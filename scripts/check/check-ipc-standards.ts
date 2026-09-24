#!/usr/bin/env node
/**
 * IPC architecture gate — the channel surface between main and renderer: the
 * ownership table in src/main/index.ts, both directions of every channel, no
 * passthrough, one typed bridge, every handler argument validated, naming. The
 * rules live in @larrydarko/lint-config/gates/ipc-standards.
 *
 * Nothing here needs an option: the paths are the package defaults. The shim
 * exists so `npm run ipc:check` and the standard it points at stay in this repo.
 */
import { checkIpcStandards } from '@larrydarko/lint-config/gates/ipc-standards';

checkIpcStandards({ standard: 'electron.instructions.md' });
