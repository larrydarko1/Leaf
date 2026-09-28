#!/usr/bin/env node
/**
 * Duplication (DRY) gate. The rules — the per-format ceilings, the cap on any single
 * clone, and (in a repo with more than one scan root) the bans on a block copied
 * between two of them and on one exported type name declared in two of them — live in
 * @larrydarko/lint-config/gates/duplication. This repo has one scan root, so the last
 * two have nothing to compare and say nothing.
 *
 * What stays here is the numbers, and every one of them is a judgement rather than a
 * measurement. They are ratcheted just above where the codebase sits today, so they
 * can only ever be driven down. Split by format because the three have genuinely
 * different stakes and one blended number hides all of them.
 *
 * jscpd matches tokens, not intent: two blocks that look identical and mean different
 * things are a false positive, and the honest answer is to raise the relevant ceiling
 * with a comment rather than contort the code.
 */
import { checkDuplication } from '@larrydarko/lint-config/gates/duplication';

checkDuplication({
    scan: ['src'],
    ceilings: {
        typescript: { limit: 4, note: 'logic — two copies of a branch is how a fixed bug comes back.' },
        scss: {
            limit: 0.5,
            note: 'presentation — real debt, and what the token system and the shared patterns in styles/components/ exist to absorb, but a stale copy makes something look wrong rather than behave wrong.',
        },
        html: {
            limit: 6,
            note: 'SFC markup — structural repetition is often the correct answer, and extracting a component would cost more than it saves.',
        },
    },
    // The largest clone today is 132. This leaves a little room without leaving room
    // for a new one.
    maxCloneTokens: 140,
});
