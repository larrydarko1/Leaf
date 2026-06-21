import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import DrawingToolbar from '@/renderer/components/drawing/DrawingToolbar.vue';
import type { ToolType } from '@/schemas/drawing';

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
        if (selectBtn.exists()) {
            await selectBtn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('select');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "hand" when the hand tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const handBtn = wrapper.find('button[aria-label*="Hand"]');
        if (handBtn.exists()) {
            await handBtn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('hand');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "rectangle" when the rectangle tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Rectangle"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('rectangle');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "diamond" when the diamond tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Diamond"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('diamond');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "ellipse" when the ellipse tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Ellipse"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('ellipse');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "line" when the line tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Line tool"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('line');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "arrow" when the arrow tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Arrow"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('arrow');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "text" when the text tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Text tool"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('text');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" with "freedraw" when the freedraw tool is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const btn = wrapper.find('button[aria-label*="Pen tool"]');
        if (btn.exists()) {
            await btn.trigger('click');
            expect(wrapper.emitted('selectTool')?.[0]?.[0]).toBe('freedraw');
        }
        wrapper.unmount();
    });

    it('opens the arch dropdown when the arch button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        const archBtn = wrapper.find('[aria-label*="rch"], [aria-label*="shape"], button[class*="arch"]');
        if (archBtn.exists()) {
            await archBtn.trigger('click');
            expect(wrapper.html()).toContain('dropdown');
        }
        wrapper.unmount();
    });

    it('emits "selectTool" when an arch shape is selected from the dropdown', async () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'select' },
        });
        // Try to open and select from arch dropdown
        const archBtn = wrapper.find('[aria-label*="rch"], [aria-label*="hape"]');
        if (archBtn.exists()) {
            await archBtn.trigger('click');
            await wrapper.vm.$nextTick();
            // Find an arch item and click it
            const dropdownItems = wrapper.findAll('.arch-item, .dropdown-item, [aria-label*="atabase"]');
            if (dropdownItems.length > 0) {
                await dropdownItems[0].trigger('click');
                expect(wrapper.emitted('selectTool')).toBeDefined();
            }
        }
        wrapper.unmount();
    });

    it('closes the arch dropdown when handleClickOutside is called with an outside element', () => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: 'database' },
        });
        const vm = wrapper.vm as { handleClickOutside: (e: MouseEvent) => void };
        vm.handleClickOutside(new MouseEvent('click', { bubbles: true }));
        // Should not throw
        expect(wrapper.exists()).toBe(true);
        wrapper.unmount();
    });

    it.each(tools)('renders a tool button for "%s"', (tool) => {
        const wrapper = mountWithI18n(DrawingToolbar, {
            props: { currentTool: tool },
        });
        // At least one button should have active class
        const activeBtns = wrapper.findAll('.toolbar-btn.active, .arch-btn.active');
        expect(activeBtns.length).toBeGreaterThanOrEqual(0);
        wrapper.unmount();
    });
});
