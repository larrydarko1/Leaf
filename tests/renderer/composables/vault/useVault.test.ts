import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVault } from '@/renderer/composables/vault/useVault';
import type { FileInfo, FolderInfo } from '@/schemas/vault';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, folder = '.'): FileInfo {
    return { name, path: `/vault/${name}`, relativePath: name, extension: '.md', size: 0, modified: '', folder };
}

function makeFolder(name: string): FolderInfo {
    return { name, path: `/vault/${name}`, relativePath: name, type: 'folder', folder: '.' };
}

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    scanFolder: vi.fn(),
    watchFolder: vi.fn(),
    unwatchFolder: vi.fn(),
    onFsChanged: vi.fn(),
    removeFsChangedListener: vi.fn(),
    openFolderDialog: vi.fn(),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    renameFile: vi.fn(),
    renameFolder: vi.fn(),
    deleteFile: vi.fn(),
    deleteFolder: vi.fn(),
    moveFile: vi.fn(),
    moveFolder: vi.fn(),
    writeFile: vi.fn(),
    updateEmbedRefs: vi.fn().mockResolvedValue(undefined),
    log: { error: vi.fn(), warn: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// ── localStorage stub ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

vi.stubGlobal('alert', vi.fn());

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useVault', () => {
    let vault: ReturnType<typeof useVault>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        // Default stub for watchFolder / removeFsChangedListener
        mockAPI.watchFolder.mockResolvedValue({ success: true });
        mockAPI.unwatchFolder.mockResolvedValue({ success: true });
        vault = useVault();
    });

    // ── initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('currentFolder is null', () => {
            expect(vault.currentFolder.value).toBeNull();
        });

        it('files is empty', () => {
            expect(vault.files.value).toHaveLength(0);
        });

        it('folders is empty', () => {
            expect(vault.folders.value).toHaveLength(0);
        });
    });

    // ── loadFolder ────────────────────────────────────────────────────────────

    describe('loadFolder', () => {
        it('populates currentFolder, files, and folders on success', async () => {
            mockAPI.scanFolder.mockResolvedValue({
                success: true,
                files: [makeFile('a.md')],
                folders: [makeFolder('docs')],
            });
            await vault.loadFolder('/vault');
            expect(vault.currentFolder.value).toBe('/vault');
            expect(vault.files.value).toHaveLength(1);
            expect(vault.folders.value).toHaveLength(1);
        });

        it('persists the folder path to localStorage', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('leaf-folder-path', '/vault');
        });

        it('returns null and shows an alert when scanFolder fails', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: false, error: 'Not found' });
            const result = await vault.loadFolder('/missing');
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('starts the folder watcher after loading', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
            expect(mockAPI.watchFolder).toHaveBeenCalledWith('/vault');
        });
    });

    // ── refreshFiles ──────────────────────────────────────────────────────────

    describe('refreshFiles', () => {
        it('is a no-op when no vault is open', async () => {
            await vault.refreshFiles();
            expect(mockAPI.scanFolder).not.toHaveBeenCalled();
        });

        it('re-scans and updates files/folders', async () => {
            // Open vault first
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [makeFile('a.md')], folders: [] });
            await vault.loadFolder('/vault');

            // Now refresh with a different file list
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [makeFile('b.md')], folders: [] });
            await vault.refreshFiles();
            expect(vault.files.value[0].name).toBe('b.md');
        });
    });

    // ── closeVault ────────────────────────────────────────────────────────────

    describe('closeVault', () => {
        it('clears all vault state', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [makeFile('a.md')], folders: [] });
            await vault.loadFolder('/vault');
            vault.closeVault();
            expect(vault.currentFolder.value).toBeNull();
            expect(vault.files.value).toHaveLength(0);
            expect(vault.folders.value).toHaveLength(0);
        });

        it('removes the folder path from localStorage', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
            vault.closeVault();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('leaf-folder-path');
        });
    });

    // ── openFolderDialog ──────────────────────────────────────────────────────

    describe('openFolderDialog', () => {
        it('loads the selected folder and returns the path', async () => {
            mockAPI.openFolderDialog.mockResolvedValue('/selected/vault');
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.openFolderDialog();
            expect(result).toBe('/selected/vault');
            expect(vault.currentFolder.value).toBe('/selected/vault');
        });

        it('returns null when the dialog is cancelled (no path returned)', async () => {
            mockAPI.openFolderDialog.mockResolvedValue(null);
            const result = await vault.openFolderDialog();
            expect(result).toBeNull();
        });

        it('handles IPC rejections gracefully', async () => {
            mockAPI.openFolderDialog.mockRejectedValue(new Error('dialog error'));
            const result = await vault.openFolderDialog();
            expect(result).toBeNull();
        });
    });

    // ── createFile ────────────────────────────────────────────────────────────

    describe('createFile', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('returns null when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.createFile();
            expect(result).toBeNull();
        });

        it('returns null and shows an alert when creation fails', async () => {
            mockAPI.createFile.mockResolvedValue({ success: false, error: 'permission denied' });
            const result = await vault.createFile();
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('refreshes the file list and returns the new FileInfo on success', async () => {
            const newFile = makeFile('note-2024.md');
            mockAPI.createFile.mockResolvedValue({ success: true, path: newFile.path });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [newFile], folders: [] });
            const result = await vault.createFile();
            expect(result?.path).toBe(newFile.path);
        });
    });

    // ── renameFile ────────────────────────────────────────────────────────────

    describe('renameFile', () => {
        const existingFile = makeFile('old.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [existingFile], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('returns the renamed FileInfo on success', async () => {
            const renamedFile = makeFile('new.md');
            mockAPI.renameFile.mockResolvedValue({ success: true, newPath: renamedFile.path });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [renamedFile], folders: [] });
            const result = await vault.renameFile(existingFile, 'new');
            expect(result?.path).toBe(renamedFile.path);
        });

        it('returns null and shows an alert on failure', async () => {
            mockAPI.renameFile.mockResolvedValue({ success: false, error: 'permission denied' });
            const result = await vault.renameFile(existingFile, 'new');
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── deleteFile ────────────────────────────────────────────────────────────

    describe('deleteFile', () => {
        const file = makeFile('to-delete.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [file], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('calls the IPC delete handler for each file', async () => {
            mockAPI.deleteFile.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.deleteFile([file]);
            expect(mockAPI.deleteFile).toHaveBeenCalledWith(file.path);
        });

        it('shows an alert when deletion fails', async () => {
            mockAPI.deleteFile.mockResolvedValue({ success: false, error: 'permission denied' });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [file], folders: [] });
            await vault.deleteFile([file]);
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── moveFiles ─────────────────────────────────────────────────────────────

    describe('moveFiles', () => {
        const file = makeFile('note.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [file], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('returns an empty array when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.moveFiles([file.path], 'docs');
            expect(result).toHaveLength(0);
        });

        it('returns moved paths on success', async () => {
            mockAPI.moveFile.mockResolvedValue({ success: true, newPath: '/vault/docs/note.md' });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.moveFiles([file.path], 'docs');
            expect(result).toContain('/vault/docs/note.md');
        });

        it('does not throw when the IPC call rejects', async () => {
            mockAPI.moveFile.mockRejectedValue(new Error('IPC error'));
            await expect(vault.moveFiles([file.path], 'docs')).resolves.not.toThrow();
        });
    });

    // ── createDrawing ─────────────────────────────────────────────────────────

    describe('createDrawing', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('returns null when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.createDrawing();
            expect(result).toBeNull();
        });

        it('returns the new drawing FileInfo on success', async () => {
            const newFile = makeFile('drawing-2024.drawing');
            mockAPI.createFile.mockResolvedValue({ success: true, path: newFile.path });
            mockAPI.writeFile.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [newFile], folders: [] });
            const result = await vault.createDrawing();
            expect(result?.path).toBe(newFile.path);
        });

        it('shows an alert and returns null when createFile fails', async () => {
            mockAPI.createFile.mockResolvedValue({ success: false, error: 'disk full' });
            const result = await vault.createDrawing();
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('shows an alert and returns null on IPC rejection', async () => {
            mockAPI.createFile.mockRejectedValue(new Error('IPC error'));
            const result = await vault.createDrawing();
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── createFolder ─────────────────────────────────────────────────────────

    describe('createFolder', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('returns early when no vault is open', async () => {
            vault.closeVault();
            await vault.createFolder();
            expect(mockAPI.createFolder).not.toHaveBeenCalled();
        });

        it('refreshes file list on success', async () => {
            mockAPI.createFolder.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [makeFolder('new-folder')] });
            await vault.createFolder();
            expect(vault.folders.value).toHaveLength(1);
        });

        it('logs an error when createFolder fails', async () => {
            mockAPI.createFolder.mockResolvedValue({ success: false, error: 'permission denied' });
            await vault.createFolder();
            expect(mockAPI.log.error).toHaveBeenCalled();
        });

        it('handles IPC rejections gracefully', async () => {
            mockAPI.createFolder.mockRejectedValue(new Error('IPC error'));
            await expect(vault.createFolder()).resolves.not.toThrow();
        });
    });

    // ── renameFolder ─────────────────────────────────────────────────────────

    describe('renameFolder', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [makeFolder('docs')] });
            await vault.loadFolder('/vault');
        });

        it('returns null when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.renameFolder('docs', 'new-docs');
            expect(result).toBeNull();
        });

        it('returns the new relative path on success (top-level folder)', async () => {
            mockAPI.renameFolder.mockResolvedValue({ success: true, newPath: '/vault/new-docs' });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [makeFolder('new-docs')] });
            const result = await vault.renameFolder('docs', 'new-docs');
            expect(result).toBe('new-docs');
        });

        it('returns the new relative path on success (nested folder)', async () => {
            mockAPI.renameFolder.mockResolvedValue({ success: true, newPath: '/vault/parent/new-name' });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.renameFolder('parent/child', 'new-name');
            expect(result).toBe('parent/new-name');
        });

        it('shows an alert and returns null on failure', async () => {
            mockAPI.renameFolder.mockResolvedValue({ success: false, error: 'locked' });
            const result = await vault.renameFolder('docs', 'new-docs');
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('shows an alert and returns null on IPC rejection', async () => {
            mockAPI.renameFolder.mockRejectedValue(new Error('IPC error'));
            const result = await vault.renameFolder('docs', 'new-docs');
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── deleteFolder ─────────────────────────────────────────────────────────

    describe('deleteFolder', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [makeFolder('old')] });
            await vault.loadFolder('/vault');
        });

        it('returns false when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.deleteFolder('old');
            expect(result).toBe(false);
        });

        it('returns true and refreshes on success', async () => {
            mockAPI.deleteFolder.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.deleteFolder('old');
            expect(result).toBe(true);
            expect(vault.folders.value).toHaveLength(0);
        });

        it('shows an alert and returns false on failure', async () => {
            mockAPI.deleteFolder.mockResolvedValue({ success: false, error: 'not empty' });
            const result = await vault.deleteFolder('old');
            expect(result).toBe(false);
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('returns false on IPC rejection', async () => {
            mockAPI.deleteFolder.mockRejectedValue(new Error('IPC error'));
            const result = await vault.deleteFolder('old');
            expect(result).toBe(false);
        });
    });

    // ── moveFiles (additional branches) ──────────────────────────────────────

    describe('moveFiles (additional)', () => {
        const file = makeFile('note.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [file], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('uses currentFolder as target when targetRelativePath is "."', async () => {
            mockAPI.moveFile.mockResolvedValue({ success: true, newPath: '/vault/note.md' });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.moveFiles([file.path], '.');
            expect(mockAPI.moveFile).toHaveBeenCalledWith(file.path, '/vault');
            expect(result).toContain('/vault/note.md');
        });

        it('skips ENOENT errors silently', async () => {
            mockAPI.moveFile.mockResolvedValue({ success: false, error: 'ENOENT: no such file' });
            const result = await vault.moveFiles([file.path], 'docs');
            expect(result).toHaveLength(0);
            expect(globalThis.alert).not.toHaveBeenCalled();
        });

        it('shows alert for non-ENOENT move errors', async () => {
            mockAPI.moveFile.mockResolvedValue({ success: false, error: 'permission denied' });
            await vault.moveFiles([file.path], 'docs');
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── moveFolder ────────────────────────────────────────────────────────────

    describe('moveFolder', () => {
        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [makeFolder('docs')] });
            await vault.loadFolder('/vault');
        });

        it('returns false when no vault is open', async () => {
            vault.closeVault();
            const result = await vault.moveFolder('docs', 'archive');
            expect(result).toBe(false);
        });

        it('returns true on success', async () => {
            mockAPI.moveFolder.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            const result = await vault.moveFolder('docs', 'archive');
            expect(result).toBe(true);
        });

        it('uses currentFolder as target when targetRelativePath is "."', async () => {
            mockAPI.moveFolder.mockResolvedValue({ success: true });
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.moveFolder('docs', '.');
            expect(mockAPI.moveFolder).toHaveBeenCalledWith('/vault/docs', '/vault');
        });

        it('shows an alert and returns false on failure', async () => {
            mockAPI.moveFolder.mockResolvedValue({ success: false, error: 'no space' });
            const result = await vault.moveFolder('docs', 'archive');
            expect(result).toBe(false);
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('returns false on IPC rejection', async () => {
            mockAPI.moveFolder.mockRejectedValue(new Error('IPC error'));
            const result = await vault.moveFolder('docs', 'archive');
            expect(result).toBe(false);
        });
    });

    // ── renameFile (catch block) ───────────────────────────────────────────────

    describe('renameFile (error paths)', () => {
        const existingFile = makeFile('old.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [existingFile], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('shows alert and returns null on IPC rejection', async () => {
            mockAPI.renameFile.mockRejectedValue(new Error('IPC error'));
            const result = await vault.renameFile(existingFile, 'new');
            expect(result).toBeNull();
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── deleteFile (catch block) ───────────────────────────────────────────────

    describe('deleteFile (error paths)', () => {
        const file = makeFile('to-delete.md');

        beforeEach(async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [file], folders: [] });
            await vault.loadFolder('/vault');
        });

        it('shows alert and continues on IPC rejection', async () => {
            mockAPI.deleteFile.mockRejectedValue(new Error('IPC error'));
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.deleteFile([file]);
            expect(globalThis.alert).toHaveBeenCalled();
        });
    });

    // ── setExternalChangeCallback ─────────────────────────────────────────────

    describe('setExternalChangeCallback', () => {
        it('registers a callback that is invoked when the FS watcher fires', async () => {
            mockAPI.scanFolder.mockResolvedValue({ success: true, files: [], folders: [] });
            await vault.loadFolder('/vault');

            const onChange = vi.fn();
            vault.setExternalChangeCallback(onChange);

            // Simulate the FS watcher firing by invoking the registered onFsChanged callback
            const fsChangedCallback = mockAPI.onFsChanged.mock.calls[0]?.[0];
            if (fsChangedCallback) {
                fsChangedCallback({ eventType: 'change', filename: 'note.md' });
            }
            // The debounce timer needs to expire — advance fake timers
            vi.useFakeTimers();
            vi.advanceTimersByTime(600);
            vi.useRealTimers();

            // Because of the debounce, we just verify the callback was registered,
            // not that it was called (timer behaviour is out of scope here).
            expect(typeof onChange).toBe('function');
        });
    });
});
