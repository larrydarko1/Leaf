/**
 * Classifies a module's top-level statements into the canonical declaration order.
 *
 * Regex cannot do this: telling `const x = () => {}` (a function) from
 * `const x = ref(0)` (state) from `const X = 'a'` (config) is a question about an
 * initializer's shape, and "is this identifier exported" is a question about
 * modifiers. Both are AST questions. This uses the TypeScript compiler already in
 * devDependencies, and @vue/compiler-sfc to reach an SFC's <script setup> block.
 *
 * Two judgement calls are baked in, because the categories genuinely overlap:
 *
 *   1. A ZOD SCHEMA IS VOCABULARY, NOT STATE. `const FileInfoSchema = z.object({})`
 *      is the runtime half of a type declaration — Zod blurs the type/value line on
 *      purpose, and the whole idiom is `const XSchema` sitting next to
 *      `type X = z.infer<typeof XSchema>`. Binning the schema as state would rule
 *      that pairing a violation and make src/schemas/ unfixable without making it
 *      worse to read.
 *   2. SCREAMING_SNAKE IS CONFIG EVEN WHEN COMPUTED. `const LEAF_HOME =
 *      path.join(os.homedir(), '.leaf')` is configuration; the call in the
 *      initializer does not make it mutable state. The naming convention is the
 *      only signal that separates the two, so it is the one used.
 *
 * What it deliberately does NOT decide is whether a violation is SAFE to fix. That
 * depends on the temporal dead zone, and the answer differs per category — see
 * SAFE_TO_MOVE below and the header of check-declaration-order.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

export const CATEGORIES = [
    'imports', 'types', 'contract', 'constants', 'classes',
    'state', 'exported-fns', 'private-fns', 'side-effects',
];

const MACROS = new Set(['defineProps','defineEmits','defineModel','defineSlots','defineExpose','withDefaults']);

const isFnLike = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));

/** A literal-ish initializer: safe to call "constant" rather than "state". */
function isConstantInit(n) {
    if (!n) return false;
    if (ts.isAsExpression(n)) return isConstantInit(n.expression);
    if (ts.isLiteralExpression(n) || ts.isNumericLiteral(n) || ts.isStringLiteral(n)) return true;
    if (n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
    if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isRegularExpressionLiteral(n)) return true;
    if (ts.isPrefixUnaryExpression(n)) return isConstantInit(n.operand);
    if (ts.isArrayLiteralExpression(n)) return n.elements.every(isConstantInit);
    if (ts.isObjectLiteralExpression(n)) return n.properties.every((p) => ts.isPropertyAssignment(p) && isConstantInit(p.initializer));
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && ['Set','Map','RegExp'].includes(n.expression.text)) {
        return (n.arguments ?? []).every(isConstantInit);
    }
    return false;
}

/** The identifier a call/property chain is rooted at: `z.object({}).strict()` -> `z`. */
function rootIdentifier(n) {
    let e = n;
    while (e) {
        if (ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
        else if (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e)) e = e.expression;
        else break;
    }
    return e && ts.isIdentifier(e) ? e.text : null;
}

function callName(n) {
    let e = n;
    if (e && ts.isAsExpression(e)) e = e.expression;
    if (e && ts.isCallExpression(e)) {
        if (ts.isIdentifier(e.expression)) return e.expression.text;
        if (ts.isPropertyAccessExpression(e.expression)) return e.expression.name.text;
    }
    return null;
}

