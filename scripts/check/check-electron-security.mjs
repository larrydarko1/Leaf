#!/usr/bin/env node
/**
 * Electron security gate — the process-model invariants.
 *   1.  THE webPreferences INVARIANTS. contextIsolation, nodeIntegration, sandbox.
 *       These are the whole process model. `nodeIntegration: true` hands `require`
 *       to a window rendering user content; `contextIsolation: false` lets that
 *       content reach into the preload's scope and rewrite the API surface. Both
 *       are one word each, and neither changes anything you can see.
 *   2.  BANNED webPreferences KEYS. webviewTag, allowRunningInsecureContent,
 *       experimentalFeatures, nodeIntegrationInWorker/InSubFrames, enableRemoteModule.
 *       Each re-opens something the defaults already closed.
 *   3.  EVERY WINDOW DECLARES A PRELOAD. A BrowserWindow with no preload has no
 *       API — but it also inherits nothing, so a second window added later for a
 *       print preview or an about box is the one nobody re-audits.
 *   4.  setWindowOpenHandler DENIES. Without it `target="_blank"` in rendered
 *       markdown opens a full Electron window on a remote origin, with its own
 *       webPreferences that nothing here configured.
 *   5.  will-navigate IS GUARDED. A link that navigates the app window away
 *       replaces the app with a remote page inside a process that already has a
 *       preload bridge attached.
 *   6.  NO `new-window` HANDLER. Removed in Electron 22. A handler there never
 *       fires — it is dead code shaped exactly like a security control, which is
 *       worse than an absence, because review reads it and stops looking.
 *   7.  BOTH PERMISSION HANDLERS EXIST AND DEFAULT TO DENY. Over `file://`
 *       Electron denies by default, so the moment a handler is added to allow the
 *       microphone it becomes the entire policy — and a handler that forgets its
 *       else-branch grants everything.
 *   8.  THE CUSTOM PROTOCOL CHECKS ITS BOUNDARY. `leaf://` is a file-read
 *       primitive callable from renderer JavaScript. Without a containment check
 *       it reads any path on the disk, and `..` in a URL is all it takes.
 *   9.  THE PRIVILEGED SCHEME DOES NOT BYPASS CSP. `bypassCSP: true` on leaf://
 *       would exempt every embed from the policy in index.html.
 *  10.  shell.openExternal IS SCHEME-GUARDED. Unguarded it hands the OS any URL a
 *       note contains — `file://`, `smb://`, on Windows a `.lnk` — which is
 *       arbitrary local execution reached by clicking a link.
 *  11.  NO UNESCAPED HTML SINKS. `document.write`/`outerHTML`/`insertAdjacentHTML`
 *       are banned, and an `innerHTML` assignment may not interpolate anything
 *       that has not been escaped or sanitised.
 *  12.  EVERY `v-html` SITE IS ACCOUNTED FOR. Whether a binding is safe depends on
 *       where its string came from, which no regex can decide — so the two known
 *       sites are listed with their reason and any NEW one fails until someone
 *       writes down why it is safe.
 *  13.  NO REGEXP BUILT FROM UNESCAPED INPUT. Note and file names reach three
 *       `new RegExp` call sites. Unescaped, a name containing `(` throws at
 *       runtime and a name containing `(.*)+` is a ReDoS.
 *  14.  NO TLS OR CERTIFICATE OVERRIDES. Nothing here talks to the network, so
 *       any appearance of these is a change of posture, not a configuration.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';
import { stripComments } from '../lib/strip-comments.mjs';

const MAIN_DIR = 'src/main';
const RENDERER_DIR = 'src/renderer';

/**
 * The `v-html` bindings that exist, and why each is safe. A new one fails this
 * gate on purpose: the judgement is human, so it should cost a line of prose.
 */
const VHTML_ALLOWED = new Map([
    [
        'src/renderer/components/drawing/DrawingToolbar.vue',
        '`shape.icon` is a static internal SVG table defined in the component — never user input.',
    ],
    [
        'src/renderer/components/ai/AiMessageList.vue',
        'Model output, rendered by `renderWithCopyBtns` → `renderMarkdown` in useAIChat.ts, which passes it through DOMPurify with an ALLOWED_TAGS allowlist.',
    ],
]);

