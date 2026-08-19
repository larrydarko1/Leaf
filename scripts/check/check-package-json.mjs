#!/usr/bin/env node
/**
 * package.json conformance gate.
 *   1. REQUIRED METADATA. Identity, provenance and the toolchain facts. `private:
 *      true` is the guard against a stray `npm publish` on an AGPL desktop app.
 *   2. SEMVER PREFIXES. `^` for everything, `~` only for packages listed below
 *      with a reason, never an exact pin — an exact pin silently opts out of
 *      security patches, and the lockfile is the real pin. The allowlist is the
 *      point: a `~` is a deliberate decision, so it should cost a line of prose.
 *   3. FIELD ORDER. The sort-package-json canonical order, so the manifest stays
 *      diff-friendly and a reader always finds a field where they expect it.
 *   4. THE ELECTRON ENTRY POINT. `main` has to name the file electron-vite
 *      actually emits. Get it wrong and `npm run build:electron` produces an
 *      installer that opens to nothing — a packaging-only failure, invisible in
 *      dev, where electron-vite serves the renderer itself.
 *   5. `build.files` SHIPS THE BUILD OUTPUT. electron-builder defaults to
 *      including everything, so a `files` allowlist that forgets `out` produces
 *      an app bundle with no application in it. It packages successfully.
 *   6. `os` AGREES WITH THE BUILD TARGETS. `os` is what npm enforces at install
 *      time and what the README's support claim rests on; `build.mac`/`build.linux`
 *      are what CI can actually produce. Drifting them apart means either
 *      advertising a platform nobody builds, or building one npm refuses to
 *      install on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

const MANIFEST = 'package.json';

const CANONICAL_ORDER = [
    'name',
    'version',
    'description',
    'keywords',
    'homepage',
    'bugs',
    'license',
    'author',
    'contributors',
    'funding',
    'type',
    'files',
    'main',
    // electron-builder reads this for the Linux .desktop file name.
    'desktopName',
    'browser',
    'module',
    'types',
    'typings',
    'exports',
    'sideEffects',
    'imports',
    'bin',
    'man',
    'directories',
    'repository',
    'scripts',
    'config',
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'optionalDependencies',
    'bundleDependencies',
    'overrides',
    'resolutions',
    'engines',
    'os',
    'cpu',
    'private',
    'packageManager',
    'publishConfig',
    'browserslist',
    // Tool config blocks last: they are the largest and the least often read.
    'build',
    'lint-staged',
];

const REQUIRED = [
    'name',
    'version',
    'description',
    'keywords',
    'homepage',
    'bugs',
    'license',
    'author',
    'repository',
    'type',
    'main',
    'engines',
    'os',
    'private',
    'packageManager',
    'build',
];

/**
 * Packages allowed a `~` (patch-only) range, and why. Anything else must be `^`.
 */
const TILDE_ALLOWED = new Map([
    ['typescript', 'Its minor releases introduce new type errors, so a minor bump is a code change, not a dependency bump.'],
    [
        'electron-log',
        'Deliberate patch-pin — the reason is not recorded. Replace this note with it the next time you touch the range, or move the dep to `^`.',
    ],
]);

const failures = [];
const fail = (what, why) => failures.push({ what, why });

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8'));
const keys = Object.keys(pkg);

// ── 1. Required metadata ─────────────────────────────────────────────────────
for (const field of REQUIRED) {
    const value = pkg[field];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        fail(`is missing the required field \`${field}\``, 'Identity, provenance and toolchain facts — the fields a reader or a build tool has no other source for.');
    }
}

if (pkg.private !== true) {
    fail('`private` is not `true`', 'It is the only guard against a stray `npm publish` of a packaged desktop app.');
}

if (typeof pkg.version === 'string' && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pkg.version)) {
    fail(`\`version\` ("${pkg.version}") is not semver`, 'The release workflow reads it to build the tag and the installer filenames; a non-semver value produces a tag nobody can order.');
}

// ── 2. Semver prefixes ───────────────────────────────────────────────────────
for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (/^(workspace:|file:|link:|npm:|git\+|\*)/.test(range)) continue;

        if (range.startsWith('~')) {
            if (!TILDE_ALLOWED.has(name)) {
                fail(
                    `${field}.${name} is "${range}" — a \`~\` range is not on the allowlist`,
                    'Patch-only is a deliberate decision. Add it to TILDE_ALLOWED in this gate with the reason, or use `^`.',
                );
            }
            continue;
        }

        if (name === 'typescript') {
            fail(`${field}.typescript is "${range}" — it must be "~"`, TILDE_ALLOWED.get('typescript'));
            continue;
        }

        if (!range.startsWith('^')) {
            fail(
                `${field}.${name} is pinned exactly to "${range}"`,
                'An exact pin opts out of security patches while adding nothing — package-lock.json is what actually pins the installed tree.',
            );
        }
    }
}

