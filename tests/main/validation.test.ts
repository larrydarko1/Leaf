import { describe, it, expect } from 'vitest';
import path from 'path';
import { assertInsideBoundary, assertSafeFileName, isInsideBoundary } from '@/main/lib/validation';

describe('validation', () => {
    describe('isInsideBoundary', () => {
        const root = '/home/user/vault';

        it('accepts the root itself', () => {
            expect(isInsideBoundary('/home/user/vault', root)).toBe(true);
        });

        it('accepts a nested file', () => {
            expect(isInsideBoundary('/home/user/vault/sub/note.md', root)).toBe(true);
        });

        it('rejects a sibling directory sharing the root prefix', () => {
            expect(isInsideBoundary('/home/user/vault-backup/note.md', root)).toBe(false);
        });

        it('rejects traversal that escapes the root', () => {
            expect(isInsideBoundary('/home/user/vault/../../etc/passwd', root)).toBe(false);
        });

        it('accepts traversal that stays within the root', () => {
            expect(isInsideBoundary('/home/user/vault/sub/../note.md', root)).toBe(true);
        });

        it('rejects an unrelated absolute path', () => {
            expect(isInsideBoundary('/etc/passwd', root)).toBe(false);
        });
    });

    describe('assertInsideBoundary', () => {
        const root = '/home/user/vault';

        it('allows a file directly inside the root', () => {
            const result = assertInsideBoundary('/home/user/vault/note.md', root);
            expect(result).toBe(path.resolve('/home/user/vault/note.md'));
        });

        it('allows a file in a nested subdirectory', () => {
            const result = assertInsideBoundary('/home/user/vault/sub/deep/note.md', root);
            expect(result).toBe(path.resolve('/home/user/vault/sub/deep/note.md'));
        });

        it('allows the root directory itself', () => {
            const result = assertInsideBoundary('/home/user/vault', root);
            expect(result).toBe(path.resolve('/home/user/vault'));
        });

        it('blocks path traversal with ../', () => {
            expect(() => assertInsideBoundary('/home/user/vault/../secret.txt', root)).toThrow('Access denied');
        });

        it('blocks path traversal escaping multiple levels', () => {
            expect(() => assertInsideBoundary('/home/user/vault/../../etc/passwd', root)).toThrow('Access denied');
        });

        it('blocks absolute path outside root', () => {
            expect(() => assertInsideBoundary('/etc/passwd', root)).toThrow('Access denied');
        });

        it('blocks sibling directory with same prefix', () => {
            // "/home/user/vault-backup" starts with "/home/user/vault" but is not inside it
            expect(() => assertInsideBoundary('/home/user/vault-backup/file.txt', root)).toThrow('Access denied');
        });

        it('blocks root path with trailing characters', () => {
            expect(() => assertInsideBoundary('/home/user/vaultx/file.txt', root)).toThrow('Access denied');
        });

        it('handles relative target paths (resolved against cwd)', () => {
            // A relative path like "../../etc/passwd" resolves against cwd, not root
            expect(() => assertInsideBoundary('../../etc/passwd', root)).toThrow('Access denied');
        });

        it('returns the resolved absolute path', () => {
            const result = assertInsideBoundary('/home/user/vault/./sub/../note.md', root);
            expect(result).toBe(path.resolve('/home/user/vault/note.md'));
        });

        it('handles root with trailing separator', () => {
            const result = assertInsideBoundary('/home/user/vault/note.md', '/home/user/vault/');
            expect(result).toBe(path.resolve('/home/user/vault/note.md'));
        });
    });

    describe('assertSafeFileName', () => {
        it('allows a simple filename', () => {
            expect(() => assertSafeFileName('note.md')).not.toThrow();
        });

        it('allows filename with dots', () => {
            expect(() => assertSafeFileName('my.note.backup.md')).not.toThrow();
        });

        it('allows filename with spaces', () => {
            expect(() => assertSafeFileName('my note.md')).not.toThrow();
        });

        it('allows filename with dashes and underscores', () => {
            expect(() => assertSafeFileName('my-note_v2.md')).not.toThrow();
        });

        it('blocks forward slash (directory traversal)', () => {
            expect(() => assertSafeFileName('sub/file.md')).toThrow('Invalid name');
        });

        it('treats a backslash as a literal filename character, not a separator', () => {
            // Leaf targets macOS and Linux, where path.basename never splits on a
            // backslash — so it is a legal (if unusual) character in a note name.
            expect(() => assertSafeFileName('sub\\file.md')).not.toThrow();
        });

        it('blocks parent directory reference', () => {
            expect(() => assertSafeFileName('../secret.md')).toThrow('Invalid name');
        });

        it('blocks empty string', () => {
            expect(() => assertSafeFileName('')).toThrow('Invalid name');
        });

        it('blocks path that looks like a directory', () => {
            expect(() => assertSafeFileName('a/b/c')).toThrow('Invalid name');
        });
    });
});
