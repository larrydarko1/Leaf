<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useAudioPlayer } from '@/renderer/composables/editor/useAudioPlayer';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    filePath: string;
};

const props = defineProps<Props>();

const {
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
} = useAudioPlayer();

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

function formatTime(seconds: number): string {
    if (seconds === 0 || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function onKeydown(e: KeyboardEvent) {
    if (e.key !== ' ') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggleAudioPlayback();
}
</script>

<template>
    <div
        class="audio-viewer"
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
                class="audio-loading"
                role="status"
                aria-live="polite">
                <p>{{ t('editor.loading_audio') }}</p>
            </div>

            <!-- Hidden native audio element -->
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
                class="custom-audio-player"
                role="group"
                :aria-label="t('editor.audio_playback_controls')">
                <!-- Play/pause button -->
                <button
                    class="audio-play-btn"
                    :aria-label="audioPlaying ? t('editor.pause_audio') : t('editor.play_audio')"
                    :title="audioPlaying ? t('editor.pause') : t('editor.play')"
                    @click="toggleAudioPlayback">
                    <svg
                        v-if="!audioPlaying"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <svg
                        v-else
                        width="20"
                        height="20"
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
                    class="audio-time"
                    :aria-label="t('editor.current_playback_time')"
                    >{{ formatTime(audioCurrentTime) }}</time
                >

                <!-- Progress bar and seek control -->
                <div
                    class="audio-progress-wrapper"
                    role="slider"
                    :aria-valuenow="Math.round(audioProgressPercent)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-label="t('editor.audio_progress', { progress: Math.round(audioProgressPercent) })"
                    :aria-valuetext="`${formatTime(audioCurrentTime)} of ${formatTime(audioDuration)}`"
                    tabindex="0"
                    @click="seekAudio">
                    <div class="audio-progress-track">
                        <div
                            class="audio-progress-fill"
                            :style="{ width: audioProgressPercent + '%' }"></div>
                    </div>
                </div>

                <!-- Total duration display -->
                <time
                    class="audio-time"
                    :aria-label="t('editor.total_duration')"
                    >{{ formatTime(audioDuration) }}</time
                >

                <!-- Volume controls -->
                <div
                    class="audio-volume-wrapper"
                    role="group"
                    :aria-label="t('editor.volume_controls')">
                    <button
                        class="audio-volume-btn"
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
                        class="audio-volume-slider"
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
                class="audio-error"
                role="alert">
                <p>{{ t('editor.audio_load_error') }}</p>
                <p class="audio-error-hint">{{ t('editor.audio_format_not_supported') }}</p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
/* ––– Root Container ––– */

.audio-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $space-8;
    overflow: auto;
    background: $base1;
    position: relative;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: url('../../assets/images/pattern.png');
        background-size: cover;
        background-position: center;
        opacity: 0.01;
        pointer-events: none;
    }
}

/* ––– Audio Container Layout ––– */

.audio-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-8;
    max-width: 500px;
    width: 100%;
    position: relative;
    z-index: $z-normal;
}

.audio-icon {
    color: $text2;
    opacity: 0.6;
}

/* ––– Loading State ––– */

.audio-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: $z-normal;

    p {
        margin: $space-2 0;
        font-size: $font-size-base;
    }
}

/* ––– Audio Player Controls ––– */

.custom-audio-player {
    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    padding: $space-3 $space-4;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-xl;
    backdrop-filter: blur(8px);
}

.audio-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: $border-radius-round;
    border: none;
    background: $accent-color;
    color: $text1;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
}

.audio-time {
    font-size: $font-size-xs;
    color: $text2;
    font-variant-numeric: tabular-nums;
    min-width: 40px;
    text-align: center;
    user-select: none;
}

/* ––– Progress Bar ––– */

.audio-progress-wrapper {
    flex: 1;
    cursor: pointer;
    padding: $space-2 0;
    display: flex;
    align-items: center;
    outline: none;
    border-radius: $border-radius-xs;
    transition: background-color $transition-fast;

    &:focus-visible {
        background-color: $bg-hover;
    }
}

.audio-progress-track {
    width: 100%;
    height: 4px;
    background: $bg-hover;
    border-radius: $border-radius-xs;
    overflow: hidden;
    position: relative;
}

.audio-progress-fill {
    height: 100%;
    background: $accent-color;
    border-radius: $border-radius-xs;
    transition: width 0.05s linear;
}

/* ––– Volume Controls ––– */

.audio-volume-wrapper {
    display: flex;
    align-items: center;
    gap: $space-2;
}

.audio-volume-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-1;
    border-radius: $border-radius-sm;
    transition: color $transition-fast;

    &:hover {
        color: $text1;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }
}

.audio-volume-slider {
    appearance: none;
    width: 60px;
    height: 4px;
    background: $bg-hover;
    border-radius: $border-radius-sm;
    outline: none;
    cursor: pointer;
    position: relative;
    transition: outline $transition-fast;

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        background: $accent-color;
        /* stylelint-disable-next-line no-unknown-custom-properties */
        width: calc(var(--volume) * 100%);
        max-width: 60px;
        height: 4px;
        border-radius: $border-radius-sm;
        pointer-events: none;
    }

    &::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: $border-radius-round;
        background: $accent-color;
        cursor: pointer;
        transition: transform $transition-fast;
    }

    &::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }
}

/* ––– Error State ––– */

.audio-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text2;
    position: relative;
    z-index: $z-normal;

    p {
        margin: $space-2 0;
        font-size: $font-size-base;
    }

    .audio-error-hint {
        font-size: $font-size-sm;
        opacity: 0.7;
    }
}
</style>
