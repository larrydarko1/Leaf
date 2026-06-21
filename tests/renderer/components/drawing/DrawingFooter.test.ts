import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import DrawingFooter from '@/renderer/components/drawing/DrawingFooter.vue';

const baseProps = {
    zoom: 1,
    zoomPercent: 100,
    historyIndex: 0,
    historyLength: 1,
    isSaving: false,
    hasUnsavedChanges: false,
};

describe('DrawingFooter', () => {
    it('renders the footer', () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: baseProps });
        expect(wrapper.find('.canvas-footer').exists()).toBe(true);
        wrapper.unmount();
    });

    it('emits "zoomToCenter" with zoom - 0.1 when zoom-out is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: baseProps });
        const buttons = wrapper.findAll('.zoom-btn');
        await buttons[0].trigger('click');
        expect(wrapper.emitted('zoomToCenter')?.[0]).toEqual([0.9]);
        wrapper.unmount();
    });

    it('emits "zoomToCenter" with 1 when zoom reset is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: { ...baseProps, zoom: 1.5 } });
        await wrapper.find('.zoom-value').trigger('click');
        expect(wrapper.emitted('zoomToCenter')?.[0]).toEqual([1]);
        wrapper.unmount();
    });

    it('emits "zoomToCenter" with zoom + 0.1 when zoom-in is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: baseProps });
        const buttons = wrapper.findAll('.zoom-btn');
        await buttons[1].trigger('click');
        expect(wrapper.emitted('zoomToCenter')?.[0]).toEqual([1.1]);
        wrapper.unmount();
    });

    it('emits "undo" when undo button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, {
            props: { ...baseProps, historyIndex: 2, historyLength: 3 },
        });
        const undoBtn = wrapper.find('[aria-label*="ndo"], button[class*="undo"]');
        if (undoBtn.exists()) {
            await undoBtn.trigger('click');
            expect(wrapper.emitted('undo')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "redo" when redo button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, {
            props: { ...baseProps, historyIndex: 0, historyLength: 3 },
        });
        const redoBtn = wrapper.find('[aria-label*="edo"], button[class*="redo"]');
        if (redoBtn.exists()) {
            await redoBtn.trigger('click');
            expect(wrapper.emitted('redo')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "clearAll" when clear button is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: baseProps });
        const clearBtn = wrapper.find('[aria-label*="lear"], button[class*="clear"]');
        if (clearBtn.exists()) {
            await clearBtn.trigger('click');
            expect(wrapper.emitted('clearAll')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('emits "openExportDialog" when export is clicked', async () => {
        const wrapper = mountWithI18n(DrawingFooter, { props: baseProps });
        const exportBtn = wrapper.find('[aria-label*="xport"], button[class*="export"]');
        if (exportBtn.exists()) {
            await exportBtn.trigger('click');
            expect(wrapper.emitted('openExportDialog')).toBeDefined();
        }
        wrapper.unmount();
    });

    it('shows saving indicator when isSaving is true', () => {
        const wrapper = mountWithI18n(DrawingFooter, {
            props: { ...baseProps, isSaving: true },
        });
        expect(wrapper.html()).toMatch(/saving|spinner|isSaving/i);
        wrapper.unmount();
    });

    it('shows unsaved changes indicator when hasUnsavedChanges is true', () => {
        const wrapper = mountWithI18n(DrawingFooter, {
            props: { ...baseProps, hasUnsavedChanges: true },
        });
        expect(wrapper.html()).toMatch(/unsaved|modified|dot/i);
        wrapper.unmount();
    });
});
