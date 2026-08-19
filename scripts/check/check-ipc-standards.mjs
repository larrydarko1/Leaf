#!/usr/bin/env node
/**
 * IPC architecture gate.
 *   1. CHANNEL DOCUMENTATION PARITY. src/main/index.ts opens with an "IPC handler
 *      ownership" table mapping each service to the channels it owns. Nothing
 *      enforced it, so it rots: a stale table is worse than none, because it is a
 *      map that confidently points the wrong way and review trusts it. Checked in
 *      both directions — an undocumented channel AND a documented pattern that
 *      matches nothing.
 *   2. EVERY CHANNEL THE PRELOAD CALLS HAS A HANDLER. A channel name is a string
 *      in two files. Rename one side and `invoke` rejects with "No handler
 *      registered for …" the first time a user touches that feature — not at
 *      build time, not in a type check, and not in any test that mocks the bridge.
 *      This is the single highest-value rule in the file.
 *   3. EVERY EVENT THE PRELOAD LISTENS FOR IS ACTUALLY SENT. The reverse
 *      direction, and it fails even more quietly: `ipcRenderer.on` for a channel
 *      nothing sends is a listener that simply never fires. Streaming AI tokens
 *      and file-watcher events both ride these, so the symptom is "the feature
 *      hangs", with no error anywhere.
 *   4. NO UNREACHABLE HANDLERS. A handler the preload never calls is dead code
 *      that is also live attack surface: it stays callable by anything running in
 *      the renderer. `knip` cannot see it, because the channel is a string.
 *   5. NO GENERIC PASSTHROUGH. The preload must not expose `ipcRenderer` itself,
 *      nor any function that takes a channel name as an argument. Either one
 *      turns the explicit API into "the renderer may call anything", which is
 *      precisely the boundary contextIsolation exists to create.
 *   6. ONE BRIDGE, TYPED AGAINST THE SHARED CONTRACT. A single
 *      `exposeInMainWorld`, and the object annotated `ElectronAPI` so the preload
 *      and the renderer's `window.electronAPI` cannot drift.
 *   7. EVERY HANDLER VALIDATES ITS ARGUMENTS. Arguments arrive from the renderer
 *      and TypeScript types are erased at runtime, so a declared `string` is
 *      whatever actually came over the wire. These handlers join paths and read
 *      files; an unchecked argument is a path-traversal parameter.
 *   8. CHANNEL NAMING: `domain:action`, lowercase domain, camelCase action, and
 *      no verb that merely repeats the domain.                             → check-error-handling.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';
import { stripComments } from '../lib/strip-comments.mjs';

const MAIN_INDEX = 'src/main/index.ts';
const SERVICES_DIR = 'src/main/services';
const PRELOAD = 'src/preload/index.ts';
const API_CONTRACT = 'src/schemas/electron.d.ts';

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (rel) => stripComments(read(rel));

// ── Collect the real surface ──────────────────────────────────────────────────
// The raw source, because rule 1 reads the ownership table out of its header comment.
const mainIndexRaw = read(MAIN_INDEX);

const serviceFiles = fs
    .readdirSync(path.join(ROOT, SERVICES_DIR))
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => `${SERVICES_DIR}/${f}`);

/** channel → owning file, for everything registered with handle() or on(). */
const handlers = new Map();
/** channel → owning file, for everything pushed with webContents.send(). */
const events = new Map();

