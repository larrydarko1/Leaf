#!/usr/bin/env node
/**
 * tsconfig drift gate.
 * The compiler settles what is checked, and every rule here exists because a
 * config can be wrong in a way that makes MORE code compile, not less — so the
 * build stays green and the mistake is invisible until something ships:
 *   • a project that does not extend the base, or extends it FIRST in an
 *     `extends` array. Later entries win, so a base listed ahead of a preset is
 *     silently overridden — the file names the strict config and gets the
 *     lax one, which is exactly what `@vue/tsconfig` would do to the renderer;
 *   • a base flag re-declared weaker in one project with no reason written
 *     down. `noUnusedLocals: false` in a test config reads as housekeeping and
 *     is how a whole program stops reporting a category of dead code;
 *   • the base growing a `target`, a `lib` or an `outDir`. The renderer targets
 *     a Chromium the app ships with and the main process targets the bundled
 *     Node; those are different numbers and each file records its own;
 *   • `types` dropped from a project. The default is not "no globals", it is
 *     EVERY hoisted `@types/*` package — so the config still compiles and the
 *     program silently widens to whatever a transitive dependency installed;
 *   • `node` in the renderer's `types`. The renderer runs with context
 *     isolation and no Node integration: `process`, `Buffer` and `require` do
 *     not exist there at runtime. Typing them in means the compiler agrees with
 *     code that crashes in the packaged app, and the mistake only surfaces
 *     outside `npm run dev`;
 *   • a `target` and a `lib` naming different ES years, which types the old
 *     library surface while emitting the new syntax;
 *   • a project config no script ever runs. `tsconfig.test.json` was exactly
 *     that — a hardened config nothing ever pointed a compiler at;
 *   • a solution file — `files: []` plus `references`, which is what the root
 *     `tsconfig.json` is — pointed at with `-p` instead of `-b`. It has no
 *     input files of its own, so tsc loads it, compiles nothing and exits 0.
 *     Only build mode follows the references to the projects that hold the
 *     actual source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT as ROOT } from '../lib/repo-root.ts';
import { stripComments } from '../lib/strip-comments.ts';

const BASE = 'tsconfig.base.json';
const RENDERER = 'tsconfig.app.json';
const NODE_TYPED = ['tsconfig.node.json'];

/** Build output and vendored trees carry tsconfigs that are nobody's to edit. */
const IGNORED_DIRS = new Set(['node_modules', 'out', 'dist-electron', 'coverage']);

/**
 * The checking rules the base owns, at the value that is the strict one. A
 * project may differ — with a reason — but the base may not be missing any of
 * them, or strictness becomes something each project decides for itself.
 */
const BASE_FLAGS: Record<string, boolean> = {
    strict: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
    noUncheckedIndexedAccess: true,
    allowUnreachableCode: false,
    allowUnusedLabels: false,
    noFallthroughCasesInSwitch: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    esModuleInterop: true,
    isolatedModules: true,
    noUncheckedSideEffectImports: true,
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    erasableSyntaxOnly: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
};

/** Settings that describe an environment, not a checking rule. The base states it holds none. */
const ENVIRONMENTAL = ['target', 'lib', 'module', 'moduleResolution', 'outDir', 'rootDir', 'noEmit', 'paths', 'types'];

/** Section dividers, in the order they must appear. */
const SECTIONS = [
    'Output & Build',
    'Target & Environment',
    'Paths & Types',
    'Type Checking - Base',
    'Type Checking - Additional Strictness',
    'Specific Behaviors',
    'Module System',
    'Library & Syntax',
];

type CompilerOptions = Record<string, unknown> & { target?: string; lib?: string[]; types?: string[] };
type TsconfigData = {
    extends?: string | string[];
    compilerOptions?: CompilerOptions;
    files?: unknown[];
    references?: { path: string }[];
};
type Config = { raw: string; data: TsconfigData; own: CompilerOptions; options: CompilerOptions | undefined };

type Failure = { rel: string; problem: string; why: string };

