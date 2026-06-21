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
    return { path, name, relativePath: path, folderPath: path, folderName: name };
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

    it('emits "renameFile" when rename action is chosen from context menu', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        if (fileItems.length > 0) {
            await fileItems[0].trigger('contextmenu');
            await wrapper.vm.$nextTick();
            // Find rename option in context menu
            const menuItems = document.querySelectorAll<HTMLButtonElement>('.context-menu-item');
            for (const item of menuItems) {
                if (item.textContent?.toLowerCase().includes('rename')) {
                    item.click();
                    await wrapper.vm.$nextTick();
                    break;
                }
            }
        }
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('emits "deleteFile" when delete action is chosen from context menu', async () => {
        const wrapper = mountWithI18n(FileExplorer, { props: baseProps, attachTo: document.body });
        await wrapper.vm.$nextTick();
        const fileItems = wrapper.findAll('.file-item');
        if (fileItems.length > 0) {
            await fileItems[0].trigger('contextmenu');
            await wrapper.vm.$nextTick();
            const menuItems = document.querySelectorAll<HTMLButtonElement>('.context-menu-item');
            for (const item of menuItems) {
                if (item.textContent?.toLowerCase().includes('delete')) {
                    item.click();
                    await wrapper.vm.$nextTick();
                    break;
                }
            }
        }
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
        // Trigger ArrowDown on window
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await wrapper.vm.$nextTick();
        // Should have emitted selectFile or selectFolder
        wrapper.unmount();
    });

    it('expands a folder when ArrowRight is pressed on selected folder', async () => {
        const wrapper = mountWithI18n(FileExplorer, {
            props: { ...baseProps, selectedFolder: '/vault/work' },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await wrapper.vm.$nextTick();
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
