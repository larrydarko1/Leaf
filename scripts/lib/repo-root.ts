/**
 * The repository root, resolved from this file's own location.
 * Every gate needs it and none of them may depend on the caller's cwd: `npm run`
 * sets cwd to the package root, a git hook does not, and an editor task runner
 * sets it to whatever folder is open. Resolving from `import.meta.url` makes the
 * answer the same in all three.
 */
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
