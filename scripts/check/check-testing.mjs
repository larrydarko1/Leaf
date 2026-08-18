#!/usr/bin/env node
/**
 * Testing standards gate — the mechanically checkable half of CONTRIBUTING.md
 * "Testing". Each section below is one rule from that document; if the two ever
 * disagree, the document is the standard and this file is the bug.
 *   1. PLACEMENT. Tests mirror `src/` under `tests/`. The standard picked this
 *      pattern over co-located `__tests__/` and the whole value is consistency —
 *      a suite in the other pattern is not wrong so much as unfindable.
 *   2. THE `.test.ts` SUFFIX. The folder is convention; the suffix is the
 *      mechanism. `include: ['tests/**\/*.test.ts']` means a `.spec.ts` is
 *      picked up by no runner at all — it stops running while still looking
 *      like a test.
 *   3. NO E2E SUITE. Also a decision, not a gap: Playwright's Electron API is
 *      experimental and an attempt here was removed. The standard says don't
 *      add one back without raising it first, so a config or dependency
 *      appearing unannounced fails rather than lands quietly.
 *   4. THE COVERAGE CONFIG, RATCHETED. Two numbers-only rules quoted from the
 *      standard: thresholds ratchet up and never down ("lowering a threshold to
 *      make a red build green is fixing the number that defines failure"), and
 *      the exclude list may not grow. Without this, the cheapest way to clear a
 *      coverage failure is to edit the definition of failure.
 *   5. NOTHING AT 0%. The aggregate hides individual files: at 87% statements a
 *      whole untested module is a rounding error.
 *   6. SUITE HYGIENE. The ways a suite goes wrong while every run stays green,
 *      so none of them announce themselves: `.only`, `.skip`, bare `test()`,
 *      commented-out tests, duplicate titles inside one `describe`.
 *   7. COMPONENT INTERNALS, AS A RATCHET. "Test behaviour, not implementation."
 *      `wrapper.vm.someRef` is the mechanical form — but it is a legitimate
 *      escape hatch often enough that a ban would be wrong, so it is counted,
 *      not forbidden. `$`-prefixed members ($nextTick, $emit) are Vue's public
 *      instance API and are explicitly fine.
 *   8. THE DOM ENVIRONMENT. One word in one config file, and the repo can
 *      disagree with the standard on it for as long as nobody reads both on the
 *      same day.
 * ONE SECTION IS CONDITIONAL and says so in the output rather than passing
 * quietly: 5 needs `coverage/coverage-summary.json`, which only exists after a
 * `--coverage` run. CI orders this gate after one. Locally, `npm run test:check`
 * straight after `npm test` skips that section, and the summary names what it
 * skipped so a green tick never overstates itself.
 * NOT CHECKED, deliberately:
 *   - Whether a test is any good. Section 5 catches a file with no test at all;
 *     nothing here tells a thorough suite from one that executes every line and
 *     asserts almost nothing.
 *   - Whether a test has an assertion. The standard forbids assertionless tests,
 *     but a call that returns a value into an `expect` built three lines earlier
 *     is indistinguishable from one that does nothing without running the suite.
 *   - The priority order (security → utilities → services → composables →
 *     components). It describes what to write NEXT — a property of a backlog,
 *     not of the tree.
 *   - Anything about the assembled app. There is no E2E suite by design, which
 *     is exactly why `npm run dev` is on the PR checklist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const VITEST_CONFIG = 'vitest.config.ts';
const COVERAGE_SUMMARY = 'coverage/coverage-summary.json';
const TEST_ROOT = 'tests';
const DOM_ENVIRONMENT = 'jsdom';

/** Top-level `tests/` directories, one per `src/` directory the standard mirrors. */
const MIRRORED = ['main', 'preload', 'renderer', 'schemas'];

/**
 * The floors as they stand. Raise them as coverage climbs; the gate fails if the
 * config drops below one, which is the only direction that needs guarding.
 * These are NOT the target — the standard's target is 100%.
 */
const MIN_THRESHOLDS = { statements: 80, branches: 80, functions: 80, lines: 80 };

/**
 * Every path the coverage config is allowed to exclude, with the reason it is
 * not a coverage gap. A new entry is a deliberate decision that something will
 * never be unit-tested — which the standard says should almost always be a
 * missing test instead, so it is made once, in writing, rather than by editing
 * a list in a config file.
 */
