import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithI18n } from '@test-utils';
import FileExplorer from '@/renderer/components/FileExplorer.vue';
import type { FileInfo, FolderInfo } from '@/schemas/vault';

function makeFile(name: string, folder = '.'): FileInfo {
    return {
        name,
        path: `/${folder}/${name}`,
        relativePath: `${folder}/${name}`,
        extension: name.split('.').pop() ?? '',
        size: 0,
        modified: new Date().toISOString(),
        folder,
    };
}

function makeFolder(path: string, name: string): FolderInfo {
    return { name: name, path: path, relativePath: path, type: 'folder', folder: name };
}

const noteFile = makeFile('notes.md', '.');
const ideaFile = makeFile('ideas.md', 'work');

const baseProps = {
    files: [noteFile, ideaFile],
    folders: [makeFolder('/vault/work', 'work')],
    currentFolder: '/vault',
    selectedFiles: [] as FileInfo[],
    activeFile: null as FileInfo | null,
    renamingFile: null as FileInfo | null,
    selectedFolder: null as string | null,
    renamingFolder: null as string | null,
    bookmarkedFiles: [] as string[],
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('FileExplorer', () => {
    it('renders the file explorer', () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps });
        expect(wrapper.find('.file-explorer, [role="tree"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('emits "selectFile" when a file is clicked', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        if (fileItems.length > 0) {
            await fileItems[0].trigger('click');
            expect(wrapper.emitted('selectFile')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "selectFolder" when a folder is clicked', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps });
        await wrapper.vm.$nextTick();
        const folderItems = wrapper.findAll('.folder-item');
        if (folderItems.length > 0) {
            await folderItems[0].trigger('click');
            expect(wrapper.emitted('selectFolder')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('shows a context menu when a file is right-clicked', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        if (fileItems.length > 0) {
            await fileItems[0].trigger('contextmenu');
            await wrapper.vm.$nextTick();
            const menu = document.querySelector('.context-menu');
            expect(menu).not.toBeNull();
        }
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('shows a context menu when a folder is right-clicked', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const folderItems = wrapper.findAll('.folder-item');
        if (folderItems.length > 0) {
            await folderItems[0].trigger('contextmenu');
            await wrapper.vm.$nextTick();
            const menu = document.querySelector('.context-menu');
            expect(menu).not.toBeNull();
        }
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('emits "startRenameFile" when rename action is chosen from context menu', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        expect(fileItems.length).toBeGreaterThan(0);

        await fileItems[0].trigger('contextmenu');
        await wrapper.vm.$nextTick();
        const renameItem = [...document.querySelectorAll<HTMLButtonElement>('.context-menu-item')].find((item) =>
            item.textContent?.toLowerCase().includes('rename'),
        );
        expect(renameItem).toBeDefined();

        renameItem?.click();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('startRenameFile')?.[0]).toEqual([noteFile]);

        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('emits "deleteFile" when delete action is chosen from context menu', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        expect(fileItems.length).toBeGreaterThan(0);

        await fileItems[0].trigger('contextmenu');
        await wrapper.vm.$nextTick();
        const deleteItem = [...document.querySelectorAll<HTMLButtonElement>('.context-menu-item')].find((item) =>
            item.textContent?.toLowerCase().includes('delete'),
        );
        expect(deleteItem).toBeDefined();

        deleteItem?.click();
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('deleteFile')?.[0]).toEqual([noteFile]);

        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('shows rename input when renamingFile is set', async () => {
        const wrapper = mountWithI18n(FileExplorer, {
            props: { ...baseProps, renamingFile: noteFile },
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('input[type="text"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('handles arrow-down keyboard navigation when component is focused', async () => {
        const wrapper = mountWithI18n(FileExplorer, {
            props: { ...baseProps, activeFile: noteFile },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await wrapper.vm.$nextTick();

        // ArrowDown moves the selection to the next visible item, whichever kind it is.
        const moved = wrapper.emitted('selectFile') ?? wrapper.emitted('selectFolder');
        expect(moved).toBeDefined();
        wrapper.unmount();
    });

    it('expands a folder when ArrowRight is pressed on selected folder', async () => {
        // The tree keys folders by relativePath, which is what `selectedFolder` carries.
        const wrapper = mountWithI18n(FileExplorer, {
            props: { ...baseProps, selectedFolder: 'work' },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[aria-expanded="false"]').exists()).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[aria-expanded="true"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('renders bookmark option in context menu for bookmarked file', async () => {
        const wrapper = mountWithI18n(FileExplorer, {
            props: { ...baseProps, bookmarkedFiles: [noteFile.path] },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        if (fileItems.length > 0) {
            await fileItems[0].trigger('contextmenu');
            await wrapper.vm.$nextTick();
            const menuText = document.querySelector('.context-menu')?.textContent ?? '';
            expect(menuText).toMatch(/bookmark/i);
        }
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });
});
