#!/usr/bin/env node
/**
 * i18n locale consistency gate — the cross-locale half of "correct", which the
 * @intlify ESLint rules cannot see. Those check that each file is well-formed and
 * that no key is missing (valid-message-syntax, no-missing-keys-in-other-locales);
 * only this can check the locales AGREE with one another.
 *   1. Plural-segment parity   — "a | b" must have the same number of `|` segments
 *                                in every locale, or vue-i18n selects the wrong
 *                                branch (or none) for that language.
 *   2. Placeholder parity      — the set of {named} interpolation tokens must match
 *                                across locales. Order may differ (word order is
 *                                language-specific), the set may not: a translator
 *                                dropping `{count}` yields a message that renders
 *                                fine and silently loses the number.
 *   3. Array-length parity     — array-valued keys must have the same length in
 *                                every locale, or the UI renders a different number
 *                                of options per language.
 *   4. createI18n options      — in src/renderer/i18n.ts. No lint rule reads that
 *                                file, and escapeParameter is a security control.
 *
 * assets/locales/*.json are not build artefacts: language.ts seeds them into
 * ~/.leaf/locales/ where users edit them, so `en` is both reference and fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const LOCALE_DIR = path.resolve(ROOT, 'assets/locales');
const I18N_CONFIG = path.resolve(ROOT, 'src/renderer/i18n.ts');
const REFERENCE = 'en';

function flatten(node, prefix = '', out = {}) {
    if (Array.isArray(node)) {
        out[`${prefix}[]`] = `__array:${node.length}`;
        node.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
            flatten(v, prefix ? `${prefix}.${k}` : k, out);
        }
    } else if (typeof node === 'string') {
        out[prefix] = node;
    }
    return out;
}

function placeholders(str) {
    return [...new Set((str.match(/\{[^}]+\}/g) || []).filter((t) => t !== "{'@'}"))].sort();
}

function pluralSegments(str) {
    return str.split('|').length;
}

function fail(message) {
    console.error(`✗ ${message}`);
    process.exit(1);
}

const files = fs
    .readdirSync(LOCALE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

if (!files.includes(REFERENCE)) {
    fail(`Reference locale "${REFERENCE}.json" not found in ${LOCALE_DIR}`);
}

const flat = {};
for (const loc of files) {
    const file = path.join(LOCALE_DIR, `${loc}.json`);
    try {
        flat[loc] = flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
        fail(`${loc}.json could not be read as JSON — ${err.message}`);
    }
}

const ref = flat[REFERENCE];
const others = files.filter((l) => l !== REFERENCE);
const errors = [];

// ── 1–3. Cross-locale value-shape parity vs the reference locale ─────────────
for (const loc of others) {
    const cur = flat[loc];
    for (const [key, refVal] of Object.entries(ref)) {
        const curVal = cur[key];

        if (refVal.startsWith('__array:')) {
            const base = key.slice(0, -2);
            if (curVal === undefined) {
                if (typeof cur[base] === 'string') {
                    errors.push(`[${loc}] ${base}: string where en has an array of ${refVal.split(':')[1]}`);
                }
                continue;
            }
            if (curVal !== refVal) {
                errors.push(`[${loc}] ${base}: array length ${curVal.split(':')[1]} ≠ en ${refVal.split(':')[1]}`);
            }
            continue;
        }

        // Absent keys are @intlify/vue-i18n/no-missing-keys-in-other-locales' job, not this gate's.
        if (curVal === undefined) {
            if (cur[`${key}[]`] !== undefined) {
                errors.push(`[${loc}] ${key}: array where en has a string`);
            }
            continue;
        }

        const rp = pluralSegments(refVal);
        const cp = pluralSegments(curVal);
        if (rp !== cp) {
            errors.push(`[${loc}] ${key}: ${cp} plural segment(s) ≠ en ${rp} — "${curVal}"`);
        }

        const rph = placeholders(refVal).join(',');
        const cph = placeholders(curVal).join(',');
        if (rph !== cph) {
            errors.push(`[${loc}] ${key}: placeholders [${cph}] ≠ en [${rph}]`);
        }
    }
}

// ── 4. createI18n options ────────────────────────────────────────────────────
if (!fs.existsSync(I18N_CONFIG)) {
    fail(`createI18n config not found at ${path.relative(ROOT, I18N_CONFIG)} — update I18N_CONFIG in this gate.`);
}
const i18nSource = fs.readFileSync(I18N_CONFIG, 'utf8');

const REQUIRED_OPTIONS = [
    {
        what: 'escapeParameter: true',
        re: /escapeParameter:\s*true/,
        why:
            'SECURITY. Interpolation params are values from outside the dictionary — model names, file paths, ' +
            'error text — and the messages themselves are user-editable under ~/.leaf/locales/. escapeParameter ' +
            'keeps a param containing markup from being interpolated unescaped; the renderer already has v-html ' +
            'sites (ai/AiMessageList.vue, drawing/DrawingToolbar.vue), so an unescaped param is one refactor away ' +
            'from an XSS sink.',
    },
    {
        what: 'legacy: false',
        re: /legacy:\s*false/,
        why: 'Composition API mode. The legacy (Options API) mode installs a different, global `$t` and silently changes how `useI18n()` resolves scope.',
    },
    {
        what: 'fallbackLocale',
        re: /fallbackLocale:/,
        why:
            'Without a fallback, a key missing from the active locale renders as the raw key path to the user. ' +
            'Locales are hand-edited in ~/.leaf/locales/, so missing keys are a runtime reality here, not only a ' +
            'build-time one.',
    },
];

for (const { what, re, why } of REQUIRED_OPTIONS) {
    if (!re.test(i18nSource)) {
        errors.push(`[${path.relative(ROOT, I18N_CONFIG)}] createI18n is missing \`${what}\` — ${why}`);
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
const refKeyCount = Object.keys(ref).filter((k) => !k.endsWith('[]')).length;
if (errors.length) {
    console.error(`✗ i18n check failed — ${errors.length} problem(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    console.error(`\nLocales checked: ${files.join(', ')} (${refKeyCount} keys, ${REFERENCE} = reference)`);
    process.exit(1);
}

console.log(
    `✓ i18n check passed — ${files.length} locales, ${refKeyCount} keys, plural/placeholder/array shapes consistent, createI18n options intact.`,
);
