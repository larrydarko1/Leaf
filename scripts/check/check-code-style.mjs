#!/usr/bin/env node
/**
 * Code style gate.
 *   1. FILENAME CASING. `.vue` is PascalCase (it is a component name — the tag
 *      you write in a template), `.ts` is camelCase. Invisible in a diff — you
 *      read the import line, not the convention it broke — and the cost of
 *      fixing it grows with every new importer. The one deliberate exception is
 *      `cm-*.ts` under composables/editor/codemirror: those are CodeMirror
 *      extension modules, named after the upstream convention rather than ours.
 *   2. A COMPOSABLE FILE EXPORTS ITS OWN NAME. `useFoo.ts` must export `useFoo`.
 *      A composable renamed without renaming its file, or split in two and only
 *      half moved, leaves a filename that lies about what is inside — and the
 *      import site reads perfectly.
 *   3. THE 400-LINE SOFTCAP, AS A RATCHET. The cap is soft, so failing every
 *      file over it would just be a refactor backlog with a red X. The files
 *      already over it are listed below at the size they were at, and the gate
 *      fails only on a NEW file crossing the line or a listed one growing. A
 *      soft target you can only move one way.
 *   4. PUBLIC BEFORE PRIVATE. Exported functions come before module-private
 *      helpers, so a reader meets the API before the machinery. Comments are
 *      stripped first: a commented-out export reads as private code stranded
 *      above the public API otherwise.
 *   5. HEADERS BY FILE TYPE. main/lib and main/services owe a JSDoc block (each
 *      owns an external concern — the filesystem, a model handle, a config file —
 *      and which one is not derivable from its exports); composables owe at least
 *      a `//` line; and
 *      `.vue` SFCs owe NOTHING, because `defineProps` is the contract and a prose
 *      header above it only drifts. That last one is a BAN, and bans are what
 *      nothing else would ever catch.
 *   6. SFC BLOCK ORDER: `<script setup>`, then `<template>`, then `<style>`.
 *      Logic before markup before presentation, so every one of the 26 SFCs
 *      opens the same way and you never hunt for the script block.
 *   7. COMMENT FORMAT IN `<template>` AND `<style>`. Each gets a different form
 *      on purpose: plain `<!-- Section -->` in markup, decorated
 *      `/* ––– Section ––– *\/` in styles. The formats are what make them
 *      scannable when a 700-line SFC is all one file; drift makes them noise.
 *   8. JSDoc TYPE TAGS IN TYPESCRIPT. `@param {string}` restates what the
 *      signature already says, and unlike the signature it is never checked, so
 *      it goes stale silently.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';
import { stripComments } from '../lib/strip-comments.mjs';

const SOURCE_ROOT = 'src';
const LINE_CAP = 400;

/**
 * Files already over the cap, at the size they were when the ratchet was set.
 * A file may shrink freely; growing past its entry, or a new file crossing the
 * cap, fails. Lower a number when you refactor — never raise one.
 */
const LENGTH_BASELINE = {
    'src/renderer/components/ai/AiMessageList.vue': 1098,
    'src/renderer/App.vue': 919,
    'src/renderer/composables/drawing/useDrawingInteraction.ts': 813,
    'src/main/services/fs.ts': 795,
    'src/renderer/components/explorer/FolderNode.vue': 777,
    'src/renderer/components/ai/AiInputArea.vue': 732,
    'src/renderer/components/NoteEditor.vue': 722,
    'src/renderer/components/ai/AiModelBar.vue': 699,
    'src/renderer/composables/drawing/useCanvasRenderer.ts': 685,
    'src/renderer/components/drawing/DrawingPropertiesPanel.vue': 674,
    'src/renderer/components/drawing/DrawingToolbar.vue': 576,
    'src/renderer/components/drawing/DrawingExportDialog.vue': 573,
    'src/renderer/composables/editor/codemirror/cm-theme.ts': 525,
    'src/renderer/components/editor/AudioViewer.vue': 514,
    'src/renderer/composables/ai/useAIChat.ts': 499,
    'src/renderer/components/SearchPanel.vue': 479,
    'src/main/services/ai.ts': 478,
    'src/renderer/components/DrawingCanvas.vue': 474,
    'src/renderer/components/editor/MarkdownToolbar.vue': 465,
    'src/renderer/components/editor/VideoViewer.vue': 441,
    'src/renderer/composables/editor/codemirror/cm-widgets.ts': 429,
    'src/renderer/composables/editor/codemirror/cm-deco-builders.ts': 422,
};