const ALLOWED_EXCLUDES = new Map([
    ['src/renderer/main.ts', 'renderer bootstrap — mounts the app and installs plugins, no branch to cover'],
    ['src/main/index.ts', 'Electron entry — creates the BrowserWindow, only exercised by launching the app'],
    ['src/**/*.d.ts', 'declarations, no runtime'],
    ['src/**/*.html', 'markup, not code'],
]);

/**
 * Tests reaching into a component's internals instead of its rendered output.
 * Zero today. If a case genuinely warrants it, raise this WITH the reason — the
 * point of a number rather than a ban is that the exception gets argued.
 */
const VM_ACCESS_BASELINE = 0;

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const repoFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
})
    .split('\n')
    .filter(Boolean);

const unitTests = repoFiles.filter((f) => /\.test\.ts$/.test(f));

// ── 1. Placement: tests mirror src/ under tests/ ────────────────────────────
for (const rel of unitTests) {
    if (rel.includes('/__tests__/') || rel.startsWith('__tests__/')) {
        fail(
            rel,
            'a co-located `__tests__/` suite',
            `This project mirrors \`src/\` under \`${TEST_ROOT}/\` instead. The standard allows either pattern but not both: half a convention is worse than either half, because now nobody knows where to look for a file that might not exist.`,
        );
        continue;
    }
    if (!rel.startsWith(`${TEST_ROOT}/`)) {
        fail(
            rel,
            `a .test.ts outside \`${TEST_ROOT}/\``,
            `Vitest is configured with \`include: ['${TEST_ROOT}/**/*.test.ts']\` — a suite anywhere else is discovered by no runner. It stops running while still looking like a test, which is the worst of both.`,
        );
        continue;
    }
    const area = rel.split('/')[1];
    if (!MIRRORED.includes(area)) {
        fail(
            rel,
            `sits under \`${TEST_ROOT}/${area}/\`, which mirrors no \`src/\` directory`,
            `\`${TEST_ROOT}/\` mirrors \`src/\` one-for-one (${MIRRORED.join(', ')}). A tree that only half-mirrors is one you have to search rather than navigate — if this really is a new area, add it to MIRRORED in this gate along with the \`src/\` directory it mirrors.`,
        );
    }
}

// ── 2. The .test.ts suffix is the mechanism ─────────────────────────────────
for (const rel of repoFiles.filter((f) => /\.spec\.[tj]s$/.test(f))) {
    fail(
        rel,
        'a .spec file',
        'Every test file ends in `.test.ts`. Vitest matches that suffix and nothing else, so a `.spec` file is run by nothing at all while still reading as a test — rename it.',
    );
}

// ── 3. No E2E suite, by decision ────────────────────────────────────────────
const E2E_ARTEFACTS = repoFiles.filter((f) => /^e2e\//.test(f) || /^playwright\.config\./.test(f));
for (const rel of E2E_ARTEFACTS) {
    fail(
        rel,
        'an E2E suite appearing without discussion',
        "There is deliberately no E2E suite: Playwright's Electron API is experimental and an earlier attempt here was removed. The standard asks that adding one back be raised first — so raise it, then delete this section along with the paragraph in CONTRIBUTING.md.",
    );
}
const manifest = JSON.parse(read('package.json'));
for (const dep of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (/^(@playwright\/|playwright)/.test(dep)) {
        fail(
            'package.json',
            `\`${dep}\` is installed`,
            'Same decision as above, arriving through the manifest instead of a config file. An E2E dependency nothing runs is a CI install cost and an unread intent.',
        );
    }
}

// ── 4. The coverage config, ratcheted ───────────────────────────────────────
const configSrc = read(VITEST_CONFIG);

const thresholdBlock = /thresholds:\s*\{([^}]*)\}/.exec(configSrc);
if (thresholdBlock === null) {
    fail(
        VITEST_CONFIG,
        'no `thresholds` block found in the coverage config',
        'Either it was removed — in which case coverage no longer fails anything — or it was reshaped and this gate can no longer read it. Both need a human.',
    );
} else {
    for (const [metric, floor] of Object.entries(MIN_THRESHOLDS)) {
        const m = new RegExp(`${metric}:\\s*(\\d+)`).exec(thresholdBlock[1]);
        if (m === null) {
            fail(VITEST_CONFIG, `no \`${metric}\` threshold`, 'All four metrics carry a floor; branches is the honest one.');
        } else if (Number(m[1]) < floor) {
            fail(
                VITEST_CONFIG,
                `\`${metric}\` threshold lowered to ${m[1]} (floor is ${floor})`,
                'Coverage ratchets one way. Lowering the number does not fix the gap, it deletes the record of it — write the test, then raise MIN_THRESHOLDS here to match.',
            );
        }
    }
}

