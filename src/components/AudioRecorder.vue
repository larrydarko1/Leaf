<template>
  <button 
    @click="toggleRecording"
    class="btn-menu-icon"
    :class="{ 'recording': isRecording }"
    :title="isRecording ? `Stop recording (${formattedDuration})` : 'Record audio'"
    :disabled="!hasPermission && !isRecording"
  >
    <svg v-if="!isRecording" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Microphone icon -->
      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="currentColor"/>
      <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z" fill="currentColor"/>
    </svg>
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Stop icon (square) -->
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

const props = defineProps<{
  currentFolder: string | null;
}>();

const emit = defineEmits<{
  recordingSaved: [filePath: string];
}>();

const isRecording = ref(false);
const hasPermission = ref(true); // Assume permission until denied
const recordingDuration = ref(0);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let stream: MediaStream | null = null;
let durationInterval: number | null = null;

const formattedDuration = computed(() => {
  const minutes = Math.floor(recordingDuration.value / 60);
  const seconds = recordingDuration.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

async function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Request microphone access
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    hasPermission.value = true;
    
    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      await saveRecording();
    };
    
    // Start recording
    mediaRecorder.start(100); // Collect data every 100ms
    isRecording.value = true;
    recordingDuration.value = 0;
    
    // Start duration counter
    durationInterval = window.setInterval(() => {
      recordingDuration.value++;
    }, 1000);
    
  } catch (error) {
    console.error('Error starting recording:', error);
    hasPermission.value = false;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  // Stop all tracks
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Clear duration interval
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
  
  isRecording.value = false;
}

async function saveRecording() {
  if (!props.currentFolder) {
    console.error('No folder selected');
    return;
  }
  
  if (audioChunks.length === 0) {
    console.error('No audio recorded');
    return;
  }
  
  try {
    // Combine all chunks into a single blob (WebM format)
    const webmBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // Convert WebM to WAV using AudioContext
    const wavBuffer = await convertWebMToWav(webmBlob);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `recording-${timestamp}.wav`;
    
    // Convert ArrayBuffer to base64 for sending to main process
    const base64Data = arrayBufferToBase64(wavBuffer);
    
    // Save the file using Electron API
    const result = await window.electronAPI.saveAudioRecording(props.currentFolder, fileName, base64Data);
    
    if (result.success && result.path) {
      emit('recordingSaved', result.path);
    } else {
      console.error('Failed to save recording:', result.error);
    }
  } catch (error) {
    console.error('Error saving recording:', error);
  }
}

async function convertWebMToWav(webmBlob: Blob): Promise<ArrayBuffer> {
  // Create an audio context
  const audioContext = new AudioContext();
  
  // Convert blob to array buffer
  const arrayBuffer = await webmBlob.arrayBuffer();
  
  // Decode the audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Convert to WAV format
  const wavBuffer = audioBufferToWav(audioBuffer);
  
  // Close the audio context
  audioContext.close();
  
  return wavBuffer;
}

function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  // Interleave channels if stereo
  let samples: Float32Array;
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    samples = new Float32Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      samples[i * 2] = left[i];
      samples[i * 2 + 1] = right[i];
    }
  } else {
    samples = audioBuffer.getChannelData(0);
  }
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp the sample to [-1, 1] and convert to 16-bit signed integer
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset + i * 2, intSample, true);
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Cleanup on component unmount
onUnmounted(() => {
  if (isRecording.value) {
    stopRecording();
  }
});
</script>

<style scoped lang="scss">
.btn-menu-icon {
  &.recording {
    color: var(--danger-color);
    background: var(--danger-color-alpha);
    animation: pulse 1.5s ease-in-out infinite;
    
    &:hover {
      background: var(--danger-color-alpha);
      color: var(--danger-color);
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