/** Callables whose output is already escaped or sanitised. */
const SAFE_WRAPPERS = /\b(escapeHtml|DOMPurify\.sanitize|sanitize|renderInline)\s*\(/;

/** The metacharacter escape that makes a string safe to embed in a RegExp. */
const REGEX_ESCAPE = /\.replace\(\s*\/\[\.\*\+\?\^\$\{\}\(\)\|\[\\\]\\\\\]\/g/;

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });

function walk(dir, exts, out = []) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel, exts, out);
        else if (exts.test(entry.name)) out.push(rel);
    }
    return out;
}

const mainFiles = walk(MAIN_DIR, /\.ts$/);
const rendererFiles = walk(RENDERER_DIR, /\.(ts|vue)$/);
const mainSource = mainFiles.map((rel) => [rel, stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'))]);
const allMain = mainSource.map(([, code]) => code).join('\n');

// ── 1/2/3. webPreferences on every BrowserWindow ─────────────────────────────
const REQUIRED_PREFS = [
    {
        key: 'contextIsolation',
        re: /contextIsolation:\s*true/,
        why: 'It is the barrier between the preload’s scope and the page. Without it, rendered content can reach in and redefine the API the renderer trusts.',
    },
    {
        key: 'nodeIntegration',
        re: /nodeIntegration:\s*false/,
        why: 'Set true, a window rendering arbitrary markdown gets `require` — and with it the filesystem, child_process and the network.',
    },
    {
        key: 'sandbox',
        re: /sandbox:\s*true/,
        why: 'Puts the renderer in an OS-level sandbox, so a Chromium RCE still lands somewhere with no filesystem. Requires the CommonJS preload electron.vite.config.ts emits.',
    },
];

const BANNED_PREFS = [
    { key: 'webviewTag', why: '<webview> creates a nested renderer whose webPreferences this configuration does not govern.' },
    { key: 'allowRunningInsecureContent', why: 'Permits http subresources inside the app document, which is a downgrade path for everything CSP protects.' },
    { key: 'experimentalFeatures', why: 'Enables unshipped Blink features — code paths that have not been through Chromium’s security review.' },
    { key: 'enableRemoteModule', why: 'The old `remote` module hands the renderer live main-process objects. Removed in modern Electron; its presence means someone was following a pre-Electron-14 guide.' },
    { key: 'nodeIntegrationInWorker', why: 'Grants Node to Web Workers, bypassing the main window’s nodeIntegration: false.' },
    { key: 'nodeIntegrationInSubFrames', why: 'Grants Node to iframes — including the leaf:// PDF preview frame.' },
];

const windowBlocks = [...allMain.matchAll(/new BrowserWindow\(\s*\{([\s\S]*?)\n\s{4}\}\)/g)];

if (windowBlocks.length === 0) {
    fail(`${MAIN_DIR}/index.ts`, 'no `new BrowserWindow({...})` call found', 'This gate reads its webPreferences. If the window is constructed some other way, update the matcher here — do not leave it reading nothing.');
}

for (const [, block] of windowBlocks) {
    for (const { key, re, why } of REQUIRED_PREFS) {
        if (!re.test(block)) {
            const present = new RegExp(`${key}:`).test(block);
            fail(
                `${MAIN_DIR}/index.ts`,
                present ? `webPreferences.${key} is not set to the required value` : `webPreferences is missing \`${key}\``,
                why,
            );
        }
    }
    for (const { key, why } of BANNED_PREFS) {
        if (new RegExp(`${key}:\\s*true`).test(block)) {
            fail(`${MAIN_DIR}/index.ts`, `webPreferences sets \`${key}: true\``, why);
        }
    }
    if (/webSecurity:\s*false/.test(block)) {
        fail(
            `${MAIN_DIR}/index.ts`,
            'webPreferences sets `webSecurity: false`',
            'It disables the same-origin policy for the whole window. Local media is served through the leaf:// protocol precisely so this never has to be touched.',
        );
    }
    if (!/preload:/.test(block)) {
        fail(`${MAIN_DIR}/index.ts`, 'a BrowserWindow declares no `preload`', 'A window with no preload has no vetted API surface, and it inherits none of the review the main window got.');
    }
}

// ── 4/5/6. Navigation containment ────────────────────────────────────────────
if (!/setWindowOpenHandler\(/.test(allMain)) {
    fail(`${MAIN_DIR}/index.ts`, 'registers no `setWindowOpenHandler`', 'Without it `target="_blank"` in rendered markdown opens a real Electron window on a remote origin.');
} else {
    const handler = allMain.match(/setWindowOpenHandler\(([\s\S]*?)\n\s{4}\}\)/);
    // Matched on the `return` itself: the handler's TYPE annotation also reads
    // `{ action: 'deny' }`, so a looser match passes even when the value changed.
    if (handler !== null && !/return\s*\{\s*action:\s*'deny'\s*\}/.test(handler[1])) {
        fail(`${MAIN_DIR}/index.ts`, 'setWindowOpenHandler does not return `action: \'deny\'`', 'Anything but deny creates a window whose webPreferences this file did not configure. External links belong in the OS browser via shell.openExternal.');
    }
}

if (!/on\(\s*'will-navigate'/.test(allMain)) {
    fail(`${MAIN_DIR}/index.ts`, 'has no `will-navigate` handler', 'A link that navigates the app window away replaces the app with a remote page in a process that still has the preload bridge attached.');
} else {
    const nav = allMain.match(/on\(\s*'will-navigate'[\s\S]*?\n\s{4}\}\)/);
    if (nav !== null && !/preventDefault\(\)/.test(nav[0])) {
        fail(`${MAIN_DIR}/index.ts`, 'the `will-navigate` handler never calls `preventDefault()`', 'Observing a navigation without cancelling it lets it proceed. The handler reads like a guard and stops nothing.');
    }
}

if (/on\(\s*'new-window'/.test(allMain)) {
    fail(
        `${MAIN_DIR}/index.ts`,
        "registers a 'new-window' handler",
        'That event was removed in Electron 22 — the handler never runs. It is dead code shaped like a security control, which stops review looking for the real one (setWindowOpenHandler).',
    );
}

// ── 7. Permission handlers, defaulting to deny ───────────────────────────────
for (const [name, why] of [
    ['setPermissionRequestHandler', 'Handles a live request (the microphone prompt for dictation). Absent, Electron’s file:// default denies everything — so adding one makes it the entire policy.'],
    ['setPermissionCheckHandler', 'Answers `navigator.permissions.query`. Without it a renderer can be told it holds a permission the request handler would refuse, and the two answers disagree.'],
]) {
    if (!new RegExp(`${name}\\(`).test(allMain)) {
        fail(`${MAIN_DIR}/index.ts`, `registers no \`${name}\``, why);
        continue;
    }
    const body = allMain.match(new RegExp(`${name}\\(([\\s\\S]*?)\\n\\s{4}\\}\\)`));
    if (body !== null && !/callback\(false\)|return false/.test(body[1])) {
        fail(
            `${MAIN_DIR}/index.ts`,
            `\`${name}\` has no deny path`,
            'A permission handler must be an allowlist: name the one permission you grant and refuse the rest. With no deny branch it grants everything it was added to restrict.',
        );
    }
}

// ── 8/9. The custom protocol ─────────────────────────────────────────────────
const protocolHandler = allMain.match(/protocol\.handle\(\s*'([a-z]+)'\s*,([\s\S]*?)\n\s{4}\}\)/);
if (protocolHandler !== null) {
    const [, scheme, body] = protocolHandler;
    if (!/isInsideBoundary|isInside|withinRoot|startsWith\(\s*root/.test(body)) {
        fail(
            `${MAIN_DIR}/index.ts`,
            `the \`${scheme}://\` handler does not check that the path is inside the vault`,
            'It is a file-read primitive any renderer script can call. Without containment it serves any path on the disk, and `..` in the URL is the whole exploit.',
        );
    }
    if (!/status:\s*403/.test(body)) {
        fail(
            `${MAIN_DIR}/index.ts`,
            `the \`${scheme}://\` handler never returns 403`,
            'A denied read has to be a refusal. Falling through to a normal fetch turns the containment check into a comment.',
        );
    }
}

const privileged = allMain.match(/registerSchemesAsPrivileged\(([\s\S]*?)\n\]\)/);
if (privileged !== null && /bypassCSP:\s*true/.test(privileged[1])) {
    fail(
        `${MAIN_DIR}/index.ts`,
        'a privileged scheme sets `bypassCSP: true`',
        'Every resource loaded through that scheme would then be exempt from the policy in index.html — which is the only CSP a file:// renderer has.',
    );
}

// ── 10. shell.openExternal is scheme-guarded ─────────────────────────────────
for (const [rel, code] of mainSource) {
    for (const m of code.matchAll(/shell\.openExternal\(([^)]*)\)/g)) {
        const line = code.slice(0, m.index).split('\n').length;
        const context = code.slice(Math.max(0, m.index - 400), m.index);
        if (!/https?:\/\//.test(context) && !/startsWith\(\s*'https?:/.test(context)) {
            fail(
                `${rel}:${line}`,
                `calls shell.openExternal(${m[1].trim().slice(0, 30)}) with no visible http/https check`,
                'openExternal hands the string to the OS. A `file://` or `smb://` URL from a note becomes local execution reached by clicking a link.',
            );
        }
    }
}

// ── 11. HTML sinks in the renderer ───────────────────────────────────────────
for (const rel of rendererFiles) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

    for (const sink of ['document.write', 'outerHTML', 'insertAdjacentHTML']) {
        if (code.includes(sink)) {
            const line = code.slice(0, code.indexOf(sink)).split('\n').length;
            fail(
                `${rel}:${line}`,
                `uses \`${sink}\``,
                'Parses its argument as HTML with no escaping stage. Build the node and set textContent, or route the string through DOMPurify.',
            );
        }
    }

    // An innerHTML assignment may not interpolate anything unescaped.
    for (const m of code.matchAll(/\.innerHTML\s*=\s*`([^`]*)`/g)) {
        const template = m[1];
        for (const interp of template.matchAll(/\$\{([^}]*)\}/g)) {
            if (!SAFE_WRAPPERS.test(interp[1])) {
                const line = code.slice(0, m.index).split('\n').length;
                fail(
                    `${rel}:${line}`,
                    `interpolates \`${interp[1].trim().slice(0, 40)}\` into innerHTML without escaping`,
                    'Note and file names reach these widgets. Wrap it in escapeHtml() — or add the helper to SAFE_WRAPPERS in this gate if it already escapes.',
                );
            }
        }
    }
}

