import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotePersistence } from '@/renderer/composables/editor/useNotePersistence';
import type { FileInfo } from '@/schemas/vault';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'note.md'): FileInfo {
    return {
        name,
        path: `/vault/${name}`,
        relativePath: name,
        extension: '.' + name.split('.').pop()!,
        size: 0,
        modified: '',
        folder: '.',
    };
}

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    log: { error: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// Stub window.alert so saves that fail don't throw in jsdom
vi.stubGlobal('alert', vi.fn());

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useNotePersistence', () => {
    let file: FileInfo | null;
    let isMarkdown: boolean;
    let resolveEmbeds: ReturnType<typeof vi.fn>;
    let onSave: ReturnType<typeof vi.fn>;
    let onContentChanged: ReturnType<typeof vi.fn>;
    let np: ReturnType<typeof useNotePersistence>;

    beforeEach(() => {
        vi.clearAllMocks();
        file = makeFile();
        isMarkdown = true;
        resolveEmbeds = vi.fn();
        onSave = vi.fn();
        onContentChanged = vi.fn();
        np = useNotePersistence(
            () => file,
            () => isMarkdown,
            resolveEmbeds as unknown as (content: string) => void,
            onSave as unknown as (content: string) => void,
            onContentChanged as unknown as (hasChanges: boolean) => void,
        );
    });

    // ── initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('starts with empty content', () => {
            expect(np.content.value).toBe('');
        });

        it('starts with no unsaved changes', () => {
            expect(np.hasUnsavedChanges.value).toBe(false);
        });

        it('starts with isSaving false', () => {
            expect(np.isSaving.value).toBe(false);
        });

        it('starts with lastLoadedPath null', () => {
            expect(np.lastLoadedPath.value).toBeNull();
        });
    });

    // ── loadFile ──────────────────────────────────────────────────────────────

    describe('loadFile', () => {
        it('sets content and originalContent on success', async () => {
            mockAPI.readFile.mockResolvedValue({ success: true, content: 'hello world' });
            await np.loadFile(makeFile());
            expect(np.content.value).toBe('hello world');
            expect(np.originalContent.value).toBe('hello world');
        });

        it('clears the hasUnsavedChanges flag after a successful load', async () => {
            np.hasUnsavedChanges.value = true;
            mockAPI.readFile.mockResolvedValue({ success: true, content: 'fresh content' });
            await np.loadFile(makeFile());
            expect(np.hasUnsavedChanges.value).toBe(false);
        });

        it('does not alter content when the read fails', async () => {
            np.content.value = 'pre-existing';
            mockAPI.readFile.mockResolvedValue({ success: false, error: 'not found' });
            await np.loadFile(makeFile());
            expect(np.content.value).toBe('pre-existing');
        });

        it('calls resolveEmbeds for Markdown files', async () => {
            mockAPI.readFile.mockResolvedValue({ success: true, content: '![[img.png]]' });
            await np.loadFile(makeFile('note.md'));
            expect(resolveEmbeds).toHaveBeenCalledWith('![[img.png]]');
        });

        it('does not call resolveEmbeds for non-Markdown files', async () => {
            mockAPI.readFile.mockResolvedValue({ success: true, content: 'plain text' });
            await np.loadFile(makeFile('note.txt'));
            expect(resolveEmbeds).not.toHaveBeenCalled();
        });

        it('handles IPC rejections gracefully', async () => {
            mockAPI.readFile.mockRejectedValue(new Error('IPC failure'));
            await expect(np.loadFile(makeFile())).resolves.not.toThrow();
        });
    });

    // ── onContentChange ───────────────────────────────────────────────────────

    describe('onContentChange', () => {
        it('sets hasUnsavedChanges to true when content differs from originalContent', () => {
            np.originalContent.value = 'original';
            np.content.value = 'modified';
            np.onContentChange();
            expect(np.hasUnsavedChanges.value).toBe(true);
            expect(onContentChanged).toHaveBeenCalledWith(true);
        });

        it('sets hasUnsavedChanges to false when content matches originalContent', () => {
            np.originalContent.value = 'same';
            np.content.value = 'same';
            np.onContentChange();
            expect(np.hasUnsavedChanges.value).toBe(false);
            expect(onContentChanged).toHaveBeenCalledWith(false);
        });
    });

    // ── saveFile ──────────────────────────────────────────────────────────────

    describe('saveFile', () => {
        it('writes the file and clears the unsaved-changes flag on success', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            np.content.value = 'new content';
            np.originalContent.value = 'old content';
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(np.hasUnsavedChanges.value).toBe(false);
            expect(np.originalContent.value).toBe('new content');
            expect(onSave).toHaveBeenCalledWith('new content');
        });

        it('sets justSaved to true after a successful save', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            np.content.value = 'x';
            np.originalContent.value = '';
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(np.justSaved.value).toBe(true);
        });

        it('calls onContentChanged(false) after a successful save', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            np.content.value = 'x';
            np.originalContent.value = '';
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(onContentChanged).toHaveBeenCalledWith(false);
        });

        it('is a no-op when there are no unsaved changes', async () => {
            np.hasUnsavedChanges.value = false;
            await np.saveFile();
            expect(mockAPI.writeFile).not.toHaveBeenCalled();
        });

        it('is a no-op when the file ref is null', async () => {
            file = null;
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(mockAPI.writeFile).not.toHaveBeenCalled();
        });

        it('is a no-op while already saving', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            np.hasUnsavedChanges.value = true;
            np.isSaving.value = true;
            await np.saveFile();
            expect(mockAPI.writeFile).not.toHaveBeenCalled();
        });

        it('shows an alert when the write fails', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: false, error: 'disk full' });
            np.content.value = 'changed';
            np.originalContent.value = 'original';
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(globalThis.alert).toHaveBeenCalled();
        });

        it('resets isSaving to false even when the write fails', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: false, error: 'oops' });
            np.content.value = 'x';
            np.originalContent.value = '';
            np.hasUnsavedChanges.value = true;
            await np.saveFile();
            expect(np.isSaving.value).toBe(false);
        });
    });

    // ── handleDrawingSave ─────────────────────────────────────────────────────

    describe('handleDrawingSave', () => {
        it('writes the drawing content and reflects it in the content ref', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            await np.handleDrawingSave('{"strokes":[]}');
            expect(np.content.value).toBe('{"strokes":[]}');
            expect(np.originalContent.value).toBe('{"strokes":[]}');
        });

        it('clears the unsaved-changes flag', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            np.hasUnsavedChanges.value = true;
            await np.handleDrawingSave('{}');
            expect(np.hasUnsavedChanges.value).toBe(false);
        });

        it('calls the onSave callback', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            await np.handleDrawingSave('{}');
            expect(onSave).toHaveBeenCalled();
        });

        it('calls onContentChanged(false)', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: true });
            await np.handleDrawingSave('{}');
            expect(onContentChanged).toHaveBeenCalledWith(false);
        });

        it('does not update content when the write fails', async () => {
            mockAPI.writeFile.mockResolvedValue({ success: false, error: 'error' });
            np.content.value = 'previous';
            await np.handleDrawingSave('new drawing');
            expect(np.content.value).toBe('previous');
        });

        it('is a no-op when file ref is null', async () => {
            file = null;
            await np.handleDrawingSave('{}');
            expect(mockAPI.writeFile).not.toHaveBeenCalled();
        });
    });

    // ── clearAutoSaveTimeout ──────────────────────────────────────────────────

    describe('clearAutoSaveTimeout', () => {
        it('can be called without throwing even when no timeout is pending', () => {
            expect(() => np.clearAutoSaveTimeout()).not.toThrow();
        });
    });
});
