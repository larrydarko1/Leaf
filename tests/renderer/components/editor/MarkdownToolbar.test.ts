import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import MarkdownToolbar from '@/renderer/components/editor/MarkdownToolbar.vue';

function mount() {
    return mountWithI18n(MarkdownToolbar, {});
}

describe('MarkdownToolbar', () => {
    it('renders a toolbar with role="toolbar"', () => {
        const w = mount();
        expect(w.find('[role="toolbar"]').exists()).toBe(true);
        w.unmount();
    });

    it('has an accessible aria-label on the toolbar', () => {
        const w = mount();
        const toolbar = w.find('[role="toolbar"]');
        expect(toolbar.attributes('aria-label')).toBeTruthy();
        w.unmount();
    });

    it('emits format "bold" on bold button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="old"], [aria-label*="Bold"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['bold']]);
        w.unmount();
    });

    it('emits format "italic" on italic button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="talic"], [aria-label*="Italic"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['italic']]);
        w.unmount();
    });

    it('emits format "strikethrough" on strikethrough button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="trikethrough"], [aria-label*="Strikethrough"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['strikethrough']]);
        w.unmount();
    });

    it('emits format "highlight" on highlight button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="ighlight"], [aria-label*="Highlight"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['highlight']]);
        w.unmount();
    });

    it('emits format "code" on inline code button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="nline"], [aria-label*="code"], [aria-label*="Code"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['code']]);
        w.unmount();
    });

    it('emits format "ul" on bullet list button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="ullet"], [aria-label*="Bullet"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['ul']]);
        w.unmount();
    });

    it('emits format "ol" on numbered list button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="umbered"], [aria-label*="Numbered"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['ol']]);
        w.unmount();
    });

    it('emits format "checkbox" on checkbox button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="heckbox"], [aria-label*="Checkbox"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['checkbox']]);
        w.unmount();
    });

    it('emits format "quote" on blockquote button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="lockquote"], [aria-label*="Blockquote"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['quote']]);
        w.unmount();
    });

    it('emits format "link" on link button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="ink"], [aria-label*="Link"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['link']]);
        w.unmount();
    });

    it('emits format "table" on table button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="able"], [aria-label*="Table"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['table']]);
        w.unmount();
    });

    it('emits format "hr" on horizontal rule button mousedown', async () => {
        const w = mount();
        await w.find('[aria-label*="orizontal"], [aria-label*="Horizontal"]').trigger('mousedown');
        expect(w.emitted('format')).toEqual([['hr']]);
        w.unmount();
    });

    it('emits heading event when heading select changes', async () => {
        const w = mount();
        const select = w.find('select[aria-label*="eading"], select[aria-label*="Heading"]');
        if (select.exists()) {
            await select.trigger('change');
            expect(w.emitted('heading')).toBeDefined();
        }
        w.unmount();
    });

    it('renders formatting buttons', () => {
        const w = mount();
        const buttons = w.findAll('button.md-toolbar-btn');
        expect(buttons.length).toBeGreaterThan(5);
        w.unmount();
    });
});
