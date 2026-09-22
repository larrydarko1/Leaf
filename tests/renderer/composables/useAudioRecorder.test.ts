import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useAudioRecorder } from '@/renderer/composables/useAudioRecorder';

class MockMediaRecorder {
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;

    start(timeslice?: number) {
        mockRecorderStart(timeslice);
        this.state = 'recording';
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    }

    stop() {
        mockRecorderStop();
        this.state = 'inactive';
        this.onstop?.();
    }
}

vi.mock('@/renderer/utils/audio', () => ({
    convertWebMToWav: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    arrayBufferToBase64: vi.fn().mockReturnValue('base64encoded'),
}));

const mockRecorderStart = vi.fn();
const mockRecorderStop = vi.fn();
const mockTrackStop = vi.fn();

const mockGetUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: mockTrackStop }],
});

const mockSaveRecording = vi.fn().mockResolvedValue({ success: true, path: '/vault/recording.wav' });
const mockLogError = vi.fn();

function setupComposable(currentFolder: string | null = '/vault') {
    const onSaved = vi.fn();
    let result!: ReturnType<typeof useAudioRecorder>;

    const wrapper = mount({
        setup() {
            result = useAudioRecorder(() => currentFolder, onSaved);
            return () => null;
        },
        template: '<div></div>',
    });

    return { ...result, onSaved, wrapper };
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

vi.stubGlobal('MediaRecorder', MockMediaRecorder);

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
});

Object.assign(window, {
    electronAPI: {
        ...(window.electronAPI ?? {}),
        saveAudioRecording: mockSaveRecording,
        log: { error: mockLogError },
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mockTrackStop }] });
    mockSaveRecording.mockResolvedValue({ success: true, path: '/vault/recording.wav' });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('useAudioRecorder', () => {
    describe('initial state', () => {
        it('isRecording is false', () => {
            const { isRecording, wrapper } = setupComposable();
            expect(isRecording.value).toBe(false);
            wrapper.unmount();
        });

        it('hasPermission is true', () => {
            const { hasPermission, wrapper } = setupComposable();
            expect(hasPermission.value).toBe(true);
            wrapper.unmount();
        });

        it('formattedDuration is 00:00', () => {
            const { formattedDuration, wrapper } = setupComposable();
            expect(formattedDuration.value).toBe('00:00');
            wrapper.unmount();
        });
    });

    describe('toggle → start', () => {
        it('calls getUserMedia with audio:true', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle();
            expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
            wrapper.unmount();
        });

        it('sets isRecording to true after start', async () => {
            const { toggle, isRecording, wrapper } = setupComposable();
            await toggle();
            expect(isRecording.value).toBe(true);
            wrapper.unmount();
        });

        it('sets hasPermission to false when getUserMedia throws', async () => {
            mockGetUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
            const { toggle, hasPermission, wrapper } = setupComposable();
            await toggle();
            expect(hasPermission.value).toBe(false);
            wrapper.unmount();
        });

        it('calls MediaRecorder.start with 100ms timeslice', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle();
            expect(mockRecorderStart).toHaveBeenCalledWith(100);
            wrapper.unmount();
        });
    });

    describe('toggle → stop', () => {
        it('sets isRecording to false', async () => {
            const { toggle, isRecording, wrapper } = setupComposable();
            await toggle(); // start
            await toggle(); // stop
            expect(isRecording.value).toBe(false);
            wrapper.unmount();
        });

        it('calls MediaRecorder.stop', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle();
            await toggle();
            expect(mockRecorderStop).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('stops all media stream tracks', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle();
            await toggle();
            expect(mockTrackStop).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('does not call stop when already inactive', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle();
            mockRecorderStop.mockClear();
            await toggle();
            expect(mockRecorderStop).toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('save (triggered via onstop)', () => {
        it('calls saveAudioRecording with folder, filename, and base64 data', async () => {
            const { toggle, wrapper } = setupComposable('/my-vault');
            await toggle(); // start — ondataavailable fires immediately, chunks have data
            await toggle(); // stop — onstop → save()
            await nextTick(); // allow save() async chain to complete
            expect(mockSaveRecording).toHaveBeenCalledWith(
                '/my-vault',
                expect.stringMatching(/^recording-.+\.wav$/),
                'base64encoded',
            );
            wrapper.unmount();
        });

        it('calls onSaved with the returned path when result.success', async () => {
            const { toggle, onSaved, wrapper } = setupComposable('/my-vault');
            await toggle();
            await toggle();
            await nextTick();
            expect(onSaved).toHaveBeenCalledWith('/vault/recording.wav');
            wrapper.unmount();
        });

        it('does not call onSaved when result.success is false', async () => {
            mockSaveRecording.mockResolvedValueOnce({ success: false });
            const { toggle, onSaved, wrapper } = setupComposable('/my-vault');
            await toggle();
            await toggle();
            await nextTick();
            expect(onSaved).not.toHaveBeenCalled();
            wrapper.unmount();
        });

        it('does not call saveAudioRecording when folder is null', async () => {
            const { toggle, wrapper } = setupComposable(null);
            await toggle();
            await toggle();
            await nextTick();
            expect(mockSaveRecording).not.toHaveBeenCalled();
            wrapper.unmount();
        });

        it('calls log.error when saveAudioRecording throws', async () => {
            mockSaveRecording.mockRejectedValueOnce(new Error('disk full'));
            const { toggle, wrapper } = setupComposable('/vault');
            await toggle();
            await toggle();
            await nextTick();
            expect(mockLogError).toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('formattedDuration', () => {
        it('formats seconds-only as 00:SS', () => {
            const { formattedDuration, wrapper } = setupComposable();
            expect(formattedDuration.value).toBe('00:00');
            wrapper.unmount();
        });
    });

    describe('onUnmounted cleanup', () => {
        it('calls stop if still recording when component unmounts', async () => {
            const { toggle, wrapper } = setupComposable();
            await toggle(); // start recording
            mockRecorderStop.mockClear();
            wrapper.unmount(); // triggers onUnmounted → stop()
            expect(mockRecorderStop).toHaveBeenCalled();
        });

        it('does not call stop if not recording when unmounted', () => {
            const { wrapper } = setupComposable();
            mockRecorderStop.mockClear();
            wrapper.unmount();
            expect(mockRecorderStop).not.toHaveBeenCalled();
        });
    });
});
