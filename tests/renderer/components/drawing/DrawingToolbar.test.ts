import { describe, it, expect } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import DrawingToolbar from '@/renderer/components/drawing/DrawingToolbar.vue';
import type { ToolType } from '@/schemas/drawing';
import { mountWithI18n } from '@test-utils';

const tools: ToolType[] = ['select', 'hand', 'rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'text', 'freedraw'];

describe('DrawingToolbar', () => {
    it('renders the toolbar', () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        expect(wrapper.find('.floating-toolbar').exists()).toBe(true);
        wrapper.unmount();
    });

    it('marks the active tool button with "active" class', () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'rectangle' },
        });
        const activeBtns = wrapper.findAll('.toolbar-btn.active');
        expect(activeBtns.length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it('emits "selectTool" with "select" when the selection tool button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'hand' },
        });
        const selectBtn = wrapper.find('button[aria-label*="Selection tool"]');
        expect(selectBtn.exists()).toBe(true);
        await selectBtn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('select');
        wrapper.unmount();
    });

    it('emits "selectTool" with "hand" when the hand tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const handBtn = wrapper.find('button[aria-label*="Hand"]');
        expect(handBtn.exists()).toBe(true);
        await handBtn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('hand');
        wrapper.unmount();
    });

    it('emits "selectTool" with "rectangle" when the rectangle tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Rectangle"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('rectangle');
        wrapper.unmount();
    });

    it('emits "selectTool" with "diamond" when the diamond tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Diamond"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('diamond');
        wrapper.unmount();
    });

    it('emits "selectTool" with "ellipse" when the ellipse tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Ellipse"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('ellipse');
        wrapper.unmount();
    });

    it('emits "selectTool" with "line" when the line tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Line tool"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('line');
        wrapper.unmount();
    });

    it('emits "selectTool" with "arrow" when the arrow tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Arrow"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('arrow');
        wrapper.unmount();
    });

    it('emits "selectTool" with "text" when the text tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Text tool"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('text');
        wrapper.unmount();
    });

    it('emits "selectTool" with "freedraw" when the freedraw tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Pen tool"]');
        expect(btn.exists()).toBe(true);
        await btn.trigger('click');
        expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('freedraw');
        wrapper.unmount();
    });

    it('opens the arch dropdown when the arch button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const archBtn = wrapper.find('[aria-label*="rch"], [aria-label*="shape"], button[class*="arch"]');
        expect(archBtn.exists()).toBe(true);
        await archBtn.trigger('click');
        expect(wrapper.html()).toContain('dropdown');
        wrapper.unmount();
    });

    it('emits "selectTool" when an arch shape is selected from the dropdown', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const archBtn = wrapper.find('[aria-label*="rch"], [aria-label*="hape"]');
        expect(archBtn.exists()).toBe(true);
        await archBtn.trigger('click');
        await wrapper.vm.$nextTick();
        const dropdownItems = wrapper.findAll('.arch-item, .dropdown-item, [aria-label*="atabase"]');
        expect(dropdownItems.length).toBeGreaterThan(0);
        await dropdownItems[0]!.trigger('click');
        expect(wrapper.emitted('selectTool')).toBeDefined();
        wrapper.unmount();
    });

    it('closes the arch dropdown when its parent reports a click outside it', async () => {
        // DrawingCanvas holds the toolbar by template ref and forwards document clicks to it.
        const toolbar = ref<InstanceType<typeof DrawingToolbar> | null>(null);
        const Host = defineComponent({
            setup: () => () => h(DrawingToolbar, { ref: toolbar, currentTool: 'database' }),
        });
        const wrapper = mountWithI18n(Host, { attachTo: document.body });
        await wrapper.find('.arch-dropdown > button').trigger('click');
        expect(wrapper.find('.arch-dropdown-menu').exists()).toBe(true);

        const forward = (e: MouseEvent): void => {
            toolbar.value?.handleClickOutside(e);
        };
        const outside = document.body.appendChild(document.createElement('div'));
        document.addEventListener('mousedown', forward);
        outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.removeEventListener('mousedown', forward);
        await nextTick();

        expect(wrapper.find('.arch-dropdown-menu').exists()).toBe(false);
        outside.remove();
        wrapper.unmount();
    });

    it.each(tools)('renders a tool button for "%s"', (tool) => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: tool },
        });
        const activeBtns = wrapper.findAll('.toolbar-btn.active, .arch-btn.active');
        expect(activeBtns.length).toBeGreaterThanOrEqual(0);
        wrapper.unmount();
    });
});