const excludeBlock = /exclude:\s*\[([\s\S]*?)\]/.exec(configSrc);
if (excludeBlock === null) {
    fail(VITEST_CONFIG, 'no coverage `exclude` list found', 'This gate can no longer tell whether the list has grown.');
} else {
    const listed = [...excludeBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const entry of listed) {
        if (!ALLOWED_EXCLUDES.has(entry)) {
            fail(
                VITEST_CONFIG,
                `new coverage exclude \`${entry}\``,
                'A file at 0% is the signal to write the missing test, not to add another exclude. If this one genuinely has no testable runtime, add it to ALLOWED_EXCLUDES in this gate with the reason — one sentence, written once, instead of a list nobody reviews.',
            );
        }
    }
    for (const [entry] of ALLOWED_EXCLUDES) {
        if (!listed.includes(entry)) {
            fail(
                VITEST_CONFIG,
                `\`${entry}\` is no longer excluded from coverage`,
                'Good news, probably — remove it from ALLOWED_EXCLUDES in this gate so the two lists stay in step.',
            );
        }
    }
}

// ── 5. Nothing at 0% (needs a coverage report) ──────────────────────────────
let measured = 0;
let uncovered = 0;
const haveCoverage = exists(COVERAGE_SUMMARY);

if (haveCoverage) {
    const summary = JSON.parse(read(COVERAGE_SUMMARY));
    for (const [key, entry] of Object.entries(summary)) {
        if (key === 'total') continue;
        const rel = path.isAbsolute(key) ? path.relative(ROOT, key) : key;
        measured++;
        if (entry.statements.total === 0) continue;
        if (entry.statements.covered === 0) {
            uncovered++;
            fail(
                rel,
                `0% of ${entry.statements.total} statement(s) covered — no test imports this file`,
                'The aggregate hides this: one untested module inside an 87% total is a rounding error. Write the suite, or if the file genuinely has no testable runtime, say so in ALLOWED_EXCLUDES here rather than leaving it at zero.',
            );
        }
    }
}

