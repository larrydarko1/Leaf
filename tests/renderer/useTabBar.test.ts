import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TabBar from '../../src/renderer/components/TabBar.vue';
import type { TabState } from '../../composables/editor/useEditorTabs';

function makeTab(name: string, path = `/${name}`): TabState {
    return {
        file: {
            name,
            path,
            relativePath: name,
            extension: '.md',
            size: 0,
            modified: '',
            folder: '.',
        },
        content: null,
        savedContent: null,
        hasUnsavedChanges: false,
        scrollTop: 0,
    };
}

describe('TabBar.vue', () => {
    it('does not render when tabs array is empty', () => {
        const wrapper = mount(TabBar, {
            props: {
                tabs: [],
                activeIndex: -1,
            },
        });
        expect(wrapper.find('.tab-bar').exists()).toBe(false);
    });

    it('renders tab bar when tabs exist', () => {
        const wrapper = mount(TabBar, {
            props: {
                tabs: [makeTab('a.md')],
                activeIndex: 0,
            },
        });
        expect(wrapper.find('.tab-bar').exists()).toBe(true);
    });

    it('renders correct number of tabs', () => {
        const tabs = [makeTab('a.md'), makeTab('b.md'), makeTab('c.md')];
        const wrapper = mount(TabBar, {
            props: { tabs, activeIndex: 0 },
        });
        expect(wrapper.findAll('.tab')).toHaveLength(3);
    });
});
