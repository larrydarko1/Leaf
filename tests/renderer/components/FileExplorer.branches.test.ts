import { shallowMount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { z } from 'zod';

import ContextMenu from '@/renderer/components/explorer/ContextMenu.vue';
import FolderNode from '@/renderer/components/explorer/FolderNode.vue';
import FileExplorer from '@/renderer/components/FileExplorer.vue';
import { i18n } from '@/renderer/i18n';
import type { FileInfo, FolderInfo } from '@/schemas/vault';
import { createDragEvent, FakeDataTransfer } from '@test-utils';

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

const file1 = makeFile({ name: 'a.md', path: '/vault/a.md' });
const file2 = makeFile({ name: 'b.md', path: '/vault/b.md' });

const folder1: FolderInfo = {
    path: '/vault/sub',
    name: 'sub',
    relativePath: 'sub',
    type: 'folder',
    folder: '.',
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

function mount(props: Partial<typeof baseProps> = {}) {
    return shallowMount(FileExplorer, {
        props: { ...baseProps, ...props },
        global: { plugins: [i18n] },
    });
}

/** The tree's root node: the component whose events the explorer listens to. */
function folderNode(wrapper: ReturnType<typeof mount>) {
    return wrapper.findComponent(FolderNode);
}

/** Right-clicks `path` the way FolderNode reports it. */
async function openContextMenu(wrapper: ReturnType<typeof mount>, type: 'file' | 'folder', path: string) {
    folderNode(wrapper).vm.$emit('context-menu', type, path, new MouseEvent('contextmenu'));
    await nextTick();
}

function menuItems(wrapper: ReturnType<typeof mount>) {
    return z
        .array(z.object({ label: z.string(), action: z.string() }))
        .parse(wrapper.findComponent(ContextMenu).props('items'));
}

async function chooseMenuAction(wrapper: ReturnType<typeof mount>, action: string) {
    wrapper.findComponent(ContextMenu).vm.$emit('action', action);
    await nextTick();
}

/** The rename text the explorer hands the tree to show. */
function renameValue(wrapper: ReturnType<typeof mount>): string {
    return z.string().parse(folderNode(wrapper).props('renameValue'));
}

/** Types into the rename field, as FolderNode reports each keystroke. */
async function typeRename(wrapper: ReturnType<typeof mount>, value: string) {
    folderNode(wrapper).vm.$emit('update-rename-value', value);
    await nextTick();
}

async function dispatchOnFileList(wrapper: ReturnType<typeof mount>, event: Event) {
    wrapper.find('.file-list').element.dispatchEvent(event);
    await nextTick();
}

beforeEach(() => {
    vi.clearAllMocks();
    mockExpandedFolders.value = new Set();
    mockFolderTree.value = [{ type: 'folder', path: '/vault/sub', name: 'sub', children: [] }];
    mockFlattenedItems.value = [];
    mockGetFileNameWithoutExtension.mockImplementation((name: string) => name.replace(/\.[^.]+$/, ''));
});

describe('contextMenuItems', () => {
    it('returns rename+delete for folder type', async () => {
        const wrapper = mount();
        await openContextMenu(wrapper, 'folder', '/vault/sub');
        const actions = menuItems(wrapper).map((i) => i.action);
        expect(actions).toContain('rename');
        expect(actions).toContain('delete');
        expect(actions).not.toContain('bookmark');
        wrapper.unmount();
    });

    it('returns bookmark+rename+delete for file type (not bookmarked)', async () => {
        const wrapper = mount({ bookmarkedFiles: [] });
        await openContextMenu(wrapper, 'file', '/vault/a.md');
        const actions = menuItems(wrapper).map((i) => i.action);
        expect(actions).toContain('bookmark');
        expect(actions).toContain('rename');
        expect(actions).toContain('delete');
        wrapper.unmount();
    });

    it('shows "remove from bookmarks" label when file is bookmarked', async () => {
        const wrapper = mount({ bookmarkedFiles: ['/vault/a.md'] });
        await openContextMenu(wrapper, 'file', '/vault/a.md');
        const bookmarkItem = menuItems(wrapper).find((i) => i.action === 'bookmark');
        expect(bookmarkItem?.label).toMatch(/remove/i);
        wrapper.unmount();
    });
});

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

describe('watch: renamingFolder', () => {
    it('sets renameValue to folder basename when renamingFolder changes', async () => {
        const wrapper = mount({ renamingFolder: null });
        await wrapper.setProps({ renamingFolder: '/vault/sub' });
        await wrapper.vm.$nextTick();
        expect(renameValue(wrapper)).toBe('sub');
        wrapper.unmount();
    });

    it('uses full path as fallback when no slash in path', async () => {
        const wrapper = mount({ renamingFolder: null });
        await wrapper.setProps({ renamingFolder: 'rootfolder' });
        await wrapper.vm.$nextTick();
        expect(renameValue(wrapper)).toBe('rootfolder');
        wrapper.unmount();
    });

    it('does not update when renamingFolder is empty string', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        await typeRename(wrapper, 'initial');
        await wrapper.setProps({ renamingFolder: '' });
        await wrapper.vm.$nextTick();
        expect(renameValue(wrapper)).toBe('initial');
        wrapper.unmount();
    });
});

describe('handleKeyDown: guard clauses', () => {
    it('ignores keys when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
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
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });
});