// ── 6. Suite hygiene ────────────────────────────────────────────────────────
const HYGIENE = [
    {
        re: /^\s*(?:describe|it|test)\.only\b/,
        what: 'a parked `.only`',
        why: 'A stray `.only` silently disables every other test in its file. The run stays green and the count drops by an amount nobody investigates.',
    },
    {
        re: /^\s*(?:describe|it|test)\.skip\b/,
        what: 'a parked `.skip`',
        why: 'A skipped test is a deferred fix living in the code. Fix it or delete it — parking it keeps the suite green about something that is not.',
    },
    {
        re: /^\s*test(?:\.\w+)?\s*\(/,
        what: 'a bare `test()`',
        why: '`describe` for grouping, `it` for cases. One vocabulary per suite, so a reader scanning for cases finds all of them.',
    },
    {
        re: /^\s*\/\/\s*(?:describe|it|test)(?:\.\w+)?\s*\(/,
        what: 'a commented-out test',
        why: 'Deleting a test is fine; leaving it as a comment is a deletion without the honesty. Git remembers it either way.',
    },
];

for (const rel of unitTests) {
    read(rel)
        .split('\n')
        .forEach((line, i) => {
            for (const { re, what, why } of HYGIENE) {
                if (re.test(line)) fail(`${rel}:${i + 1}`, what, why);
            }
        });
}

/**
 * Duplicate case titles, scoped to the enclosing `describe` — the same title in
 * two different blocks reads fine and is everywhere in this suite; the same
 * title twice in ONE block is a copy-paste that lost its edit. `it.each` titles
 * are skipped: their `%s` placeholders expand per case at run time.
 */
for (const rel of unitTests) {
    const stack = [];
    const seen = new Map();
    let depth = 0;

    for (const line of read(rel).split('\n')) {
        const opened = /^\s*describe(?:\.\w+)?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/.exec(line);
        const cased = /^\s*it\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/.exec(line);

        if (opened !== null) {
            stack.push({ title: opened[2], depth });
        } else if (cased !== null) {
            const key = [...stack.map((s) => s.title), cased[2]].join(' › ');
            seen.set(key, (seen.get(key) ?? 0) + 1);
        }

        for (const ch of line) {
            if (ch === '{' || ch === '(') depth++;
            else if (ch === '}' || ch === ')') depth--;
        }
        while (stack.length > 0 && depth <= stack[stack.length - 1].depth) stack.pop();
    }

    for (const [key, count] of seen) {
        if (count > 1) {
            fail(
                rel,
                `${count} cases titled \`${key}\` in the same describe`,
                'A copy-paste that lost its edit: both run, neither fails, and the second one\'s intent is gone. Give it the title it was meant to have, or delete it if it duplicates the first.',
            );
        }
    }
}

// ── 7. Reaching into component internals, ratcheted ─────────────────────────
const vmHits = [];
for (const rel of unitTests) {
    read(rel)
        .split('\n')
        .forEach((line, i) => {
            if (/\.vm\.[a-zA-Z_][a-zA-Z0-9_]*/.test(line)) vmHits.push(`${rel}:${i + 1}`);
        });
}
if (vmHits.length > VM_ACCESS_BASELINE) {
    for (const site of vmHits.slice(VM_ACCESS_BASELINE)) {
        fail(
            site,
            "reads a component's internals through `wrapper.vm`",
            'Assert what the component DOES — what renders, what event fires, what the user sees. A test bound to internal state breaks on every refactor without catching a single real bug. (`wrapper.vm.$nextTick` and friends are Vue\'s public API and are not counted.) If this case genuinely warrants it, raise VM_ACCESS_BASELINE in this gate with the reason.',
        );
    }
} else if (vmHits.length < VM_ACCESS_BASELINE) {
    fail(
        'scripts/check/check-testing.mjs',
        `VM_ACCESS_BASELINE is ${VM_ACCESS_BASELINE} but only ${vmHits.length} site(s) remain`,
        'Lower it so the ratchet cannot slip back.',
    );
}

// ── 8. The DOM environment named by the standard ────────────────────────────
const configuredEnv = /environment:\s*'([\w-]+)'/.exec(configSrc);
if (configuredEnv === null) {
    fail(VITEST_CONFIG, 'could not read the test `environment`', 'This gate can no longer tell which DOM implementation the suite runs on.');
} else if (configuredEnv[1] !== DOM_ENVIRONMENT) {
    fail(
        VITEST_CONFIG,
        `tests run on \`${configuredEnv[1]}\`, but the standard names \`${DOM_ENVIRONMENT}\``,
        'Switch it back, or change CONTRIBUTING.md and DOM_ENVIRONMENT here together. They are one decision, and when they disagree the config wins silently.',
    );
}

for (const rel of unitTests) {
    const m = /@vitest-environment\s+([\w-]+)/.exec(read(rel));
    if (m !== null && m[1] !== DOM_ENVIRONMENT) {
        fail(
            rel,
            `pins itself to \`${m[1]}\` with an @vitest-environment pragma`,
            `The project config chooses the environment for every suite. A pragma that disagrees with it is a per-file override nobody reading ${VITEST_CONFIG} would ever see.`,
        );
    }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`\n✘ ${failures.length} testing standards violation(s):\n`);
    for (const { file, what, why } of failures) {
        console.error(`  • ${file}: ${what}`);
        console.error(`    → ${why}\n`);
    }
    console.error('See the Testing section of .github/CONTRIBUTING.md, then re-run.\n');
    process.exit(1);
}

console.log(
    `\n✓ Testing OK — ${unitTests.length} suite(s), all under \`${TEST_ROOT}/\` mirroring \`src/\`, all named \`.test.ts\`, no E2E reintroduced, coverage thresholds at or above the ${MIN_THRESHOLDS.statements}% floor, ${ALLOWED_EXCLUDES.size} coverage exclude(s) all accounted for, no \`.only\`/\`.skip\`/bare \`test()\`/commented-out or duplicate cases, no test reading component internals, all on ${DOM_ENVIRONMENT}.`,
);
console.log(
    haveCoverage
        ? `  Coverage report: ${measured} file(s) measured, ${uncovered} with no test at all.`
        : '  Coverage report: not present — the 0%-file check was SKIPPED. Run `npm run test:coverage` first to include it.',
);
console.log(
    '\nNot machine-checked: whether a passing test asserts anything worth asserting, whether the next test to write is the highest-priority one, whether a component test would survive a refactor.',
);
