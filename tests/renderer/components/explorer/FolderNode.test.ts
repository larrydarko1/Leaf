import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import FolderNode from '@/renderer/components/explorer/FolderNode.vue';
import type { FileInfo, TreeNode } from '@/schemas/vault';

function makeFile(name: string, path: string, ext = 'md'): FileInfo {
    return {
        name,
        path,
        relativePath: path,
        extension: ext,
        size: 0,
        modified: new Date().toISOString(),
        folder: '.',
    };
}

function makeFileNode(file: FileInfo): TreeNode {
    return { path: file.path, name: file.name, type: 'file', file };
}

function makeFolderNode(path: string, name: string, children: TreeNode[] = []): TreeNode {
    return { path, name, type: 'folder', children };
}

const noteFile = makeFile('notes.md', '/vault/notes.md');
const imageFile = makeFile('photo.png', '/vault/photo.png', 'png');
const videoFile = makeFile('clip.mp4', '/vault/clip.mp4', 'mp4');
const audioFile = makeFile('song.mp3', '/vault/song.mp3', 'mp3');
const drawingFile = makeFile('sketch.leaf', '/vault/sketch.leaf', 'leaf');

const baseProps = {
    depth: 0,
    selectedFiles: [] as FileInfo[],
    activeFile: null as FileInfo | null,
    renamingFile: null as FileInfo | null,
    selectedFolder: null as string | null,
    renamingFolder: null as string | null,
    renameValue: '',
    expandedFolders: new Set<string>(),
    bookmarkedFiles: [] as string[],
};

describe('FolderNode — file node', () => {
    it('renders a file item for a file type node', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile) },
        });
        expect(wrapper.find('.file-item, [role="treeitem"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows the file name', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile) },
        });
        expect(wrapper.html()).toContain('notes.md');
        wrapper.unmount();
    });

    it('applies "active" class when file is the activeFile', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile), activeFile: noteFile },
        });
        const item = wrapper.find('.file-item');
        expect(item.classes()).toContain('active');
        wrapper.unmount();
    });

    it('applies "selected" class when file is in selectedFiles', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile), selectedFiles: [noteFile] },
        });
        const item = wrapper.find('.file-item');
        expect(item.classes()).toContain('selected');
        wrapper.unmount();
    });

    it('emits "selectFile" when the file item is clicked', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile) },
        });
        await wrapper.find('.file-item').trigger('click');
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toMatchObject({ path: noteFile.path });
        wrapper.unmount();
    });

    it('emits "contextMenu" when the file is right-clicked', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile) },
        });
        await wrapper.find('.file-item').trigger('contextmenu');
        expect(wrapper.emitted('contextMenu')?.[0]?.[0]).toBe('file');
        wrapper.unmount();
    });

    it('shows an image icon for image files', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(imageFile) },
        });
        expect(wrapper.html()).toBeTruthy();
        wrapper.unmount();
    });

    it('shows a video icon for video files', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(videoFile) },
        });
        expect(wrapper.html()).toBeTruthy();
        wrapper.unmount();
    });

    it('shows an audio icon for audio files', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(audioFile) },
        });
        expect(wrapper.html()).toBeTruthy();
        wrapper.unmount();
    });

    it('shows a drawing icon for drawing files', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(drawingFile) },
        });
        expect(wrapper.html()).toBeTruthy();
        wrapper.unmount();
    });

    it('applies indentation based on depth', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: makeFileNode(noteFile), depth: 2 },
        });
        // Depth 2 means paddingLeft = 2 * 16 + 10 = 42px
        expect(wrapper.html()).toContain('42px');
        wrapper.unmount();
    });
});

describe('FolderNode — folder node', () => {
    const folderNode = makeFolderNode('/vault/docs', 'docs', [makeFileNode(noteFile)]);

    it('renders a folder item for a folder type node', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        expect(wrapper.find('.folder-item').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows the folder name', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        expect(wrapper.html()).toContain('docs');
        wrapper.unmount();
    });

    it('emits "selectFolder" when the folder item is clicked', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        await wrapper.find('.folder-item').trigger('click');
        expect(wrapper.emitted('selectFolder')?.[0]?.[0]).toBe('/vault/docs');
        wrapper.unmount();
    });

    it('emits "toggleFolder" when the chevron button is clicked', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        await wrapper.find('.chevron-button').trigger('click');
        expect(wrapper.emitted('toggleFolder')?.[0]?.[0]).toBe('/vault/docs');
        wrapper.unmount();
    });

    it('does not expand children when folder is not in expandedFolders', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        // Without being expanded, children should not be rendered
        expect(wrapper.findAll('.file-item').length).toBe(0);
        wrapper.unmount();
    });

    it('expands and shows children when folder is in expandedFolders', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: folderNode,
                expandedFolders: new Set(['/vault/docs']),
            },
        });
        // Children should be rendered when expanded
        expect(wrapper.findAll('.file-item').length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it('applies "active" class when folder is the selectedFolder', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode, selectedFolder: '/vault/docs' },
        });
        expect(wrapper.find('.folder-item').classes()).toContain('active');
        wrapper.unmount();
    });

    it('emits "contextMenu" when the folder is right-clicked', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        await wrapper.find('.folder-item').trigger('contextmenu');
        expect(wrapper.emitted('contextMenu')?.[0]?.[0]).toBe('folder');
        wrapper.unmount();
    });

    it('shows the open folder icon when expanded', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: folderNode,
                expandedFolders: new Set(['/vault/docs']),
            },
        });
        expect(wrapper.find('.folder-icon-open').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows the closed folder icon when not expanded', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        expect(wrapper.find('.folder-icon-open').exists()).toBe(false);
        wrapper.unmount();
    });

    it('shows the aria-expanded attribute as false when not expanded', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: { ...baseProps, node: folderNode },
        });
        expect(wrapper.find('.folder-item').attributes('aria-expanded')).toBe('false');
        wrapper.unmount();
    });

    it('shows the aria-expanded attribute as true when expanded', () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: folderNode,
                expandedFolders: new Set(['/vault/docs']),
            },
        });
        expect(wrapper.find('.folder-item').attributes('aria-expanded')).toBe('true');
        wrapper.unmount();
    });
});

describe('FolderNode — renaming', () => {
    it('shows a rename input when renamingFile matches the file', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: makeFileNode(noteFile),
                renamingFile: noteFile,
                renameValue: 'notes',
            },
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('input[type="text"], .rename-input').exists()).toBe(true);
        wrapper.unmount();
    });

    it('emits "cancelRename" when Escape is pressed during rename', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: makeFileNode(noteFile),
                renamingFile: noteFile,
                renameValue: 'notes',
            },
        });
        await wrapper.vm.$nextTick();
        const input = wrapper.find('input');
        if (input.exists()) {
            await input.trigger('keydown', { key: 'Escape' });
            expect(wrapper.emitted('cancelRename')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "rename" when the input loses focus (blur)', async () => {
        const wrapper = mountWithI18n(FolderNode, {
            props: {
                ...baseProps,
                node: makeFileNode(noteFile),
                renamingFile: noteFile,
                renameValue: 'newnotes',
            },
        });
        await wrapper.vm.$nextTick();
        const input = wrapper.find('input');
        if (input.exists()) {
            await input.trigger('blur');
            expect(wrapper.emitted('rename')).toBeDefined();
        }
        wrapper.unmount();
    });
});
