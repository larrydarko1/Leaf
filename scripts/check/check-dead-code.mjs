#!/usr/bin/env node
/**
 * Dead-code gate — the reachability half of "unused", which ESLint cannot see.
 * Budgets are 0 and only ever go down: delete the dead thing rather than raise one.
 * `npm run dead:check -- --all` also reports the ungated categories below.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const CATEGORIES = {
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

/** Reported by `--all`, never gated: drift and resolution failures, not dead code. */
const UNGATED = ['unlisted', 'binaries', 'unresolved', 'cycles'];

const BUDGET = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 0]));

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

const args = ['--no-progress', '--reporter', 'json', '--tags=-public', '--include', GATED.join(',')];

let raw;
try {
    raw = execFileSync(bin, args, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
} catch (err) {
    raw = err.stdout ?? '';
    if (!raw.trim()) {
        console.error('✘ check-dead-code: knip produced no output. Is `knip` installed?');
        if (err.stderr) console.error(err.stderr.toString().trim());
        process.exit(1);
    }
}

let report;
try {
    report = JSON.parse(raw);
} catch {
    console.error("✘ check-dead-code: could not parse knip's JSON report.");
    console.error(raw.slice(0, 500));
    process.exit(1);
}

const found = Object.fromEntries(GATED.map((k) => [k, []]));
for (const entry of report.issues ?? []) {
    for (const category of GATED) {
        for (const item of entry[category] ?? []) {
            found[category].push(
                Array.isArray(item)
                    ? { file: entry.file, name: item.map((s) => s.name).join(' = '), line: item[0]?.line }
                    : { file: entry.file, name: item.name, line: item.line },
            );
        }
    }
}

const where = ({ file, name, line }) => (name === file ? file : `${file}${line ? `:${line}` : ''} — ${name}`);

let failed = false;

for (const [category, { label, fix }] of Object.entries(CATEGORIES)) {
    const hits = found[category];
    if (hits.length <= BUDGET[category]) continue;

    failed = true;
    console.error(`\n✘ ${label}: ${hits.length} exceeds the budget of ${BUDGET[category]}.\n`);
    for (const hit of hits.sort((a, b) => a.file.localeCompare(b.file))) {
        console.error(`  • ${where(hit)}`);
    }
    console.error(`\n    → ${fix}\n`);
}

if (failed) {
    console.error(
        'Budgets live in scripts/check/check-dead-code.mjs and only ever go down.\n' +
            'If an export is public by design, tag it `/** @public */` rather than raising one.\n',
    );
    process.exit(1);
}

console.log(`\nNo dead code: ${GATED.length} categories, all at 0.`);
console.log(
    'Not machine-checked: code reachable from an entry point but never reached at RUNTIME — an IPC handler nothing calls, a branch no setting enables.',
);
