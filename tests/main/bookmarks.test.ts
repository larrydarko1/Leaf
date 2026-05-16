import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Mocks (must be declared before any imports that pull in the mocked modules) ──

vi.mock('electron', () => ({
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    shell: { openExternal: vi.fn() },
}));

vi.mock('../../src/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Mock IPC helper ──────────────────────────────────────────────────────────
// Captures handlers registered via ipc.handle() so they can be called directly
// in tests without a running Electron instance.

type IpcHandler = (_event: null, ...args: unknown[]) => Promise<unknown>;

function makeMockIpc() {
    const handlers = new Map<string, IpcHandler>();
    return {
        handle(channel: string, fn: IpcHandler) {
            handlers.set(channel, fn);
        },
        async invoke(channel: string, ...args: unknown[]) {
            const fn = handlers.get(channel);
            if (!fn) throw new Error(`No handler registered for channel '${channel}'`);
            return fn(null, ...args);
        },
    };
}

// ── Shared state ─────────────────────────────────────────────────────────────

let tmpVault: string;
let ipc: ReturnType<typeof makeMockIpc>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function newTmpVault(): string {
    const dir = path.join(os.tmpdir(), `leaf-bm-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('bookmarks IPC handlers', () => {
    // Each test gets a fresh module (so vaultRoot is reset to null) and a
    // brand-new empty temp vault.
    beforeEach(async () => {
        vi.resetModules();
        tmpVault = newTmpVault();
        ipc = makeMockIpc();
        const { register } = await import('../../src/main/services/fs');
        register(ipc as never, () => null);
        // Scan the vault to set the module-level vaultRoot
        await ipc.invoke('files:scan', tmpVault);
    });

    afterEach(() => {
        fs.rmSync(tmpVault, { recursive: true, force: true });
    });

    // ── bookmarks:load ───────────────────────────────────────────────────────

    describe('bookmarks:load', () => {
        it('returns empty array when .leaf/bookmarks.json does not exist', async () => {
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.success).toBe(true);
            expect(result.bookmarks).toEqual([]);
        });

        it('returns the saved list after a successful save', async () => {
            const paths = [`${tmpVault}/a.md`, `${tmpVault}/b.md`];
            await ipc.invoke('bookmarks:save', paths);
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.success).toBe(true);
            expect(result.bookmarks).toEqual(paths);
        });

        it('filters out paths that have escaped the vault (tampered file)', async () => {
            const leafDir = path.join(tmpVault, '.leaf');
            fs.mkdirSync(leafDir, { recursive: true });
            fs.writeFileSync(
                path.join(leafDir, 'bookmarks.json'),
                JSON.stringify([`${tmpVault}/valid.md`, '/etc/passwd']),
            );
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.success).toBe(true);
            expect(result.bookmarks).toContain(`${tmpVault}/valid.md`);
            expect(result.bookmarks).not.toContain('/etc/passwd');
        });

        it('returns empty array when bookmarks.json contains non-array JSON', async () => {
            const leafDir = path.join(tmpVault, '.leaf');
            fs.mkdirSync(leafDir, { recursive: true });
            fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), JSON.stringify({ oops: true }));
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.success).toBe(true);
            expect(result.bookmarks).toEqual([]);
        });

        it('returns empty array when bookmarks.json contains malformed JSON', async () => {
            const leafDir = path.join(tmpVault, '.leaf');
            fs.mkdirSync(leafDir, { recursive: true });
            fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), 'NOT JSON {{{}}}');
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.success).toBe(true);
            expect(result.bookmarks).toEqual([]);
        });
    });

    // ── bookmarks:save ───────────────────────────────────────────────────────

    describe('bookmarks:save', () => {
        it('returns success for a valid list of vault-internal paths', async () => {
            const result = (await ipc.invoke('bookmarks:save', [`${tmpVault}/note.md`])) as { success: boolean };
            expect(result.success).toBe(true);
        });

        it('creates .leaf/bookmarks.json inside the vault', async () => {
            await ipc.invoke('bookmarks:save', [`${tmpVault}/note.md`]);
            const bookmarksFile = path.join(tmpVault, '.leaf', 'bookmarks.json');
            expect(fs.existsSync(bookmarksFile)).toBe(true);
        });

        it('creates the .leaf directory if it does not exist', async () => {
            const leafDir = path.join(tmpVault, '.leaf');
            expect(fs.existsSync(leafDir)).toBe(false);
            await ipc.invoke('bookmarks:save', [`${tmpVault}/note.md`]);
            expect(fs.existsSync(leafDir)).toBe(true);
        });

        it('rejects a path that escapes the vault via traversal', async () => {
            const result = (await ipc.invoke('bookmarks:save', [`${tmpVault}/../outside.md`])) as {
                success: boolean;
                error?: string;
            };
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/access denied/i);
        });

        it('rejects an absolute path outside the vault', async () => {
            const result = (await ipc.invoke('bookmarks:save', ['/etc/passwd'])) as {
                success: boolean;
                error?: string;
            };
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/access denied/i);
        });

        it('rejects a non-array payload', async () => {
            const result = (await ipc.invoke('bookmarks:save', 'not-an-array')) as {
                success: boolean;
                error?: string;
            };
            expect(result.success).toBe(false);
        });

        it('rejects a payload containing non-string entries', async () => {
            const result = (await ipc.invoke('bookmarks:save', [42, true])) as {
                success: boolean;
                error?: string;
            };
            expect(result.success).toBe(false);
        });

        it('overwrites the previous bookmarks list', async () => {
            await ipc.invoke('bookmarks:save', [`${tmpVault}/a.md`, `${tmpVault}/b.md`]);
            await ipc.invoke('bookmarks:save', [`${tmpVault}/c.md`]);
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.bookmarks).toEqual([`${tmpVault}/c.md`]);
        });

        it('persists an empty list (clearing bookmarks)', async () => {
            await ipc.invoke('bookmarks:save', [`${tmpVault}/a.md`]);
            await ipc.invoke('bookmarks:save', []);
            const result = (await ipc.invoke('bookmarks:load')) as {
                success: boolean;
                bookmarks: string[];
            };
            expect(result.bookmarks).toEqual([]);
        });
    });

    // ── no vault open ────────────────────────────────────────────────────────

    describe('when no vault is open', () => {
        beforeEach(async () => {
            // Reset so vaultRoot is null for this sub-suite
            vi.resetModules();
            ipc = makeMockIpc();
            const { register } = await import('../../src/main/services/fs');
            register(ipc as never, () => null);
            // Intentionally skip files:scan — vaultRoot stays null
        });

        it('bookmarks:load returns failure', async () => {
            const result = (await ipc.invoke('bookmarks:load')) as { success: boolean };
            expect(result.success).toBe(false);
        });

        it('bookmarks:save returns failure', async () => {
            const result = (await ipc.invoke('bookmarks:save', [])) as { success: boolean };
            expect(result.success).toBe(false);
        });
    });
});
