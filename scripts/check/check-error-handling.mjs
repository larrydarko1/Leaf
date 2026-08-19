#!/usr/bin/env node
/**
 * Error-handling gate.
 *   1. EVERY IPC HANDLER CONTAINS ITS OWN FAILURES. A throw inside
 *      `ipcMain.handle` does reach the renderer — as a rejected promise whose
 *      message has been flattened to a string and prefixed with
 *      "Error invoking remote method". The type is gone, the stack is the
 *      preload's, and any field the error carried is gone with it. So a handler
 *      catches its own failures and returns `{ success: false, error }`, which is
 *      why all 56 of them already do. This is the rule that keeps the 57th
 *      honest, because nothing about writing a throw here looks wrong.
 *   2. HANDLERS DO NOT THROW AT THEIR TOP LEVEL. The specific shape rule 1 misses:
 *      a `throw` reachable outside any try in the handler body — often a guard
 *      clause added later, above the try, where it reads perfectly.
 *   3. BOTH PROCESS-LEVEL BACKSTOPS EXIST. `uncaughtException` AND
 *      `unhandledRejection`. The app's startup and shutdown are `void`ed promise
 *      chains (`void app.whenReady().then(...)`), so a rejection in either has
 *      nowhere to surface: no window, no console the user will ever see, and in
 *      the default Node configuration it terminates the process. Without the
 *      handler, the entire diagnostic is that the app closed.
 *   4. SHUTDOWN RELEASES THE NATIVE HANDLES. node-llama-cpp holds a model in
 *      memory, whisper holds an ONNX session, and the vault holds an fs watcher.
 *      A `before-quit` that forgets one leaves a process that has closed its
 *      window but not exited — which presents to the user as the app failing to
 *      quit, and to the next launch as a port or file lock already taken.
 *   5. A SWALLOWED FAILURE STATES ITS REASON. `no-empty` already rejects a truly
 *      empty block, and it accepts any comment at all — so it cannot ask the
 *      question that matters, which is why this particular failure is safe to
 *      drop. Every one of the 11 swallows in this codebase answers it
 *      (`/* doesn't exist yet — good *\/`); this keeps that true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';
import { stripComments } from '../lib/strip-comments.mjs';

const MAIN_INDEX = 'src/main/index.ts';
const MAIN_DIR = 'src/main';
const RENDERER_DIR = 'src/renderer';

/** Services holding a resource the OS does not reclaim when the window closes. */
const CLEANUP_REQUIRED = [
    ['fsService', 'holds the vault fs watcher — an active watcher keeps the event loop alive after the window is gone.'],
    ['aiService', 'holds a node-llama-cpp model and its context, which are gigabytes of native memory outside the JS heap.'],
    ['speechService', 'holds the whisper ONNX session — a native handle with its own threads.'],
];

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

/**
 * From `start`, return the body of the callback that follows.
 *
 * The body has to be located from the `=>`, not from the first `{`: these
 * handlers annotate their return type inline (`Promise<{ success: boolean }>`),
 * so the first brace after the channel name belongs to the TYPE. Reading from
 * there yields the annotation and then spills into the next handler, which makes
 * every check downstream quietly wrong.
 *
 * Returns `{ body, expression }` — `expression: true` for a concise arrow body
 * (`() => getStatus()`), which has no statements and therefore no try block.
 */
function callbackBody(source, start) {
    const arrow = source.indexOf('=>', start);
    if (arrow === -1) return { body: '', expression: false };

    let i = arrow + 2;
    while (i < source.length && /\s/.test(source[i])) i++;

    if (source[i] !== '{') {
        // Concise body: up to the comma or paren that closes the handle() call.
        let depth = 0;
        for (let j = i; j < source.length; j++) {
            const ch = source[j];
            if ('([{'.includes(ch)) depth++;
            else if (')]}'.includes(ch)) {
                if (depth === 0) return { body: source.slice(i, j), expression: true };
                depth--;
            }
        }
        return { body: source.slice(i), expression: true };
    }

    let depth = 0;
    for (let j = i; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') {
            depth--;
            if (depth === 0) return { body: source.slice(i + 1, j), expression: false };
        }
    }
    return { body: source.slice(i + 1), expression: false };
}

