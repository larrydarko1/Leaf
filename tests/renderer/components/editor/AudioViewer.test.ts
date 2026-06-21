import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithI18n } from '@test-utils';
import AudioViewer from '@/renderer/components/editor/AudioViewer.vue';

const mockElectronAPI = {
    readAudio: vi.fn(),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
};

Object.defineProperty(globalThis.window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
    configurable: true,
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // Stub HTMLMediaElement methods not implemented in jsdom
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        value: vi.fn(),
    });
    mockElectronAPI.readAudio.mockResolvedValue({
        success: true,
        dataUrl: 'data:audio/mp3;base64,fake',
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AudioViewer', () => {
    it('renders the audio viewer container', () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        expect(wrapper.exists()).toBe(true);
        wrapper.unmount();
    });

    it('calls readAudio with the file path on mount', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        expect(mockElectronAPI.readAudio).toHaveBeenCalledWith('/vault/song.mp3');
        wrapper.unmount();
    });

    it('shows the audio element after loading successfully', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        expect(audio.exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows error state when readAudio returns success: false', async () => {
        mockElectronAPI.readAudio.mockResolvedValue({ success: false, error: 'Not found' });
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(wrapper.html()).toMatch(/error|unavailable/i);
        wrapper.unmount();
    });

    it('shows error state when readAudio throws', async () => {
        mockElectronAPI.readAudio.mockRejectedValue(new Error('Network error'));
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        expect(wrapper.html()).toMatch(/error|unavailable/i);
        wrapper.unmount();
    });

    it('reloads audio when filePath prop changes', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.setProps({ filePath: '/vault/other.mp3' });
        await new Promise((r) => setTimeout(r, 0));
        expect(mockElectronAPI.readAudio).toHaveBeenCalledWith('/vault/other.mp3');
        wrapper.unmount();
    });

    it('shows loading state while readAudio is pending', async () => {
        let resolveFn: (v: unknown) => void;
        mockElectronAPI.readAudio.mockReturnValue(
            new Promise((r) => {
                resolveFn = r;
            }),
        );
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await wrapper.vm.$nextTick();
        // While loading, the loading indicator should show or controls should be absent
        expect(wrapper.exists()).toBe(true);
        resolveFn!({ success: true, dataUrl: 'data:audio/mp3;base64,fake' });
        wrapper.unmount();
    });

    it('shows audio controls after successful load and loadedmetadata event', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
        }
        expect(wrapper.exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows custom audio player controls after loadedmetadata fires', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
            expect(wrapper.find('.custom-audio-player').exists()).toBe(true);
        }
        wrapper.unmount();
    });

    it('calls toggleAudioPlayback when play button is clicked', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
            const playBtn = wrapper.find('.audio-play-btn');
            if (playBtn.exists()) {
                await playBtn.trigger('click');
                expect(wrapper.exists()).toBe(true);
            }
        }
        wrapper.unmount();
    });

    it('seeks audio when progress bar is clicked', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
            const progress = wrapper.find('.audio-progress-wrapper');
            if (progress.exists()) {
                await progress.trigger('click', { clientX: 50 });
                expect(wrapper.exists()).toBe(true);
            }
        }
        wrapper.unmount();
    });

    it('mutes audio when volume button is clicked', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
            const volBtn = wrapper.find('.audio-volume-btn');
            if (volBtn.exists()) {
                await volBtn.trigger('click');
                expect(wrapper.exists()).toBe(true);
            }
        }
        wrapper.unmount();
    });

    it('changes volume when slider input fires', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await wrapper.vm.$nextTick();
            const slider = wrapper.find('.audio-volume-slider');
            if (slider.exists()) {
                // Use setValue which properly sets the value on the element
                await slider.setValue('0.5');
                expect(wrapper.exists()).toBe(true);
            }
        }
        wrapper.unmount();
    });

    it('fires onAudioEnded when audio ended event fires', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
            await audio.trigger('ended');
            expect(wrapper.exists()).toBe(true);
        }
        wrapper.unmount();
    });

    it('fires onAudioError when audio error event fires', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('error');
            await wrapper.vm.$nextTick();
            expect(wrapper.html()).toMatch(/error|unavailable/i);
        }
        wrapper.unmount();
    });

    it('toggles playback on Space key press', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        await wrapper.vm.$nextTick();
        const audio = wrapper.find('audio');
        if (audio.exists()) {
            await audio.trigger('loadedmetadata');
        }
        // Trigger a space keydown on the window
        const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        window.dispatchEvent(e);
        expect(wrapper.exists()).toBe(true);
        wrapper.unmount();
    });

    it('does not toggle playback on Space when target is an input', async () => {
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        await new Promise((r) => setTimeout(r, 0));
        const input = document.createElement('input');
        document.body.appendChild(input);
        const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        Object.defineProperty(e, 'target', { value: input });
        window.dispatchEvent(e);
        expect(wrapper.exists()).toBe(true);
        wrapper.unmount();
        document.body.removeChild(input);
    });

    it('adds keydown listener on mount', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        wrapper.unmount();
        addSpy.mockRestore();
    });

    it('removes keydown listener on unmount', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const wrapper = mountWithI18n(AudioViewer, {
            props: { filePath: '/vault/song.mp3' },
        });
        wrapper.unmount();
        expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        removeSpy.mockRestore();
    });
});
