<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useVideoPlayer } from '../../composables/editor/useVideoPlayer';

const props = defineProps<{
    filePath: string;
}>();

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

function onKeydown(e: KeyboardEvent) {
    if (e.key !== ' ' || !videoRef.value) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggleVideoPlayback();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div class="video-viewer">
        <div v-if="videoUrl && !videoError" class="video-player-wrapper">
            <video
                ref="videoRef"
                :key="videoUrl"
                :src="videoUrl"
                class="video-preview"
                @error="onVideoError"
                @loadedmetadata="onVideoLoaded"
                @ended="onVideoEnded"
                @click="toggleVideoPlayback"
            ></video>
            <div class="video-controls">
                <button class="video-ctrl-btn" :title="videoPlaying ? 'Pause' : 'Play'" @click="toggleVideoPlayback">
                    <svg v-if="!videoPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
                <span class="video-time">{{ formatTime(videoCurrentTime) }}</span>
                <div class="video-progress-wrapper" @click="seekVideo">
                    <div class="video-progress-track">
                        <div class="video-progress-fill" :style="{ width: videoProgressPercent + '%' }"></div>
                    </div>
                </div>
                <span class="video-time">{{ formatTime(videoDuration) }}</span>
                <div class="video-volume-wrapper">
                    <button
                        class="video-ctrl-btn"
                        :title="videoVolume === 0 ? 'Unmute' : 'Mute'"
                        @click="toggleVideoMute"
                    >
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
                        >
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
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
                        >
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
                        >
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                    <input
                        type="range"
                        class="video-volume-slider"
                        min="0"
                        max="1"
                        step="0.01"
                        :value="videoVolume"
                        @input="onVideoVolumeChange"
                    />
                </div>
            </div>
        </div>
        <div v-if="videoError" class="video-error">
            <p>Failed to load video</p>
            <p class="video-error-hint">This format may not be supported</p>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.video-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: auto;
    background: var(--base1);
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

.video-player-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
    gap: 0;
}

.video-preview {
    max-width: 100%;
    max-height: calc(100% - 52px);
    border-radius: 10px 10px 0 0;
    display: block;
    background: #000;
    cursor: pointer;

    &::-webkit-media-controls {
        display: none !important;
    }
}

.video-controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.5rem 0.85rem;
    background: var(--bg-primary);
    border: 1px solid var(--text3);
    border-top: none;
    border-radius: 0 0 10px 10px;
}

.video-ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    min-width: 30px;
    border-radius: 50%;
    border: none;
    background: var(--accent-color);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;

    &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
}

.video-time {
    font-size: 0.7rem;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
    min-width: 2.5em;
    text-align: center;
    user-select: none;
}

.video-progress-wrapper {
    flex: 1;
    cursor: pointer;
    padding: 0.4rem 0;
    display: flex;
    align-items: center;
}

.video-progress-track {
    width: 100%;
    height: 4px;
    background: var(--bg-hover);
    border-radius: 2px;
    overflow: hidden;
}

.video-progress-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: 2px;
    transition: width 0.05s linear;
}

.video-volume-wrapper {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.video-volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 55px;
    height: 4px;
    background: var(--bg-hover);
    border-radius: 2px;
    outline: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--accent-color);
        cursor: pointer;
        transition: transform 0.1s;
    }

    &::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }
}

.video-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    position: relative;
    z-index: 1;

    p {
        margin: 0.5rem 0;
        font-size: 1rem;
    }

    .video-error-hint {
        font-size: 0.85rem;
        opacity: 0.7;
    }
}
</style>
