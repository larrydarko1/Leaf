#!/usr/bin/env node
/**
 * tsconfig drift gate. Every rule exists because a config can be wrong in a way
 * that makes MORE code compile, not less — so the build stays green and the
 * mistake is invisible until the app is packaged. The rules live in
 * @larrydarko/lint-config/gates/tsconfigs.
 *
 * What stays here is this repo's answers.
 *
 * `nodeTyped` — the main-process config. It takes `["node"]` and nothing else:
 * no DOM lib, no test globals in the shipped program.
 *
 * `browserProjects` — the renderer. It runs with context isolation on and node
 * integration off, so `process`, `Buffer` and `require` do not exist there at
 * runtime. Typing them in means the compiler agrees with code that crashes in
 * the packaged app, and `npm run dev` never shows it.
 *
 * `browserSources` — the same rule asked of the code rather than the config,
 * and it is the half that actually holds. A renderer can have Node globals in
 * scope without ever declaring them: one `/// <reference types="node" />`
 * inside any dependency's typings pulls all of @types/node into the program,
 * and then `process.env` in a component compiles clean. Checking the source is
 * cheap and does not care how the globals got there. Tests are exempt — they
 * run under Vitest in Node, where reading a fixture off disk is correct.
 *
 * `nonEmitting` is not passed: this app has no package consumed as TypeScript
 * source, so there is nothing for that rule to be about.
 */
import { checkTsconfigs } from '@larrydarko/lint-config/gates/tsconfigs';

checkTsconfigs({
    nodeTyped: ['tsconfig.node.json'],
    browserProjects: ['tsconfig.app.json'],
    browserSources: ['src/renderer'],
});
