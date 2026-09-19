<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useVideoPlayer } from '@/renderer/composables/editor/useVideoPlayer';
import { useI18n } from 'vue-i18n';

type Props = {
    filePath: string;
};

const props = defineProps<Props>();

const { t } = useI18n();

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

function onKeydown(e: KeyboardEvent): void {
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
</script>

<template>
    <div class="video-viewer media-stage">
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
                class="video-controls media-controls"
                role="group"
                :aria-label="t('editor.video_player_controls')">
                <!-- Play/pause button -->
                <button
                    class="video-ctrl-btn media-ctrl-btn"
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
                    class="video-time media-time"
                    aria-live="polite"
                    aria-atomic="true"
                    >{{ formatTime(videoCurrentTime) }}</time
                >

                <!-- Progress bar -->
                <div
                    class="video-progress-wrapper media-progress"
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
                    <div class="video-progress-track media-progress-track">
                        <div
                            class="video-progress-fill media-progress-fill"
                            :style="{ width: videoProgressPercent + '%' }"></div>
                    </div>
                </div>

                <!-- Total duration display -->
                <time
                    class="video-time media-time"
                    :aria-label="t('editor.total_duration')"
                    >{{ formatTime(videoDuration) }}</time
                >

                <!-- Volume control -->
                <fieldset class="video-volume-wrapper media-volume">
                    <button
                        class="video-ctrl-btn media-ctrl-btn"
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
                        class="video-volume-slider media-volume-slider"
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
            class="video-error media-message"
            role="alert">
            <h2 class="media-message-title">{{ t('editor.video_load_error') }}</h2>
            <p>{{ t('editor.failed_to_load_video') }}</p>
            <p class="video-error-hint hint">{{ t('editor.video_format_not_supported') }}</p>
        </section>
    </div>
</template>

<style lang="scss" scoped>
// The stage is `.media-stage`, the error block is `.media-message`, the transport
// bar is `.media-controls`. What is left is that here the bar is joined to the video
// above it rather than standing on its own.

// The two of them are one object: a column the width of the video, with nothing
// between the picture and the controls.
.video-player-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: $z-normal;
}

// It leaves room for the bar rather than filling the pane, and rounds only the two
// corners the bar is not against.
.video-preview {
    max-width: 100%;
    max-height: calc(100% - $size-16);
    border-radius: $border-radius-xl $border-radius-xl 0 0;
    display: block;
    background: $base1;
    cursor: pointer;
}

// Joined to the video above it, so the top edge is open and only the bottom
// corners round.
.video-controls {
    padding: $space-2 $space-4;
    border-top: none;
    border-radius: 0 0 $border-radius-xl $border-radius-xl;
}

// `<fieldset>` groups the volume controls for assistive tech, and arrives with a
// border, a margin and a min-width that have nothing to do with how it looks here.
// This was `fieldset, time, section { all: unset }`, which took `.media-volume` off
// the group it was applied to — a scoped element selector outranks a global class —
// so the video's volume row was laid out inline while the audio player's was flex.
// Only what the browser actually supplies is reset now; `time` and `section` were in
// that list with nothing to undo.
fieldset {
    margin: 0;
    padding: 0;
    border: none;
    min-width: 0;
}
</style>