for (const rel of [MAIN_INDEX, ...serviceFiles]) {
    const source = code(rel);
    for (const m of source.matchAll(/\b(?:ipcMain|ipc)\.(?:handle|on)\(\s*'([^']+)'/g)) {
        if (handlers.has(m[1])) {
            fail(rel, `registers \`${m[1]}\`, which ${handlers.get(m[1])} already registers`, 'The second registration throws at startup for handle(), or silently double-fires for on().');
        }
        handlers.set(m[1], rel);
    }
    for (const m of source.matchAll(/\.send\(\s*'([^']+)'/g)) events.set(m[1], rel);
}

const preloadCode = code(PRELOAD);

/** channel → 'invoke' | 'send' | 'on', as the preload uses it. */
const preloadChannels = new Map();
for (const m of preloadCode.matchAll(/ipcRenderer\.(invoke|send|on)\(\s*'([^']+)'/g)) {
    preloadChannels.set(m[2], m[1]);
}

// ── 1. Channel documentation parity ───────────────────────────────────────────
const ownershipBlock = mainIndexRaw.match(/IPC handler ownership:([\s\S]*?)\n \*\//);

if (ownershipBlock === null) {
    fail(MAIN_INDEX, 'has no "IPC handler ownership:" table in its header', 'It is the only map of which service owns which channels. Without it, finding the owner of a channel means grepping five files.');
} else {
    /** `fs-service → file:*, folder:*` → { file: services/fs.ts, patterns: [...] } */
    const documented = new Map();
    for (const line of ownershipBlock[1].split('\n')) {
        // Label, then an optional parenthetical qualifier, then the channel list.
        const m = line.match(/^\s*\*\s+([a-zA-Z]+)(?:-service)?(?:\s+\([^)]*\))?\s+→\s+(.+?)\s*$/);
        if (m === null) continue;
        const owner = m[1] === 'main' ? MAIN_INDEX : `${SERVICES_DIR}/${m[1]}.ts`;
        documented.set(owner, m[2].split(',').map((p) => p.trim()).filter((p) => p !== ''));
    }

    for (const [owner, patterns] of documented) {
        if (!fs.existsSync(path.join(ROOT, owner))) {
            fail(MAIN_INDEX, `the ownership table names \`${owner}\`, which does not exist`, 'The table documents a service that was renamed or removed.');
        }
        // Every documented pattern must match at least one live channel.
        for (const pattern of patterns) {
            const re = pattern.endsWith('*') ? new RegExp(`^${pattern.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) : null;
            const matched = [...handlers.entries()].some(([channel, file]) => file === owner && (re !== null ? re.test(channel) : channel === pattern));
            if (!matched) {
                fail(
                    MAIN_INDEX,
                    `the ownership table documents \`${pattern}\` for ${path.basename(owner)}, which registers no such channel`,
                    'A stale entry is a map pointing the wrong way. Remove it, or restore the handler it describes.',
                );
            }
        }
    }

    // Every live channel must be covered by a documented pattern for its owner.
    for (const [channel, owner] of handlers) {
        const patterns = documented.get(owner);
        if (patterns === undefined) {
            fail(
                MAIN_INDEX,
                `the ownership table has no entry for ${path.basename(owner)} (which registers \`${channel}\`)`,
                'Every file registering a channel needs a row, or the table is not a map of the surface.',
            );
            continue;
        }
        const covered = patterns.some((p) => (p.endsWith('*') ? channel.startsWith(p.slice(0, -1)) : channel === p));
        if (!covered) {
            fail(
                MAIN_INDEX,
                `\`${channel}\` is registered by ${path.basename(owner)} but no documented pattern covers it`,
                'Add it to that service’s row in the ownership table. An undocumented channel is one nobody knows is part of the API.',
            );
        }
    }
}

// ── 2/3. The two directions of the channel surface ────────────────────────────
for (const [channel, kind] of preloadChannels) {
    if (kind === 'on') {
        if (!events.has(channel)) {
            fail(
                PRELOAD,
                `listens for \`${channel}\`, which nothing sends`,
                'A listener for a channel no `webContents.send` writes never fires. The feature hangs with no error — streaming tokens and file-watcher events both ride these.',
            );
        }
    } else if (!handlers.has(channel)) {
        fail(
            PRELOAD,
            `calls \`${channel}\`, which has no handler`,
            'The channel name is a string in two files, checked by nothing. `invoke` rejects with "No handler registered" the first time a user touches the feature.',
        );
    }
}

// ── 4. No unreachable handlers ────────────────────────────────────────────────
for (const [channel, owner] of handlers) {
    if (!preloadChannels.has(channel)) {
        fail(
            owner,
            `registers \`${channel}\`, which the preload never calls`,
            'Dead code that is still live attack surface — it stays callable from the renderer. knip cannot see it, because the channel is a string.',
        );
    }
}
for (const [channel, owner] of events) {
    if (!preloadChannels.has(channel)) {
        fail(owner, `sends \`${channel}\`, which the preload never listens for`, 'The push has no receiver. Whatever it was feeding stopped being wired up.');
    }
}

