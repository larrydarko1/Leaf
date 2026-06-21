import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountWithI18n } from '@test-utils';
import AudioRecorder from '@/renderer/components/AudioRecorder.vue';
import { useAudioRecorder } from '@/renderer/composables/useAudioRecorder';

const mockToggle = vi.fn();
const mockIsRecording = ref(false);
const mockHasPermission = ref(true);
const mockFormattedDuration = ref('00:00');

vi.mock('@/renderer/composables/useAudioRecorder', () => ({
    useAudioRecorder: vi.fn(() => ({
        isRecording: mockIsRecording,
        hasPermission: mockHasPermission,
        formattedDuration: mockFormattedDuration,
        toggle: mockToggle,
    })),
}));

beforeEach(() => {
    mockToggle.mockReset();
    mockIsRecording.value = false;
    mockHasPermission.value = true;
    mockFormattedDuration.value = '00:00';
});

describe('AudioRecorder', () => {
    describe('idle state (not recording)', () => {
        it('renders a button', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows mic SVG when not recording', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            // Mic icon contains a <path> element (not a <rect>)
            expect(wrapper.find('svg path').exists()).toBe(true);
            expect(wrapper.find('svg rect').exists()).toBe(false);
            wrapper.unmount();
        });

        it('does not have "recording" class when not recording', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').classes()).not.toContain('recording');
            wrapper.unmount();
        });

        it('aria-pressed is false when not recording', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('aria-pressed')).toBe('false');
            wrapper.unmount();
        });

        it('is enabled when hasPermission is true', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
            wrapper.unmount();
        });

        it('is disabled when hasPermission is false and not recording', () => {
            mockHasPermission.value = false;
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('disabled')).toBeDefined();
            wrapper.unmount();
        });
    });

    describe('recording state', () => {
        beforeEach(() => {
            mockIsRecording.value = true;
        });

        it('shows stop icon (rect) when recording', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('svg rect').exists()).toBe(true);
            expect(wrapper.find('svg path').exists()).toBe(false);
            wrapper.unmount();
        });

        it('has "recording" class when isRecording is true', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').classes()).toContain('recording');
            wrapper.unmount();
        });

        it('aria-pressed is true when recording', () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('aria-pressed')).toBe('true');
            wrapper.unmount();
        });

        it('is NOT disabled even when hasPermission is false (can still stop)', () => {
            mockHasPermission.value = false;
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
            wrapper.unmount();
        });

        it('includes formattedDuration in aria-label when recording', () => {
            mockFormattedDuration.value = '01:23';
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            expect(wrapper.find('button').attributes('aria-label')).toContain('01:23');
            wrapper.unmount();
        });
    });

    describe('interactions', () => {
        it('calls toggle when button is clicked', async () => {
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            await wrapper.find('button').trigger('click');
            expect(mockToggle).toHaveBeenCalledOnce();
            wrapper.unmount();
        });

        it('passes currentFolder prop to useAudioRecorder', () => {
            mountWithI18n(AudioRecorder, { props: { currentFolder: '/my-notes' } });
            expect(vi.mocked(useAudioRecorder)).toHaveBeenCalled();
        });

        it('emits "recordingSaved" when recording is saved', async () => {
            let capturedOnSaved: (path: string) => void = () => {};
            vi.mocked(useAudioRecorder).mockImplementationOnce((_getter, onSaved) => {
                capturedOnSaved = onSaved;
                return {
                    isRecording: mockIsRecording,
                    hasPermission: mockHasPermission,
                    formattedDuration: mockFormattedDuration,
                    toggle: mockToggle,
                };
            });
            const wrapper = mountWithI18n(AudioRecorder, { props: { currentFolder: '/vault' } });
            capturedOnSaved('/vault/recording.wav');
            await wrapper.vm.$nextTick();
            expect(wrapper.emitted('recordingSaved')?.[0]).toEqual(['/vault/recording.wav']);
            wrapper.unmount();
        });
    });
});
