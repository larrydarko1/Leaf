#!/usr/bin/env node
/**
 * Refactoring & change-management gate. Deferred work does not live in the code: a
 * `TODO` is a promise nobody is tracking, and it outlives its own deferral because
 * nothing ever re-reads it. A `(TBD)` sat in an SCSS architecture header describing a
 * file as unwritten, at a point where the file was 200 lines and imported.
 *
 * ESLint's `no-warning-comments` covers every script it can parse. This gate covers
 * the rest — the file types with no parser, and the `<template>` half of an SFC, which
 * the rule never sees because vue-eslint-parser keeps it on a separate AST. Both live
 * in @larrydarko/lint-config/gates/refactoring, and every option it takes is already
 * right for this repo: `.vue` is linted, `todo.md` is the tracker and it is gitignored
 * here, and its items are prose rather than a checklist.
 */
import { checkRefactoring } from '@larrydarko/lint-config/gates/refactoring';

checkRefactoring();