const errors: Failure[] = [];
const fail = (rel: string, problem: string, why: string): void => {
    errors.push({ rel, problem, why });
};
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const configs = new Map(listConfigs('.').map((rel) => [rel, parse(rel)]));
const base = configs.get(BASE);

if (base === undefined) {
    console.error(`✖ ${BASE} is missing. It is the one file that decides what is checked.`);
    process.exit(1);
}

/** Configs that actually check code: not the base, not a `files: []` solution file. */
const projects = [...configs].filter(([rel, cfg]) => rel !== BASE && cfg.options !== undefined);

// ── 1. Every project extends the base, and the base wins ────────────────────
// Resolved, not spelled: a misspelled `extends` target is a warning tsc carries
// on past. The file reads as strict and is not.
for (const [rel, cfg] of projects) {
    const parents = cfg.data.extends === undefined ? [] : [cfg.data.extends].flat();
    const at = parents.findIndex((p) => resolveExtends(p, rel) === BASE);

    if (at === -1) {
        const spelled = parents.find((p) => p.endsWith(BASE));
        if (spelled !== undefined) {
            fail(
                rel,
                `extends "${spelled}", which does not resolve to ${BASE}`,
                `From this file that path is ${path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, rel)), spelled))}, which is not a file. tsc warns and carries on, so the project silently checks nothing it names.`,
            );
        } else {
            fail(
                rel,
                `does not extend ${BASE}`,
                'A project outside the base decides its own strictness, and the default is lax. Extend it, even to override one flag afterwards.',
            );
        }
    } else if (at !== parents.length - 1) {
        fail(
            rel,
            `extends ${BASE} at position ${at + 1} of ${parents.length}`,
            'Later entries win. A base ahead of a preset is overridden by it: the file names the strict config and compiles under the lax one, with nothing to show for it. Put the base last.',
        );
    }
}

// ── 2. The base holds every checking flag and no environment ────────────────
for (const [flag, strictValue] of Object.entries(BASE_FLAGS)) {
    const actual = base.options?.[flag];
    if (actual === undefined) {
        fail(
            BASE,
            `does not set \`${flag}\``,
            'Every checking rule lives here, so that turning one off is one visible edit rather than a value a project quietly never set.',
        );
    } else if (actual !== strictValue) {
        fail(
            BASE,
            `sets \`${flag}: ${JSON.stringify(actual)}\``,
            `The base carries the strict value (${strictValue}). A project that genuinely cannot hold this overrides it locally, with the reason next to it — rule 3.`,
        );
    }
}
for (const setting of ENVIRONMENTAL) {
    if (base.options?.[setting] !== undefined) {
        fail(
            BASE,
            `sets \`${setting}\``,
            'The base is checking rules only — its own header says so. A target, a lib or an emit path differs between the renderer and the main process and each one records why it is what it is; a value here is one nobody chose and every project silently inherits.',
        );
    }
}

// ── 3. Weakening a base flag needs the reason written next to it ────────────
// Not a comment somewhere in the file: next to the line. Relaxing a check is a
// decision, and the next person reads the file rather than the commit.
for (const [rel, cfg] of projects) {
    for (const flag of Object.keys(BASE_FLAGS)) {
        if (cfg.own[flag] === undefined || cfg.own[flag] === BASE_FLAGS[flag]) continue;
        if (!hasReason(cfg.raw, flag)) {
            fail(
                rel,
                `overrides \`${flag}: ${JSON.stringify(cfg.own[flag])}\` with no reason`,
                'Write what forces it and what would let it be removed.',
            );
        }
    }
}

// ── 4. A declared target names the same ES year as its lib ──────────────────
for (const [rel, cfg] of projects) {
    const { target, lib } = cfg.own;
    if (target === undefined) continue;
    if (lib === undefined) {
        fail(
            rel,
            `sets \`target: "${target}"\` with no \`lib\``,
            'Without one the library surface is inferred from the target, which is fine until the target moves and nothing says the two are meant to agree. State it.',
        );
    } else if (String(lib[0]).toLowerCase() !== String(target).toLowerCase()) {
        fail(
            rel,
            `targets ${target} but its lib starts at ${String(lib[0])}`,
            'A lib behind the target types the old standard library while the emit uses the new syntax; a lib ahead of it types methods the runtime floor does not have. The first lib entry is the ES year and must match.',
        );
    }
}

