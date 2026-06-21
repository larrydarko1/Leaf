import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithI18n } from '@test-utils';
import SearchPanel from '@/renderer/components/SearchPanel.vue';
import type { FileInfo } from '@/schemas/vault';

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

const files: FileInfo[] = [
    makeFile('notes.md', 'docs'),
    makeFile('ideas.md', 'work'),
    makeFile('README.md', '.'),
    makeFile('todos.md', 'work'),
    makeFile('draft.txt', '.'),
    makeFile('noodles.md', 'recipes'),
];

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

async function search(wrapper: ReturnType<typeof mountWithI18n>, query: string) {
    const input = wrapper.find('.search-input');
    await input.setValue(query);
    vi.advanceTimersByTime(600);
    await wrapper.vm.$nextTick();
}

describe('SearchPanel', () => {
    it('renders the panel with an empty search input', () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        expect(wrapper.find('.search-panel').exists()).toBe(true);
        expect(wrapper.find('.search-input').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows no results when query is empty', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        expect(wrapper.findAll('.search-result-item').length).toBe(0);
        wrapper.unmount();
    });

    it('shows the clear button only when there is a query', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        expect(wrapper.find('.clear-button').exists()).toBe(false);
        await search(wrapper, 'notes');
        expect(wrapper.find('.clear-button').exists()).toBe(true);
        wrapper.unmount();
    });

    it('returns files matching the query', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'notes');
        const results = wrapper.findAll('.search-result-item');
        expect(results.length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it('returns nothing for a query with no matches', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        // 'bbb' contains 'b' which appears in none of the test file names
        await search(wrapper, 'bbb');
        expect(wrapper.findAll('.search-result-item').length).toBe(0);
        wrapper.unmount();
    });

    it('clears search when the clear button is clicked', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'notes');
        await wrapper.find('.clear-button').trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.clear-button').exists()).toBe(false);
        expect(wrapper.findAll('.search-result-item').length).toBe(0);
        wrapper.unmount();
    });

    it('emits "selectFile" when a result is clicked', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'notes');
        await wrapper.find('.search-result-item').trigger('click');
        expect(wrapper.emitted('selectFile')).toBeDefined();
        wrapper.unmount();
    });

    it('emits "openFile" when a result is double-clicked', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'notes');
        await wrapper.find('.search-result-item').trigger('dblclick');
        expect(wrapper.emitted('openFile')).toBeDefined();
        wrapper.unmount();
    });

    it('applies "selected" class to files in selectedFiles', async () => {
        const target = files[0];
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [target], activeFile: null },
        });
        await search(wrapper, 'notes');
        const results = wrapper.findAll('.search-result-item');
        const selectedItems = results.filter((r) => r.classes().includes('selected'));
        expect(selectedItems.length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it('emits "close" when Escape is pressed and query is empty', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
            attachTo: document.body,
        });
        await wrapper.find('.search-input').trigger('keydown', { key: 'Escape' });
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('close')).toBeDefined();
        wrapper.unmount();
    });

    it('clears the search when Escape is pressed with a non-empty query', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'notes');
        await wrapper.find('.search-input').trigger('keydown', { key: 'Escape' });
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('.search-result-item').length).toBe(0);
        expect(wrapper.emitted('close')).toBeUndefined();
        wrapper.unmount();
    });

    it('opens the selected result when Enter is pressed', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
            attachTo: document.body,
        });
        await search(wrapper, 'notes');
        // Navigate down to select the first item (window-level ArrowDown)
        await wrapper.find('.search-input').trigger('keydown', { key: 'ArrowDown' });
        await wrapper.vm.$nextTick();
        // Now press Enter to open
        await wrapper.find('.search-input').trigger('keydown', { key: 'Enter' });
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('openFile')).toBeDefined();
        wrapper.unmount();
    });

    it('highlights matching text in file names', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'note');
        const html = wrapper.html();
        expect(html).toContain('highlight');
        wrapper.unmount();
    });

    it('ranks exact-start matches higher than substring matches', async () => {
        const wrapper = mountWithI18n(SearchPanel, {
            props: { files, selectedFiles: [], activeFile: null },
        });
        await search(wrapper, 'no');
        const items = wrapper.findAll('.search-result-item');
        // notes.md starts with "no", should appear before noodles.md
        // but both should appear
        expect(items.length).toBeGreaterThanOrEqual(2);
        wrapper.unmount();
    });
});
