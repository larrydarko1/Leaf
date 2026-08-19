#!/usr/bin/env node
/**
 * Document-level standards gate for the renderer shell.
 *   1. THE DOCUMENT SHELL. src/renderer/index.html is the one file ESLint's Vue
 *      parser never reads — no rule can assert `lang` or a charset exists.
 *   2. THE CONTENT-SECURITY-POLICY META TAG. In a packaged build the renderer
 *      loads over `file://`, where there is no server to send a CSP header, so
 *      this tag IS the policy. It is also the only thing standing between a
 *      malicious note — markdown is rendered, and there are `v-html` sites — and
 *      script execution inside a window that can talk to the main process.
 *      Checked positively (the locked directives must be present) and negatively
 *      (`unsafe-eval` and remote script/connect origins must not appear), because
 *      a CSP degrades silently: a directive someone widened still parses, still
 *      loads the app, and reports nothing.
 *   3. NO REMOTE SUBRESOURCES. Leaf's claim is that nothing leaves the device.
 *      A single remote `<script>`/`<link>` in the shell breaks that claim, at
 *      the one point where CSP is also the only guard.
 *   4. THE REDUCED-MOTION ESCAPE HATCH. 84 transition/animation declarations are
 *      spread across 26 SFCs; one global override is what makes all of them
 *      honour `prefers-reduced-motion`. Stylelint can police how a rule is
 *      written but not that a rule still EXISTS, and deleting it would be
 *      invisible in review and silent at runtime.
 * NOT CHECKED, deliberately — this is a packaged desktop app, not a web page:
 *   - `<meta name="viewport">`, `theme-color`, `<link rel="icon">`. There is no
 *     mobile viewport, no browser chrome and no tab; the window icon comes from
 *     BrowserWindow (`icon:`) and electron-builder.
 *   - `<title>`. src/main/index.ts sets `title: ''` on purpose. A `<title>` here
 *     would override the window title the main process chose.
 *   - og:*, twitter:*, canonical, `<meta name="description">`. Nothing crawls a
 *     `file://` document. Requiring them would be cargo cult.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

const INDEX_HTML = 'src/renderer/index.html';
const BASE_SCSS = 'src/renderer/styles/base.scss';

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read(INDEX_HTML);

// ── 1. Document shell ────────────────────────────────────────────────────────
const REQUIRED_HEAD = [
    {
        what: '<html lang="…">',
        re: /<html[^>]+\blang="[a-z]{2}[^"]*"/i,
        why: 'Screen readers pick pronunciation from it on load, before any locale the app selects later.',
    },
    {
        what: '<meta charset>',
        re: /<meta[^>]+charset=/i,
        why: 'Without it the renderer guesses the encoding — and notes are UTF-8 text with arbitrary content.',
    },
    {
        what: '<div id="app">',
        re: /<div[^>]+id="app"/i,
        why: 'The mount point src/renderer/main.ts calls `.mount("#app")` on. Rename it and the app renders nothing, with no error.',
    },
];

for (const { what, re, why } of REQUIRED_HEAD) {
    if (!re.test(html)) fail(INDEX_HTML, `is missing ${what}`, why);
}

// ── 2. The Content-Security-Policy meta tag ──────────────────────────────────
const cspMatch = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);

if (cspMatch === null) {
    fail(
        INDEX_HTML,
        'has no Content-Security-Policy meta tag',
        'In a packaged build the renderer loads over file:// — there is no server to send a CSP header, so this tag is the entire policy.',
    );
} else {
    const csp = cspMatch[1].replace(/\s+/g, ' ').trim();

    /** Directives that must be present, and locked to the value given. */
    const REQUIRED_DIRECTIVES = [
        {
            what: "default-src 'self'",
            re: /default-src\s+'self'/,
            why: 'The backstop every directive without an explicit rule falls through to. Widen it and every unlisted fetch type opens at once.',
        },
        {
            what: "object-src 'none'",
            re: /object-src\s+'none'/,
            why: '<object>/<embed> load plugin content that is not covered by script-src — a bypass that looks like nothing.',
        },
        {
            what: "base-uri 'none'",
            re: /base-uri\s+'none'/,
            why: 'An injected <base> rewrites every relative URL in the document, including the entry script, without touching script-src.',
        },
        {
            what: "form-action 'none'",
            re: /form-action\s+'none'/,
            why: 'A local-first app never posts anywhere. Without this, injected markup can exfiltrate via a form submit, which no other directive covers.',
        },
        {
            what: 'frame-ancestors or a frame-src bound to leaf:',
            re: /frame-(ancestors|src)\s+[^;]+/,
            why: 'The PDF preview uses an iframe; the policy has to say which schemes may fill one.',
        },
    ];

    for (const { what, re, why } of REQUIRED_DIRECTIVES) {
        if (!re.test(csp)) fail(INDEX_HTML, `CSP is missing \`${what}\``, why);
    }

    /** Values that must never appear. A CSP that was widened still parses. */
    const BANNED = [
        {
            what: "'unsafe-eval'",
            re: /'unsafe-eval'/,
            why: 'Vue SFCs are precompiled and vue-i18n v10+ uses the CSP-safe JIT compiler, so nothing here needs it. Its presence means something started evaluating strings.',
        },
        {
            what: "'unsafe-inline' in script-src",
            re: /script-src[^;]*'unsafe-inline'/,
            why: 'Turns every injection point in rendered markdown into script execution. (style-src may keep it — Vue :style bindings need it.)',
        },
        {
            what: "a wildcard host ('*')",
            re: /(?:^|\s)\*(?:\s|;|$)/,
            why: 'A local-first app has no origin to reach. A wildcard is a network egress path in the one policy that was supposed to forbid one.',
        },
    ];

    for (const { what, re, why } of BANNED) {
        if (re.test(csp)) fail(INDEX_HTML, `CSP contains ${what}`, why);
    }

    /**
     * Remote origins. localhost/127.0.0.1 is the Vite HMR socket, which only
     * exists in dev and cannot resolve in a packaged build.
     */
    for (const m of csp.matchAll(/\b(https?|wss?):\/\/([^\s;]+)/g)) {
        const host = m[2];
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(host)) {
            fail(
                INDEX_HTML,
                `CSP allows the remote origin \`${m[0]}\``,
                'Nothing in Leaf may reach the network. Only the dev-server HMR socket on localhost is permitted here.',
            );
        }
    }
}