// ── 5. Every project declares `types` ───────────────────────────────────────
// The default is not "none". It is every `@types/*` package hoisted into scope,
// so the program widens whenever a transitive dependency adds one and nothing
// in the diff shows it.
for (const [rel, cfg] of projects) {
    if (cfg.own.types === undefined) {
        fail(
            rel,
            'does not declare `types`',
            'Omitting it pulls in every hoisted `@types/*` package, so what is in scope is decided by the dependency tree. List what this project actually needs.',
        );
    }
}
for (const rel of NODE_TYPED) {
    const own = configs.get(rel)?.own;
    if (own !== undefined && JSON.stringify(own.types) !== JSON.stringify(['node'])) {
        fail(
            rel,
            `declares types ${JSON.stringify(own.types)}`,
            'The main and preload program takes `["node"]` and nothing else — no DOM lib, no test globals in the shipped program.',
        );
    }
}

// ── 6. The renderer is never typed against Node ─────────────────────────────
// It runs sandboxed, with context isolation on and node integration off. Node
// globals in scope mean the compiler blesses `process.env` and `Buffer` calls
// that throw in the packaged app, where there is no dev server to fall back on.
{
    const renderer = configs.get(RENDERER);
    if (renderer !== undefined) {
        if ((renderer.own.types ?? []).includes('node')) {
            fail(
                RENDERER,
                'declares `node` in `types`',
                'Everything the renderer may touch arrives over the preload bridge. Typing Node globals in makes unreachable APIs compile — the crash shows up only once packaged.',
            );
        }
        if ((renderer.own.lib ?? []).some((entry) => !/^(es|dom)/i.test(String(entry)))) {
            fail(
                RENDERER,
                `declares lib ${JSON.stringify(renderer.own.lib)}`,
                'The renderer is a browser program: ES and DOM libraries only.',
            );
        }
    }
}

// ── 7. Every project config is reached by a typecheck script ────────────────
// A config nothing runs is a config that drifts for free.
const { reached, pointed } = reachableConfigs();

for (const [rel] of projects) {
    if (!reached.has(rel)) {
        fail(
            rel,
            'is not reached by any typecheck script',
            'Add it to the `typecheck` script — `-p <file>`, or as a reference of the solution file it already builds. Rules 1 to 6 only constrain what a config says; nothing but a compiler run constrains whether it is true.',
        );
    }
}

// ── 8. A solution file is only ever run in build mode ───────────────────────
// The reachability above trusts `-b` to follow references, so the one thing
// that would make it a lie gets its own check: a solution file named with `-p`
// compiles nothing at all and still exits 0.
for (const rel of pointed) {
    const cfg = configs.get(rel);
    if (cfg !== undefined && isSolution(cfg.data)) {
        fail(
            rel,
            'is a solution file run without `-b`',
            'It declares `files: []`, so under `-p` tsc has no input, checks not one line and exits 0 — the script reads as a typecheck of everything the file references and is a no-op. Only `-b`/`--build` follows `references`.',
        );
    }
}

// ── 9. Section dividers come from the known set, in order ───────────────────
for (const [rel, cfg] of configs) {
    const found = sectionsOf(cfg.raw);
    let highest = -1;
    for (const { name, line } of found) {
        const at = SECTIONS.indexOf(name);
        if (at === -1) {
            fail(
                rel,
                `unknown section divider "${name}" (line ${line})`,
                `One of: ${SECTIONS.join(', ')}. A divider nobody else uses sorts nowhere and stops grouping anything.`,
            );
        } else if (at < highest) {
            fail(
                rel,
                `section "${name}" is out of order (line ${line})`,
                `Dividers run in a fixed order so the same setting sits in the same place in every file: ${SECTIONS.join(' → ')}.`,
            );
        } else {
            highest = at;
        }
    }
}

