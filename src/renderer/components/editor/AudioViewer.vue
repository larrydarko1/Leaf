<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

import IconMusic from '@/renderer/components/icons/IconMusic.vue';
import IconPause from '@/renderer/components/icons/IconPause.vue';
import IconPlay from '@/renderer/components/icons/IconPlay.vue';
import IconVolumeHigh from '@/renderer/components/icons/IconVolumeHigh.vue';
import IconVolumeLow from '@/renderer/components/icons/IconVolumeLow.vue';
import IconVolumeMute from '@/renderer/components/icons/IconVolumeMute.vue';
import { useAudioPlayer } from '@/renderer/composables/editor/useAudioPlayer';

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
    const target = e.target;
    if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
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
                <IconMusic
                    width="80"
                    height="80"
                    stroke-width="1.5" />
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
                class="audio-element"
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
                    <IconPlay
                        v-if="!audioPlaying"
                        width="16"
                        height="16" />
                    <IconPause
                        v-else
                        width="16"
                        height="16" />
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
                        <IconVolumeMute
                            v-if="audioVolume === 0"
                            width="16"
                            height="16" />
                        <IconVolumeLow
                            v-else-if="audioVolume < 0.5"
                            width="16"
                            height="16" />
                        <IconVolumeHigh
                            v-else
                            width="16"
                            height="16" />
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
// The stage, messages and transport bar are all `media-*` classes. What is left is the card in the
// middle of the pane, which only this viewer has: there is no file to look at, so the player is the
// content.
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

// The real <audio> element is the playback engine only — every control the user sees is the
// custom transport bar below it, so the element itself is never rendered.
.audio-element {
    display: none;
}

// The large glyph standing in for the waveform, dimmed so it reads as decoration.
.audio-icon {
    color: $text2;
    opacity: $opacity-mid;
}
</style>
