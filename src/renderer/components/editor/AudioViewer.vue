<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useAudioPlayer } from '@/renderer/composables/editor/useAudioPlayer';
import { useI18n } from 'vue-i18n';

type Props = {
    filePath: string;
};

const props = defineProps<Props>();

const { t } = useI18n();

const {
    audioUrl,
    // @ts-expect-error noUnusedLocals false-positive: bound via ref="audioRef" in template
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
} = useAudioPlayer();

function formatTime(seconds: number): string {
    if (seconds === 0 || !isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const wholeSeconds = Math.floor(seconds % 60);
    return `${minutes}:${wholeSeconds.toString().padStart(2, '0')}`;
}

function onKeydown(e: KeyboardEvent): void {
    if (e.key !== ' ') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggleAudioPlayback();
}

watch(
    () => props.filePath,
    async (path) => {
        reset();
        await loadAudio(path);
    },
    { immediate: true },
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div
        class="audio-viewer media-stage"
        role="region"
        :aria-label="t('editor.audio_player')">
        <div class="audio-container">
            <!-- Audio icon display -->
            <div
                class="audio-icon"
                aria-hidden="true">
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle
                        cx="6"
                        cy="18"
                        r="3"></circle>
                    <circle
                        cx="18"
                        cy="16"
                        r="3"></circle>
                </svg>
            </div>

            <!-- Loading state -->
            <div
                v-if="isLoadingAudio"
                class="audio-loading media-message"
                role="status"
                aria-live="polite">
                <p>{{ t('editor.loading_audio') }}</p>
            </div>

            <!-- eslint-disable-next-line a11y/media-has-caption -->
            <audio
                v-if="audioUrl && !audioError"
                ref="audioRef"
                :key="audioUrl"
                :src="audioUrl"
                style="display: none"
                @error="onAudioError"
                @loadedmetadata="onAudioLoaded"
                @ended="onAudioEnded"></audio>

            <!-- Custom audio player controls -->
            <div
                v-if="audioUrl && !audioError && !isLoadingAudio"
                class="custom-audio-player media-controls"
                role="group"
                :aria-label="t('editor.audio_playback_controls')">
                <!-- Play/pause button -->
                <button
                    class="audio-play-btn media-ctrl-btn"
                    :aria-label="audioPlaying ? t('editor.pause_audio') : t('editor.play_audio')"
                    :title="audioPlaying ? t('editor.pause') : t('editor.play')"
                    @click="toggleAudioPlayback">
                    <svg
                        v-if="!audioPlaying"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <svg
                        v-else
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true">
                        <rect
                            x="6"
                            y="4"
                            width="4"
                            height="16"
                            rx="1" />
                        <rect
                            x="14"
                            y="4"
                            width="4"
                            height="16"
                            rx="1" />
                    </svg>
                </button>

                <!-- Current time display -->
                <time
                    class="audio-time media-time"
                    :aria-label="t('editor.current_playback_time')"
                    >{{ formatTime(audioCurrentTime) }}</time
                >

                <!-- Progress bar and seek control -->
                <!-- eslint-disable-next-line a11y/click-events-have-key-events -->
                <div
                    class="audio-progress-wrapper media-progress"
                    role="slider"
                    :aria-valuenow="Math.round(audioProgressPercent)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-label="t('editor.audio_progress', { progress: Math.round(audioProgressPercent) })"
                    :aria-valuetext="`${formatTime(audioCurrentTime)} of ${formatTime(audioDuration)}`"
                    tabindex="0"
                    @click="seekAudio">
                    <div class="audio-progress-track media-progress-track">
                        <div
                            class="audio-progress-fill media-progress-fill"
                            :style="{ width: audioProgressPercent + '%' }"></div>
                    </div>
                </div>

                <!-- Total duration display -->
                <time
                    class="audio-time media-time"
                    :aria-label="t('editor.total_duration')"
                    >{{ formatTime(audioDuration) }}</time
                >

                <!-- Volume controls -->
                <div
                    class="audio-volume-wrapper media-volume"
                    role="group"
                    :aria-label="t('editor.volume_controls')">
                    <button
                        class="audio-volume-btn media-volume-btn"
                        :aria-label="audioVolume === 0 ? t('editor.unmute_audio') : t('editor.mute_audio')"
                        :title="audioVolume === 0 ? t('editor.unmute') : t('editor.mute')"
                        @click="toggleMute">
                        <svg
                            v-if="audioVolume === 0"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line
                                x1="23"
                                y1="9"
                                x2="17"
                                y2="15"></line>
                            <line
                                x1="17"
                                y1="9"
                                x2="23"
                                y2="15"></line>
                        </svg>
                        <svg
                            v-else-if="audioVolume < 0.5"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                        <svg
                            v-else
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                    <input
                        type="range"
                        class="audio-volume-slider media-volume-slider"
                        min="0"
                        max="1"
                        step="0.01"
                        :value="audioVolume"
                        :style="{ '--volume': audioVolume }"
                        :aria-label="t('editor.volume_controls')"
                        @input="onVolumeChange" />
                </div>
            </div>

            <!-- Error state -->
            <div
                v-if="audioError"
                class="audio-error media-message"
                role="alert">
                <h2 class="media-message-title">{{ t('editor.audio_load_error') }}</h2>
                <p class="audio-error-hint hint">{{ t('editor.audio_format_not_supported') }}</p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
// The stage is `.media-stage`, the loading and error blocks are `.media-message`,
// the transport bar is `.media-controls`. What is left is the card in the middle of
// the pane, which only this viewer has — there is no file to look at, so the player
// is the content.
.audio-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-7;
    max-width: $size-29;
    width: 100%;
    position: relative;
    z-index: $z-normal;
}

// The large glyph standing in for the waveform, dimmed so it reads as decoration.
.audio-icon {
    color: $text2;
    opacity: $opacity-mid;
}
</style>