/** Every tsconfig in the repo, minus node_modules, build output and dotted directories. */
function listConfigs(rel: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        const child = rel === '.' ? entry.name : `${rel}/${entry.name}`;
        if (entry.isDirectory()) listConfigs(child, out);
        else if (/^tsconfig(\..+)?\.json$/.test(entry.name)) out.push(child);
    }
    return out;
}

/**
 * A config as both text and data. `options` is what the file plus its ancestors
 * decide; `own` is only what this file states, which is what rules 3 to 6 are
 * about — inheriting a setting is not the same as choosing it.
 */
function parse(rel: string): Config {
    const raw = read(rel);
    let data: TsconfigData;
    try {
        data = JSON.parse(stripComments(raw)) as TsconfigData;
    } catch (e) {
        fail(
            rel,
            `is not parseable JSON (${(e as Error).message})`,
            'tsc reads JSONC — comments are fine, a trailing comma is not.',
        );
        data = {};
    }
    return { raw, data, own: data.compilerOptions ?? {}, options: effective(rel, data) };
}

/** compilerOptions merged down the `extends` chain, nearest file winning. */
function effective(rel: string, data: TsconfigData, seen = new Set<string>()): CompilerOptions | undefined {
    if (seen.has(rel)) return {}; // cyclic extends: tsc's error to report, not ours
    seen.add(rel);

    let inherited: CompilerOptions = {};
    for (const specifier of data.extends === undefined ? [] : [data.extends].flat()) {
        const parent = resolveExtends(specifier, rel);
        if (parent === null) continue; // an unresolvable parent is tsc's complaint
        try {
            inherited = {
                ...inherited,
                ...effective(parent, JSON.parse(stripComments(read(parent))) as TsconfigData, seen),
            };
        } catch {
            continue;
        }
    }
    return data.compilerOptions === undefined && Object.keys(inherited).length === 0
        ? undefined
        : { ...inherited, ...(data.compilerOptions ?? {}) };
}