/**
 * Files whose public API is not declared before their private helpers. Known
 * debt, listed so the rule can be enforced everywhere else — the same one-way
 * ratchet as LENGTH_BASELINE. Remove an entry when you reorder the file; never
 * add one to silence a new violation.
 */
const ORDERING_EXEMPT = new Set([
    'src/main/services/conversation.ts',
    'src/main/services/fs.ts',
    'src/renderer/composables/editor/codemirror/cm-deco-builders.ts',
    'src/renderer/composables/editor/codemirror/cm-markdown-widgets.ts',
]);

/** Modules named by an upstream convention rather than this repo's. */
const CASING_EXEMPT = /^cm-[a-z0-9-]+\.ts$/;
const CODEMIRROR_DIR = 'src/renderer/composables/editor/codemirror';

/** Ambient declaration files are named after what they declare, not by our casing. */
const DECLARATION = /\.d\.ts$/;

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });

/** Every tracked source file under src/, as repo-relative POSIX paths. */
function walk(dir, out = []) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.(ts|vue)$/.test(entry.name)) out.push(rel);
    }
    return out;
}

const files = walk(SOURCE_ROOT).sort();

for (const rel of files) {
    const base = path.basename(rel);
    const stem = base.replace(/\.(ts|vue)$/, '');
    const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const code = stripComments(source);
    // wc -l semantics: a trailing newline terminates the last line, it does not start a new one.
    const lines = source.replace(/\n$/, '').split('\n');

    // ── 1. Filename casing ───────────────────────────────────────────────────
    if (base.endsWith('.vue')) {
        if (!PASCAL_CASE.test(stem)) {
            fail(rel, `filename "${base}" is not PascalCase`, 'An SFC filename is the component name you write as a tag; Vue resolves and devtools label it by that name.');
        }
    } else if (!DECLARATION.test(base)) {
        const exempt = CASING_EXEMPT.test(base) && rel.startsWith(CODEMIRROR_DIR);
        if (!exempt && !CAMEL_CASE.test(stem)) {
            fail(rel, `filename "${base}" is not camelCase`, `TypeScript modules under ${SOURCE_ROOT}/ are camelCase (the \`cm-*\` kebab exception is only for ${CODEMIRROR_DIR}).`);
        }
    }

    // ── 2. A composable file exports its own name ────────────────────────────
    if (/^use[A-Z]/.test(stem) && base.endsWith('.ts')) {
        const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let)\\s+${stem}`).test(code);
        if (!exported) {
            fail(rel, `exports nothing named \`${stem}*\``, 'A composable renamed without renaming its file leaves a filename that lies about its contents, and every import site still reads correctly. A helpers module satisfies this with a prefixed export (useDebounce.ts → `useDebounceFn`).');
        }
    }

    // ── 3. The 400-line softcap, as a ratchet ────────────────────────────────
    const count = lines.length;
    const baseline = LENGTH_BASELINE[rel];
    if (baseline === undefined) {
        if (count > LINE_CAP) {
            fail(rel, `${count} lines exceeds the ${LINE_CAP}-line softcap`, 'Split it, or add it to LENGTH_BASELINE in this gate with a note saying why it earns an exception.');
        }
    } else if (count > baseline) {
        fail(rel, `grew to ${count} lines (baseline ${baseline})`, `Already over the ${LINE_CAP}-line softcap — the ratchet only allows it to shrink. Lower its LENGTH_BASELINE entry when you refactor.`);
    }

    // ── 4. Public before private (.ts only — an SFC has one script block) ────
    if (base.endsWith('.ts') && !DECLARATION.test(base) && !ORDERING_EXEMPT.has(rel)) {
        const declarations = [];
        for (const m of code.matchAll(/^(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) {
            declarations.push({ exported: m[1] !== undefined, name: m[2] });
        }
        const firstPrivate = declarations.findIndex((d) => !d.exported);
        if (firstPrivate !== -1) {
            const lateExport = declarations.slice(firstPrivate).find((d) => d.exported);
            if (lateExport !== undefined) {
                fail(rel, `exported \`${lateExport.name}()\` is declared after the private \`${declarations[firstPrivate].name}()\``, 'Public API first, machinery below, so a reader meets what the module offers before how it works.');
            }
        }
    }

    // ── 5. Headers by file type ──────────────────────────────────────────────
    const opensWithJsdoc = /^\s*\/\*\*/.test(source);
    const opensWithComment = /^\s*(\/\*|\/\/)/.test(source);

    if (/^src\/main\/(lib|services)\//.test(rel) && !DECLARATION.test(base)) {
        if (!opensWithJsdoc) {
            fail(rel, 'has no JSDoc header block', 'A main-process module owns an external concern — the filesystem, a model handle, a config file — and which one, plus what it guarantees callers, is not derivable from its exports.');
        }
    }
    if (/^src\/renderer\/composables\//.test(rel) && !opensWithComment) {
        fail(rel, 'has no header comment', 'A composable owes at least a `//` line saying what state it owns — that is the thing its signature cannot say.');
    }
    if (base.endsWith('.vue') && opensWithJsdoc) {
        fail(rel, 'opens with a JSDoc header block', 'SFCs owe no prose header: `defineProps`/`defineEmits` are the contract, and a header above them is the one part nothing checks, so it is the part that goes stale.');
    }

    // ── 6/7. SFC block order and comment format ──────────────────────────────
    if (base.endsWith('.vue')) {
        const blocks = [...source.matchAll(/^<(script|template|style)\b/gm)].map((m) => m[1]);
        const order = blocks.filter((b, i) => blocks.indexOf(b) === i);
        const expected = ['script', 'template', 'style'].filter((b) => order.includes(b));
        if (order.join(',') !== expected.join(',')) {
            fail(rel, `block order is <${order.join('>, <')}>`, 'Every SFC opens `<script setup>` → `<template>` → `<style>`: logic, then markup, then presentation. All 26 agree, so you never hunt for the script block.');
        }

        const templateStart = source.indexOf('\n<template');
        const styleStart = source.indexOf('\n<style');

        if (templateStart !== -1) {
            const template = source.slice(templateStart, styleStart === -1 ? undefined : styleStart);
            for (const m of template.matchAll(/^\s*\/\*|^\s*\/\//gm)) {
                void m;
                fail(rel, 'uses a JS-style comment inside <template>', 'Markup comments are `<!-- Section -->`. A `//` in a template is not a comment at all — Vue renders it as text.');
                break;
            }
        }

        if (styleStart !== -1) {
            const style = source.slice(styleStart);
            for (const m of style.matchAll(/^[ \t]*\/\*(?!\s*–)([^*]*)\*\//gm)) {
                const text = m[1].trim();
                if (text === '' || /^stylelint-/.test(text)) continue;
                fail(rel, `style section comment "${text.slice(0, 40)}" is not in the decorated form`, 'Style sections are written `/* ––– Section ––– */` (en-dashes). The decoration is what makes them scannable in a 700-line SFC.');
                break;
            }
        }
    }

    // ── 8. JSDoc type tags in TypeScript ─────────────────────────────────────
    const typeTag = source.match(/@(param|returns?|type)\s*\{/);
    if (typeTag !== null) {
        fail(rel, `JSDoc carries a type annotation (\`@${typeTag[1]} {…}\`)`, 'The signature already states the type and is actually checked; the tag is a copy that nothing verifies, so it drifts. Describe meaning, not types.');
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ Code style check failed — ${failures.length} problem(s):\n`);
    let current = '';
    for (const { file, what, why } of failures) {
        if (file !== current) {
            console.error(`  ${file}`);
            current = file;
        }
        console.error(`    • ${what}`);
        console.error(`      ${why}`);
    }
    console.error(`\nFiles scanned: ${files.length} under ${SOURCE_ROOT}/`);
    process.exit(1);
}

console.log(
    `✓ Code style check passed — ${files.length} files: casing, composable naming, ${LINE_CAP}-line ratchet (${Object.keys(LENGTH_BASELINE).length} baselined), ordering, headers, SFC blocks, comment formats.`,
);