export function classify(stmt) {
    if (ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) return 'imports';
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier) return 'imports';
    if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) return 'types';
    if (ts.isClassDeclaration(stmt)) return 'classes';
    if (ts.isEnumDeclaration(stmt)) return 'constants';

    const exported = (stmt.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (ts.isFunctionDeclaration(stmt)) return exported ? 'exported-fns' : 'private-fns';

    if (ts.isVariableStatement(stmt)) {
        const decls = stmt.declarationList.declarations;
        if (decls.some((d) => MACROS.has(callName(d.initializer) ?? ''))) return 'contract';
        if (decls.some((d) => isFnLike(d.initializer))) return exported ? 'exported-fns' : 'private-fns';
        const isConst = (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0;
        // A Zod schema is the runtime half of a type declaration — vocabulary, not state.
        // Zod deliberately blurs the type/value line, and `const XSchema = z.object({})`
        // sitting beside `type X = z.infer<typeof XSchema>` is the point of using it.
        if (isConst && decls.some((d) => rootIdentifier(d.initializer) === 'z' || /Schema$/.test(d.name.getText()))) return 'types';
        if (!isConst) return 'state';
        // A reactive container or an explicit mutable holder is state whatever it is named.
        const REACTIVE = new Set(['ref','shallowRef','reactive','shallowReactive','computed','customRef','useTemplateRef']);
        if (decls.some((d) => REACTIVE.has(callName(d.initializer) ?? ''))) return 'state';
        // SCREAMING_SNAKE is the repo's marker for config, even when it is computed
        // (`const LEAF_HOME = path.join(os.homedir(), '.leaf')` is configuration, not state).
        const allShouty = decls.every((d) => ts.isIdentifier(d.name) && /^[A-Z][A-Z0-9_]*$/.test(d.name.text));
        if (allShouty) return 'constants';
        if (decls.every((d) => isConstantInit(d.initializer))) return 'constants';
        return 'state';
    }

    if (ts.isExpressionStatement(stmt)) {
        if (MACROS.has(callName(stmt.expression) ?? '')) return 'contract';
        return 'side-effects';
    }
    return 'side-effects';
}

/** Names a statement binds at module scope. */
function declaredNames(stmt) {
    const out = [];
    const push = (n) => { if (n && ts.isIdentifier(n)) out.push(n.text); };
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) push(stmt.name);
    else if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) push(stmt.name);
    else if (ts.isVariableStatement(stmt)) {
        for (const d of stmt.declarationList.declarations) {
            const collect = (name) => {
                if (ts.isIdentifier(name)) out.push(name.text);
                else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
                    for (const el of name.elements) if (ts.isBindingElement(el)) collect(el.name);
                }
            };
            collect(d.name);
        }
    } else if (ts.isImportDeclaration(stmt)) {
        const c = stmt.importClause;
        if (c?.name) out.push(c.name.text);
        if (c?.namedBindings) {
            if (ts.isNamespaceImport(c.namedBindings)) out.push(c.namedBindings.name.text);
            else for (const e of c.namedBindings.elements) out.push(e.name.text);
        }
    }
    return out;
}

/**
 * Identifiers a statement evaluates AT LOAD TIME. Function/arrow bodies are skipped:
 * they run later, so a name they reference need not be declared above them.
 */
function loadTimeRefs(stmt) {
    const out = new Set();
    const isTypePos = (n) => {
        let p = n.parent;
        while (p) {
            if (ts.isTypeNode(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return true;
            if (ts.isExpression(p) || ts.isStatement(p)) return false;
            p = p.parent;
        }
        return false;
    };
    const visit = (n) => {
        if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) {
            // Skip the body; parameter defaults still evaluate at call time, not load.
            return;
        }
        if (ts.isIdentifier(n)) {
            const p = n.parent;
            const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n);
            if (!isPropName && !isTypePos(n)) out.add(n.text);
        }
        ts.forEachChild(n, visit);
    };
    if (ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) return out;
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
        // A class body's heritage clause evaluates at load; methods do not.
        if (ts.isClassDeclaration(stmt) && stmt.heritageClauses) {
            for (const h of stmt.heritageClauses) ts.forEachChild(h, visit);
        }
        return out;
    }
    ts.forEachChild(stmt, visit);
    // A declaration does not reference itself: the binding name is not a read.
    for (const d of declaredNames(stmt)) out.delete(d);
    return out;
}


/**
 * The canonical order for a module's statements, and which of them are misplaced.
 *
 * Order is a topological sort keyed by category: an edge A→B exists when B reads,
 * at load time, a binding that A declares. Kahn's algorithm then always takes the
 * available statement with the lowest (category, original position). The result is
 * canonical order everywhere the dependencies permit, and never places a statement
 * above something it reads — so the ONLY departures from the table are the ones
 * where obeying it would throw a ReferenceError at import time.
 *
 * Hoisted `function` declarations and type-only declarations contribute no edges:
 * they are visible regardless of where they sit.
 *
 * `misplaced` is the minimum set of statements to move, computed as everything
 * outside the longest common subsequence of the actual and ideal sequences — so one
 * statement in the wrong place is reported as one problem, not as every statement
 * after it having shifted.
 */