/** Resolve one `extends` entry to a repo-relative path, or null for a package outside the tree. */
function resolveExtends(specifier: string, fromRel: string): string | null {
    if (!specifier.startsWith('.')) return null; // a published preset — not ours to check
    const from = path.resolve(path.dirname(path.join(ROOT, fromRel)), specifier);
    const hit = [from, `${from}.json`, path.join(from, 'tsconfig.json')].find(
        (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
    );
    return hit === undefined ? null : path.relative(ROOT, hit);
}

/** Is there a comment on this setting's line, or on the lines immediately above it? */
function hasReason(raw: string, flag: string): boolean {
    const lines = raw.split('\n');
    const at = lines.findIndex((line) => new RegExp(`^\\s*"${flag}"\\s*:`).test(line));
    if (at === -1) return false;
    if (/\/\/|\/\*/.test((lines[at] ?? '').replace(new RegExp(`^\\s*"${flag}"\\s*:.*?(?=//|/\\*|$)`), ''))) return true;

    for (let i = at - 1; i >= 0; i--) {
        const above = (lines[i] ?? '').trim();
        if (above === '') continue;
        // A section divider is a label, not a reason — keep walking past it.
        if (
            /^\/\*.*\*\/$/.test(above) &&
            SECTIONS.includes(above.replace(/^\/\*\s*|\s*\*\/$/g, '').split(' — ')[0] ?? '')
        )
            continue;
        return above.startsWith('//') || above.startsWith('*') || above.endsWith('*/');
    }
    return false;
}

/**
 * Single-line `/* … *\/` comments, which is what a section divider is. A
 * multi-line block is prose about the setting under it and is left alone; a
 * divider may carry a trailing ` — reason`, and sorts on the label before it.
 */
function sectionsOf(raw: string): { line: number; name: string }[] {
    return raw
        .split('\n')
        .map((line, i) => ({ line: i + 1, text: line.trim() }))
        .filter(({ text }) => /^\/\*[^*].*\*\/$/.test(text))
        .map(({ line, text }) => ({
            line,
            name: (text.replace(/^\/\*\s*|\s*\*\/$/g, '').split(' — ')[0] ?? '').trim(),
        }));
}

/**
 * Configs a compiler is actually pointed at. Every `npm run` script is read,
 * not just `typecheck`, and each `&&` segment is judged on its own, because tsc
 * has three different ways of being told what to compile:
 *   • `-p <file>` names one project outright;
 *   • `-b`/`--build` takes its projects as positional arguments instead, and
 *     then compiles everything they `reference` as well. `vue-tsc -b
 *     tsconfig.json` names one file and runs three: the solution file holds no
 *     source of its own and points at the renderer, main/preload and test
 *     projects, which hold all of it;
 *   • neither, in which case tsc falls back to the `tsconfig.json` beside the
 *     manifest that runs it.
 *
 * `reached` is every config a compiler ends up loading; `pointed` is the subset
 * a script names WITHOUT build mode, which is what rule 8 judges.
 */
function reachableConfigs(): { reached: Set<string>; pointed: Set<string> } {
    const reached = new Set<string>();
    const pointed = new Set<string>();

    const scripts = (JSON.parse(read('package.json')) as { scripts?: Record<string, string> }).scripts ?? {};
    for (const segment of Object.values(scripts).flatMap((command) => command.split('&&'))) {
        const args = segment.trim().split(/\s+/);
        const at = args.findIndex((arg) => /^(?:vue-)?tsc$/.test(arg));
        if (at === -1) continue; // not a compiler run — `tsc-alias`, `tsx`, a path with tsc in it

        const flags = args.slice(at + 1);
        const building = flags.includes('-b') || flags.includes('--build');
        // Build mode reads its projects positionally; -p is the only form otherwise.
        const named = building
            ? flags.filter((arg) => !arg.startsWith('-'))
            : [/(?:-p|--project)\s+(\S+)/.exec(segment)?.[1]].filter((arg): arg is string => arg !== undefined);

        for (const specifier of named.length > 0 ? named : ['tsconfig.json']) {
            const rel = toConfigPath(specifier, '.');
            if (building) addWithReferences(rel, reached);
            else {
                reached.add(rel);
                pointed.add(rel);
            }
        }
    }
    return { reached, pointed };
}

/** A `-b` root drags in everything it references, and everything those reference. */
function addWithReferences(rel: string, out: Set<string>): void {
    if (out.has(rel)) return; // also the cycle guard; tsc reports a reference cycle itself
    out.add(rel);
    for (const { path: specifier } of configs.get(rel)?.data.references ?? []) {
        addWithReferences(toConfigPath(specifier, path.dirname(rel)), out);
    }
}

/** `-p`, `-b` and `references` all take a directory to mean the `tsconfig.json` inside it. */
function toConfigPath(specifier: string, fromDir: string): string {
    const abs = path.resolve(ROOT, fromDir, specifier);
    const file = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? path.join(abs, 'tsconfig.json') : abs;
    return path.relative(ROOT, file);
}

/** A config that holds no source of its own and exists only to point at others. */
function isSolution(data: TsconfigData): boolean {
    return Array.isArray(data.files) && data.files.length === 0 && (data.references ?? []).length > 0;
}

// ── Report ──────────────────────────────────────────────────────────────────
if (errors.length > 0) {
    console.error(`\n✖ ${errors.length} tsconfig problem(s):\n`);
    for (const { rel, problem, why } of errors) {
        console.error(`  ${rel}: ${problem}`);
        console.error(`    → ${why}\n`);
    }
    process.exit(1);
}

console.log(
    `✔ tsconfigs consistent: ${projects.length} projects, each extending ${BASE} last, ` +
        `${Object.keys(BASE_FLAGS).length} checking flags owned by the base and nothing environmental, ` +
        'every override explained, every target matched to its lib, the renderer free of Node types, ' +
        'every project scoping its own `types` and reached by a compiler.',
);
console.log(
    '\nNot machine-checked: whether a target is the right one for its runtime, whether an override is still needed, ' +
        'or whether the Chromium floor Electron ships matches what the renderer typechecks against.',
);
