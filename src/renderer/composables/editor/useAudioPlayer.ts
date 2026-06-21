/**
 * useAudioPlayer — reactive audio playback state, seeking, and volume control.
 */

import { ref, computed } from 'vue';

export function useAudioPlayer() {
    const audioUrl = ref('');
    const audioRef = ref<HTMLAudioElement | null>(null);
    const audioError = ref(false);
    const isLoadingAudio = ref(false);
    const audioPlaying = ref(false);
    const audioDuration = ref(0);
    const audioCurrentTime = ref(0);
    const audioVolume = ref(1);
    let audioRafId: number | null = null;

    function onAudioError() {
        audioError.value = true;
    }

    function onAudioLoaded() {
        if (audioRef.value !== null) {
            audioDuration.value = audioRef.value.duration;
        }
    }

    function onAudioEnded() {
        audioPlaying.value = false;
        if (audioRafId !== null) {
            cancelAnimationFrame(audioRafId);
            audioRafId = null;
        }
    }

    function updateAudioProgress() {
        if (audioRef.value !== null) {
            audioCurrentTime.value = audioRef.value.currentTime;
        }
        if (audioPlaying.value) {
            audioRafId = requestAnimationFrame(updateAudioProgress);
        }
    }

    function toggleAudioPlayback() {
        if (audioRef.value === null) return;
        if (audioPlaying.value) {
            audioRef.value.pause();
            audioPlaying.value = false;
            if (audioRafId !== null) {
                cancelAnimationFrame(audioRafId);
                audioRafId = null;
            }
        } else {
            void audioRef.value.play();
            audioPlaying.value = true;
            updateAudioProgress();
        }
    }

    const audioProgressPercent = computed(() => {
        if (audioDuration.value === 0) return 0;
        return (audioCurrentTime.value / audioDuration.value) * 100;
    });

    function seekAudio(event: MouseEvent) {
        if (audioRef.value === null || !(audioDuration.value > 0)) return;
        const wrapper = event.currentTarget as HTMLElement;
        const rect = wrapper.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        audioRef.value.currentTime = percent * audioDuration.value;
        audioCurrentTime.value = audioRef.value.currentTime;
    }

    function onVolumeChange(event: Event) {
        const value = parseFloat((event.target as HTMLInputElement).value);
        audioVolume.value = value;
        if (audioRef.value !== null) {
            audioRef.value.volume = value;
        }
    }

    function toggleMute() {
        if (audioVolume.value > 0) {
            audioVolume.value = 0;
        } else {
            audioVolume.value = 1;
        }
        if (audioRef.value !== null) {
            audioRef.value.volume = audioVolume.value;
        }
    }

    async function loadAudio(filePath: string) {
        isLoadingAudio.value = true;
        audioError.value = false;
        audioUrl.value = '';

        try {
            const result = await window.electronAPI.readAudio(filePath);
            if (result.success && result.dataUrl !== undefined) {
                audioUrl.value = result.dataUrl;
            } else {
                window.electronAPI.log.error('Failed to load audio:', result.error);
                audioError.value = true;
            }
        } catch (error) {
            window.electronAPI.log.error('Error loading audio:', error);
            audioError.value = true;
        } finally {
            isLoadingAudio.value = false;
        }
    }

    function reset() {
        if (audioRafId !== null) {
            cancelAnimationFrame(audioRafId);
            audioRafId = null;
        }
        audioError.value = false;
        audioPlaying.value = false;
        audioCurrentTime.value = 0;
        audioDuration.value = 0;
        audioUrl.value = '';
    }

    return {
        audioUrl,
        audioRef,
        audioError,
        isLoadingAudio,
        audioPlaying,
        audioDuration,
        audioCurrentTime,
        audioVolume,
        audioProgressPercent,
        onAudioError,
        onAudioLoaded,
        onAudioEnded,
        toggleAudioPlayback,
        seekAudio,
        onVolumeChange,
        toggleMute,
        loadAudio,
        reset,
    };
}
