/**
 * Branch-focused tests for FileExplorer.vue.
 * Covers context menu logic, keyboard nav, rename/delete/drag actions, and guard clauses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { i18n } from '@/renderer/i18n';
import FileExplorer from '@/renderer/components/FileExplorer.vue';
import type { FileInfo, FolderInfo } from '@/schemas/vault';

// ── useFolderTree mock ─────────────────────────────────────────────────────────

const mockExpandedFolders = ref(new Set<string>());
const mockFolderTree = ref<unknown[]>([]);
const mockFlattenedItems = ref<{ type: 'file' | 'folder'; file?: FileInfo; folderPath?: string }[]>([]);
const mockVisibleFiles = ref<FileInfo[]>([]);
const mockToggleFolder = vi.fn();
const mockGetFileNameWithoutExtension = vi.fn((name: string) => name.replace(/\.[^.]+$/, ''));

vi.mock('@/renderer/composables/vault/useFolderTree', () => ({
    useFolderTree: vi.fn(() => ({
        expandedFolders: mockExpandedFolders,
        folderTree: mockFolderTree,
        flattenedItems: mockFlattenedItems,
        visibleFiles: mockVisibleFiles,
        toggleFolder: mockToggleFolder,
        getFileNameWithoutExtension: mockGetFileNameWithoutExtension,
    })),
}));

// ── helpers ────────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<FileInfo> = {}): FileInfo {
    return {
        name: 'note.md',
        path: '/vault/note.md',
        relativePath: 'note.md',
        extension: '.md',
        size: 100,
        modified: new Date().toISOString(),
        folder: '/vault',
        ...overrides,
    };
}

const file1 = makeFile({ name: 'a.md', path: '/vault/a.md' });
const file2 = makeFile({ name: 'b.md', path: '/vault/b.md' });
const folder1: FolderInfo = {
    path: '/vault/sub',
    name: 'sub',
    relativePath: 'sub',
    folderPath: '/vault/sub',
    folderName: 'sub',
};

const baseProps = {
    files: [file1, file2],
    folders: [folder1],
    currentFolder: '/vault',
    selectedFiles: [] as FileInfo[],
    activeFile: null as FileInfo | null,
    renamingFile: null as FileInfo | null,
    selectedFolder: null as string | null,
    renamingFolder: null as string | null,
    bookmarkedFiles: [] as string[],
};

function mount(props: Partial<typeof baseProps> = {}) {
    return shallowMount(FileExplorer, {
        props: { ...baseProps, ...props },
        global: { plugins: [i18n] },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockExpandedFolders.value = new Set();
    mockFlattenedItems.value = [];
    mockGetFileNameWithoutExtension.mockImplementation((name: string) => name.replace(/\.[^.]+$/, ''));
});

// ── contextMenuItems computed ─────────────────────────────────────────────────

describe('contextMenuItems', () => {
    it('returns rename+delete for folder type', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleContextMenu: (type: 'file' | 'folder', path: string, e: MouseEvent) => void;
            contextMenuItems: { action: string }[];
        };
        vm.handleContextMenu('folder', '/vault/sub', new MouseEvent('contextmenu'));
        await wrapper.vm.$nextTick();
        const actions = vm.contextMenuItems.map((i) => i.action);
        expect(actions).toContain('rename');
        expect(actions).toContain('delete');
        expect(actions).not.toContain('bookmark');
        wrapper.unmount();
    });

    it('returns bookmark+rename+delete for file type (not bookmarked)', async () => {
        const wrapper = mount({ bookmarkedFiles: [] });
        const vm = wrapper.vm as unknown as {
            handleContextMenu: (type: 'file' | 'folder', path: string, e: MouseEvent) => void;
            contextMenuItems: { label: string; action: string }[];
        };
        vm.handleContextMenu('file', '/vault/a.md', new MouseEvent('contextmenu'));
        await wrapper.vm.$nextTick();
        const actions = vm.contextMenuItems.map((i) => i.action);
        expect(actions).toContain('bookmark');
        expect(actions).toContain('rename');
        expect(actions).toContain('delete');
        wrapper.unmount();
    });

    it('shows "remove from bookmarks" label when file is bookmarked', async () => {
        const wrapper = mount({ bookmarkedFiles: ['/vault/a.md'] });
        const vm = wrapper.vm as unknown as {
            handleContextMenu: (type: 'file' | 'folder', path: string, e: MouseEvent) => void;
            contextMenuItems: { label: string; action: string }[];
        };
        vm.handleContextMenu('file', '/vault/a.md', new MouseEvent('contextmenu'));
        await wrapper.vm.$nextTick();
        const bookmarkItem = vm.contextMenuItems.find((i) => i.action === 'bookmark');
        expect(bookmarkItem?.label).toMatch(/remove/i);
        wrapper.unmount();
    });
});

// ── watch: renamingFile ───────────────────────────────────────────────────────

describe('watch: renamingFile', () => {
    it('sets renameValue to filename without extension when renamingFile changes', async () => {
        mockGetFileNameWithoutExtension.mockReturnValue('note');
        const wrapper = mount({ renamingFile: null });
        await wrapper.setProps({ renamingFile: file1 });
        await wrapper.vm.$nextTick();
        expect(mockGetFileNameWithoutExtension).toHaveBeenCalledWith(file1.name);
        wrapper.unmount();
    });

    it('does not update renameValue when renamingFile is null', async () => {
        const wrapper = mount({ renamingFile: file1 });
        mockGetFileNameWithoutExtension.mockClear();
        await wrapper.setProps({ renamingFile: null });
        await wrapper.vm.$nextTick();
        expect(mockGetFileNameWithoutExtension).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});

// ── watch: renamingFolder ─────────────────────────────────────────────────────

describe('watch: renamingFolder', () => {
    it('sets renameValue to folder basename when renamingFolder changes', async () => {
        const wrapper = mount({ renamingFolder: null });
        await wrapper.setProps({ renamingFolder: '/vault/sub' });
        await wrapper.vm.$nextTick();
        const vm = wrapper.vm as unknown as { renameValue: string };
        expect(vm.renameValue).toBe('sub');
        wrapper.unmount();
    });

    it('uses full path as fallback when no slash in path', async () => {
        const wrapper = mount({ renamingFolder: null });
        await wrapper.setProps({ renamingFolder: 'rootfolder' });
        await wrapper.vm.$nextTick();
        const vm = wrapper.vm as unknown as { renameValue: string };
        expect(vm.renameValue).toBe('rootfolder');
        wrapper.unmount();
    });

    it('does not update when renamingFolder is empty string', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        const vm = wrapper.vm as unknown as { renameValue: string };
        vm.renameValue = 'initial';
        await wrapper.setProps({ renamingFolder: '' });
        await wrapper.vm.$nextTick();
        expect(vm.renameValue).toBe('initial');
        wrapper.unmount();
    });
});

// ── handleKeyDown: guard clauses ──────────────────────────────────────────────

describe('handleKeyDown: guard clauses', () => {
    it('ignores keys when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        // No interaction should occur (no events emitted for navigation)
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('ignores keys when renamingFolder is set', () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('ignores arrow keys when target is a TEXTAREA', () => {
        const wrapper = mount();
        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        document.body.removeChild(ta);
        wrapper.unmount();
    });

    it('ignores arrow keys when target is an INPUT', () => {
        const wrapper = mount();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        document.body.removeChild(input);
        wrapper.unmount();
    });

    it('ignores non-arrow keys', () => {
        const wrapper = mount();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('returns early when flattenedItems is empty', () => {
        mockFlattenedItems.value = [];
        const wrapper = mount();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });
});

// ── handleKeyDown: folder expand/collapse ─────────────────────────────────────

describe('handleKeyDown: ArrowRight/Left folder expand/collapse', () => {
    it('ArrowRight expands a collapsed selected folder', async () => {
        const wrapper = mount({ selectedFolder: '/vault/sub' });
        mockExpandedFolders.value = new Set();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(mockExpandedFolders.value.has('/vault/sub')).toBe(true);
        wrapper.unmount();
    });

    it('ArrowRight does not collapse an already-expanded folder', async () => {
        const wrapper = mount({ selectedFolder: '/vault/sub' });
        mockExpandedFolders.value = new Set(['/vault/sub']);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(mockExpandedFolders.value.has('/vault/sub')).toBe(true);
        wrapper.unmount();
    });

    it('ArrowLeft collapses an expanded selected folder', async () => {
        const wrapper = mount({ selectedFolder: '/vault/sub' });
        mockExpandedFolders.value = new Set(['/vault/sub']);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(mockExpandedFolders.value.has('/vault/sub')).toBe(false);
        wrapper.unmount();
    });

    it('ArrowLeft does nothing if folder is already collapsed', async () => {
        const wrapper = mount({ selectedFolder: '/vault/sub' });
        mockExpandedFolders.value = new Set();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(mockExpandedFolders.value.size).toBe(0);
        wrapper.unmount();
    });

    it('ArrowRight/Left does nothing when no folder selected', () => {
        const wrapper = mount({ selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(mockExpandedFolders.value.size).toBe(0);
        wrapper.unmount();
    });
});

// ── handleKeyDown: keyboard navigation ───────────────────────────────────────

describe('handleKeyDown: ArrowDown/Up navigation', () => {
    it('emits selectFile for the next file item (ArrowDown)', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ activeFile: file1, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file2);
        wrapper.unmount();
    });

    it('wraps ArrowDown from last item to first', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ activeFile: file2, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('emits selectFile for the previous item (ArrowUp)', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ activeFile: file2, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('wraps ArrowUp from first item to last', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ activeFile: file1, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file2);
        wrapper.unmount();
    });

    it('uses selectedFolder index when selectedFolder is set', () => {
        mockFlattenedItems.value = [
            { type: 'folder', folderPath: '/vault/sub' },
            { type: 'file', file: file1 },
        ];
        const wrapper = mount({ selectedFolder: '/vault/sub', activeFile: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('emits selectFolder when navigating to a folder item', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'folder', folderPath: '/vault/sub' },
        ];
        const wrapper = mount({ activeFile: file1, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFolder')?.[0]?.[0]).toBe('/vault/sub');
        wrapper.unmount();
    });

    it('uses activeFile when selectedFolder index is -1', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ selectedFolder: '/nonexistent', activeFile: file1 });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file2);
        wrapper.unmount();
    });

    it('starts from 0 when no current selection (currentIndex -1, ArrowDown)', () => {
        mockFlattenedItems.value = [
            { type: 'file', file: file1 },
            { type: 'file', file: file2 },
        ];
        const wrapper = mount({ activeFile: null, selectedFolder: null });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        // currentIndex = -1 → newIndex = 0
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });
});

// ── selectFile / selectFolder guard ──────────────────────────────────────────

describe('selectFile / selectFolder guards', () => {
    it('selectFile does not emit when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        const vm = wrapper.vm as unknown as { selectFile: (f: FileInfo) => void };
        vm.selectFile(file1);
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFile does not emit when renamingFolder is set', () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        const vm = wrapper.vm as unknown as { selectFile: (f: FileInfo) => void };
        vm.selectFile(file1);
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFile emits when no renaming active', () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        const vm = wrapper.vm as unknown as { selectFile: (f: FileInfo) => void };
        vm.selectFile(file1);
        expect(wrapper.emitted('selectFile')).toBeDefined();
        wrapper.unmount();
    });

    it('selectFolder does not emit when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        const vm = wrapper.vm as unknown as { selectFolder: (p: string) => void };
        vm.selectFolder('/vault/sub');
        expect(wrapper.emitted('selectFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFolder emits when no renaming', () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        const vm = wrapper.vm as unknown as { selectFolder: (p: string) => void };
        vm.selectFolder('/vault/sub');
        expect(wrapper.emitted('selectFolder')).toBeDefined();
        wrapper.unmount();
    });
});

// ── handleContextMenuAction ───────────────────────────────────────────────────

describe('handleContextMenuAction', () => {
    function openContextMenu(wrapper: ReturnType<typeof mount>, type: 'file' | 'folder', path: string) {
        const vm = wrapper.vm as unknown as {
            handleContextMenu: (t: 'file' | 'folder', p: string, e: MouseEvent) => void;
        };
        vm.handleContextMenu(type, path, new MouseEvent('contextmenu'));
    }

    it('bookmark action on file emits toggleBookmark', async () => {
        const wrapper = mount({ files: [file1] });
        openContextMenu(wrapper, 'file', file1.path);
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('bookmark');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('toggleBookmark')?.[0]?.[0]).toBe(file1.path);
        wrapper.unmount();
    });

    it('rename action on folder emits startRenameFolder', async () => {
        const wrapper = mount();
        openContextMenu(wrapper, 'folder', '/vault/sub');
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('rename');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('startRenameFolder')?.[0]?.[0]).toBe('/vault/sub');
        wrapper.unmount();
    });

    it('rename action on file emits startRenameFile when file found', async () => {
        const wrapper = mount({ files: [file1] });
        openContextMenu(wrapper, 'file', file1.path);
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('rename');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('startRenameFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('rename action on file emits nothing when file not found', async () => {
        const wrapper = mount({ files: [] });
        openContextMenu(wrapper, 'file', '/vault/missing.md');
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('rename');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('startRenameFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('delete action on folder emits deleteFolder', async () => {
        const wrapper = mount();
        openContextMenu(wrapper, 'folder', '/vault/sub');
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('delete');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('deleteFolder')?.[0]?.[0]).toBe('/vault/sub');
        wrapper.unmount();
    });

    it('delete action on file emits deleteFile when file found', async () => {
        const wrapper = mount({ files: [file1] });
        openContextMenu(wrapper, 'file', file1.path);
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('delete');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('deleteFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('delete action on file emits nothing when file not found', async () => {
        const wrapper = mount({ files: [] });
        openContextMenu(wrapper, 'file', '/vault/ghost.md');
        const vm = wrapper.vm as unknown as {
            handleContextMenuAction: (a: string) => void;
        };
        vm.handleContextMenuAction('delete');
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('deleteFile')).toBeUndefined();
        wrapper.unmount();
    });
});

// ── confirmRename ─────────────────────────────────────────────────────────────

describe('confirmRename', () => {
    function setRenameValue(wrapper: ReturnType<typeof mount>, value: string) {
        const vm = wrapper.vm as unknown as { renameValue: string };
        vm.renameValue = value;
    }

    it('emits renameFile when renamingFile and new name differs', async () => {
        mockGetFileNameWithoutExtension.mockReturnValue('a');
        const wrapper = mount({ renamingFile: file1 });
        setRenameValue(wrapper, 'b');
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('renameFile')?.[0]).toEqual([file1, 'b']);
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFile and name is unchanged', async () => {
        mockGetFileNameWithoutExtension.mockReturnValue('a');
        const wrapper = mount({ renamingFile: file1 });
        setRenameValue(wrapper, 'a');
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        expect(wrapper.emitted('renameFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFile but renameValue is empty', async () => {
        const wrapper = mount({ renamingFile: file1 });
        setRenameValue(wrapper, '   ');
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        wrapper.unmount();
    });

    it('emits renameFolder when renamingFolder and new name differs', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        setRenameValue(wrapper, 'newsub');
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('renameFolder')?.[0]).toEqual(['/vault/sub', 'newsub']);
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFolder and name unchanged', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        setRenameValue(wrapper, 'sub');
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        expect(wrapper.emitted('renameFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits cancelRename when neither renamingFile nor renamingFolder', async () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        const vm = wrapper.vm as unknown as { confirmRename: () => void };
        vm.confirmRename();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        wrapper.unmount();
    });
});

// ── drag events ───────────────────────────────────────────────────────────────

describe('drag events', () => {
    it('handleRootDragOver sets isDragOverRoot to true', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as { handleRootDragOver: (e: DragEvent) => void };
        const fakeEvt = { preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent;
        vm.handleRootDragOver(fakeEvt);
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.file-list').classes()).toContain('drag-over-root');
        wrapper.unmount();
    });

    it('handleRootDragOver sets dropEffect when dataTransfer exists', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as { handleRootDragOver: (e: DragEvent) => void };
        const dt = { dropEffect: '' };
        vm.handleRootDragOver({ preventDefault: vi.fn(), dataTransfer: dt } as unknown as DragEvent);
        expect(dt.dropEffect).toBe('move');
        wrapper.unmount();
    });

    it('handleRootDragLeave sets isDragOverRoot to false when relatedTarget is outside', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleRootDragOver: (e: DragEvent) => void;
            handleRootDragLeave: (e: DragEvent) => void;
        };
        vm.handleRootDragOver({ preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        const outsideEl = document.createElement('div');
        // Simulate leaving: target does not contain relatedTarget (outsideEl is detached)
        const fileListEl = wrapper.find('.file-list').element as HTMLElement;
        vm.handleRootDragLeave({
            target: fileListEl,
            relatedTarget: outsideEl,
        } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.file-list').classes()).not.toContain('drag-over-root');
        wrapper.unmount();
    });

    it('handleRootDrop emits moveFile for file: data', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleRootDrop: (e: DragEvent) => void;
        };
        const dt = { getData: vi.fn().mockReturnValue('file:/vault/note.md') } as unknown as DataTransfer;
        vm.handleRootDrop({ dataTransfer: dt, preventDefault: vi.fn() } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('moveFile')?.[0]).toEqual(['/vault/note.md', '.']);
        wrapper.unmount();
    });

    it('handleRootDrop emits moveFolder for folder: data', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleRootDrop: (e: DragEvent) => void;
        };
        const dt = { getData: vi.fn().mockReturnValue('folder:/vault/sub') } as unknown as DataTransfer;
        vm.handleRootDrop({ dataTransfer: dt, preventDefault: vi.fn() } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('moveFolder')?.[0]).toEqual(['/vault/sub', '.']);
        wrapper.unmount();
    });

    it('handleRootDrop emits nothing for empty dataTransfer', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleRootDrop: (e: DragEvent) => void;
        };
        const dt = { getData: vi.fn().mockReturnValue('') } as unknown as DataTransfer;
        vm.handleRootDrop({ dataTransfer: dt, preventDefault: vi.fn() } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('moveFile')).toBeUndefined();
        expect(wrapper.emitted('moveFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('handleRootDrop emits nothing when dataTransfer is null', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleRootDrop: (e: DragEvent) => void;
        };
        vm.handleRootDrop({ dataTransfer: null, preventDefault: vi.fn() } as unknown as DragEvent);
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('moveFile')).toBeUndefined();
        wrapper.unmount();
    });
});

// ── empty state ───────────────────────────────────────────────────────────────

describe('empty state', () => {
    it('shows empty state when files list is empty', () => {
        const wrapper = mount({ files: [] });
        expect(wrapper.find('.empty-state').exists()).toBe(true);
        wrapper.unmount();
    });

    it('hides empty state when files exist', () => {
        const wrapper = mount({ files: [file1] });
        expect(wrapper.find('.empty-state').exists()).toBe(false);
        wrapper.unmount();
    });
});

// ── close context menu ────────────────────────────────────────────────────────

describe('closeContextMenu', () => {
    it('hides context menu', async () => {
        const wrapper = mount();
        const vm = wrapper.vm as unknown as {
            handleContextMenu: (t: 'file' | 'folder', p: string, e: MouseEvent) => void;
            closeContextMenu: () => void;
        };
        vm.handleContextMenu('file', file1.path, new MouseEvent('contextmenu'));
        vm.closeContextMenu();
        await wrapper.vm.$nextTick();
        const ctxMenu = wrapper.findComponent({ name: 'ContextMenu' });
        expect(ctxMenu.props('visible')).toBe(false);
        wrapper.unmount();
    });
});
