import fs from 'fs';
import os from 'os';
import path from 'path';

import { BrowserWindow } from 'electron';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { createFakeIpc } from './test-utils';

const { mockShowOpenDialog } = vi.hoisted(() => ({ mockShowOpenDialog: vi.fn() }));
const { mockState } = vi.hoisted(() => ({ mockState: { current: {} as Record<string, unknown> } }));

vi.mock('electron', () => ({
    BrowserWindow: vi.fn(),
    app: { getPath: vi.fn(() => '/home/test') },
    dialog: { showOpenDialog: mockShowOpenDialog, showSaveDialog: vi.fn() },
    shell: { openExternal: vi.fn() },
}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/main/lib/appState', () => ({
    readState: vi.fn(() => Promise.resolve({ ...mockState.current })),
    updateState: vi.fn((mutate: (s: Record<string, unknown>) => Record<string, unknown>) => {
        mockState.current = mutate({ ...mockState.current });
        return Promise.resolve();
    }),
}));

const ScanReplySchema = z.object({
    success: z.boolean(),
    root: z.string().optional(),
    files: z.array(z.object({ relativePath: z.string() })),
    folders: z.array(z.object({ relativePath: z.string() })),
});

const fakeWindow = new BrowserWindow();
let tmpVault: string;
let ipc: ReturnType<typeof createFakeIpc>;

function newTmpVault(): string {
    const dir = path.join(os.tmpdir(), `leaf-scan-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

describe('files:scan IPC handler', () => {
    beforeEach(async () => {
        vi.resetModules();
        tmpVault = newTmpVault();
        ipc = createFakeIpc();
        const { register } = await import('@/main/services/fs');
        register(ipc, () => fakeWindow);
        mockState.current = {};
        mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: [tmpVault] });
        await ipc.invoke('dialog:openFolder');
    });

    afterEach(() => {
        fs.rmSync(tmpVault, { recursive: true, force: true });
    });

    it('returns success with empty lists for an empty vault', async () => {
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.success).toBe(true);
        expect(result.files).toEqual([]);
        expect(result.folders).toEqual([]);
    });

    it('ignores a path argument and scans the vault root instead', async () => {
        fs.writeFileSync(path.join(tmpVault, 'note.md'), '# Hello');
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan', '/etc'));
        expect(result.success).toBe(true);
        expect(result.root).toBe(path.resolve(tmpVault));
        expect(result.files.map((f) => f.relativePath)).toEqual(['note.md']);
    });

    it('includes regular markdown files at the vault root', async () => {
        fs.writeFileSync(path.join(tmpVault, 'note.md'), '# Hello');
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.files.map((f) => f.relativePath)).toContain('note.md');
    });

    it('includes regular subdirectories', async () => {
        fs.mkdirSync(path.join(tmpVault, 'projects'));
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.folders.map((f) => f.relativePath)).toContain('projects');
    });

    it('includes files nested inside subdirectories', async () => {
        fs.mkdirSync(path.join(tmpVault, 'notes'));
        fs.writeFileSync(path.join(tmpVault, 'notes', 'hello.md'), '# hi');
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.files.map((f) => f.relativePath)).toContain('notes/hello.md');
    });

    it('excludes the .leaf directory from the folders list', async () => {
        fs.mkdirSync(path.join(tmpVault, '.leaf'));
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.folders.map((f) => f.relativePath)).not.toContain('.leaf');
    });

    it('excludes files inside .leaf from the file list', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir);
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), '[]');
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        const filePaths = result.files.map((f) => f.relativePath);
        expect(filePaths.every((p) => !p.startsWith('.leaf'))).toBe(true);
    });

    it('excludes .leaf while still returning sibling folders and files', async () => {
        fs.mkdirSync(path.join(tmpVault, '.leaf'));
        fs.writeFileSync(path.join(tmpVault, '.leaf', 'bookmarks.json'), '[]');
        fs.mkdirSync(path.join(tmpVault, 'notes'));
        fs.writeFileSync(path.join(tmpVault, 'notes', 'hello.md'), '# hi');
        fs.writeFileSync(path.join(tmpVault, 'readme.md'), 'readme');

        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        const folderPaths = result.folders.map((f) => f.relativePath);
        const filePaths = result.files.map((f) => f.relativePath);

        expect(folderPaths).not.toContain('.leaf');
        expect(filePaths.every((p) => !p.startsWith('.leaf'))).toBe(true);
        expect(folderPaths).toContain('notes');
        expect(filePaths).toContain('readme.md');
        expect(filePaths).toContain('notes/hello.md');
    });

    it('still includes other dotfolders such as .git', async () => {
        fs.mkdirSync(path.join(tmpVault, '.git'));
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.folders.map((f) => f.relativePath)).toContain('.git');
    });

    it('still includes dotfiles that are not inside .leaf', async () => {
        fs.writeFileSync(path.join(tmpVault, '.gitignore'), '');
        const result = ScanReplySchema.parse(await ipc.invoke('files:scan'));
        expect(result.success).toBe(true);
    });
});
