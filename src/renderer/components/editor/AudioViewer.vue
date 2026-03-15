<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useAudioPlayer } from '../../composables/editor/useAudioPlayer';

const props = defineProps<{
    filePath: string;
}>();

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

function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

watch(
    () => props.filePath,
    async (path) => {
        reset();
        await loadAudio(path);
    },
    { immediate: true },
);

function onKeydown(e: KeyboardEvent) {
    if (e.key !== ' ') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggleAudioPlayback();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div class="audio-viewer">
        <div class="audio-container">
            <div class="audio-icon">
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
            </div>
            <div v-if="isLoadingAudio" class="audio-loading">
                <p>Loading audio...</p>
            </div>
            <!-- Hidden native audio element -->
            <audio
                v-if="audioUrl && !audioError"
                ref="audioRef"
                :key="audioUrl"
                :src="audioUrl"
                style="display: none;"
                @error="onAudioError"
                @loadedmetadata="onAudioLoaded"
                @ended="onAudioEnded"
            ></audio>
            <!-- Custom audio player UI -->
            <div v-if="audioUrl && !audioError && !isLoadingAudio" class="custom-audio-player">
                <button class="audio-play-btn" :title="audioPlaying ? 'Pause' : 'Play'" @click="toggleAudioPlayback">
                    <svg v-if="!audioPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                </button>
                <span class="audio-time">{{ formatTime(audioCurrentTime) }}</span>
                <div class="audio-progress-wrapper" @click="seekAudio">
                    <div class="audio-progress-track">
                        <div class="audio-progress-fill" :style="{ width: audioProgressPercent + '%' }"></div>
                    </div>
                </div>
                <span class="audio-time">{{ formatTime(audioDuration) }}</span>
                <div class="audio-volume-wrapper">
                    <button class="audio-volume-btn" :title="audioVolume === 0 ? 'Unmute' : 'Mute'" @click="toggleMute">
                        <svg v-if="audioVolume === 0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                        <svg v-else-if="audioVolume < 0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                    <input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" :value="audioVolume" @input="onVolumeChange" />
                </div>
            </div>
            <div v-if="audioError" class="audio-error">
                <p>Failed to load audio</p>
                <p class="audio-error-hint">This format may not be supported</p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.audio-viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: auto;
    -webkit-app-region: no-drag;
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

.audio-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    max-width: 500px;
    width: 100%;
    position: relative;
    z-index: 1;
}

.audio-icon {
    color: var(--text2);
    opacity: 0.6;
}

.audio-loading {
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
}

.custom-audio-player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--text3);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.audio-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    border: none;
    background: var(--accent-color);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
}

.audio-time {
    font-size: 0.75rem;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
    min-width: 2.5em;
    text-align: center;
    user-select: none;
}

.audio-progress-wrapper {
    flex: 1;
    cursor: pointer;
    padding: 0.5rem 0;
    display: flex;
    align-items: center;
}

.audio-progress-track {
    width: 100%;
    height: 4px;
    background: var(--bg-hover);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
}

.audio-progress-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: 2px;
    transition: width 0.05s linear;
}

.audio-volume-wrapper {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.audio-volume-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 4px;
    transition: color 0.15s;

    &:hover {
        color: var(--text1);
    }
}

.audio-volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 60px;
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

.audio-error {
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

    .audio-error-hint {
        font-size: 0.85rem;
        opacity: 0.7;
    }
}
</style>
