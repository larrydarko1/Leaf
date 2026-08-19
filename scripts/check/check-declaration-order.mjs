#!/usr/bin/env node
/**
 * Declaration order gate.
 * The canonical order within a module:
 *    1. imports          — `import` statements
 *    2. types            — interfaces, type aliases, Zod schemas: the vocabulary
 *    3. contract         — defineProps / defineEmits: the SFC's public API, which
 *                          everything below it reads as `props`
 *    4. constants        — thresholds, ids, feature flags, SCREAMING_SNAKE config
 *    5. classes          — exported first, then private
 *    6. state            — singletons, caches, lazy loaders, module-level refs
 *    7. exported-fns     — the public API, the headline
 *    8. private-fns      — implementation detail, grouped by concern
 *    9. side-effects     — onMounted / watch / listener wiring: statements that RUN
 *                          at load and reference every layer above
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';
import { CATEGORIES, analyzeFile } from '../lib/declaration-order.mjs';

const SOURCE_ROOT = 'src';

const failures = [];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(rel);
    }
    return out;
}

const files = walk(SOURCE_ROOT).sort();
let statementsChecked = 0;

for (const rel of files) {
    const result = analyzeFile(rel, ROOT);
    if (result === null) continue;
    statementsChecked += result.count;

    if (result.cycle === true) {
        failures.push({
            file: rel,
            headline: 'has a circular load-time dependency between top-level statements',
            misplaced: [],
            why: 'No order satisfies it, so the canonical order cannot be computed. Break the cycle — at module scope it means two statements each read a binding the other declares.',
        });
        continue;
    }

    if (result.misplaced.length > 0) {
        failures.push({
            file: rel,
            headline: `${result.misplaced.length} statement(s) out of canonical order`,
            misplaced: result.misplaced,
            why: `Order is: ${CATEGORIES.join(' → ')}.`,
        });
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    const total = failures.reduce((n, f) => n + f.misplaced.length, 0);
    console.error(`✗ Declaration order check failed — ${failures.length} file(s), ${total} statement(s):\n`);
    for (const { file, headline, why, misplaced } of failures) {
        console.error(`  ${file} — ${headline}`);
        console.error(`    ${why}`);
        for (const m of misplaced) {
            console.error(`      L${String(m.line).padStart(4)}  ${m.cat} "${m.name.slice(0, 40)}" belongs after ${m.belongsAfter}`);
        }
        console.error('');
    }
    console.error(
        'Every position reported here is reachable: the target order is computed as a\n' +
            'topological sort, so it already respects every load-time dependency. If a move\n' +
            'looks unsafe, the dependency is missing from the analysis — say so rather than\n' +
            'reordering blindly.',
    );
    process.exit(1);
}

console.log(
    `✓ Declaration order check passed — ${files.length} modules, ${statementsChecked} top-level statements, all in canonical order (or held by a load-time dependency).`,
);
