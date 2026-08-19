#!/usr/bin/env node
/**
 * SCSS architecture gate.
 *   1. THE BARREL. index.scss @forwards the token modules and @uses the ones that
 *      emit rules, and main.ts imports it exactly once. Import it twice and every
 *      global rule is emitted twice; drop the @forward and `@use '@/renderer/styles'`
 *      silently stops resolving the tokens.
 *   2. THE VITE INJECTION. `css.preprocessorOptions.scss.additionalData` in
 *      electron.vite.config.ts is what makes `$color-*` available inside every SFC
 *      without an import. Lose it and all 26 components fail to compile at once —
 *      yet nothing in the style files themselves records that they depend on it.
 *      The `index.scss` guard in that function matters too: without it the barrel
 *      @uses itself and sass fails on a circular load.
 *   3. THEME TOKEN PARITY, THREE WAYS. Theme presets are JSON under assets/themes/,
 *      seeded into ~/.leaf/themes/ where users hand-edit them, and applied by
 *      useTheme.ts as `--<key>` custom properties on <html>. So a token has three
 *      places it must agree:
 *        • the `:root` block in variables.scss — the compiled-in fallback;
 *        • every theme JSON's `colors` map;
 *        • every `var(--token)` in a stylesheet or SFC.
 *      Each mismatch fails silently and differently. A key missing from ONE theme
 *      falls back to the SCSS default, so that element is off-palette in that
 *      theme only, for whoever picked it. A key in the themes but not in `:root`
 *      has no fallback at all if a theme fails to load. A `var()` in neither
 *      renders as nothing. This is the CSS analogue of the locale parity in
 *      check-i18n.mjs, and it is the reason that gate exists.
 *   4. SELF-HOSTED EVERYTHING. No CDN `@import url()`, no remote font. Zero
 *      third-party requests is a claim about what is ABSENT from the repo, which
 *      only a sweep can check — and in a local-first app it is a privacy
 *      guarantee, not a performance preference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

const STYLES = 'src/renderer/styles';
const VARIABLES = `${STYLES}/variables.scss`;
const INDEX = `${STYLES}/index.scss`;
const MAIN_TS = 'src/renderer/main.ts';
const VITE_CONFIG = 'electron.vite.config.ts';
const THEMES_DIR = 'assets/themes';
const REFERENCE_THEME = 'dark';

/**
 * Custom properties a component sets itself through a `:style` binding, so they
 * are deliberately absent from the theme palette. Keep the reason with the name.
 */
const COMPONENT_LOCAL_VARS = new Map([
    ['scroll-distance', 'FolderNode.vue — marquee offset for a truncated name'],
    ['scroll-duration', 'FolderNode.vue — marquee duration, proportional to the name length'],
    ['volume', 'AudioViewer.vue / VideoViewer.vue — volume slider fill width'],
]);

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ── 1. The barrel ────────────────────────────────────────────────────────────
const index = read(INDEX);
const mainTs = read(MAIN_TS);

if (!/@forward\s+['"][^'"]*variables['"]/.test(index)) {
    fail(INDEX, 'does not `@forward` variables', "SFCs reach the tokens through `@use '@/renderer/styles'`, which only resolves what the barrel forwards.");
}
if (!/@use\s+['"][^'"]*base['"]/.test(index)) {
    fail(INDEX, 'does not `@use` base', 'base.scss is the only module that EMITS global rules — the reset, :root and the reduced-motion override. Un-@used, none of it reaches the bundle.');
}

const styleImports = [...mainTs.matchAll(/import\s+['"][^'"]*\.scss['"]/g)];
if (styleImports.length === 0) {
    fail(MAIN_TS, 'imports no stylesheet', `The barrel has exactly one importer, and it is this file: \`import '@/renderer/styles/index.scss'\`.`);
} else if (styleImports.length > 1) {
    fail(MAIN_TS, `imports ${styleImports.length} stylesheets`, 'The barrel is the single entry point. A second import emits every global rule twice.');
}

// ── 2. The Vite injection ────────────────────────────────────────────────────
const viteConfig = read(VITE_CONFIG);
const additionalData = viteConfig.match(/additionalData:\s*([\s\S]{0,400}?)\n\s{12}\},/);