// ── 3. No remote subresources in the shell ───────────────────────────────────
for (const m of html.matchAll(/<(script|link|img)\b[^>]*\b(?:src|href)="(https?:)?\/\/[^"]*"/gi)) {
    fail(
        INDEX_HTML,
        `loads a remote subresource: \`${m[0].slice(0, 60)}…\``,
        'Every asset ships inside the app. A remote one is a network request on launch and a build that stops being reproducible.',
    );
}

// ── 4. The reduced-motion escape hatch ───────────────────────────────────────
const baseScss = read(BASE_SCSS);
const reducedMotionBlocks = [...baseScss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\s*\}/g)];

const hasGlobalOverride = reducedMotionBlocks.some(([, body]) => /animation[^:]*:\s*none|animation-duration|transition[^:]*:\s*none|transition-duration/.test(body));

if (reducedMotionBlocks.length === 0) {
    fail(
        BASE_SCSS,
        'has no `@media (prefers-reduced-motion: reduce)` block',
        'It is the only place the 84 transition/animation declarations across 26 SFCs can be switched off at once.',
    );
} else if (!hasGlobalOverride) {
    fail(
        BASE_SCSS,
        'has a reduced-motion block, but none of them neutralises transitions/animations',
        'Guarding only `scroll-behavior` leaves the other 84 declarations running. The block needs a global rule zeroing animation and transition duration.',
    );
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ HTML standards check failed — ${failures.length} problem(s):\n`);
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

console.log('✓ HTML standards check passed — document shell, CSP directives, no remote subresources, reduced-motion override intact.');
