#!/usr/bin/env node
/**
 * Refactoring & change-management gate.
 *   1. eslint/refactoring.js runs `no-warning-comments` over everything ESLint
 *      parses: .ts, .vue, .js, .mjs, .cjs.
 *   2. THIS GATE covers everything else. ESLint has no parser for .scss, .yml,
 *      .json, .sh or .md, and markers live there too — a `(TBD)` in an SCSS
 *      architecture header describing a file as unwritten, at a point where the
 *      file is 200 lines and imported. That is the failure mode exactly: a
 *      deferral that outlived its own deferral, in a file nothing lints.
 *   3. AND `.vue` TEMPLATES, which are rule 1's blind spot. `no-warning-comments`
 *      reads `sourceCode.getAllComments()`, which for an SFC is the comments of
 *      the <script> program — vue-eslint-parser keeps the template on a separate
 *      AST and the rule never asks it for anything. So `// TODO` in <script> is
 *      caught by ESLint and `<!-- TODO -->` twelve lines below it is not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

/**
 * Deferral markers, shouted. Kept in sync by hand with the `terms` list in
 * eslint/refactoring.js — importing it would be tidier, but the two are matched
 * differently on purpose (see the header), and a shared constant would invite
 * someone to unify the matching too.
 */
const MARKERS = /\b(TODO|FIXME|FIX ME|HACK|XXX|TBD|WIP)\b/i;

/** Extensions ESLint parses — rule 1's job, not this gate's. */
const LINTED = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

/** Extensions this gate reads. */
const SCANNED = new Set(['.scss', '.css', '.yml', '.yaml', '.json', '.sh', '.md', '.html', '.vue']);

/** Files whose purpose is to carry deferrals. */
const EXEMPT = new Set(['todo.md']);

const NOISE = /^(node_modules|dist|dist-electron|out|coverage|package-lock\.json)/;

const findings = [];

/** Tracked plus untracked-but-not-ignored, so .gitignore is honoured for free. */
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
})
    .split('\n')
    .filter((f) => f !== '' && !NOISE.test(f) && !EXEMPT.has(f))
    .filter((f) => {
        const ext = path.extname(f);
        return SCANNED.has(ext) && !LINTED.has(ext);
    });

/** Remove fenced blocks and inline code spans — a backticked word is named, not used. */
function stripMarkdownCode(source) {
    return source
        .replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ' '))
        .replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
}

/** An SFC's <template> block only — <script> is ESLint's, <style> is scanned as CSS. */
function templateBlock(source) {
    const start = source.search(/^<template[\s>]/m);
    if (start === -1) return null;
    const end = source.lastIndexOf('\n</template>');
    return source.slice(start, end === -1 ? undefined : end);
}

for (const rel of files) {
    const ext = path.extname(rel);
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;

    let source = fs.readFileSync(full, 'utf8');
    let offset = 0;

    if (ext === '.md') {
        source = stripMarkdownCode(source);
    } else if (ext === '.vue') {
        const template = templateBlock(source);
        if (template === null) continue;
        offset = source.slice(0, source.indexOf(template)).split('\n').length - 1;
        source = template;
    }

    source.split('\n').forEach((line, i) => {
        const match = line.match(MARKERS);
        if (match !== null) {
            findings.push({
                file: rel,
                line: i + 1 + offset,
                marker: match[1].toUpperCase(),
                text: line.trim().slice(0, 90),
            });
        }
    });
}

// ── Report ───────────────────────────────────────────────────────────────────
if (findings.length > 0) {
    console.error(`✗ Refactoring check failed — ${findings.length} deferral marker(s) in files ESLint cannot parse:\n`);
    for (const { file, line, marker, text } of findings) {
        console.error(`  ${file}:${line}  [${marker}]`);
        console.error(`    ${text}`);
    }
    console.error(
        '\nEither do the work or record it in todo.md, where it is tracked instead of' +
            '\nrotting in a file nothing lints. A marker in source outlives the reason it was added.',
    );
    process.exit(1);
}

console.log(`✓ Refactoring check passed — ${files.length} unlinted files carry no deferral markers.`);