describe('selectFile / selectFolder guards', () => {
    it('selectFile does not emit when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        folderNode(wrapper).vm.$emit('select-file', file1);
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFile does not emit when renamingFolder is set', () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        folderNode(wrapper).vm.$emit('select-file', file1);
        expect(wrapper.emitted('selectFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFile emits when no renaming active', () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        folderNode(wrapper).vm.$emit('select-file', file1);
        expect(wrapper.emitted('selectFile')).toBeDefined();
        wrapper.unmount();
    });

    it('selectFolder does not emit when renamingFile is set', () => {
        const wrapper = mount({ renamingFile: file1 });
        folderNode(wrapper).vm.$emit('select-folder', '/vault/sub');
        expect(wrapper.emitted('selectFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('selectFolder emits when no renaming', () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        folderNode(wrapper).vm.$emit('select-folder', '/vault/sub');
        expect(wrapper.emitted('selectFolder')).toBeDefined();
        wrapper.unmount();
    });
});

describe('handleContextMenuAction', () => {
    it('bookmark action on file emits toggleBookmark', async () => {
        const wrapper = mount({ files: [file1] });
        await openContextMenu(wrapper, 'file', file1.path);
        await chooseMenuAction(wrapper, 'bookmark');
        expect(wrapper.emitted('toggleBookmark')?.[0]?.[0]).toBe(file1.path);
        wrapper.unmount();
    });

    it('rename action on folder emits startRenameFolder', async () => {
        const wrapper = mount();
        await openContextMenu(wrapper, 'folder', '/vault/sub');
        await chooseMenuAction(wrapper, 'rename');
        expect(wrapper.emitted('startRenameFolder')?.[0]?.[0]).toBe('/vault/sub');
        wrapper.unmount();
    });

    it('rename action on file emits startRenameFile when file found', async () => {
        const wrapper = mount({ files: [file1] });
        await openContextMenu(wrapper, 'file', file1.path);
        await chooseMenuAction(wrapper, 'rename');
        expect(wrapper.emitted('startRenameFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('rename action on file emits nothing when file not found', async () => {
        const wrapper = mount({ files: [] });
        await openContextMenu(wrapper, 'file', '/vault/missing.md');
        await chooseMenuAction(wrapper, 'rename');
        expect(wrapper.emitted('startRenameFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('delete action on folder emits deleteFolder', async () => {
        const wrapper = mount();
        await openContextMenu(wrapper, 'folder', '/vault/sub');
        await chooseMenuAction(wrapper, 'delete');
        expect(wrapper.emitted('deleteFolder')?.[0]?.[0]).toBe('/vault/sub');
        wrapper.unmount();
    });

    it('delete action on file emits deleteFile when file found', async () => {
        const wrapper = mount({ files: [file1] });
        await openContextMenu(wrapper, 'file', file1.path);
        await chooseMenuAction(wrapper, 'delete');
        expect(wrapper.emitted('deleteFile')?.[0]?.[0]).toEqual(file1);
        wrapper.unmount();
    });

    it('delete action on file emits nothing when file not found', async () => {
        const wrapper = mount({ files: [] });
        await openContextMenu(wrapper, 'file', '/vault/ghost.md');
        await chooseMenuAction(wrapper, 'delete');
        expect(wrapper.emitted('deleteFile')).toBeUndefined();
        wrapper.unmount();
    });
});

describe('confirmRename', () => {
    it('emits renameFile when renamingFile and new name differs', async () => {
        mockGetFileNameWithoutExtension.mockReturnValue('a');
        const wrapper = mount({ renamingFile: file1 });
        await typeRename(wrapper, 'b');
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('renameFile')?.[0]).toEqual([file1, 'b']);
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFile and name is unchanged', async () => {
        mockGetFileNameWithoutExtension.mockReturnValue('a');
        const wrapper = mount({ renamingFile: file1 });
        await typeRename(wrapper, 'a');
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        expect(wrapper.emitted('renameFile')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFile but renameValue is empty', async () => {
        const wrapper = mount({ renamingFile: file1 });
        await typeRename(wrapper, '   ');
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        wrapper.unmount();
    });

    it('emits renameFolder when renamingFolder and new name differs', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        await typeRename(wrapper, 'newsub');
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('renameFolder')?.[0]).toEqual(['/vault/sub', 'newsub']);
        wrapper.unmount();
    });

    it('emits cancelRename when renamingFolder and name unchanged', async () => {
        const wrapper = mount({ renamingFolder: '/vault/sub' });
        await typeRename(wrapper, 'sub');
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        expect(wrapper.emitted('renameFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits cancelRename when neither renamingFile nor renamingFolder', async () => {
        const wrapper = mount({ renamingFile: null, renamingFolder: null });
        folderNode(wrapper).vm.$emit('rename');
        await nextTick();
        expect(wrapper.emitted('cancelRename')).toBeDefined();
        wrapper.unmount();
    });
});

describe('drag events', () => {
    it('dragging over the list highlights it as a drop target', async () => {
        const wrapper = mount();
        await dispatchOnFileList(wrapper, createDragEvent('dragover', null));
        expect(wrapper.find('.file-list').classes()).toContain('drag-over-root');
        wrapper.unmount();
    });

    it('dragging over the list asks for a move', async () => {
        const wrapper = mount();
        const dt = new FakeDataTransfer();
        await dispatchOnFileList(wrapper, createDragEvent('dragover', dt));
        expect(dt.dropEffect).toBe('move');
        wrapper.unmount();
    });

    it('leaving the list for an element outside it clears the highlight', async () => {
        const wrapper = mount();
        await dispatchOnFileList(wrapper, createDragEvent('dragover', null));
        const outsideEl = document.createElement('div');
        await dispatchOnFileList(wrapper, createDragEvent('dragleave', null, { relatedTarget: outsideEl }));
        expect(wrapper.find('.file-list').classes()).not.toContain('drag-over-root');
        wrapper.unmount();
    });

    it('dropping a file on the list moves it to the vault root', async () => {
        const wrapper = mount();
        const dt = new FakeDataTransfer({ 'text/plain': 'file:/vault/note.md' });
        await dispatchOnFileList(wrapper, createDragEvent('drop', dt));
        expect(wrapper.emitted('moveFile')?.[0]).toEqual(['/vault/note.md', '.']);
        wrapper.unmount();
    });

    it('dropping a folder on the list moves it to the vault root', async () => {
        const wrapper = mount();
        const dt = new FakeDataTransfer({ 'text/plain': 'folder:/vault/sub' });
        await dispatchOnFileList(wrapper, createDragEvent('drop', dt));
        expect(wrapper.emitted('moveFolder')?.[0]).toEqual(['/vault/sub', '.']);
        wrapper.unmount();
    });

    it('a drop carrying no data moves nothing', async () => {
        const wrapper = mount();
        await dispatchOnFileList(wrapper, createDragEvent('drop', new FakeDataTransfer()));
        expect(wrapper.emitted('moveFile')).toBeUndefined();
        expect(wrapper.emitted('moveFolder')).toBeUndefined();
        wrapper.unmount();
    });

    it('a drop with no dataTransfer moves nothing', async () => {
        const wrapper = mount();
        await dispatchOnFileList(wrapper, createDragEvent('drop', null));
        expect(wrapper.emitted('moveFile')).toBeUndefined();
        wrapper.unmount();
    });
});

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

describe('closeContextMenu', () => {
    it('hides context menu', async () => {
        const wrapper = mount();
        await openContextMenu(wrapper, 'file', file1.path);
        expect(wrapper.findComponent(ContextMenu).props('visible')).toBe(true);
        wrapper.findComponent(ContextMenu).vm.$emit('close');
        await nextTick();
        expect(wrapper.findComponent(ContextMenu).props('visible')).toBe(false);
        wrapper.unmount();
    });
});
