#!/usr/bin/env node
/**
 * Testing standards gate — the mechanically checkable half of the "Testing" section
 * of CONTRIBUTING.md. The rules live in @larrydarko/lint-config/gates/testing; what
 * stays here is this repo's answers. If this file and that document ever disagree,
 * the document is the standard and this file is the bug.
 *
 * `layout: mirrored` — tests mirror `src/` under `tests/`, one top-level directory
 * per `src/` directory. The standard picked this over co-located `__tests__/` and
 * the whole value is consistency: a suite in the other pattern is not wrong so much
 * as unfindable. A `tests/` directory mirroring nothing is a tree you have to search
 * rather than navigate, so a new area is added here and in `src/` together.
 *
 * `e2e: false` — a decision, not a gap. Playwright's Electron API is experimental
 * and an attempt here was removed. The standard says not to add one back without
 * raising it first, so a config, a directory or a dependency appearing unannounced
 * fails rather than lands quietly. That same switch is what makes a `.spec` file
 * fail here: Vitest matches `.test.ts` and nothing else, so a `.spec` is run by
 * nothing at all while still reading as a test.
 *
 * `thresholds` and `excludes` are the two numbers-only rules from the standard:
 * thresholds ratchet up and never down ("lowering a threshold to make a red build
 * green is fixing the number that defines failure"), and the exclude list may not
 * grow. Each exclude carries the reason it is not a coverage gap, written once here
 * instead of sitting unexplained in a config file.
 *
 * `vmBaseline: 0` — "test behaviour, not implementation". `wrapper.vm.someRef` is
 * the mechanical form, but a legitimate escape hatch often enough that a ban would
 * be wrong, so it is counted rather than forbidden. `$`-prefixed members ($nextTick,
 * $emit) are Vue's public instance API and never counted.
 */
import { checkTesting } from '@larrydarko/lint-config/gates/testing';

checkTesting({
    config: 'vitest.config.ts',
    layout: { kind: 'mirrored', root: 'tests', areas: ['main', 'preload', 'renderer', 'schemas'] },
    e2e: false,
    thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    excludes: {
        'src/renderer/main.ts': 'renderer bootstrap — mounts the app and installs plugins, no branch to cover',
        'src/main/index.ts': 'Electron entry — creates the BrowserWindow, only exercised by launching the app',
        'src/**/*.d.ts': 'declarations, no runtime',
        'src/**/*.html': 'markup, not code',
    },
    domEnvironment: { name: 'jsdom', config: 'vitest.config.ts' },
    vmBaseline: 0,
});
