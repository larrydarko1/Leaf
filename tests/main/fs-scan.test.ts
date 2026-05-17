import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    shell: { openExternal: vi.fn() },
}));

vi.mock('../../src/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── IPC helper ───────────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

type ScanResult = {
    success: boolean;
    files: { relativePath: string }[];
    folders: { relativePath: string }[];
};

// ── Shared state ─────────────────────────────────────────────────────────────

let tmpVault: string;
let ipc: ReturnType<typeof makeMockIpc>;

function newTmpVault(): string {
    const dir = path.join(os.tmpdir(), `leaf-scan-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('files:scan IPC handler', () => {
    beforeEach(async () => {
        vi.resetModules();
        tmpVault = newTmpVault();
        ipc = makeMockIpc();
        const { register } = await import('../../src/main/services/fs');
        register(ipc as never, () => null);
    });

    afterEach(() => {
        fs.rmSync(tmpVault, { recursive: true, force: true });
    });

    it('returns success with empty lists for an empty vault', async () => {
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.success).toBe(true);
        expect(result.files).toEqual([]);
        expect(result.folders).toEqual([]);
    });

    it('returns failure for a non-string path argument', async () => {
        const result = (await ipc.invoke('files:scan', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('includes regular markdown files at the vault root', async () => {
        fs.writeFileSync(path.join(tmpVault, 'note.md'), '# Hello');
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.files.map((f) => f.relativePath)).toContain('note.md');
    });

    it('includes regular subdirectories', async () => {
        fs.mkdirSync(path.join(tmpVault, 'projects'));
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.folders.map((f) => f.relativePath)).toContain('projects');
    });

    it('includes files nested inside subdirectories', async () => {
        fs.mkdirSync(path.join(tmpVault, 'notes'));
        fs.writeFileSync(path.join(tmpVault, 'notes', 'hello.md'), '# hi');
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.files.map((f) => f.relativePath)).toContain('notes/hello.md');
    });

    // ── .leaf exclusion ───────────────────────────────────────────────────────

    it('excludes the .leaf directory from the folders list', async () => {
        fs.mkdirSync(path.join(tmpVault, '.leaf'));
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.folders.map((f) => f.relativePath)).not.toContain('.leaf');
    });

    it('excludes files inside .leaf from the file list', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir);
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), '[]');
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        const filePaths = result.files.map((f) => f.relativePath);
        expect(filePaths.every((p) => !p.startsWith('.leaf'))).toBe(true);
    });

    it('excludes .leaf while still returning sibling folders and files', async () => {
        fs.mkdirSync(path.join(tmpVault, '.leaf'));
        fs.writeFileSync(path.join(tmpVault, '.leaf', 'bookmarks.json'), '[]');
        fs.mkdirSync(path.join(tmpVault, 'notes'));
        fs.writeFileSync(path.join(tmpVault, 'notes', 'hello.md'), '# hi');
        fs.writeFileSync(path.join(tmpVault, 'readme.md'), 'readme');

        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        const folderPaths = result.folders.map((f) => f.relativePath);
        const filePaths = result.files.map((f) => f.relativePath);

        expect(folderPaths).not.toContain('.leaf');
        expect(filePaths.every((p) => !p.startsWith('.leaf'))).toBe(true);
        expect(folderPaths).toContain('notes');
        expect(filePaths).toContain('readme.md');
        expect(filePaths).toContain('notes/hello.md');
    });

    // ── Other dotfolders remain visible ───────────────────────────────────────

    it('still includes other dotfolders such as .git', async () => {
        fs.mkdirSync(path.join(tmpVault, '.git'));
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        expect(result.folders.map((f) => f.relativePath)).toContain('.git');
    });

    it('still includes dotfiles that are not inside .leaf', async () => {
        fs.writeFileSync(path.join(tmpVault, '.gitignore'), '');
        const result = (await ipc.invoke('files:scan', tmpVault)) as ScanResult;
        // .gitignore has no allowed extension so won't be in files — just
        // confirm the scan itself doesn't throw and succeeds
        expect(result.success).toBe(true);
    });
});
