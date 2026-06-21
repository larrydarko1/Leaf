import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountWithI18n } from '@test-utils';
import ImageViewer from '@/renderer/components/editor/ImageViewer.vue';

const mockReadImage = vi.fn();

Object.defineProperty(globalThis.window, 'electronAPI', {
    value: { readImage: mockReadImage },
    writable: true,
    configurable: true,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ImageViewer', () => {
    it('shows loading state while the image is being fetched', async () => {
        // Never resolve so we stay in loading state
        mockReadImage.mockReturnValue(new Promise(() => {}));
        const wrapper = mountWithI18n(ImageViewer, {
            props: { filePath: '/vault/photo.png', fileName: 'photo.png' },
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('renders the image when readImage succeeds', async () => {
        mockReadImage.mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,abc' });
        const wrapper = mountWithI18n(ImageViewer, {
            props: { filePath: '/vault/photo.png', fileName: 'photo.png' },
        });
        // Wait for the async loadImage to finish
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const img = wrapper.find('img.image-preview');
        expect(img.exists()).toBe(true);
        expect(img.attributes('src')).toBe('data:image/png;base64,abc');
        expect(img.attributes('alt')).toBe('photo.png');
        wrapper.unmount();
    });

    it('shows error state when readImage returns success: false', async () => {
        mockReadImage.mockResolvedValue({ success: false });
        const wrapper = mountWithI18n(ImageViewer, {
            props: { filePath: '/vault/missing.png', fileName: 'missing.png' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.image-error').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows error state when readImage throws', async () => {
        mockReadImage.mockRejectedValue(new Error('network error'));
        const wrapper = mountWithI18n(ImageViewer, {
            props: { filePath: '/vault/bad.png', fileName: 'bad.png' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.image-error').exists()).toBe(true);
        wrapper.unmount();
    });

    it('reloads when filePath prop changes', async () => {
        mockReadImage.mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,abc' });
        const wrapper = mountWithI18n(ImageViewer, {
            props: { filePath: '/vault/a.png', fileName: 'a.png' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(mockReadImage).toHaveBeenCalledWith('/vault/a.png');

        await wrapper.setProps({ filePath: '/vault/b.png', fileName: 'b.png' });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(mockReadImage).toHaveBeenCalledWith('/vault/b.png');
        wrapper.unmount();
    });
});
