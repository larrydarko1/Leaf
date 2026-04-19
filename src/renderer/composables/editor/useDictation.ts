/**
 * useDictation — streams microphone audio to the main-process Whisper service
 * and inserts transcribed text into the editor.
 */

import { ref } from 'vue';
import type { Ref } from 'vue';

function resampleTo16kHz(input: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return input;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const srcIdx = i * ratio;
        const floor = Math.floor(srcIdx);
        const frac = srcIdx - floor;
        if (floor + 1 < input.length) {
            output[i] = input[floor] * (1 - frac) + input[floor + 1] * frac;
        } else {
            output[i] = input[floor] || 0;
        }
    }
    return output;
}

export function useDictation(content: Ref<string>, onContentChange: () => void) {
    const isDictating = ref(false);
    const isDictationLoading = ref(false);

    let dictationStream: MediaStream | null = null;
    let dictationAudioContext: AudioContext | null = null;
    let dictationProcessor: ScriptProcessorNode | null = null;
    let dictationRawSamples: Float32Array[] = [];
    let dictationInterval: number | null = null;
    let whisperModelReady = false;

    async function toggleDictation() {
        if (isDictating.value) {
            stopDictation();
            return;
        }

        if (!whisperModelReady) {
            isDictationLoading.value = true;
            try {
                const status = await window.electronAPI.speechGetStatus();
                if (!status.isModelLoaded) {
                    const result = await window.electronAPI.speechInit();
                    if (!result.success) {
                        console.error('Failed to init Whisper:', result.error);
                        isDictationLoading.value = false;
                        return;
                    }
                }
                whisperModelReady = true;
            } catch (err) {
                console.error('Failed to init Whisper:', err);
                isDictationLoading.value = false;
                return;
            }
            isDictationLoading.value = false;
        }

        try {
            dictationStream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
            });
        } catch (err) {
            console.error('Microphone access denied:', err);
            return;
        }

        dictationAudioContext = new AudioContext();
        const source = dictationAudioContext.createMediaStreamSource(dictationStream);
        dictationProcessor = dictationAudioContext.createScriptProcessor(4096, 1, 1);
        dictationRawSamples = [];

        dictationProcessor.onaudioprocess = (e) => {
            const channelData = e.inputBuffer.getChannelData(0);
            dictationRawSamples.push(new Float32Array(channelData));
        };

        source.connect(dictationProcessor);
        dictationProcessor.connect(dictationAudioContext.destination);

        isDictating.value = true;

        dictationInterval = window.setInterval(async () => {
            if (dictationRawSamples.length === 0) return;

            const chunks = dictationRawSamples.slice();
            dictationRawSamples = [];

            const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
            const fullAudio = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                fullAudio.set(chunk, offset);
                offset += chunk.length;
            }

            const nativeSampleRate = dictationAudioContext?.sampleRate || 44100;
            const resampled = resampleTo16kHz(fullAudio, nativeSampleRate);

            try {
                const result = await window.electronAPI.speechTranscribe(Array.from(resampled));
                if (result.success && result.text && result.text.length > 0) {
                    const trimmedText = result.text.trim();
                    if (trimmedText) {
                        const needsSpace = content.value.length > 0 && !/\s$/.test(content.value);
                        content.value += (needsSpace ? ' ' : '') + trimmedText;
                        onContentChange();
                    }
                }
            } catch (err) {
                console.error('Transcription error:', err);
            }
        }, 5000);
    }

    function stopDictation() {
        isDictating.value = false;

        if (dictationInterval) {
            clearInterval(dictationInterval);
            dictationInterval = null;
        }

        if (dictationRawSamples.length > 0 && dictationAudioContext) {
            const chunks = dictationRawSamples.slice();
            dictationRawSamples = [];
            const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
            const fullAudio = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                fullAudio.set(chunk, offset);
                offset += chunk.length;
            }
            const nativeSampleRate = dictationAudioContext.sampleRate;
            const resampled = resampleTo16kHz(fullAudio, nativeSampleRate);

            window.electronAPI
                .speechTranscribe(Array.from(resampled))
                .then((result) => {
                    if (result.success && result.text && result.text.trim()) {
                        const needsSpace = content.value.length > 0 && !/\s$/.test(content.value);
                        content.value += (needsSpace ? ' ' : '') + result.text.trim();
                        onContentChange();
                    }
                })
                .catch(() => {});
        }

        if (dictationProcessor) {
            dictationProcessor.disconnect();
            dictationProcessor = null;
        }

        if (dictationAudioContext) {
            dictationAudioContext.close();
            dictationAudioContext = null;
        }

        if (dictationStream) {
            dictationStream.getTracks().forEach((track) => track.stop());
            dictationStream = null;
        }
    }

    return { isDictating, isDictationLoading, toggleDictation, stopDictation };
}