if (!/additionalData:/.test(viteConfig)) {
    fail(
        VITE_CONFIG,
        'has no `css.preprocessorOptions.scss.additionalData`',
        'It is what prepends the token @use to every SFC style block. Without it every `$`-variable in all 26 components is an undefined-variable error.',
    );
} else {
    if (!/@use\s+['"]@\/renderer\/styles['"]\s+as\s+\*/.test(viteConfig)) {
        fail(VITE_CONFIG, 'additionalData does not inject `@use \'@/renderer/styles\' as *`', 'The `as *` is what puts the tokens in the SFC’s own namespace; without it every reference needs a prefix.');
    }
    if (additionalData !== null && !/index\.scss/.test(additionalData[1])) {
        fail(
            VITE_CONFIG,
            'additionalData does not exempt index.scss',
            'The barrel would be given a @use of itself. Sass fails the whole build on the circular load, and the message points at the wrong file.',
        );
    }
}

// ── 3. Theme token parity, three ways ────────────────────────────────────────
const variables = read(VARIABLES);

/** The `:root` block in variables.scss — the compiled-in fallback layer. */
const rootBlock = variables.match(/:root\s*\{([\s\S]*?)\n\}/);
const rootTokens = new Set();
if (rootBlock === null) {
    fail(VARIABLES, 'has no `:root` block', 'It is the fallback layer every `var(--token)` resolves against before a theme is applied.');
} else {
    for (const m of rootBlock[1].matchAll(/^\s*--([a-z0-9-]+)\s*:/gim)) rootTokens.add(m[1]);
}

/** Every theme preset's `colors` map. */
const themeFiles = exists(THEMES_DIR)
    ? fs
          .readdirSync(path.join(ROOT, THEMES_DIR))
          .filter((f) => f.endsWith('.json'))
          .sort()
    : [];

if (themeFiles.length === 0) {
    fail(THEMES_DIR, 'contains no theme presets', 'These are the bundled defaults seeded into ~/.leaf/themes/ on first launch.');
}

const themeTokens = new Map();
for (const file of themeFiles) {
    const id = file.replace(/\.json$/, '');
    let parsed;
    try {
        parsed = JSON.parse(read(`${THEMES_DIR}/${file}`));
    } catch (err) {
        fail(`${THEMES_DIR}/${file}`, `is not valid JSON — ${err.message}`, 'It is copied verbatim into ~/.leaf/themes/, so a malformed preset ships broken.');
        continue;
    }
    if (typeof parsed.name !== 'string' || parsed.name === '') {
        fail(`${THEMES_DIR}/${file}`, 'has no `name`', 'The ThemePicker lists presets by `name`; without one the entry renders blank.');
    }
    if (parsed.colors === undefined || typeof parsed.colors !== 'object') {
        fail(`${THEMES_DIR}/${file}`, 'has no `colors` map', 'useTheme.ts applies `colors` as `--<key>` custom properties — a preset without it changes nothing when selected.');
        continue;
    }
    themeTokens.set(id, new Set(Object.keys(parsed.colors)));
}

const reference = themeTokens.get(REFERENCE_THEME);
if (reference === undefined) {
    fail(THEMES_DIR, `has no ${REFERENCE_THEME}.json`, `${REFERENCE_THEME} is the reference preset and the default id in theme.ts — every other preset is compared against its key set.`);
} else {
    // 3a. Every preset carries exactly the reference key set.
    for (const [id, tokens] of themeTokens) {
        if (id === REFERENCE_THEME) continue;
        const missing = [...reference].filter((k) => !tokens.has(k));
        const extra = [...tokens].filter((k) => !reference.has(k));
        if (missing.length > 0) {
            fail(
                `${THEMES_DIR}/${id}.json`,
                `is missing ${missing.length} colour(s): ${missing.join(', ')}`,
                `Each one falls back to the ${VARIABLES} default, so those elements are off-palette in this theme only — visible solely to whoever selected it.`,
            );
        }
        if (extra.length > 0) {
            fail(
                `${THEMES_DIR}/${id}.json`,
                `defines ${extra.length} colour(s) no other theme has: ${extra.join(', ')}`,
                `Either every preset needs the token (and ${VARIABLES} a fallback), or nothing reads it and it is dead weight users will try to edit.`,
            );
        }
    }

    // 3b. The `:root` fallback layer matches the palette.
    const missingFallback = [...reference].filter((k) => !rootTokens.has(k));
    const orphanFallback = [...rootTokens].filter((k) => !reference.has(k));
    if (missingFallback.length > 0) {
        fail(
            VARIABLES,
            `:root has no fallback for ${missingFallback.join(', ')}`,
            'A theme that fails to load, or an older hand-edited preset in ~/.leaf/themes/ that predates the token, leaves these resolving to nothing.',
        );
    }
    if (orphanFallback.length > 0) {
        fail(
            VARIABLES,
            `:root defines ${orphanFallback.join(', ')}, which no theme preset overrides`,
            'The token is permanently stuck at its fallback — a theme switch cannot change it, which is exactly the bug that is hardest to see.',
        );
    }
}

// 3c. Every `var(--token)` resolves to something.
const styleFiles = [];
const collect = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) collect(rel);
        else if (/\.(scss|vue)$/.test(entry.name)) styleFiles.push(rel);
    }
};
collect('src/renderer');

const declaredTokens = new Set([...rootTokens, ...(reference ?? []), ...COMPONENT_LOCAL_VARS.keys()]);
const unresolved = new Map();

for (const rel of styleFiles) {
    const source = read(rel);
    for (const m of source.matchAll(/var\(\s*--([a-z0-9-]+)/gi)) {
        if (!declaredTokens.has(m[1]) && !unresolved.has(m[1])) unresolved.set(m[1], rel);
    }
}

for (const [token, rel] of unresolved) {
    fail(
        rel,
        `uses \`var(--${token})\`, which nothing defines`,
        `Not in :root, not in any theme preset, and not listed as component-local in this gate. It resolves to nothing — the property is simply dropped.`,
    );
}

// ── 4. Self-hosted everything ────────────────────────────────────────────────
for (const rel of [...styleFiles, INDEX]) {
    const source = read(rel);
    for (const m of source.matchAll(/@import\s+url\(|https?:\/\/fonts\.(googleapis|gstatic)\.com|@font-face[\s\S]{0,300}?url\(\s*['"]?https?:/gi)) {
        fail(
            rel,
            `pulls a remote stylesheet or font (\`${m[0].slice(0, 40)}…\`)`,
            'Leaf makes no network requests. A CDN font is a request on every launch, a build that is no longer reproducible, and a blank first paint offline.',
        );
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ SCSS standards check failed — ${failures.length} problem(s):\n`);
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
    `✓ SCSS standards check passed — barrel + injection intact, ${themeFiles.length} theme presets agree on ${reference?.size ?? 0} tokens, ${styleFiles.length} style files self-hosted.`,
);