// ── 12. v-html sites ─────────────────────────────────────────────────────────
for (const rel of rendererFiles.filter((f) => f.endsWith('.vue'))) {
    const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (!/\bv-html\b/.test(source)) continue;
    if (!VHTML_ALLOWED.has(rel)) {
        const line = source.slice(0, source.search(/\bv-html\b/)).split('\n').length;
        fail(
            `${rel}:${line}`,
            'introduces a new `v-html` binding',
            'v-html bypasses Vue’s escaping entirely. Whether that is safe depends on where the string came from, so add the file to VHTML_ALLOWED in this gate with the reason it cannot carry untrusted markup.',
        );
    }
}
for (const rel of VHTML_ALLOWED.keys()) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full) || !/\bv-html\b/.test(fs.readFileSync(full, 'utf8'))) {
        fail(rel, 'is listed in VHTML_ALLOWED but no longer uses `v-html`', 'Drop the entry. A stale exemption is one that silently covers the next binding added to this file.');
    }
}

// ── 13. RegExp built from input ──────────────────────────────────────────────
for (const rel of [...mainFiles, ...rendererFiles]) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    for (const m of code.matchAll(/new RegExp\(\s*`([^`]*)`/g)) {
        for (const interp of m[1].matchAll(/\$\{([^}]*)\}/g)) {
            const name = interp[1].trim();
            if (/^\\\\/.test(name)) continue;
            const escapedHere = REGEX_ESCAPE.test(code) && new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=[\\s\\S]{0,120}?\\.replace\\(`).test(code);
            if (!escapedHere) {
                const line = code.slice(0, m.index).split('\n').length;
                fail(
                    `${rel}:${line}`,
                    `builds a RegExp from \`${name.slice(0, 30)}\` with no metacharacter escape`,
                    'A file name containing `(` throws at runtime; one containing `(a+)+` is a ReDoS that hangs the process. Escape it with `.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\')` first.',
                );
            }
        }
    }
}

// ── 14. TLS / certificate overrides ──────────────────────────────────────────
for (const [rel, code] of mainSource) {
    for (const bad of ['setCertificateVerifyProc', 'ignoreCertificateErrors', "'certificate-error'"]) {
        if (code.includes(bad)) {
            const line = code.slice(0, code.indexOf(bad)).split('\n').length;
            fail(
                `${rel}:${line}`,
                `uses \`${bad}\``,
                'Leaf makes no network requests, so there is no certificate to have an opinion about. Its appearance means something started talking to a server.',
            );
        }
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ Electron security check failed — ${failures.length} problem(s):\n`);
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
    `✓ Electron security check passed — process model, navigation containment, permissions, leaf:// boundary, HTML sinks (${VHTML_ALLOWED.size} v-html sites accounted for), RegExp inputs.`,
);