// ── 5. No generic passthrough ─────────────────────────────────────────────────
const exposeCalls = [...preloadCode.matchAll(/contextBridge\.exposeInMainWorld\(\s*'([^']+)'/g)];

if (/exposeInMainWorld\(\s*'[^']+'\s*,\s*ipcRenderer\s*\)/.test(preloadCode)) {
    fail(PRELOAD, 'exposes `ipcRenderer` itself', 'That hands the renderer every channel at once, plus `removeAllListeners`. The allowlist becomes decoration.');
}

for (const m of preloadCode.matchAll(/ipcRenderer\.(?:invoke|send|on)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
    fail(
        PRELOAD,
        `passes the variable \`${m[1]}\` as a channel name instead of a literal`,
        'A channel taken as an argument is a generic passthrough: the renderer chooses the channel, so the explicit surface stops being a boundary.',
    );
}

// ── 6. One bridge, typed against the shared contract ──────────────────────────
if (exposeCalls.length === 0) {
    fail(PRELOAD, 'never calls `contextBridge.exposeInMainWorld`', 'With contextIsolation on, this is the only way the renderer gets an API at all.');
} else if (exposeCalls.length > 1) {
    fail(
        PRELOAD,
        `calls exposeInMainWorld ${exposeCalls.length} times (${exposeCalls.map((m) => m[1]).join(', ')})`,
        'One bridge, one contract. A second global is a second surface that nothing types and no gate reads.',
    );
}

if (!/:\s*ElectronAPI\b/.test(preloadCode)) {
    fail(
        PRELOAD,
        'the exposed object is not annotated `ElectronAPI`',
        `The annotation is what ties this file to ${API_CONTRACT}, which is what the renderer's \`window.electronAPI\` resolves to. Without it the two sides drift and only fail at runtime.`,
    );
}

// ── 7. Every handler validates its arguments ───────────────────────────────────
for (const rel of [MAIN_INDEX, ...serviceFiles]) {
    const source = code(rel);
    for (const m of source.matchAll(/\b(?:ipcMain|ipc)\.(?:handle|on)\(\s*'([^']+)',?\s*/g)) {
        const body = source.slice(m.index + m[0].length, m.index + m[0].length + 2500);
        const signature = body.match(/^(?:async\s*)?\(([^)]*)\)/);
        if (signature === null) continue;

        const params = signature[1]
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p !== '' && !p.startsWith('_'));
        if (params.length === 0) continue;

        const validates = /safeParse|\.parse\(|typeof\s+\w+\s*[!=]==|Array\.isArray\(|\.test\(/.test(body);
        if (!validates) {
            const line = source.slice(0, m.index).split('\n').length;
            fail(
                `${rel}:${line}`,
                `\`${m[1]}\` takes ${params.length} argument(s) and validates none of them`,
                'TypeScript types are erased, so a declared `string` is whatever the renderer actually sent. These handlers join paths and read files — an unchecked argument is a traversal parameter.',
            );
        }
    }
}

// ── 8. Channel naming ─────────────────────────────────────────────────────────
for (const channel of [...handlers.keys(), ...events.keys()]) {
    const parts = channel.split(':');
    if (parts.length !== 2) {
        fail(handlers.get(channel) ?? events.get(channel), `channel \`${channel}\` is not \`domain:action\``, 'One colon, two parts. The domain is what groups the channel with its service; without it the surface is a flat list of 60 names.');
        continue;
    }
    const [domain, action] = parts;
    if (!/^[a-z][a-zA-Z]*$/.test(domain)) {
        fail(handlers.get(channel) ?? events.get(channel), `channel \`${channel}\` has a non-camelCase domain`, 'Domains are lowercase-initial camelCase (`file`, `systemPrompt`) so they sort and group predictably.');
    }
    if (!/^[a-z][a-zA-Z]*$/.test(action)) {
        fail(handlers.get(channel) ?? events.get(channel), `channel \`${channel}\` has a non-camelCase action`, 'Actions are lowercase-initial camelCase (`read`, `openLeafDir`).');
    }
    if (action.toLowerCase().startsWith(domain.toLowerCase()) && action.length > domain.length) {
        fail(handlers.get(channel) ?? events.get(channel), `channel \`${channel}\` repeats its domain in the action`, `\`${domain}:${action.slice(domain.length).replace(/^./, (c) => c.toLowerCase())}\` says the same thing.`);
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ IPC standards check failed — ${failures.length} problem(s):\n`);
    let current = '';
    for (const { file, what, why } of failures) {
        if (file !== current) {
            console.error(`  ${file}`);
            current = file;
        }
        console.error(`    • ${what}`);
        console.error(`      ${why}`);
    }
    process.exit(1);
}

console.log(
    `✓ IPC standards check passed — ${handlers.size} handlers + ${events.size} events, all documented, reachable, validated and matched by the preload's ${preloadChannels.size} channels.`,
);
