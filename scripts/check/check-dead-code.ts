#!/usr/bin/env node
/**
 * Dead-code gate — the reachability half of "unused", which ESLint cannot see: it
 * reasons inside one file, and this asks knip whether anything in the repository
 * reaches a module at all. Two passes, twelve categories and the reasoning behind
 * each live in @larrydarko/lint-config/gates/dead-code.
 *
 * Nothing about this gate is repo-specific except the closing hint and the examples
 * in the footer, which is why the options object is three lines. Budgets are all
 * zero and stay there.
 *
 * The one thing worth remembering here: a dependency Electron loads indirectly — a
 * native backend, a builder hook — looks unused to an import graph. Those belong
 * under `ignoreDependencies` in knip.config.js with a reason, not in a raised budget.
 */
import { checkDeadCode } from '@larrydarko/lint-config/gates/dead-code';

checkDeadCode({
    checksDir: 'scripts/check',
    notMachineChecked:
        'code reachable from an entry point but never reached at RUNTIME — an IPC handler nothing calls, a branch no setting enables.',
});
