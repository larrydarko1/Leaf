<script setup lang="ts">
import { useAudioRecorder } from '../composables/useAudioRecorder';

const props = defineProps<{ currentFolder: string | null }>();
const emit = defineEmits<{ recordingSaved: [filePath: string] }>();

const { isRecording, hasPermission, formattedDuration, toggle } = useAudioRecorder(
    () => props.currentFolder,
    (path) => emit('recordingSaved', path),
);
</script>

<template>
    <button
        class="btn-menu-icon"
        :class="{ recording: isRecording }"
        :title="isRecording ? `Stop recording (${formattedDuration})` : 'Record audio'"
        :disabled="!hasPermission && !isRecording"
        @click="toggle"
    >
        <svg
            v-if="!isRecording"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <!-- Microphone icon -->
            <path
                d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
                fill="currentColor"
            />
            <path
                d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z"
                fill="currentColor"
            />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Stop icon (square) -->
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
    </button>
</template>

<style scoped lang="scss">
.btn-menu-icon {
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

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.6;
    }
}
</style>
