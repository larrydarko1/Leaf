#!/usr/bin/env node
/**
 * Declaration order gate.
 *
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
 *
 * This is a hard rule. There is one exception and it is not a list someone
 * maintains — it is computed, because the only thing that can legitimately
 * override the table is the module failing to load.
 *
 * HOW THE EXCEPTION WORKS. `const` and `class` bindings sit in a temporal dead
 * zone and side-effect statements run at load, so the table is not uniformly safe
 * to impose: moving a statement above something it reads is a ReferenceError at
 * import time — the module never loads, and no test catches it because nothing
 * gets far enough to run. So the canonical order is computed as a topological sort
 * keyed by category (see analyze() in ../lib/declaration-order.ts): an edge A→B
 * exists when B reads, at load time, a binding A declares, and the sort always
 * takes the available statement with the lowest (category, original position). The
 * result is the table wherever the dependencies permit, and the dependency
 * everywhere else.
 *
 * Hoisted `function` declarations and type-only declarations create no edges — they
 * are visible wherever they sit — which is why the bulk of the ordering is free.
 *
 * The shape that earns it in a Vue codebase is `defineExpose({ el })`: contract
 * (#3) reading a template ref that is state (#6), so hoisting it to position 3
 * would put it above the `ref()` it exposes.
 *
 * SCOPE. src/ and tests/, in two passes.
 *   - tests/ gets the SECOND pass, against a different table (TEST_CATEGORIES):
 *     imports → types → mocks → constants → helpers → hooks → tests. A suite used
 *     to be out of scope on the grounds that its order was dictated by `vi.mock`
 *     hoisting rather than by design, which had it backwards — the hoisting is
 *     precisely what fixes `vi.mock`'s position, and a file that writes it lower
 *     down misrepresents what runs first. What is true is that the production
 *     table cannot express the rule: `vi.mock`, `beforeEach` and `describe` are
 *     all expression statements, so it bins all three as side-effects and sorts
 *     the mocks LAST. See TEST_CATEGORIES in ../lib/declaration-order.ts.
 *
 * WHAT THIS CANNOT SEE. Whether two statements in the SAME category are in a
 * sensible order relative to each other. The table says private functions are
 * "grouped by concern"; grouping is a judgement about meaning, and the sort
 * preserves existing relative order within a category rather than inventing one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.ts';
import { CATEGORIES, TEST_CATEGORIES, analyzeFile, isTestPath } from '../lib/declaration-order.ts';

const SOURCE_ROOTS = ['src', 'tests'];

type Failure = {
    file: string;
    headline: string;
    misplaced: { cat: string; name: string; line: number; belongsAfter: string }[];
    why: string;
};

const failures: Failure[] = [];

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(rel);
    }
    return out;
}

const discovered = SOURCE_ROOTS.flatMap((root) => walk(root)).sort();
const files = discovered.filter((rel) => !isTestPath(rel));
// .vue is production-only; a suite is always a .ts module.
const testFiles = discovered.filter((rel) => isTestPath(rel) && rel.endsWith('.ts'));
let statementsChecked = 0;

for (const rel of [...files, ...testFiles]) {
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
            why: `Order is: ${(isTestPath(rel) ? TEST_CATEGORIES : CATEGORIES).join(' → ')}.`,
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
            console.error(
                `      L${String(m.line).padStart(4)}  ${m.cat} "${m.name.slice(0, 40)}" belongs after ${m.belongsAfter}`,
            );
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
    `✓ Declaration order check passed — ${files.length} modules + ${testFiles.length} suites, ` +
        `${statementsChecked} top-level statements, all in canonical order (or held by a load-time dependency).`,
);
