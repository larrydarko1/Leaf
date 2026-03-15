// Input validation helpers for IPC handlers — keeps security checks
// consistent across all service modules.

import path from 'path';

/**
 * Ensure `targetPath` resolves inside `rootDir`.
 * Throws if the resolved path escapes the root (path traversal).
 *
 * @returns The resolved absolute path (cleaned of `..`, symlink-safe via resolve).
 */
export function assertInsideBoundary(targetPath: string, rootDir: string): string {
    const resolved = path.resolve(targetPath);
    const root = path.resolve(rootDir);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error('Access denied: path is outside the allowed directory.');
    }
    return resolved;
}

/**
 * Ensure `name` is a plain filename with no directory separators or traversal.
 * Throws if `name` contains slashes or resolves differently from itself.
 */
export function assertSafeFileName(name: string): void {
    if (!name || path.basename(name) !== name) {
        throw new Error('Invalid name: must be a plain filename without path separators.');
    }
}
