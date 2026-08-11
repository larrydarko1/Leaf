#!/usr/bin/env node
/**
 * Dependency audit gate with a reviewed allowlist.
 * `npm audit` has no ignore mechanism, so a single upstream-blocked advisory
 * turns CI permanently red — and the usual reaction (dropping --audit-level to
 * critical) silently swallows every future high finding too. This wraps the
 * audit instead: high/critical advisories fail the build unless their GHSA is
 * explicitly listed below, with a reason.
 * The allowlist is deliberately awkward to maintain. Each entry must say why the
 * advisory cannot be fixed from here and why it is unreachable in Leaf's code.
 * An entry that no longer matches anything npm reports also fails the build:
 * upstream shipped the fix, so the waiver and any workaround it describes are
 * now stale. That is what stops a "temporary" exception becoming permanent.
 */
import { execFileSync } from 'node:child_process';

const ALLOWLIST = [
    {
        id: 'GHSA-f88m-g3jw-g9cj',
        package: 'sharp',
        why:
            '@huggingface/transformers pins sharp "^0.34.5". A caret range on a 0.x version is bounded ' +
            'at the next minor, so it cannot resolve the patched 0.35 line. Upstream fix is open but ' +
            'unmerged: huggingface/transformers.js#1731 (issue #1729). ' +
            'Reachability: Leaf never imports sharp, and uses transformers for exactly one thing — local ' +
            'Whisper speech-to-text in src/main/services/speech.ts, which takes a Float32Array of audio ' +
            'and returns text. sharp is transformers\' image backend; no image pipeline is constructed, ' +
            'so the vulnerable libvips decoders are not on any Leaf code path. This waiver lapses the ' +
            'moment image processing or a transformers image pipeline is added.',
    },
    {
        id: 'GHSA-xcpc-8h2w-3j85',
        package: 'adm-zip',
        why:
            'onnxruntime-node declares adm-zip "^0.5.16"; the fix is in 0.6.0, which that range cannot ' +
            'reach. Both copies in the tree are affected — the direct onnxruntime-node 1.27.0 and the ' +
            '1.24.3 that @huggingface/transformers pins — and 1.27.0 is already the latest release, so ' +
            'upgrading does not help. ' +
            'Reachability: adm-zip is used only by onnxruntime-node/script/install-utils.js to unpack the ' +
            'native binary at postinstall — it is not on any runtime path, and Leaf exposes no ZIP import ' +
            'or extraction to users. Exploiting it would require a malicious archive served from the ONNX ' +
            'Runtime CDN during install.',
    },
];

const FAIL_SEVERITIES = new Set(['high', 'critical']);

function runAudit() {
    try {
        return execFileSync('npm', ['audit', '--json', '--omit=dev'], {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
        });
    } catch (err) {
        if (typeof err.stdout === 'string' && err.stdout.length > 0) return err.stdout;
        throw err;
    }
}

/**
 * Flatten npm's vulnerability tree into one row per (package, advisory).
 * `via` holds advisory objects for direct hits and plain package-name strings
 * where the package is only a carrier for a dependency's advisory — carriers
 * would double-count, so only the objects are collected.
 */
function findings(report) {
    const rows = [];
    for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
        for (const via of vuln.via ?? []) {
            if (typeof via !== 'object' || via.url === undefined) continue;
            const id = via.url.split('/').pop();
            rows.push({ package: name, id, title: via.title, severity: via.severity ?? vuln.severity });
        }
    }
    return rows;
}

const report = JSON.parse(runAudit());

if (report.error !== undefined) {
    const { code, summary } = report.error;
    console.error(`\n✘ npm audit could not complete: ${summary ?? code ?? 'unknown error'}`);
    console.error('    → This is an audit failure, not an audit finding. Nothing has been verified.\n');
    process.exit(1);
}

const all = findings(report);
const rows = all.filter((r) => FAIL_SEVERITIES.has(r.severity));

const allowed = new Map(ALLOWLIST.map((e) => [e.id, e]));
const blocking = [];
const waived = [];

for (const row of rows) {
    const entry = allowed.get(row.id);
    if (entry === undefined) {
        blocking.push(row);
    } else {
        waived.push({ ...row, entry });
    }
}

const seen = new Set(all.map((r) => r.id));
const unused = ALLOWLIST.filter((e) => !seen.has(e.id));

for (const { entry } of waived) {
    console.log(`  ~ ${entry.id} (${entry.package}) waived`);
}

if (unused.length > 0) {
    console.error(`\n✘ ${unused.length} allowlist entry/ies no longer reported by npm audit:\n`);
    for (const entry of unused) {
        console.error(`  ${entry.id} (${entry.package})`);
        console.error(`    → Upstream shipped the fix. Delete the entry and any workaround it describes.\n`);
    }
}

if (blocking.length > 0) {
    console.error(`\n✘ ${blocking.length} unreviewed high/critical advisory/ies:\n`);
    for (const row of blocking) {
        console.error(`  ${row.severity.toUpperCase()} ${row.id} — ${row.package}`);
        console.error(`    ${row.title}`);
        console.error(`    → Upgrade it. Allowlist it in this file only if upstream makes that impossible.\n`);
    }
}

if (blocking.length > 0 || unused.length > 0) process.exit(1);

console.log(`\nAudit clean: no unreviewed high/critical advisories (${waived.length} waived).`);
