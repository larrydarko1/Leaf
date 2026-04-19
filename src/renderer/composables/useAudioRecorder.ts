/**
 * useAudioRecorder — reactive recording state and lifecycle.
 * Owns: MediaRecorder setup, stream cleanup, duration timer, saving to vault.
 * Does NOT own: audio encoding (utils/audio.ts), UI rendering (AudioRecorder.vue).
 */

import { ref, computed, onUnmounted } from 'vue';
import { convertWebMToWav, arrayBufferToBase64 } from '../utils/audio';

export function useAudioRecorder(getCurrentFolder: () => string | null, onSaved: (filePath: string) => void) {
    const isRecording = ref(false);
    const hasPermission = ref(true);
    const duration = ref(0);

    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let stream: MediaStream | null = null;
    let durationInterval: number | null = null;

    const formattedDuration = computed(() => {
        const m = Math.floor(duration.value / 60)
            .toString()
            .padStart(2, '0');
        const s = (duration.value % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    });

    async function start() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            hasPermission.value = true;

            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.onstop = () => save();

            mediaRecorder.start(100);
            isRecording.value = true;
            duration.value = 0;
            durationInterval = window.setInterval(() => duration.value++, 1000);
        } catch {
            hasPermission.value = false;
        }
    }

    function stop() {
        if (mediaRecorder?.state !== 'inactive') mediaRecorder?.stop();

        stream?.getTracks().forEach((t) => t.stop());
        stream = null;

        if (durationInterval) {
            clearInterval(durationInterval);
            durationInterval = null;
        }
        isRecording.value = false;
    }

    async function toggle() {
        if (isRecording.value) {
            stop();
        } else {
            await start();
        }
    }

    async function save() {
        const folder = getCurrentFolder();
        if (!folder || audioChunks.length === 0) return;

        try {
            const webmBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const wavBuffer = await convertWebMToWav(webmBlob);
            const base64 = arrayBufferToBase64(wavBuffer);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `recording-${timestamp}.wav`;

            const result = await window.electronAPI.saveAudioRecording(folder, fileName, base64);
            if (result.success && result.path) onSaved(result.path);
        } catch (error) {
            console.error('[useAudioRecorder] Failed to save recording:', error);
        }
    }

    // Release the microphone if the component unmounts mid-recording
    onUnmounted(() => {
        if (isRecording.value) stop();
    });

    return { isRecording, hasPermission, formattedDuration, toggle };
}
