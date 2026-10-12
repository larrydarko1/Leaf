<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IconMic from '@/renderer/components/icons/IconMic.vue';
import IconSquare from '@/renderer/components/icons/IconSquare.vue';
import { useAudioRecorder } from '@/renderer/composables/useAudioRecorder';

type Props = {
    currentFolder: string | null;
};

const props = defineProps<Props>();
const emit = defineEmits<{ recordingSaved: [filePath: string] }>();

const { t } = useI18n();

const { isRecording, hasPermission, formattedDuration, toggle } = useAudioRecorder(
    () => props.currentFolder,
    (path) => emit('recordingSaved', path),
);
</script>

<template>
    <button
        class="icon-btn icon-btn-lg icon-btn-toggle"
        :class="{ recording: isRecording }"
        :aria-label="
            isRecording
                ? t('audio_recorder.stop_recording', { duration: formattedDuration })
                : t('audio_recorder.record_audio')
        "
        :aria-pressed="isRecording"
        :disabled="!hasPermission && !isRecording"
        @click="toggle">
        <IconMic
            v-if="!isRecording"
            width="16"
            height="16" />
        <IconSquare
            v-else
            width="16"
            height="16" />
    </button>
</template>

<style scoped lang="scss">
// The shape is the rail's; this is the one state only this button has. The danger tint stays on
// hover, so the button does not look like it is about to do something else.
.icon-btn {
    &.recording {
        color: $danger-color;
        background: $danger-color-alpha;
        animation: pulse 1.5s ease-in-out infinite;

        &:hover {
            background: $danger-color-alpha;
            color: $danger-color;
        }
    }
}
</style>
