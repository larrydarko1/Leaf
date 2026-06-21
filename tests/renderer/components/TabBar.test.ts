import { describe, it, expect, vi } from 'vitest';
import { mountWithI18n } from '@test-utils';
import TabBar from '@/renderer/components/TabBar.vue';
import type { TabState } from '@/schemas/vault';

function makeTab(name: string, path: string, hasUnsavedChanges = false): TabState {
    return {
        file: {
            name,
            path,
            relativePath: path,
            extension: name.split('.').pop() ?? '',
            size: 0,
            modified: new Date().toISOString(),
            folder: '.',
        },
        content: null,
        savedContent: null,
        hasUnsavedChanges,
        scrollTop: 0,
    };
}

const defaultTabs: TabState[] = [
    makeTab('notes.md', '/vault/notes.md'),
    makeTab('ideas.md', '/vault/ideas.md', true),
    makeTab('draft.txt', '/vault/draft.txt'),
];

describe('TabBar', () => {
    it('renders nothing when tabs array is empty', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: [], activeIndex: 0 },
        });
        expect(wrapper.find('.tab-bar').exists()).toBe(false);
        wrapper.unmount();
    });

    it('renders a tab for each entry', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        expect(wrapper.findAll('.tab')).toHaveLength(3);
        wrapper.unmount();
    });

    it('applies the "active" class to the active tab', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 1 },
        });
        const tabs = wrapper.findAll('.tab');
        expect(tabs[1].classes()).toContain('active');
        expect(tabs[0].classes()).not.toContain('active');
        wrapper.unmount();
    });

    it('shows the unsaved indicator for tabs with unsaved changes', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        const tabs = wrapper.findAll('.tab');
        expect(tabs[1].find('.tab-dot').exists()).toBe(true);
        expect(tabs[0].find('.tab-dot').exists()).toBe(false);
        wrapper.unmount();
    });

    it('displays filename without extension', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: [makeTab('README.md', '/vault/README.md')], activeIndex: 0 },
        });
        expect(wrapper.find('.tab-name').text()).toBe('README');
        wrapper.unmount();
    });

    it('displays filename as-is when there is no extension', () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: [makeTab('Makefile', '/vault/Makefile')], activeIndex: 0 },
        });
        expect(wrapper.find('.tab-name').text()).toBe('Makefile');
        wrapper.unmount();
    });

    it('emits "switch" with the tab index on tab click', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab')[2].trigger('click');
        expect(wrapper.emitted('switch')?.[0]).toEqual([2]);
        wrapper.unmount();
    });

    it('emits "close" with the tab index when close button is clicked', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab-close')[0].trigger('click');
        expect(wrapper.emitted('close')?.[0]).toEqual([0]);
        wrapper.unmount();
    });

    it('does not emit "switch" when the close button is clicked (stopPropagation)', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab-close')[0].trigger('click');
        expect(wrapper.emitted('switch')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits "close" on middle-click (button 1)', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab')[1].trigger('mousedown', { button: 1 });
        expect(wrapper.emitted('close')?.[0]).toEqual([1]);
        wrapper.unmount();
    });

    it('does not emit "close" on left-click mousedown (button 0)', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab')[0].trigger('mousedown', { button: 0 });
        expect(wrapper.emitted('close')).toBeUndefined();
        wrapper.unmount();
    });

    it('emits "switch" on Enter keydown', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        await wrapper.findAll('.tab')[1].trigger('keydown', { key: 'Enter' });
        expect(wrapper.emitted('switch')?.[0]).toEqual([1]);
        wrapper.unmount();
    });

    it('emits "reorder" when drag-start and drop on different tabs', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        const tabs = wrapper.findAll('.tab');
        const dt = { effectAllowed: '', dropEffect: '', setDragImage: vi.fn() };
        await tabs[0].trigger('dragstart', { dataTransfer: dt });
        await tabs[2].trigger('drop', { dataTransfer: dt });
        expect(wrapper.emitted('reorder')?.[0]).toEqual([0, 2]);
        wrapper.unmount();
    });

    it('does not emit "reorder" when drag-start equals drop index', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        const tabs = wrapper.findAll('.tab');
        const dt = { effectAllowed: '', dropEffect: '', setDragImage: vi.fn() };
        await tabs[1].trigger('dragstart', { dataTransfer: dt });
        await tabs[1].trigger('drop', { dataTransfer: dt });
        expect(wrapper.emitted('reorder')).toBeUndefined();
        wrapper.unmount();
    });

    it('resets drag state on dragend', async () => {
        const wrapper = mountWithI18n(TabBar, {
            props: { tabs: defaultTabs, activeIndex: 0 },
        });
        const tabs = wrapper.findAll('.tab');
        const dt = { effectAllowed: '', dropEffect: '', setDragImage: vi.fn() };
        await tabs[0].trigger('dragstart', { dataTransfer: dt });
        // Trigger dragend without dropping
        await tabs[0].trigger('dragend');
        // After dragend, no "dragging" class should remain
        expect(tabs[0].classes()).not.toContain('dragging');
        wrapper.unmount();
    });
});
