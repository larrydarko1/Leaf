/**
 * Import order — layer 1 of the declaration table, sorted from the inside.
 *
 * Imports are grouped by how far away the imported code lives, farthest first:
 *
 *    1. builtin    — the Node runtime itself: `node:fs`, and bare `fs` / `path`
 *    2. external   — npm packages: `vue`, `electron`, `@vue/test-utils`
 *    3. local      — this app: `@/main/…`, `@/renderer/…`, `./…`, `../…`, and the
 *                    other tsconfig aliases listed in LOCAL_ALIASES
 *
 * `electron` is external even though it feels like part of the platform: it is a
 * package in node_modules like any other, and the main process imports it next to
 * `electron-log`, not next to `node:fs`.
 *
 * One blank line between groups, none inside one, and inside a group the lines are
 * alphabetical by specifier (case-insensitive). That last part is deliberately
 * mechanical: "the order the components appear on the page" feels natural to the
 * author and is unguessable to everyone else, while alphabetical by path clusters
 * a folder's imports together on its own.
 *
 * WHAT IS GROUPED BY SOURCE, NOT BY KIND. There is no "types" group and no
 * "composables" group. `consistent-type-imports` with `inline-type-imports` puts a
 * type and a value from the same module into ONE statement, so a type-only group
 * could not hold that line; and `@/composables/…` sorts next to its neighbours
 * without a rule saying so.
 *
 * THE EXCEPTION IS COMPUTED, NOT LISTED. A side-effect import (`import 'x'`) runs
 * for what it does, and `import 'dotenv/config'` has to run before anything that
 * reads `process.env` at import time. So side-effect imports never move, and they
 * split the import run into segments that are sorted independently. The blank
 * lines on either side of one are left to the author.
 *
 * Only the leading run of imports is checked. An import below a non-import
 * statement is the declaration-order pass's problem, not this one's.
 */
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

import { parse as parseSfc } from '@vue/compiler-sfc';
import ts from 'typescript';

export const IMPORT_GROUPS = ['builtin', 'external', 'local'];

/** tsconfig `paths` entries that look like npm packages but point into this repo. */
const LOCAL_ALIASES = ['@test-utils'];
const BUILTINS = new Set(builtinModules);

/** One import statement, with the text that travels with it when the run is sorted. */
type ImportItem = {
    spec: string;
    group: number;
    line: number;
    sideEffect: boolean;
    start: number;
    end: number;
};

type ImportProblem = { line: number; message: string };

export type ImportAnalysis = { problems: ImportProblem[]; count: number; fixed: string };

function groupOf(spec: string): number {
    if (spec.startsWith('node:') || BUILTINS.has(spec.split('/')[0] ?? spec)) return 0;
    if (spec.startsWith('@/') || spec.startsWith('.')) return 2;
    if (LOCAL_ALIASES.some((alias) => spec === alias || spec.startsWith(`${alias}/`))) return 2;
    return 1;
}

const sortKey = (it: ImportItem): string => it.spec.toLowerCase();

function compare(a: ImportItem, b: ImportItem): number {
    if (a.group !== b.group) return a.group - b.group;
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka === kb) return 0;
    return ka < kb ? -1 : 1;
}

/**
 * The leading run of imports. Each item's text runs from its first attached
 * comment to the end of its last line, so a `// why` above an import or after it
 * moves with it. The first import's leading comment is left alone: that is the
 * file header, not a note about the first import.
 */
function collect(code: string, sf: ts.SourceFile): ImportItem[] {
    const items: ImportItem[] = [];
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) break;
        const lineEnd = code.indexOf('\n', stmt.end);
        const end = lineEnd === -1 ? code.length : lineEnd;
        let start = stmt.getStart(sf);
        if (items.length > 0) {
            const comments = ts.getLeadingCommentRanges(code, stmt.getFullStart()) ?? [];
            const first = comments.find((c) => !/\n\s*\n/.test(code.slice(c.end, start)));
            if (first !== undefined) start = first.pos;
        }
        items.push({
            spec: (stmt.moduleSpecifier as ts.StringLiteral).text,
            group: groupOf((stmt.moduleSpecifier as ts.StringLiteral).text),
            line: sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1,
            sideEffect: stmt.importClause === undefined,
            start,
            end,
        });
    }
    return items;
}

