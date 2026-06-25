<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useVideoPlayer } from '@/renderer/composables/editor/useVideoPlayer';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    filePath: string;
};

const props = defineProps<Props>();

const {
    videoUrl,
    videoRef,
    videoError,
    videoPlaying,
    videoDuration,
    videoCurrentTime,
    videoVolume,
    videoProgressPercent,
    formatTime,
    onVideoError,
    onVideoLoaded,
    onVideoEnded,
    toggleVideoPlayback,
    seekVideo,
    onVideoVolumeChange,
    toggleVideoMute,
    reset,
} = useVideoPlayer();

watch(
    () => props.filePath,
    (path) => {
        reset();
        videoUrl.value = `leaf://localhost${path}`;
    },
    { immediate: true },
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function onKeydown(e: KeyboardEvent) {
    if (e.key !== ' ' || videoRef.value === null) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggleVideoPlayback();
}

function seekVideoBySeconds(seconds: number): void {
    if (videoRef.value === null) return;
    videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime + seconds);
}
</script>

<template>
    <div class="video-viewer">
        <!-- Video player area -->
        <div
            v-if="videoUrl && !videoError"
            class="video-player-wrapper">
            <!-- eslint-disable-next-line a11y/media-has-caption a11y/click-events-have-key-events a11y/no-static-element-interactions -->
            <video
                ref="videoRef"
                :key="videoUrl"
                :src="videoUrl"
                class="video-preview"
                :aria-label="t('editor.video_player')"
                @error="onVideoError"
                @loadedmetadata="onVideoLoaded"
                @ended="onVideoEnded"
                @click="toggleVideoPlayback"></video>

            <!-- Control bar -->
            <div
                class="video-controls"
                role="group"
                :aria-label="t('editor.video_player_controls')">
                <!-- Play/pause button -->
                <button
                    class="video-ctrl-btn"
                    type="button"
                    :aria-label="videoPlaying ? t('editor.pause_video') : t('editor.play_video')"
                    :title="videoPlaying ? t('editor.pause') : t('editor.play')"
                    @click="toggleVideoPlayback">
                    <svg
                        v-if="!videoPlaying"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <svg
                        v-else
                        width="18"
                        height="18"
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
                    class="video-time"
                    aria-live="polite"
                    aria-atomic="true"
                    >{{ formatTime(videoCurrentTime) }}</time
                >

                <!-- Progress bar -->
                <div
                    class="video-progress-wrapper"
                    role="slider"
                    :aria-label="t('editor.video_progress', { progress: videoProgressPercent })"
                    :aria-valuenow="videoProgressPercent"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-valuetext="`${formatTime(videoCurrentTime)} of ${formatTime(videoDuration)}`"
                    tabindex="0"
                    @click="seekVideo"
                    @keydown.left="seekVideoBySeconds(-5)"
                    @keydown.right="seekVideoBySeconds(5)">
                    <div class="video-progress-track">
                        <div
                            class="video-progress-fill"
                            :style="{ width: videoProgressPercent + '%' }"></div>
                    </div>
                </div>

                <!-- Total duration display -->
                <time
                    class="video-time"
                    :aria-label="t('editor.total_duration')"
                    >{{ formatTime(videoDuration) }}</time
                >

                <!-- Volume control -->
                <fieldset class="video-volume-wrapper">
                    <button
                        class="video-ctrl-btn"
                        type="button"
                        :aria-label="videoVolume === 0 ? t('editor.unmute_video') : t('editor.mute_video')"
                        :title="videoVolume === 0 ? t('editor.unmute') : t('editor.mute')"
                        @click="toggleVideoMute">
                        <svg
                            v-if="videoVolume === 0"
                            width="15"
                            height="15"
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
                            v-else-if="videoVolume < 0.5"
                            width="15"
                            height="15"
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
                            width="15"
                            height="15"
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
                        id="volume-slider"
                        type="range"
                        class="video-volume-slider"
                        min="0"
                        max="1"
                        step="0.01"
                        :value="videoVolume"
                        :style="{ '--volume': videoVolume }"
                        aria-label="Volume level"
                        @input="onVideoVolumeChange" />
                </fieldset>
            </div>
        </div>

        <!-- Error state fallback -->
        <section
            v-if="videoError"
            class="video-error"
            role="alert">
            <h2>{{ t('editor.video_load_error') }}</h2>
            <p>{{ t('editor.failed_to_load_video') }}</p>
            <p class="video-error-hint">{{ t('editor.video_format_not_supported') }}</p>
        </section>
    </div>
</template>

<style lang="scss" scoped>
/* ––– Video Viewer Container ––– */

.video-viewer {
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

/* ––– Player Wrapper & Preview ––– */

.video-player-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: $z-normal;
    gap: 0;
}

.video-preview {
    max-width: 100%;
    max-height: calc(100% - 52px);
    border-radius: $border-radius-xl $border-radius-xl 0 0;
    display: block;
    background: $base1;
    cursor: pointer;
}

/* ––– Control Bar ––– */

.video-controls {
    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    padding: $space-2 $space-4;
    background: $bg-primary;
    border: 1px solid $text3;
    border-top: none;
    border-radius: 0 0 $border-radius-xl $border-radius-xl;
}

.video-ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    min-width: 30px;
    border-radius: $border-radius-round;
    border: none;
    background: $accent-color;
    color: $text1;
    cursor: pointer;
    transition: all $transition-fast;
    padding: 0;

    &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
}

/* ––– Progress & Time Display ––– */

.video-time {
    font-size: $font-size-xs;
    color: $text2;
    font-variant-numeric: tabular-nums;
    min-width: 40px;
    text-align: center;
    user-select: none;
}

.video-progress-wrapper {
    flex: 1;
    cursor: pointer;
    padding: $space-2 0;
    display: flex;
    align-items: center;
}

.video-progress-track {
    width: 100%;
    height: 4px;
    background: $bg-hover;
    border-radius: $border-radius-xs;
    overflow: hidden;
}

.video-progress-fill {
    height: 100%;
    background: $accent-color;
    border-radius: $border-radius-xs;
    transition: width 0.05s linear;
}

/* ––– Volume Control ––– */

.video-volume-wrapper {
    display: flex;
    align-items: center;
    gap: $space-1;
}

.video-volume-slider {
    appearance: none;
    width: 55px;
    height: 4px;
    background: $bg-hover;
    border-radius: $border-radius-xs;
    outline: none;
    cursor: pointer;
    position: relative;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        background: $accent-color;
        /* stylelint-disable-next-line no-unknown-custom-properties */
        width: calc(var(--volume) * 100%);
        max-width: 55px;
        height: 4px;
        border-radius: $border-radius-xs;
        pointer-events: none;
    }

    &::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: $border-radius-round;
        background: $accent-color;
        cursor: pointer;
        transition: transform 0.1s;
        position: relative;
        z-index: $z-normal;
    }

    &::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }
}

/* ––– Error State ––– */

.video-error {
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

    .video-error-hint {
        font-size: $font-size-sm;
        opacity: 0.7;
    }
}

/* ––– Reset Utility ––– */

fieldset,
time,
section {
    all: unset;
}
</style>