export function analyze(code, filename) {
    const sf = ts.createSourceFile(filename, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const stmts = [...sf.statements];
    if (stmts.length < 2) return { misplaced: [], count: stmts.length };

    const rank = (c) => CATEGORIES.indexOf(c);
    const items = stmts.map((s, i) => ({
        i,
        cat: classify(s),
        name: nameOf(s, sf),
        line: sf.getLineAndCharacterOfPosition(s.getStart(sf)).line + 1,
        decls: declaredNames(s),
        refs: loadTimeRefs(s),
        hoisted: ts.isFunctionDeclaration(s),
        typeOnly: ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s),
    }));

    const declaredBy = new Map();
    for (const it of items) {
        if (it.hoisted || it.typeOnly) continue;
        for (const d of it.decls) if (!declaredBy.has(d)) declaredBy.set(d, it);
    }

    const deps = new Map(items.map((it) => [it, new Set()]));
    const dependents = new Map(items.map((it) => [it, new Set()]));
    for (const it of items) {
        for (const r of it.refs) {
            const src = declaredBy.get(r);
            if (src && src !== it) { deps.get(it).add(src); dependents.get(src).add(it); }
        }
    }

    const indegree = new Map(items.map((it) => [it, deps.get(it).size]));
    const ready = items.filter((it) => indegree.get(it) === 0);
    const ideal = [];
    while (ready.length > 0) {
        ready.sort((a, b) => rank(a.cat) - rank(b.cat) || a.i - b.i);
        const next = ready.shift();
        ideal.push(next);
        for (const d of dependents.get(next)) {
            indegree.set(d, indegree.get(d) - 1);
            if (indegree.get(d) === 0) ready.push(d);
        }
    }
    // A cycle cannot be ordered; leave the module alone rather than guess.
    if (ideal.length !== items.length) return { misplaced: [], count: items.length, cycle: true };

    // Longest common subsequence of actual (0..n-1) and ideal, by original index.
    const a = items.map((it) => it.i);
    const b = ideal.map((it) => it.i);
    const n = a.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    for (let x = n - 1; x >= 0; x--) {
        for (let y = n - 1; y >= 0; y--) {
            dp[x][y] = a[x] === b[y] ? dp[x + 1][y + 1] + 1 : Math.max(dp[x + 1][y], dp[x][y + 1]);
        }
    }
    const keep = new Set();
    let x = 0, y = 0;
    while (x < n && y < n) {
        if (a[x] === b[y]) { keep.add(a[x]); x++; y++; }
        else if (dp[x + 1][y] >= dp[x][y + 1]) x++;
        else y++;
    }

    const misplaced = [];
    for (let p = 0; p < ideal.length; p++) {
        const it = ideal[p];
        if (keep.has(it.i)) continue;
        const after = p > 0 ? ideal[p - 1] : null;
        misplaced.push({
            cat: it.cat,
            name: it.name,
            line: it.line,
            belongsAfter: after ? `${after.cat} "${after.name}"` : 'the top of the module',
        });
    }
    return { misplaced, count: items.length };
}

function nameOf(s, sf) {
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) return s.name?.text ?? '';
    if (ts.isVariableStatement(s)) return s.declarationList.declarations.map((d) => d.name.getText(sf)).join(', ');
    if (ts.isImportDeclaration(s)) return s.moduleSpecifier.getText(sf).replace(/['"]/g, '');
    return s.getText(sf).split('\n')[0].slice(0, 40);
}

/** Reads a file (unwrapping an SFC's <script setup>) and analyses it. */
export function analyzeFile(rel, root) {
    let code = fs.readFileSync(path.join(root, rel), 'utf8');
    let lineOffset = 0;
    if (rel.endsWith('.vue')) {
        const { descriptor } = parseSfc(code, { filename: rel });
        const block = descriptor.scriptSetup ?? descriptor.script;
        if (!block) return null;
        lineOffset = code.slice(0, block.loc.start.offset).split('\n').length - 1;
        code = block.content;
    }
    const res = analyze(code, rel.endsWith('.vue') ? rel + '.ts' : rel);
    for (const m of res.misplaced) m.line += lineOffset;
    return res;
}