/** Splits the run at side-effect imports, which never move. */
function segments(items: ImportItem[]): ImportItem[][] {
    const out: ImportItem[][] = [[]];
    for (const it of items) {
        if (it.sideEffect) out.push([]);
        else out[out.length - 1]?.push(it);
    }
    return out.filter((seg) => seg.length > 0);
}

const blankLinesBetween = (code: string, a: ImportItem, b: ImportItem): number =>
    code.slice(a.end, b.start).split('\n').length - 2;

function render(code: string, seg: ImportItem[]): string {
    const sorted = [...seg].sort(compare);
    return sorted
        .map((it, idx) => {
            const prev = sorted[idx - 1];
            if (prev === undefined) return code.slice(it.start, it.end);
            return (prev.group === it.group ? '\n' : '\n\n') + code.slice(it.start, it.end);
        })
        .join('');
}

function analyzeImports(code: string, filename: string): ImportAnalysis {
    const sf = ts.createSourceFile(filename, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const items = collect(code, sf);
    const problems: ImportProblem[] = [];
    let fixed = code;

    // Right to left, so earlier offsets stay valid while later segments are replaced.
    for (const seg of segments(items).reverse()) {
        const sorted = [...seg].sort(compare);
        sorted.forEach((it, idx) => {
            if (seg[idx] !== it) {
                const prev = sorted[idx - 1];
                problems.push({
                    line: it.line,
                    message: `"${it.spec}" (${IMPORT_GROUPS[it.group]}) belongs ${prev === undefined ? 'first' : `after "${prev.spec}"`}`,
                });
            }
        });
        for (let idx = 1; idx < seg.length; idx++) {
            const prev = seg[idx - 1];
            const it = seg[idx];
            if (prev === undefined || it === undefined || prev.group > it.group) continue;
            const blanks = blankLinesBetween(code, prev, it);
            const want = prev.group === it.group ? 0 : 1;
            if (blanks !== want) {
                problems.push({
                    line: it.line,
                    message:
                        want === 0
                            ? `blank line inside the ${IMPORT_GROUPS[it.group]} group, above "${it.spec}"`
                            : `needs exactly one blank line between the ${IMPORT_GROUPS[prev.group]} and ${IMPORT_GROUPS[it.group]} groups, above "${it.spec}"`,
                });
            }
        }
        const first = seg[0];
        const last = seg[seg.length - 1];
        // A comment floating between two imports belongs to neither, so a rewrite
        // would drop it. Report the segment, but leave it for a human to fix.
        const floating = seg.some((it, idx) => idx > 0 && code.slice(seg[idx - 1]?.end, it.start).trim() !== '');
        if (first !== undefined && last !== undefined && !floating) {
            fixed = fixed.slice(0, first.start) + render(code, seg) + fixed.slice(last.end);
        }
    }
    problems.sort((a, b) => a.line - b.line);
    return { problems, count: items.length, fixed };
}

/** One file's script text, unwrapping an SFC's <script setup> — and where it sits in the file. */
function readScript(rel: string, root: string): { source: string; code: string; offset: number } | null {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    if (!rel.endsWith('.vue')) return { source, code: source, offset: 0 };
    const { descriptor } = parseSfc(source, { filename: rel });
    const block = descriptor.scriptSetup ?? descriptor.script;
    if (block === null) return null;
    return { source, code: block.content, offset: block.loc.start.offset };
}

/** Analyses a file's imports, with problem lines relative to the whole file. */
export function checkImportsInFile(rel: string, root: string): ImportAnalysis | null {
    const script = readScript(rel, root);
    if (script === null) return null;
    const res = analyzeImports(script.code, rel.endsWith('.vue') ? rel + '.ts' : rel);
    const lineOffset = script.source.slice(0, script.offset).split('\n').length - 1;
    for (const problem of res.problems) problem.line += lineOffset;
    return res;
}

/** Rewrites a file's import block into canonical order. Returns whether it changed. */
export function fixImportsInFile(rel: string, root: string): boolean {
    const script = readScript(rel, root);
    if (script === null) return false;
    const { fixed } = analyzeImports(script.code, rel);
    if (fixed === script.code) return false;
    const { source, offset, code } = script;
    fs.writeFileSync(path.join(root, rel), source.slice(0, offset) + fixed + source.slice(offset + code.length));
    return true;
}