/** Strip every `try { … } catch { … }` so what remains is the unguarded code. */
function outsideTry(body) {
    let out = body;
    for (;;) {
        const at = out.indexOf('try');
        if (at === -1) return out;
        const open = out.indexOf('{', at);
        if (open === -1) return out;
        let depth = 0;
        let end = out.length;
        for (let i = open; i < out.length; i++) {
            if (out[i] === '{') depth++;
            else if (out[i] === '}') {
                depth--;
                if (depth === 0) {
                    end = i + 1;
                    break;
                }
            }
        }
        // Consume the trailing catch/finally blocks too.
        const rest = out.slice(end);
        const tail = rest.match(/^\s*(?:catch\s*(?:\([^)]*\))?\s*\{|finally\s*\{)/);
        if (tail === null) {
            out = out.slice(0, at) + out.slice(end);
            continue;
        }
        let d2 = 0;
        let e2 = end;
        for (let i = end + tail[0].length - 1; i < out.length; i++) {
            if (out[i] === '{') d2++;
            else if (out[i] === '}') {
                d2--;
                if (d2 === 0) {
                    e2 = i + 1;
                    break;
                }
            }
        }
        out = out.slice(0, at) + out.slice(e2);
    }
}

const mainFiles = walk(MAIN_DIR, /\.ts$/);

// ── 1/2. Every IPC handler contains its own failures ─────────────────────────
let handlerCount = 0;

for (const rel of mainFiles) {
    const source = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

    for (const m of source.matchAll(/\b(?:ipcMain|ipc)\.handle\(\s*'([^']+)'/g)) {
        handlerCount++;
        const channel = m[1];
        const { body, expression } = callbackBody(source, m.index + m[0].length);
        const line = source.slice(0, m.index).split('\n').length;

        const guarded = /try\s*\{/.test(body);
        const envelope = /success:\s*false/.test(body);

        /**
         * Only a handler that can actually fail owes containment. A concise
         * synchronous getter (`() => getStatus()`) reads state already in memory:
         * wrapping it would add a branch no test could ever reach.
         */
        const fallible = !expression && /\bawait\b|\bthrow\b|\bfs\.|readFile|writeFile|existsSync/.test(body);

        if (fallible && !guarded && !envelope) {
            fail(
                `${rel}:${line}`,
                `\`${channel}\` neither try/catches nor returns a failure envelope`,
                'A throw crossing IPC arrives as a flattened string prefixed "Error invoking remote method" — no type, no stack, no fields. Catch it and return `{ success: false, error }`.',
            );
            continue;
        }

        if (expression) continue;
        const unguarded = outsideTry(body);
        if (/\bthrow\b/.test(unguarded)) {
            fail(
                `${rel}:${line}`,
                `\`${channel}\` has a \`throw\` outside its try block`,
                'Usually a guard clause added above the try later. It reads correctly and it is the one path whose error reaches the renderer unstructured.',
            );
        }
    }
}

// ── 3. Process-level backstops ───────────────────────────────────────────────
const mainIndex = stripComments(fs.readFileSync(path.join(ROOT, MAIN_INDEX), 'utf8'));

for (const [event, why] of [
    ['uncaughtException', 'The last line of defence. Without it a synchronous throw anywhere in the main process exits the app with nothing written down.'],
    [
        'unhandledRejection',
        'Startup and shutdown are `void`ed promise chains, so a rejection in either has no catch and no console a user will see. In the default Node configuration it terminates the process, and the whole diagnostic is that the app closed.',
    ],
]) {
    if (!new RegExp(`process\\.on\\(\\s*'${event}'`).test(mainIndex)) {
        fail(MAIN_INDEX, `registers no \`process.on('${event}')\` handler`, why);
    }
}

// ── 4. Shutdown releases the native handles ──────────────────────────────────
if (!/app\.on\(\s*'before-quit'/.test(mainIndex)) {
    fail(MAIN_INDEX, "has no `before-quit` handler", 'It is the only hook that runs while the services still exist. Without it the model, the ONNX session and the fs watcher are never released.');
} else {
    const { body: quitBody } = callbackBody(mainIndex, mainIndex.search(/app\.on\(\s*'before-quit'/));
    for (const [service, why] of CLEANUP_REQUIRED) {
        if (!new RegExp(`${service}\\.cleanup\\(`).test(quitBody)) {
            fail(MAIN_INDEX, `\`before-quit\` never calls \`${service}.cleanup()\``, `It ${why}`);
        }
    }
}

// ── 5. A swallowed failure states its reason ─────────────────────────────────
let swallows = 0;

for (const rel of [...mainFiles, ...walk(RENDERER_DIR, /\.(ts|vue)$/)]) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    for (const m of raw.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\}/g)) {
        const body = m[1];
        // Only a swallow if nothing is logged, rethrown or returned.
        if (/\b(throw|return|log\.|console\.|electronAPI\.log)\b/.test(body)) continue;
        if (stripComments(body).trim() !== '') continue;

        swallows++;
        if (!/\/\*[\s\S]*?\*\/|\/\/[^\n]*/.test(body)) {
            const line = raw.slice(0, m.index).split('\n').length;
            fail(
                `${rel}:${line}`,
                'swallows a failure with no stated reason',
                'Dropping an error is sometimes right, but only the author knows why this one is safe to lose. `no-empty` accepts any comment; it cannot ask for the reason. Write it.',
            );
        }
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ Error handling check failed — ${failures.length} problem(s):\n`);
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
    `✓ Error handling check passed — ${handlerCount} IPC handlers contain their own failures, both process backstops present, shutdown releases ${CLEANUP_REQUIRED.length} native handles, ${swallows} swallows all state a reason.`,
);
