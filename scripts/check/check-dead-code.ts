#!/usr/bin/env node
/**
 * Dead-code gate — the reachability half of "unused", which ESLint cannot see.
 * Budgets are 0 and only ever go down: delete the dead thing rather than raise one.
 * `npm run dead:check -- --all` also reports the ungated categories below.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.ts';

type Category = { label: string; fix: string };

const CATEGORIES: Record<string, Category> = {
    files: {
        label: 'Unused files',
        fix: 'No entry point reaches this module. Delete it, or import it from something that is reached.',
    },
    exports: {
        label: 'Unused exports',
        fix: 'Nothing imports this. Drop the `export` keyword if the value is still used inside its own file, otherwise delete it. If it is public by design, tag it `/** @public */`.',
    },
    types: {
        label: 'Unused exported types',
        fix: 'Nothing imports this type. Unexport or delete it — a stale exported type reads as a contract and will be written against.',
    },
    nsExports: {
        label: 'Unused exports in a namespace',
        fix: 'Only reachable via `import * as ns` and never accessed off it. The live namespace is what kept it looking used — same fix as an unused export: unexport or delete.',
    },
    nsTypes: {
        label: 'Unused exported types in a namespace',
        fix: 'Only reachable via `import * as ns` and never referenced off it. Unexport or delete.',
    },
    namespaceMembers: {
        label: 'Unused namespace members',
        fix: 'A member of a namespace nothing reads. Delete it — the namespace being imported says nothing about this member being used.',
    },
    enumMembers: {
        label: 'Unused enum members',
        fix: 'Nothing ever compares against this case. Delete it, or find out which code path was supposed to produce it.',
    },
    duplicates: {
        label: 'Duplicate exports',
        fix: 'The same symbol is exported twice under different names. Keep the one callers use and delete the alias — the spare is what someone imports by mistake a year from now.',
    },
    dependencies: {
        label: 'Unused dependencies',
        fix: 'Declared in package.json, imported nowhere. Uninstall it — it costs install time, bundle size, and audit surface for nothing. If it is loaded indirectly (a native backend, a builder hook), list it under `ignoreDependencies` in knip.json with a reason.',
    },
    devDependencies: {
        label: 'Unused devDependencies',
        fix: 'Declared in package.json, used by nothing. Uninstall it — a dev tool nothing runs still costs every CI install.',
    },
    optionalPeerDependencies: {
        label: 'Unused optional peer dependencies',
        fix: 'Declared as an optional peer, imported nowhere. Drop it from the manifest.',
    },
};

/** The second pass. Not a knip issue type — this gate's own word — so it cannot live in CATEGORIES, which doubles as the `--include` list. */
const TEST_ONLY = {
    key: 'testOnlyExports',
    label: 'Exports used only by tests',
    fix: "Production code never imports this; only a test does. Decide which of the four it is: unwired production code (delete it, or wire it), a real part of the module's contract (tag `/** @public */`), an internal reached past the front door (unexport, and test it through the caller that uses it), or an expected value the test should write down as a literal instead of importing (an assertion fed from the code under test cannot fail).",
};

/** CATEGORIES minus `files` and the dependency ones: under `--production` the test files leave the graph, so vitest and every test helper would come back "unused". */
const PROD_INCLUDE = ['exports', 'types', 'nsExports', 'nsTypes', 'namespaceMembers', 'enumMembers'];

const PROD_ARGS = ['--production', '--include-entry-exports'];

/** Reported by `--all`, never gated: drift and resolution failures, not dead code. */
const UNGATED = ['unlisted', 'binaries', 'unresolved', 'cycles'];

const BUDGET = Object.fromEntries([...Object.keys(CATEGORIES), TEST_ONLY.key].map((k) => [k, 0]));

const GATED = Object.keys(CATEGORIES);

const bin = path.resolve(ROOT, 'node_modules/.bin/knip');

if (process.argv.includes('--all')) {
    try {
        const argv = ['--no-progress', '--tags=-public', '--include', [...GATED, ...UNGATED].join(',')];
        execFileSync(bin, argv, { cwd: ROOT, stdio: 'inherit' });
    } catch {
        /* Findings make knip exit non-zero; in this mode we are only reporting. */
    }
    process.exit(0);
}

/** One knip run, bucketed by category. `extra` is what separates the two passes. */
type Hit = { file: string; name: string; line: number | undefined };

type KnipItem = { name: string; line?: number };

/** knip --reporter json, reduced to what this gate reads. */
type KnipReport = { issues?: (Record<string, (KnipItem | KnipItem[])[] | undefined> & { file: string })[] };

function knip(include: string[], extra: string[] = []): Record<string, Hit[]> {
    const args = ['--no-progress', '--reporter', 'json', '--tags=-public', '--include', include.join(','), ...extra];

    let raw: string;
    try {
        raw = execFileSync(bin, args, {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (err) {
        // knip exits non-zero whenever it finds anything, but still prints the report.
        const { stdout, stderr } = err as { stdout?: string; stderr?: string | Buffer };
        raw = stdout ?? '';
        if (raw.trim() === '') {
            console.error('✘ check-dead-code: knip produced no output. Is `knip` installed?');
            if (stderr !== undefined) console.error(stderr.toString().trim());
            process.exit(1);
        }
    }

    let report: KnipReport;
    try {
        report = JSON.parse(raw) as KnipReport;
    } catch {
        console.error("✘ check-dead-code: could not parse knip's JSON report.");
        console.error(raw.slice(0, 500));
        process.exit(1);
    }

    const found: Record<string, Hit[]> = Object.fromEntries(include.map((k) => [k, []]));
    for (const entry of report.issues ?? []) {
        for (const category of include) {
            const hits = found[category] ?? [];
            found[category] = hits;
            for (const item of entry[category] ?? []) {
                hits.push(
                    Array.isArray(item)
                        ? { file: entry.file, name: item.map((s) => s.name).join(' = '), line: item[0]?.line }
                        : { file: entry.file, name: item.name, line: item.line },
                );
            }
        }
    }
    return found;
}

const found = knip(GATED);

/** Anything the first pass named is dead outright and reported there; the remainder is alive only because a test imports it. */
const id = ({ file, name }: Hit): string => `${file}::${name}`;
const alreadyReported = new Set(Object.values(found).flat().map(id));
found[TEST_ONLY.key] = Object.values(knip(PROD_INCLUDE, PROD_ARGS))
    .flat()
    .filter((hit) => !alreadyReported.has(id(hit)));

const where = ({ file, name, line }: Hit): string =>
    name === file ? file : `${file}${line !== undefined ? `:${line}` : ''} — ${name}`;

let failed = false;

const REPORTED: [string, Category][] = [...Object.entries(CATEGORIES), [TEST_ONLY.key, TEST_ONLY]];

for (const [category, { label, fix }] of REPORTED) {
    const hits = found[category] ?? [];
    const budget = BUDGET[category] ?? 0;
    if (hits.length <= budget) continue;

    failed = true;
    console.error(`\n✘ ${label}: ${hits.length} exceeds the budget of ${budget}.\n`);
    for (const hit of hits.sort((a, b) => a.file.localeCompare(b.file))) {
        console.error(`  • ${where(hit)}`);
    }
    console.error(`\n    → ${fix}\n`);
}

if (failed) {
    console.error(
        'Budgets live in scripts/check/check-dead-code.ts and only ever go down.\n' +
            'If an export is public by design, tag it `/** @public */` rather than raising one.\n',
    );
    process.exit(1);
}

console.log(`\nNo dead code: ${GATED.length + 1} categories, all at 0.`);
console.log(
    'Not machine-checked: code reachable from an entry point but never reached at RUNTIME — an IPC handler nothing calls, a branch no setting enables.',
);
