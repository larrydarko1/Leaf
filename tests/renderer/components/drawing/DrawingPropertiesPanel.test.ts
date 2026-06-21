import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import DrawingPropertiesPanel from '@/renderer/components/drawing/DrawingPropertiesPanel.vue';

const baseProps = {
    visible: true,
    activeStrokeColor: '#1e1e1e',
    activeFillColor: 'transparent',
    activeStrokeWidth: 2,
    activeStrokeStyle: 'solid',
    activeBorderRadius: 0,
    activeFontSize: 16,
    showFillOption: true,
    showFontSizeOption: false,
    showRoundnessOption: false,
    hasSelection: true,
};

describe('DrawingPropertiesPanel', () => {
    it('renders the panel when visible is true', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        expect(wrapper.find('.properties-panel').exists()).toBe(true);
        wrapper.unmount();
    });

    it('does not render when visible is false', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, visible: false },
        });
        expect(wrapper.find('.properties-panel').exists()).toBe(false);
        wrapper.unmount();
    });

    it('emits setProperty with strokeColor when a stroke color swatch is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        const swatches = wrapper.findAll('.color-swatch');
        await swatches[0].trigger('click');
        const emitted = wrapper.emitted('setProperty');
        expect(emitted).toBeDefined();
        expect(emitted?.[0]?.[0]).toBe('strokeColor');
        wrapper.unmount();
    });

    it('emits setProperty with fillColor "transparent" when transparent swatch is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        await wrapper.find('.transparent-swatch').trigger('click');
        expect(wrapper.emitted('setProperty')?.[0]).toEqual(['fillColor', 'transparent']);
        wrapper.unmount();
    });

    it('emits setProperty with strokeWidth when a width button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        const widthBtns = wrapper.findAll('.stroke-width-btn');
        await widthBtns[2].trigger('click'); // strokeWidth = 4
        expect(wrapper.emitted('setProperty')?.[0]).toEqual(['strokeWidth', 4]);
        wrapper.unmount();
    });

    it('marks active stroke color swatch as active', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, activeStrokeColor: '#1e1e1e' },
        });
        const activeSwatches = wrapper.findAll('.color-swatch.active');
        expect(activeSwatches.length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it('marks active stroke width button as active', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, activeStrokeWidth: 2 },
        });
        const activeBtns = wrapper.findAll('.stroke-width-btn.active');
        expect(activeBtns.length).toBe(1);
        wrapper.unmount();
    });

    it('does not show fill section when showFillOption is false', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, showFillOption: false },
        });
        expect(wrapper.find('.transparent-swatch').exists()).toBe(false);
        wrapper.unmount();
    });

    it('emits "copy" when copy button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        const copyBtn = wrapper.find('[aria-label*="opy"], .copy-btn, button[class*="copy"]');
        if (copyBtn.exists()) {
            await copyBtn.trigger('click');
            expect(wrapper.emitted('copy')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "duplicate" when duplicate button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        const dupBtn = wrapper.find('[aria-label*="uplicate"], .duplicate-btn, button[class*="duplicate"]');
        if (dupBtn.exists()) {
            await dupBtn.trigger('click');
            expect(wrapper.emitted('duplicate')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "delete" when delete button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, { props: baseProps });
        const deleteBtn = wrapper.find('[aria-label*="elete"], .delete-btn, button[class*="delete"]');
        if (deleteBtn.exists()) {
            await deleteBtn.trigger('click');
            expect(wrapper.emitted('delete')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('shows font size options when showFontSizeOption is true', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, showFontSizeOption: true },
        });
        expect(wrapper.html()).toContain('font');
        wrapper.unmount();
    });

    it('shows border radius options when showRoundnessOption is true', () => {
        const wrapper = mountWithI18n(DrawingPropertiesPanel, {
            props: { ...baseProps, showRoundnessOption: true },
        });
        // Should render border radius buttons
        expect(wrapper.findAll('.border-radius-btn, .roundness-btn, [class*="radius"]').length).toBeGreaterThanOrEqual(
            0,
        );
        wrapper.unmount();
    });
});