// ── 3. Field order ───────────────────────────────────────────────────────────
const unknown = keys.filter((k) => !CANONICAL_ORDER.includes(k));
if (unknown.length > 0) {
    fail(
        `has field(s) this gate does not know where to sort: ${unknown.join(', ')}`,
        'Add them to CANONICAL_ORDER at the position they belong, so the ordering rule stays total rather than quietly skipping them.',
    );
}

const ranked = keys.filter((k) => CANONICAL_ORDER.includes(k));
const sorted = [...ranked].sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));
if (ranked.join(',') !== sorted.join(',')) {
    const firstDiff = ranked.findIndex((k, i) => k !== sorted[i]);
    fail(
        `field order diverges at \`${ranked[firstDiff]}\` (expected \`${sorted[firstDiff]}\`)`,
        `Canonical order is: ${sorted.join(', ')}`,
    );
}

// ── 4. The Electron entry point ──────────────────────────────────────────────
const viteConfig = fs.readFileSync(path.join(ROOT, 'electron.vite.config.ts'), 'utf8');
const mainInput = viteConfig.match(/main:\s*\{[\s\S]*?input:\s*\{\s*index:\s*resolve\(__dirname,\s*'([^']+)'/);

if (typeof pkg.main !== 'string') {
    fail('`main` is not a string', 'Electron resolves the main process from it; without it the app has no entry point.');
} else {
    if (!/^out\//.test(pkg.main)) {
        fail(
            `\`main\` is "${pkg.main}", which is not under \`out/\``,
            'electron-vite builds into out/. Pointing main at src/ ships TypeScript to a runtime that cannot read it.',
        );
    }
    if (mainInput !== null) {
        const expected = `out/${mainInput[1].replace(/^src\//, '').replace(/\.ts$/, '.js')}`;
        if (pkg.main !== expected) {
            fail(
                `\`main\` is "${pkg.main}" but electron-vite emits "${expected}"`,
                'A packaging-only failure: dev works because electron-vite launches the process itself, so this surfaces first as an installer that opens to nothing.',
            );
        }
    }
}

// ── 5. build.files ships the build output ────────────────────────────────────
const buildFiles = pkg.build?.files;
if (!Array.isArray(buildFiles)) {
    fail('`build.files` is not an array', 'Without an explicit allowlist electron-builder packages the whole tree, including node_modules and src.');
} else {
    const shipsOut = buildFiles.some((entry) => (typeof entry === 'string' ? /(^|\/)out/.test(entry) : entry?.from === 'out'));
    if (!shipsOut) {
        fail(
            '`build.files` does not include the `out` directory',
            'electron-builder would produce a bundle with no application in it, and it would package successfully.',
        );
    }
    if (!buildFiles.includes('package.json')) {
        fail('`build.files` does not include `package.json`', 'Electron reads `main` from the packaged manifest at launch; omit it and the app has no entry point.');
    }
}

// ── 6. `os` agrees with the build targets ────────────────────────────────────
const OS_TO_TARGET = { darwin: 'mac', linux: 'linux', win32: 'win' };
const declaredOs = Array.isArray(pkg.os) ? pkg.os : [];

for (const osName of declaredOs) {
    const target = OS_TO_TARGET[osName];
    if (target !== undefined && pkg.build?.[target] === undefined) {
        fail(
            `\`os\` lists "${osName}" but \`build.${target}\` has no target`,
            'Advertising a platform CI cannot produce an installer for. The README support claim and the release assets come apart.',
        );
    }
}
for (const [osName, target] of Object.entries(OS_TO_TARGET)) {
    if (pkg.build?.[target] !== undefined && !declaredOs.includes(osName)) {
        fail(
            `\`build.${target}\` builds an installer but \`os\` does not list "${osName}"`,
            'npm refuses to install on a platform absent from `os`, so the build target is for a platform contributors cannot set up.',
        );
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
    console.error(`✗ package.json check failed — ${failures.length} problem(s):\n`);
    for (const { what, why } of failures) {
        console.error(`  • ${MANIFEST} ${what}`);
        console.error(`    ${why}`);
    }
    process.exit(1);
}

console.log(
    '✓ package.json check passed — metadata, semver ranges, field order, Electron entry + packaging, os/target parity.',
);
