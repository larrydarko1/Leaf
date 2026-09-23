#!/usr/bin/env node
/**
 * CI/CD pipeline. All eighteen rules — job timeouts, concurrency, least-privilege
 * permissions, SHA-pinned actions, pinned runner images (resolved through the
 * matrix, which is where the release build lives), `npm ci`, the npm cache, the
 * two workflow_run gates and the head_sha checkout, immutable image tags, a
 * BuildKit cache scope per image, `packages: write`, scrubbed secret files, no
 * untrusted input in a `run:` block, checksummed downloads, every `npm run` and
 * every gate script wired in, and the CI Node major against engines.node — live
 * in @larrydarko/lint-config/gates/pipeline.
 *
 * Nothing about them is project-specific: each rule fires on the step shape it is
 * about and is silent in a repo that has none, which is why the five container
 * rules cost this repo nothing. All that stays here is where the gate scripts
 * live — `scripts/check`, singular.
 */
import { checkPipeline } from '@larrydarko/lint-config/gates/pipeline';

checkPipeline({ checksDir: 'scripts/check' });
