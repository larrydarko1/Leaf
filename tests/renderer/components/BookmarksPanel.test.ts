import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import BookmarksPanel from '@/renderer/components/BookmarksPanel.vue';
import type { FileInfo } from '@/schemas/vault';

function makeFile(name: string, path: string): FileInfo {
    return {
        name,
        path,
        relativePath: path,
        extension: name.split('.').pop() ?? '',
        size: 0,
        modified: new Date().toISOString(),
        folder: '.',
    };
}

const fileA = makeFile('notes.md', '/vault/notes.md');
const fileB = makeFile('ideas.md', '/vault/ideas.md');
const fileC = makeFile('draft.md', '/vault/draft.md');

const allFiles = [fileA, fileB, fileC];

describe('BookmarksPanel', () => {
    it('renders nothing when no files are bookmarked', () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [],
                selectedFiles: [],
                activeFile: null,
            },
        });
        expect(wrapper.findAll('.bookmark-item').length).toBe(0);
        wrapper.unmount();
    });

    it('renders only the bookmarked files', () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path, fileC.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        const items = wrapper.findAll('.bookmark-item');
        expect(items).toHaveLength(2);
        wrapper.unmount();
    });

    it('skips bookmarked paths that do not match any file', () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: ['/vault/missing.md', fileB.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        expect(wrapper.findAll('.bookmark-item')).toHaveLength(1);
        wrapper.unmount();
    });

    it('emits "selectFile" with the file when a bookmark is clicked', async () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path, fileB.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        await wrapper.findAll('.bookmark-item')[1].trigger('click');
        expect(wrapper.emitted('selectFile')?.[0]?.[0]).toMatchObject({ path: fileB.path });
        wrapper.unmount();
    });

    it('emits "openFile" on double-click', async () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        await wrapper.find('.bookmark-item').trigger('dblclick');
        expect(wrapper.emitted('openFile')?.[0]?.[0]).toMatchObject({ path: fileA.path });
        wrapper.unmount();
    });

    it('emits "removeBookmark" with the file path when the remove button is clicked', async () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        await wrapper.find('.unbookmark-btn').trigger('click');
        expect(wrapper.emitted('removeBookmark')?.[0]?.[0]).toBe(fileA.path);
        wrapper.unmount();
    });

    it('applies the "selected" class to selected files', () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path, fileB.path],
                selectedFiles: [fileA],
                activeFile: null,
            },
        });
        const items = wrapper.findAll('.bookmark-item');
        expect(items[0].classes()).toContain('selected');
        expect(items[1].classes()).not.toContain('selected');
        wrapper.unmount();
    });

    it('shows the panel header', () => {
        const wrapper = mountWithI18n(BookmarksPanel, {
            props: {
                files: allFiles,
                bookmarkedPaths: [fileA.path],
                selectedFiles: [],
                activeFile: null,
            },
        });
        expect(wrapper.find('.bookmarks-panel').exists()).toBe(true);
        wrapper.unmount();
    });
});
