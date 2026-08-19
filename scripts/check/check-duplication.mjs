#!/usr/bin/env node
/**
 * Duplication (DRY) gate.
 * Enforced two ways, because a percentage alone is a bad alarm:
 *   1. A PER-FORMAT CEILING. Ratcheted just above where the codebase sits today,
 *      so the number can only be driven down. Split by format because the three
 *      have genuinely different stakes, and one blended number hides all of them:
 *        • typescript is LOGIC. Two copies of a branch is the case that actually
 *          costs you a bug.
 *        • scss is presentation. Repetition there is real debt (it is what the
 *          token system and the shared mixins in components.scss exist to
 *          absorb), but a stale copy makes something look wrong, not behave
 *          wrong — so it gets a looser ceiling, honestly labelled.
 *        • html is SFC template markup, where structural repetition is often the
 *          correct answer and extracting a component would cost more than it saves.
 *   2. A CAP ON ANY SINGLE CLONE. A percentage is a ratio, so it quietly improves
 *      as the codebase grows: a large new copy-paste can land while the number
 *      goes DOWN. This is the rule that catches the thing you actually care about
 *      — one big block pasted into a second place — independently of size.
 * A note on what this cannot judge: jscpd matches tokens, not intent. Two blocks
 * that look identical and mean different things are a false positive, and the
 * honest response is to raise the relevant ceiling with a comment rather than
 * contort the code. Every number below is a judgement, not a measurement.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

const SCAN = 'src';

/**
 * Ceiling on duplicated TOKENS per format, as a percentage. Tokens rather than
 * lines: line counts move with formatting, so a prettier config change would
 * otherwise shift every number here.
 */
const CEILINGS = {
    typescript: { limit: 4, note: 'logic — two copies of a branch is how a fixed bug comes back' },
    scss: { limit: 8, note: 'presentation — real debt, but it makes things look wrong rather than behave wrong' },
    html: { limit: 6, note: 'SFC markup — structural repetition is often cheaper than another component' },
};

/**
 * No single clone may exceed this many tokens, whatever the percentages say.
 * The largest today is 147 (a shared panel layout between LanguagePicker and
 * ThemePicker); this leaves a little room without leaving room for a new one.
 */
const MAX_CLONE_TOKENS = 160;

/**
 * Resolved from node_modules rather than imported, because jscpd is a CLI.
 *
 * knip cannot see a binary reached this way — a path built at runtime is just a
 * string — so it would report jscpd as an unused dependency. What keeps it visible
 * is the `lint:dup` script in package.json, which invokes `jscpd` directly: knip
 * parses script bodies and resolves the binaries named in them. That script is the
 * console-reporter version of this gate, for reading the clones rather than just
 * being told the total, and it shares the same .jscpd.json — so the two can never
 * disagree about what counts as a clone. Delete it and dead:check starts failing.
 */
const bin = path.resolve(ROOT, 'node_modules/.bin/jscpd');
if (!fs.existsSync(bin)) {
    console.error('✗ check-duplication: jscpd is not installed. Run `npm ci`.');
    process.exit(1);
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-'));

try {
    execFileSync(bin, [SCAN, '--reporters', 'json', '--output', outDir, '--silent'], {
        cwd: ROOT,
        stdio: 'ignore',
    });
} catch {
    /* jscpd exits non-zero on its own thresholds; the JSON report is still written. */
}

const reportPath = path.join(outDir, 'jscpd-report.json');
if (!fs.existsSync(reportPath)) {
    console.error('✗ check-duplication: jscpd produced no report.');
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
fs.rmSync(outDir, { recursive: true, force: true });

const failures = [];
const loc = (f) => `${f.name}:${f.start}-${f.end}`;

// ── 1. Per-format ceilings ───────────────────────────────────────────────────
for (const [format, { limit, note }] of Object.entries(CEILINGS)) {
    const stats = report.statistics.formats[format];
    if (stats === undefined) continue;
    const pct = stats.percentageTokens;
    if (pct > limit) {
        const worst = report.duplicates
            .filter((d) => d.format === format)
            .sort((a, b) => b.tokens - a.tokens)
            .slice(0, 5);
        failures.push({
            what: `${format} duplication is ${pct.toFixed(2)}% of tokens, over the ${limit}% ceiling (${stats.clones} clones)`,
            why: `This ceiling is ${note}.`,
            clones: worst,
        });
    }
}

// ── 2. No single clone over the cap ──────────────────────────────────────────
const oversized = report.duplicates.filter((d) => d.tokens > MAX_CLONE_TOKENS).sort((a, b) => b.tokens - a.tokens);

if (oversized.length > 0) {
    failures.push({
        what: `${oversized.length} clone(s) exceed ${MAX_CLONE_TOKENS} tokens`,
        why: 'A block this size pasted into a second place is the case the percentages cannot catch — the ratio can fall while this lands. Extract it, or state why the two are only incidentally alike.',
        clones: oversized.slice(0, 5),
    });
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ Duplication check failed — ${failures.length} problem(s):\n`);
    for (const { what, why, clones } of failures) {
        console.error(`  • ${what}`);
        console.error(`    ${why}`);
        for (const c of clones) {
            console.error(`      ${String(c.tokens).padStart(4)} tokens  ${loc(c.firstFile)}  <=>  ${loc(c.secondFile)}`);
        }
        console.error('');
    }
    process.exit(1);
}

const summary = Object.keys(CEILINGS)
    .filter((f) => report.statistics.formats[f] !== undefined)
    .map((f) => `${f} ${report.statistics.formats[f].percentageTokens.toFixed(2)}%/${CEILINGS[f].limit}%`)
    .join(', ');

const largest = report.duplicates.reduce((n, d) => Math.max(n, d.tokens), 0);

console.log(
    `✓ Duplication check passed — ${summary}; ${report.statistics.total.clones} clones, largest ${largest} tokens (cap ${MAX_CLONE_TOKENS}).`,
);
