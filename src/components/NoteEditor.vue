<template>
  <div class="note-editor">
    <div class="editor-header" v-if="file">
      <div class="file-info">
        <div class="file-title-container">
          <h2 class="file-title">{{ getFileNameWithoutExtension(file.name) }}</h2>
          <div class="badge-with-toggle">
            <span class="file-extension-badge">{{ file.extension }}</span>
            <button 
              v-if="isMarkdownFile"
              @click="showPreview = !showPreview"
              class="preview-toggle"
              :title="showPreview ? 'Edit' : 'Preview'"
            >
              <svg v-if="showPreview" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="editor-actions">
        <span v-if="isSaving" class="saving-indicator">Saving...</span>
        <span v-else-if="hasUnsavedChanges" class="unsaved-indicator">Unsaved</span>
      </div>
    </div>
    
    <!-- Image viewer for image files -->
    <div v-if="file && isImageFile" class="image-viewer">
      <div v-if="isLoadingImage" class="image-loading">
        <p>Loading image...</p>
      </div>
      <img 
        v-else-if="imageUrl && !imageError"
        :src="imageUrl" 
        :alt="file.name"
        class="image-preview"
        @load="onImageLoad"
        @error="onImageError"
      />
      <div v-if="imageError" class="image-error">
        <p>Failed to load image</p>
      </div>
    </div>
    
    <!-- Video player for video files -->
    <div v-else-if="file && isVideoFile" class="video-viewer">
      <div v-if="videoUrl && !videoError" class="video-player-wrapper">
        <video 
          ref="videoRef"
          :src="videoUrl"
          :key="videoUrl"
          class="video-preview"
          @error="onVideoError"
          @loadedmetadata="onVideoLoaded"
          @ended="onVideoEnded"
          @click="toggleVideoPlayback"
        ></video>
        <div class="video-controls">
          <button class="video-ctrl-btn" @click="toggleVideoPlayback" :title="videoPlaying ? 'Pause' : 'Play'">
            <svg v-if="!videoPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          </button>
          <span class="video-time">{{ formatTime(videoCurrentTime) }}</span>
          <div class="video-progress-wrapper" @click="seekVideo">
            <div class="video-progress-track">
              <div class="video-progress-fill" :style="{ width: videoProgressPercent + '%' }"></div>
            </div>
          </div>
          <span class="video-time">{{ formatTime(videoDuration) }}</span>
          <div class="video-volume-wrapper">
            <button class="video-ctrl-btn" @click="toggleVideoMute" :title="videoVolume === 0 ? 'Unmute' : 'Mute'">
              <svg v-if="videoVolume === 0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
              <svg v-else-if="videoVolume < 0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
            <input type="range" class="video-volume-slider" min="0" max="1" step="0.01" :value="videoVolume" @input="onVideoVolumeChange" />
          </div>
        </div>
      </div>
      <div v-if="videoError" class="video-error">
        <p>Failed to load video</p>
        <p class="video-error-hint">This format may not be supported</p>
      </div>
    </div>
    
    <!-- PDF viewer for PDF files -->
    <div v-else-if="file && isPdfFile" class="pdf-viewer">
      <iframe 
        v-if="pdfUrl && !pdfError"
        :src="pdfUrl"
        class="pdf-preview"
        @error="onPdfError"
      >
      </iframe>
      <div v-if="pdfError" class="pdf-error">
        <p>Failed to load PDF</p>
        <p class="pdf-error-hint">This file may be corrupted or in an unsupported format</p>
      </div>
    </div>
    
    <!-- Audio player for audio files -->
    <div v-else-if="file && isAudioFile" class="audio-viewer">
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
          :src="audioUrl"
          :key="audioUrl"
          style="display: none;"
          @error="onAudioError"
          @loadedmetadata="onAudioLoaded"
          @ended="onAudioEnded"
        ></audio>
        <!-- Custom audio player UI -->
        <div v-if="audioUrl && !audioError && !isLoadingAudio" class="custom-audio-player">
          <button class="audio-play-btn" @click="toggleAudioPlayback" :title="audioPlaying ? 'Pause' : 'Play'">
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
            <button class="audio-volume-btn" @click="toggleMute" :title="audioVolume === 0 ? 'Unmute' : 'Mute'">
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
    
    <!-- Drawing canvas for drawing files -->
    <DrawingCanvas
      v-else-if="file && isDrawingFile"
      :file-path="file.path"
      :initial-content="content"
      @save="handleDrawingSave"
      @content-changed="(hasChanges) => hasUnsavedChanges = hasChanges"
    />
    
    <!-- ODT rich text editor -->
    <div 
      v-else-if="file && isOdtFile"
      class="odt-editor-container"
    >
      <div class="odt-toolbar">
        <button 
          class="toolbar-btn" 
          :class="{ active: isFormatActive('bold') }"
          title="Bold (⌘B)" 
          @mousedown.prevent="execFormat('bold')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button 
          class="toolbar-btn" 
          :class="{ active: isFormatActive('italic') }"
          title="Italic (⌘I)" 
          @mousedown.prevent="execFormat('italic')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button 
          class="toolbar-btn" 
          :class="{ active: isFormatActive('underline') }"
          title="Underline (⌘U)" 
          @mousedown.prevent="execFormat('underline')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
            <line x1="4" y1="21" x2="20" y2="21"></line>
          </svg>
        </button>
        <button 
          class="toolbar-btn" 
          :class="{ active: isFormatActive('strikeThrough') }"
          title="Strikethrough" 
          @mousedown.prevent="execFormat('strikeThrough')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.1 0 1.4.8 2.3 2.3 3"></path>
            <path d="M4 12h16"></path>
            <path d="M17 16c0 2.3-2 4-5.5 4-2 0-3.7-.4-5.5-1.5"></path>
          </svg>
        </button>
        <div class="toolbar-separator"></div>
        <select 
          class="toolbar-select" 
          @change="execHeading($event)" 
          :value="currentHeadingLevel"
          title="Paragraph format"
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <div class="toolbar-separator"></div>
        <button 
          class="toolbar-btn" 
          title="Bullet list" 
          @mousedown.prevent="execFormat('insertUnorderedList')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button 
          class="toolbar-btn" 
          title="Numbered list" 
          @mousedown.prevent="execFormat('insertOrderedList')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="10" y1="6" x2="21" y2="6"></line>
            <line x1="10" y1="12" x2="21" y2="12"></line>
            <line x1="10" y1="18" x2="21" y2="18"></line>
            <path d="M4 6h1v4"></path>
            <path d="M4 10h2"></path>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
          </svg>
        </button>
      </div>
      <div 
        ref="odtEditorRef"
        class="odt-richtext-editor"
        contenteditable="true"
        @input="onOdtContentChange"
        @keydown="onOdtKeydown"
      ></div>
    </div>

    <!-- Text editor for text files -->
    <div 
      v-else-if="file && !isImageFile && !isVideoFile && !isAudioFile && !isPdfFile && !isDrawingFile"
      class="text-editor-container"
      @dragenter.prevent="onEditorDragEnter"
      @dragover.prevent="onEditorDragOver"
      @dragleave.prevent="onEditorDragLeave"
      @drop.prevent="onFileDrop"
    >
      <!-- Drop overlay for drag-and-drop media embed (purely visual) -->
      <div 
        v-show="isDragOverEditor"
        class="drop-overlay"
      >
        <div class="drop-overlay-content">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <p>Drop to embed</p>
        </div>
      </div>

      <!-- Edit mode -->
      <textarea
        ref="textareaRef"
        v-if="!showPreview || !isMarkdownFile"
        v-model="content"
        class="editor-textarea"
        :class="{ 'code-editor': isCodeFile }"
        :placeholder="isCodeFile ? 'Start coding...' : 'Start writing...'"
        @input="onContentChange"
      ></textarea>
      
      <!-- Preview mode for markdown -->
      <div 
        v-if="showPreview && isMarkdownFile"
        class="markdown-preview-mode"
        v-html="renderedMarkdown"
        @click="onMarkdownPreviewClick"
        @input="onMarkdownPreviewInput"
      ></div>

      <!-- Dictation button for txt/md files -->
      <button
        v-if="isDictatable"
        class="dictation-btn"
        :class="{ active: isDictating, loading: isDictationLoading }"
        :title="isDictating ? 'Stop dictation' : (isDictationLoading ? 'Loading Whisper model...' : 'Start dictation (Speech-to-Text)')"
        :disabled="isDictationLoading"
        @click="toggleDictation"
      >
        <!-- Microphone icon -->
        <svg v-if="!isDictationLoading" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
        <!-- Loading spinner -->
        <svg v-else class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
        <!-- Pulsing dot when active -->
        <span v-if="isDictating" class="dictation-pulse"></span>
      </button>
    </div>
    
    <div v-else class="editor-empty">
      <div class="empty-message">
        <div class="empty-logo">
          <img draggable="false" src="../assets/icon.png" alt="Leaf" class="empty-logo-icon" />
          <span class="empty-logo-text">leaf.</span>
        </div>
        <p>Select a note to start editing</p>
        <p class="hint">or create a new one from your notes folder</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { marked } from 'marked';
import DrawingCanvas from './DrawingCanvas.vue';
import type { FileInfo } from '../types/electron';

// Configure marked for clean rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const props = defineProps<{
  file: FileInfo | null;
  workspacePath: string | null;
}>();

const emit = defineEmits<{
  save: [content: string];
  contentChanged: [hasChanges: boolean];
}>();

const content = ref('');
const originalContent = ref('');
const hasUnsavedChanges = ref(false);

/** Reload the current file's content from disk */
async function reloadContent() {
  if (props.file) {
    await loadFile(props.file);
  }
}

defineExpose({ reloadContent });
const isSaving = ref(false);
const imageError = ref(false);
const videoError = ref(false);
let autoSaveTimeout: number | null = null;

// Image file extensions
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

// Video file extensions
const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

// Audio file extensions
const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];

// PDF file extensions
const pdfExtensions = ['.pdf'];

// Drawing file extensions
const drawingExtensions = ['.drawing'];

// ODT document file extensions
const odtExtensions = ['.odt'];

// Code file extensions
const codeExtensions = [
  '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php',
  '.swift', '.m', '.mm', '.r', '.R', '.pl', '.pm', '.lua', '.sql', '.graphql', '.gql',
  '.dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
  '.prettierrc', '.babelrc', '.npmrc', '.nvmrc'
];

// Image loading state
const imageUrl = ref('');
const isLoadingImage = ref(false);

// Video state
const videoUrl = ref('');
const videoRef = ref<HTMLVideoElement | null>(null);
const videoPlaying = ref(false);
const videoDuration = ref(0);
const videoCurrentTime = ref(0);
const videoVolume = ref(1);
let videoRafId: number | null = null;

// Audio state
const audioUrl = ref('');
const audioRef = ref<HTMLAudioElement | null>(null);
const audioError = ref(false);
const isLoadingAudio = ref(false);
const audioPlaying = ref(false);
const audioDuration = ref(0);
const audioCurrentTime = ref(0);
const audioVolume = ref(1);
let audioRafId: number | null = null;

// PDF state
const pdfUrl = ref('');
const pdfError = ref(false);

// Markdown preview state
const showPreview = ref(false);

// Textarea ref for cursor position on drop
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Drag-and-drop state
const isDragOverEditor = ref(false);
let dragCounter = 0;

// Dictation (Speech-to-Text) state
const isDictating = ref(false);
const isDictationLoading = ref(false);
let dictationStream: MediaStream | null = null;
let dictationAudioContext: AudioContext | null = null;
let dictationProcessor: ScriptProcessorNode | null = null;
let dictationRawSamples: Float32Array[] = [];
let dictationInterval: number | null = null;
let whisperModelReady = false;

// ODT rich text editor state
const odtEditorRef = ref<HTMLDivElement | null>(null);
const odtHtmlContent = ref('');
const odtOriginalHtml = ref('');
const currentHeadingLevel = ref('p');

// Obsidian-style embed cache: maps filename -> resolved absolute path
const embedCache = ref<Map<string, string>>(new Map());
// Track embed resolution version to trigger reactivity
const embedCacheVersion = ref(0);

// Resolve embed paths asynchronously when content changes
async function resolveEmbeds(text: string) {
  if (!props.file || !props.workspacePath) return;

  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  const matches = [...text.matchAll(embedRegex)];
  if (matches.length === 0) return;

  const noteDir = props.file.path.substring(0, props.file.path.lastIndexOf('/'));
  let changed = false;

  for (const match of matches) {
    const inner = match[1];
    const fileName = inner.split('|')[0].split('#')[0].trim();
    if (!fileName || embedCache.value.has(fileName)) continue;

    try {
      const result = await window.electronAPI.resolveEmbedPath(fileName, noteDir, props.workspacePath);
      if (result.success && result.path) {
        embedCache.value.set(fileName, result.path);
        changed = true;
      }
    } catch (err) {
      console.error('Failed to resolve embed:', fileName, err);
    }
  }

  if (changed) {
    embedCacheVersion.value++;
  }
}

// Helper: determine media type from file extension
function getEmbedMediaType(fileName: string): 'image' | 'video' | 'audio' | 'pdf' | 'note' | 'unknown' {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  if (imageExtensions.includes(ext)) return 'image';
  if (videoExtensions.includes(ext)) return 'video';
  if (audioExtensions.includes(ext)) return 'audio';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.md' || ext === '.txt') return 'note';
  return 'unknown';
}

// Check if current file is an image
const isImageFile = computed(() => {
  if (!props.file) return false;
  return imageExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is a video
const isVideoFile = computed(() => {
  if (!props.file) return false;
  return videoExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is an audio file
const isAudioFile = computed(() => {
  if (!props.file) return false;
  return audioExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is a PDF file
const isPdfFile = computed(() => {
  if (!props.file) return false;
  return pdfExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is a code file
const isCodeFile = computed(() => {
  if (!props.file) return false;
  return codeExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is a markdown file
const isMarkdownFile = computed(() => {
  if (!props.file) return false;
  return props.file.extension.toLowerCase() === '.md';
});

// Check if current file is a drawing file
const isDrawingFile = computed(() => {
  if (!props.file) return false;
  return drawingExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file is an ODT file
const isOdtFile = computed(() => {
  if (!props.file) return false;
  return odtExtensions.includes(props.file.extension.toLowerCase());
});

// Check if current file supports dictation (txt or md only)
const isDictatable = computed(() => {
  if (!props.file) return false;
  const ext = props.file.extension.toLowerCase();
  return ext === '.txt' || ext === '.md';
});

// Render markdown for preview mode
const renderedMarkdown = computed(() => {
  if (!isMarkdownFile.value) return '';
  
  // Access embedCacheVersion to create reactive dependency
  void embedCacheVersion.value;
  
  // Pre-process: replace Obsidian-style ![[file]] embeds with HTML before marked parsing
  const processedContent = content.value.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    // Parse the inner content: filename|options or filename#heading
    const pipeIndex = inner.indexOf('|');
    const hashIndex = inner.indexOf('#');
    
    let fileName: string;
    let displayOptions = '';
    
    if (pipeIndex !== -1) {
      fileName = inner.substring(0, pipeIndex).trim();
      displayOptions = inner.substring(pipeIndex + 1).trim();
    } else if (hashIndex !== -1) {
      fileName = inner.substring(0, hashIndex).trim();
    } else {
      fileName = inner.trim();
    }
    
    const resolvedPath = embedCache.value.get(fileName);
    if (!resolvedPath) {
      // Not resolved yet — show placeholder
      return `<div class="embed-placeholder" data-embed="${fileName}"><span class="embed-placeholder-icon">📎</span> <span>${fileName}</span></div>`;
    }
    
    const fileUrl = `file://${encodeURI(resolvedPath).replace(/#/g, '%23')}`;
    const mediaType = getEmbedMediaType(fileName);
    
    switch (mediaType) {
      case 'image': {
        // Parse dimension options: "300" or "300x200" or alt text
        let widthAttr = '';
        let heightAttr = '';
        let altText = fileName;
        if (displayOptions) {
          const dimMatch = displayOptions.match(/^(\d+)(?:x(\d+))?$/);
          if (dimMatch) {
            widthAttr = ` width="${dimMatch[1]}"`;
            if (dimMatch[2]) heightAttr = ` height="${dimMatch[2]}"`;
          } else {
            altText = displayOptions;
          }
        }
        return `<img src="${fileUrl}" alt="${altText}"${widthAttr}${heightAttr} class="embed-image" />`;
      }
      case 'video':
        return `<div class="embed-video-container">
          <video src="${fileUrl}" preload="metadata" class="embed-video"></video>
          <div class="embed-video-controls">
            <button class="embed-video-play" title="Play">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="embed-video-time embed-video-current">0:00</span>
            <div class="embed-video-progress">
              <div class="embed-video-progress-track">
                <div class="embed-video-progress-fill" style="width:0%"></div>
              </div>
            </div>
            <span class="embed-video-time embed-video-duration">0:00</span>
            <div class="embed-volume-wrapper">
              <button class="embed-volume-btn" title="Mute">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <input type="range" class="embed-volume-slider" min="0" max="1" step="0.01" value="1" />
            </div>
          </div>
        </div>`;
      case 'audio':
        return `<div class="embed-audio-container">
          <audio src="${fileUrl}" preload="metadata" class="embed-audio"></audio>
          <div class="embed-audio-controls">
            <button class="embed-audio-play" title="Play">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="embed-audio-time embed-audio-current">0:00</span>
            <div class="embed-audio-progress">
              <div class="embed-audio-progress-track">
                <div class="embed-audio-progress-fill" style="width:0%"></div>
              </div>
            </div>
            <span class="embed-audio-time embed-audio-duration">0:00</span>
            <div class="embed-volume-wrapper">
              <button class="embed-volume-btn" title="Mute">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <input type="range" class="embed-volume-slider" min="0" max="1" step="0.01" value="1" />
            </div>
          </div>
        </div>`;
      case 'pdf':
        return `<div class="embed-pdf-container"><iframe src="${fileUrl}" class="embed-pdf" frameborder="0"></iframe></div>`;
      case 'note':
        return `<div class="embed-note-link"><a href="#" data-embed-note="${resolvedPath}">📄 ${fileName}</a></div>`;
      default:
        return `<div class="embed-placeholder"><span class="embed-placeholder-icon">📎</span> <a href="${fileUrl}">${fileName}</a></div>`;
    }
  });
  
  // Convert ==highlight== syntax to <mark> tags before parsing
  const highlightedContent = processedContent.replace(/==((?!=).*?)==/g, '<mark>$1</mark>');
  
  // Convert - [/] half-complete tasks to a marked-compatible format with a marker
  const halfTaskProcessed = highlightedContent.replace(/^(\s*)- \[\/\] /gm, '$1- [ ] <!-- half --> ');
  
  let html = marked.parse(halfTaskProcessed, { async: false }) as string;
  
  // Add data-task-index to task list items for toggling and remove disabled
  // Also detect half-complete marker and add data-half attribute
  let taskIndex = 0;
  html = html.replace(/<li><input(.*?)>/g, (_match, attrs) => {
    const cleanAttrs = attrs.replace(/\s*disabled=""/g, '');
    return `<li class="task" data-task-index="${taskIndex++}"><input${cleanAttrs}>`;
  });
  
  // Convert half-complete markers into data attribute on the checkbox
  html = html.replace(/(<input[^>]*>)\s*<!-- half -->/g, (_match, inputTag) => {
    return inputTag.replace('<input', '<input data-half="true"');
  });
  
  return html;
});

// Load image via IPC for reliable base64 data URL
async function loadImage(filePath: string) {
  isLoadingImage.value = true;
  imageError.value = false;
  imageUrl.value = '';
  
  try {
    const result = await window.electronAPI.readImage(filePath);
    if (result.success && result.dataUrl) {
      imageUrl.value = result.dataUrl;
    } else {
      console.error('Failed to load image:', result.error);
      imageError.value = true;
    }
  } catch (error) {
    console.error('Error loading image:', error);
    imageError.value = true;
  } finally {
    isLoadingImage.value = false;
  }
}

function onVideoError() {
  videoError.value = true;
}

function onVideoLoaded() {
  if (videoRef.value) {
    videoDuration.value = videoRef.value.duration;
  }
}

function onVideoEnded() {
  videoPlaying.value = false;
  if (videoRafId) {
    cancelAnimationFrame(videoRafId);
    videoRafId = null;
  }
}

function toggleVideoPlayback() {
  if (!videoRef.value) return;
  if (videoPlaying.value) {
    videoRef.value.pause();
    videoPlaying.value = false;
    if (videoRafId) {
      cancelAnimationFrame(videoRafId);
      videoRafId = null;
    }
  } else {
    videoRef.value.play();
    videoPlaying.value = true;
    updateVideoProgress();
  }
}

function updateVideoProgress() {
  if (videoRef.value) {
    videoCurrentTime.value = videoRef.value.currentTime;
  }
  if (videoPlaying.value) {
    videoRafId = requestAnimationFrame(updateVideoProgress);
  }
}

const videoProgressPercent = computed(() => {
  if (videoDuration.value === 0) return 0;
  return (videoCurrentTime.value / videoDuration.value) * 100;
});

function seekVideo(event: MouseEvent) {
  if (!videoRef.value || videoDuration.value === 0) return;
  const wrapper = event.currentTarget as HTMLElement;
  const rect = wrapper.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  videoRef.value.currentTime = percent * videoDuration.value;
  videoCurrentTime.value = videoRef.value.currentTime;
}

function onVideoVolumeChange(event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value);
  videoVolume.value = value;
  if (videoRef.value) {
    videoRef.value.volume = value;
  }
}

function toggleVideoMute() {
  if (videoVolume.value > 0) {
    videoVolume.value = 0;
  } else {
    videoVolume.value = 1;
  }
  if (videoRef.value) {
    videoRef.value.volume = videoVolume.value;
  }
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Alias for use in event delegation handlers
const fmtTime = formatTime;

function onAudioError() {
  audioError.value = true;
}

function onAudioLoaded() {
  if (audioRef.value) {
    audioDuration.value = audioRef.value.duration;
  }
}

function onAudioEnded() {
  audioPlaying.value = false;
  if (audioRafId) {
    cancelAnimationFrame(audioRafId);
    audioRafId = null;
  }
}

function toggleAudioPlayback() {
  if (!audioRef.value) return;
  if (audioPlaying.value) {
    audioRef.value.pause();
    audioPlaying.value = false;
    if (audioRafId) {
      cancelAnimationFrame(audioRafId);
      audioRafId = null;
    }
  } else {
    audioRef.value.play();
    audioPlaying.value = true;
    updateAudioProgress();
  }
}

function updateAudioProgress() {
  if (audioRef.value) {
    audioCurrentTime.value = audioRef.value.currentTime;
  }
  if (audioPlaying.value) {
    audioRafId = requestAnimationFrame(updateAudioProgress);
  }
}

const audioProgressPercent = computed(() => {
  if (audioDuration.value === 0) return 0;
  return (audioCurrentTime.value / audioDuration.value) * 100;
});

function seekAudio(event: MouseEvent) {
  if (!audioRef.value || audioDuration.value === 0) return;
  const wrapper = event.currentTarget as HTMLElement;
  const rect = wrapper.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audioRef.value.currentTime = percent * audioDuration.value;
  audioCurrentTime.value = audioRef.value.currentTime;
}

function onVolumeChange(event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value);
  audioVolume.value = value;
  if (audioRef.value) {
    audioRef.value.volume = value;
  }
}

function toggleMute() {
  if (audioVolume.value > 0) {
    audioVolume.value = 0;
  } else {
    audioVolume.value = 1;
  }
  if (audioRef.value) {
    audioRef.value.volume = audioVolume.value;
  }
}

function onPdfError() {
  pdfError.value = true;
}

function onImageLoad() {
  imageError.value = false;
}

function onImageError() {
  imageError.value = true;
}

// Load audio via IPC for reliable base64 data URL
async function loadAudio(filePath: string) {
  isLoadingAudio.value = true;
  audioError.value = false;
  audioUrl.value = '';
  
  try {
    const result = await window.electronAPI.readAudio(filePath);
    if (result.success && result.dataUrl) {
      audioUrl.value = result.dataUrl;
    } else {
      console.error('Failed to load audio:', result.error);
      audioError.value = true;
    }
  } catch (error) {
    console.error('Error loading audio:', error);
    audioError.value = true;
  } finally {
    isLoadingAudio.value = false;
  }
}

function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

// Watch for file changes
watch(() => props.file, async (newFile) => {
  // Reset error states
  imageError.value = false;
  videoError.value = false;
  videoPlaying.value = false;
  videoCurrentTime.value = 0;
  videoDuration.value = 0;
  if (videoRafId) { cancelAnimationFrame(videoRafId); videoRafId = null; }
  audioError.value = false;
  audioPlaying.value = false;
  audioCurrentTime.value = 0;
  audioDuration.value = 0;
  if (audioRafId) { cancelAnimationFrame(audioRafId); audioRafId = null; }
  pdfError.value = false;
  imageUrl.value = '';
  videoUrl.value = '';
  audioUrl.value = '';
  pdfUrl.value = '';
  
  // Clear embed cache when switching files
  embedCache.value.clear();
  embedCacheVersion.value++;
  
  if (newFile) {
    const ext = newFile.extension.toLowerCase();
    
    // Check if file is an image
    if (imageExtensions.includes(ext)) {
      // Load image via IPC
      await loadImage(newFile.path);
      // Clear text content for image files
      content.value = '';
      originalContent.value = '';
      hasUnsavedChanges.value = false;
    } else if (videoExtensions.includes(ext)) {
      // Set video URL using file:// protocol (webSecurity disabled allows this)
      videoUrl.value = `file://${newFile.path}`;
      videoError.value = false;
      // Clear text content for video files
      content.value = '';
      originalContent.value = '';
      hasUnsavedChanges.value = false;
    } else if (audioExtensions.includes(ext)) {
      // Load audio via IPC for better format compatibility
      await loadAudio(newFile.path);
      // Clear text content for audio files
      content.value = '';
      originalContent.value = '';
      hasUnsavedChanges.value = false;
    } else if (pdfExtensions.includes(ext)) {
      // Set PDF URL using file:// protocol
      pdfUrl.value = `file://${newFile.path}`;
      pdfError.value = false;
      // Clear text content for PDF files
      content.value = '';
      originalContent.value = '';
      hasUnsavedChanges.value = false;
    } else if (odtExtensions.includes(ext)) {
      // Load ODT file content
      await loadOdtFile(newFile);
    } else {
      // Load text content for text files
      await loadFile(newFile);
    }
  } else {
    content.value = '';
    originalContent.value = '';
    hasUnsavedChanges.value = false;
  }
}, { immediate: true });

async function loadFile(file: FileInfo) {
  // Clear any pending auto-save when switching files
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  
  try {
    const result = await window.electronAPI.readFile(file.path);
    if (result.success && result.content !== undefined) {
      content.value = result.content;
      originalContent.value = result.content;
      hasUnsavedChanges.value = false;
      
      // Resolve any Obsidian-style embeds in markdown files
      if (file.extension.toLowerCase() === '.md') {
        resolveEmbeds(result.content);
      }
    } else {
      console.error('Failed to read file:', result.error);
    }
  } catch (error) {
    console.error('Error loading file:', error);
  }
}

async function loadOdtFile(file: FileInfo) {
  // Clear any pending auto-save when switching files
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  
  try {
    const result = await window.electronAPI.readOdt(file.path);
    if (result.success && result.content !== undefined) {
      // Content is now HTML from the converter
      odtHtmlContent.value = result.content;
      odtOriginalHtml.value = result.content;
      // Also store in content for save compatibility
      content.value = result.content;
      originalContent.value = result.content;
      hasUnsavedChanges.value = false;
    } else {
      console.error('Failed to read ODT file:', result.error);
    }
  } catch (error) {
    console.error('Error loading ODT file:', error);
  }
}

// ODT rich text editor methods
function onOdtContentChange() {
  if (!odtEditorRef.value) return;
  const currentHtml = odtEditorRef.value.innerHTML;
  content.value = currentHtml;
  hasUnsavedChanges.value = currentHtml !== odtOriginalHtml.value;
  emit('contentChanged', hasUnsavedChanges.value);
  
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Auto-save after 3 seconds of inactivity
  if (hasUnsavedChanges.value) {
    autoSaveTimeout = window.setTimeout(() => {
      saveFile();
    }, 3000);
  }
}

function onOdtKeydown(event: KeyboardEvent) {
  // Handle keyboard shortcuts for formatting
  if (event.metaKey || event.ctrlKey) {
    switch (event.key.toLowerCase()) {
      case 'b':
        event.preventDefault();
        execFormat('bold');
        break;
      case 'i':
        event.preventDefault();
        execFormat('italic');
        break;
      case 'u':
        event.preventDefault();
        execFormat('underline');
        break;
      case 's':
        event.preventDefault();
        saveFile();
        break;
    }
  }
}

function execFormat(command: string) {
  document.execCommand(command, false);
  // Update heading level indicator
  updateCurrentHeadingLevel();
}

function execHeading(event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  
  if (value === 'p') {
    document.execCommand('formatBlock', false, 'p');
  } else {
    document.execCommand('formatBlock', false, value);
  }
  currentHeadingLevel.value = value;
}

function isFormatActive(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function updateCurrentHeadingLevel() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  
  let node: Node | null = selection.anchorNode;
  while (node && node !== odtEditorRef.value) {
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        currentHeadingLevel.value = tagName;
        return;
      }
    }
    node = node.parentNode;
  }
  currentHeadingLevel.value = 'p';
}

// Watch odtHtmlContent and populate contenteditable div
watch(odtHtmlContent, async (newHtml) => {
  await nextTick();
  if (odtEditorRef.value && newHtml) {
    odtEditorRef.value.innerHTML = newHtml;
  }
});

function onContentChange() {
  hasUnsavedChanges.value = content.value !== originalContent.value;
  emit('contentChanged', hasUnsavedChanges.value);
  
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Resolve any new embeds in markdown files
  if (isMarkdownFile.value && content.value.includes('![[')) {
    resolveEmbeds(content.value);
  }
  
  // Set new timeout for auto-save (7 seconds after user stops typing)
  if (hasUnsavedChanges.value) {
    autoSaveTimeout = window.setTimeout(() => {
      saveFile();
    }, 3000);
  }
}

// ============================
// Drag-and-drop media embed logic
// ============================

// Embeddable file extensions
const embeddableExtensions = [
  ...imageExtensions,
  ...videoExtensions,
  ...audioExtensions,
  ...pdfExtensions,
];

function isEmbeddableFile(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return embeddableExtensions.includes(ext);
}

function hasEmbeddableData(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  // Native file drop from OS
  if (dt.types.includes('Files')) return true;
  // Internal drag from FileExplorer (text/plain with "file:" prefix)
  if (dt.types.includes('text/plain')) return true;
  return false;
}

function onEditorDragEnter(event: DragEvent) {
  if (!isMarkdownFile.value) return;
  if (!hasEmbeddableData(event.dataTransfer)) return;
  dragCounter++;
  isDragOverEditor.value = true;
}

function onEditorDragOver(event: DragEvent) {
  if (!isMarkdownFile.value) return;
  if (hasEmbeddableData(event.dataTransfer)) {
    if (event.dataTransfer) {
      // Use 'copy' for native OS file drops, 'move' for internal FileExplorer drags
      // effectAllowed is set by the source; dropEffect must be compatible
      if (event.dataTransfer.types.includes('Files')) {
        event.dataTransfer.dropEffect = 'copy';
      } else {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  }
}

function onEditorDragLeave(_event: DragEvent) {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDragOverEditor.value = false;
  }
}

async function onFileDrop(event: DragEvent) {
  dragCounter = 0;
  isDragOverEditor.value = false;
  
  if (!isMarkdownFile.value || !props.file || !props.workspacePath) return;
  
  const embedTexts: string[] = [];
  
  // 1. Check for internal drag from FileExplorer (text/plain with "file:" prefix)
  const plainData = event.dataTransfer?.getData('text/plain');
  if (plainData && plainData.startsWith('file:')) {
    const filePath = plainData.substring(5);
    const fileName = filePath.split('/').pop() || '';
    
    if (fileName && isEmbeddableFile(fileName)) {
      embedTexts.push(`![[${fileName}]]`);
    }
  }
  
  // 2. Check for native file drops from OS (e.g. Finder)
  if (embedTexts.length === 0 && event.dataTransfer?.files?.length) {
    const files = Array.from(event.dataTransfer.files);
    const noteDir = props.file.path.substring(0, props.file.path.lastIndexOf('/'));
    
    for (const file of files) {
      const filePath = (file as any).path as string;
      if (!filePath) continue;
      if (!isEmbeddableFile(file.name)) continue;
      
      if (filePath.startsWith(props.workspacePath)) {
        embedTexts.push(`![[${file.name}]]`);
      } else {
        try {
          const result = await window.electronAPI.copyFileToVault(filePath, noteDir);
          if (result.success && result.fileName) {
            embedTexts.push(`![[${result.fileName}]]`);
          } else {
            console.error('Failed to copy file to vault:', result.error);
          }
        } catch (err) {
          console.error('Error copying file to vault:', err);
        }
      }
    }
  }
  
  if (embedTexts.length === 0) return;
  
  const embedString = embedTexts.join('\n');
  
  // Insert at cursor position in textarea, or append at end
  if (textareaRef.value && (!showPreview.value || !isMarkdownFile.value)) {
    const textarea = textareaRef.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.value.substring(0, start);
    const after = content.value.substring(end);
    
    // Add newlines around the embed if needed
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n');
    const needNewlineAfter = after.length > 0 && !after.startsWith('\n');
    
    const insertion = (needNewlineBefore ? '\n' : '') + embedString + (needNewlineAfter ? '\n' : '');
    content.value = before + insertion + after;
    
    // Set cursor position after the insertion
    await nextTick();
    const newPos = start + insertion.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
    textarea.focus();
  } else {
    // Preview mode or no textarea — append at end
    const needNewline = content.value.length > 0 && !content.value.endsWith('\n');
    content.value += (needNewline ? '\n' : '') + embedString + '\n';
  }
  
  onContentChange();
}

// Handle clicks in markdown preview (for checkbox toggling and embedded video)
function onMarkdownPreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  
  // --- Embedded video play/pause ---
  const vidPlayBtn = target.closest('.embed-video-play') as HTMLElement;
  if (vidPlayBtn) {
    event.preventDefault();
    const container = vidPlayBtn.closest('.embed-video-container') as HTMLElement;
    if (!container) return;
    const video = container.querySelector('video') as HTMLVideoElement;
    if (!video) return;
    if (video.paused) {
      video.play();
      vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      const updateProgress = () => {
        const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
        const curEl = container.querySelector('.embed-video-current') as HTMLElement;
        if (fill && video.duration) fill.style.width = ((video.currentTime / video.duration) * 100) + '%';
        if (curEl) curEl.textContent = fmtTime(video.currentTime);
        if (!video.paused) requestAnimationFrame(updateProgress);
      };
      updateProgress();
      video.onended = () => {
        vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
        if (fill) fill.style.width = '0%';
        const curEl = container.querySelector('.embed-video-current') as HTMLElement;
        if (curEl) curEl.textContent = '0:00';
      };
      video.onloadedmetadata = () => {
        const durEl = container.querySelector('.embed-video-duration') as HTMLElement;
        if (durEl) durEl.textContent = fmtTime(video.duration);
      };
      if (video.duration) {
        const durEl = container.querySelector('.embed-video-duration') as HTMLElement;
        if (durEl) durEl.textContent = fmtTime(video.duration);
      }
    } else {
      video.pause();
      vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    return;
  }
  
  // --- Embedded audio play/pause ---
  const audPlayBtn = target.closest('.embed-audio-play') as HTMLElement;
  if (audPlayBtn) {
    event.preventDefault();
    const container = audPlayBtn.closest('.embed-audio-container') as HTMLElement;
    if (!container) return;
    const audio = container.querySelector('audio') as HTMLAudioElement;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      const updateProgress = () => {
        const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
        const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
        if (fill && audio.duration) fill.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
        if (curEl) curEl.textContent = fmtTime(audio.currentTime);
        if (!audio.paused) requestAnimationFrame(updateProgress);
      };
      updateProgress();
      audio.onended = () => {
        audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
        if (fill) fill.style.width = '0%';
        const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
        if (curEl) curEl.textContent = '0:00';
      };
      audio.onloadedmetadata = () => {
        const durEl = container.querySelector('.embed-audio-duration') as HTMLElement;
        if (durEl) durEl.textContent = fmtTime(audio.duration);
      };
      if (audio.duration) {
        const durEl = container.querySelector('.embed-audio-duration') as HTMLElement;
        if (durEl) durEl.textContent = fmtTime(audio.duration);
      }
    } else {
      audio.pause();
      audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    return;
  }
  
  // --- Embedded audio seek ---
  const audProgress = target.closest('.embed-audio-progress') as HTMLElement;
  if (audProgress) {
    event.preventDefault();
    const container = audProgress.closest('.embed-audio-container') as HTMLElement;
    if (!container) return;
    const audio = container.querySelector('audio') as HTMLAudioElement;
    if (!audio || !audio.duration) return;
    const rect = audProgress.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
    if (fill) fill.style.width = (pct * 100) + '%';
    const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
    if (curEl) curEl.textContent = fmtTime(audio.currentTime);
    return;
  }
  
  // --- Embedded video seek ---
  const vidProgress = target.closest('.embed-video-progress') as HTMLElement;
  if (vidProgress) {
    event.preventDefault();
    const container = vidProgress.closest('.embed-video-container') as HTMLElement;
    if (!container) return;
    const video = container.querySelector('video') as HTMLVideoElement;
    if (!video || !video.duration) return;
    const rect = vidProgress.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
    const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
    if (fill) fill.style.width = (pct * 100) + '%';
    const curEl = container.querySelector('.embed-video-current') as HTMLElement;
    if (curEl) curEl.textContent = fmtTime(video.currentTime);
    return;
  }
  
  // --- Click on embedded video to play/pause ---
  const vidEl = target.closest('.embed-video') as HTMLVideoElement;
  if (vidEl) {
    event.preventDefault();
    const container = vidEl.closest('.embed-video-container') as HTMLElement;
    const playBtn = container?.querySelector('.embed-video-play') as HTMLElement;
    if (playBtn) playBtn.click();
    return;
  }
  
  // --- Embedded mute toggle (works for both video and audio containers) ---
  const muteBtn = target.closest('.embed-volume-btn') as HTMLElement;
  if (muteBtn) {
    event.preventDefault();
    const container = muteBtn.closest('.embed-video-container, .embed-audio-container') as HTMLElement;
    if (!container) return;
    const media = (container.querySelector('video') || container.querySelector('audio')) as HTMLMediaElement;
    if (!media) return;
    const slider = container.querySelector('.embed-volume-slider') as HTMLInputElement;
    const svgMuted = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    const svgLow = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const svgHigh = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    if (media.volume > 0) {
      media.dataset.prevVolume = String(media.volume);
      media.volume = 0;
      if (slider) slider.value = '0';
      muteBtn.innerHTML = svgMuted;
    } else {
      const prev = parseFloat(media.dataset.prevVolume || '1');
      media.volume = prev;
      if (slider) slider.value = String(prev);
      muteBtn.innerHTML = prev < 0.5 ? svgLow : svgHigh;
    }
    return;
  }
  
  // --- Embedded volume slider (works for both video and audio containers) ---
  const volSlider = target.closest('.embed-volume-slider') as HTMLInputElement;
  if (volSlider) {
    // Handled by 'input' event listener, but prevent click propagation
    return;
  }
  
  // --- Checkbox toggling ---
  if (target.tagName === 'INPUT' && (target as HTMLInputElement).getAttribute('type') === 'checkbox') {
    event.preventDefault();
    const li = target.closest('li.task');
    if (!li) return;
    
    // Toggle checkbox state: [ ] → [/] → [x] → [ ]
    const lines = content.value.split('\n');
    let taskIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const uncheckedMatch = lines[i].match(/^(\s*)- \[ \] /);
      const halfMatch = lines[i].match(/^(\s*)- \[\/\] /);
      const checkedMatch = lines[i].match(/^(\s*)- \[x\] /i);
      if (uncheckedMatch || halfMatch || checkedMatch) {
        const liTaskIndex = li.getAttribute('data-task-index');
        if (String(taskIndex) === liTaskIndex) {
          if (uncheckedMatch) {
            lines[i] = lines[i].replace(/^(\s*)- \[ \]/, '$1- [/]');
          } else if (halfMatch) {
            lines[i] = lines[i].replace(/^(\s*)- \[\/\]/, '$1- [x]');
          } else {
            lines[i] = lines[i].replace(/^(\s*)- \[x\]/i, '$1- [ ]');
          }
          content.value = lines.join('\n');
          onContentChange();
          break;
        }
        taskIndex++;
      }
    }
  }
}

// Handle input events in markdown preview (for embedded volume sliders)
function onMarkdownPreviewInput(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.classList.contains('embed-volume-slider')) return;
  
  const container = target.closest('.embed-video-container, .embed-audio-container') as HTMLElement;
  if (!container) return;
  const media = (container.querySelector('video') || container.querySelector('audio')) as HTMLMediaElement;
  if (!media) return;
  
  const vol = parseFloat(target.value);
  media.volume = vol;
  
  const muteBtn = container.querySelector('.embed-volume-btn') as HTMLElement;
  if (muteBtn) {
    const svgMuted = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    const svgLow = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const svgHigh = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    if (vol === 0) {
      muteBtn.innerHTML = svgMuted;
    } else if (vol < 0.5) {
      muteBtn.innerHTML = svgLow;
    } else {
      muteBtn.innerHTML = svgHigh;
    }
  }
}

async function saveFile() {
  if (!props.file || !hasUnsavedChanges.value || isSaving.value) return;
  
  isSaving.value = true;
  
  try {
    let result;
    if (isOdtFile.value) {
      const htmlContent = odtEditorRef.value?.innerHTML || content.value;
      result = await window.electronAPI.writeOdt(props.file.path, htmlContent);
    } else {
      result = await window.electronAPI.writeFile(props.file.path, content.value);
    }
    if (result.success) {
      if (isOdtFile.value) {
        odtOriginalHtml.value = odtEditorRef.value?.innerHTML || content.value;
      }
      originalContent.value = content.value;
      hasUnsavedChanges.value = false;
      emit('contentChanged', false);
      emit('save', content.value);
    } else {
      console.error('Failed to save file:', result.error);
      alert('Failed to save file: ' + result.error);
    }
  } catch (error) {
    console.error('Error saving file:', error);
    alert('Error saving file');
  } finally {
    isSaving.value = false;
  }
}

// Handle drawing canvas save
async function handleDrawingSave(drawingContent: string) {
  if (!props.file) return;
  
  try {
    const result = await window.electronAPI.writeFile(props.file.path, drawingContent);
    if (result.success) {
      content.value = drawingContent;
      originalContent.value = drawingContent;
      hasUnsavedChanges.value = false;
      emit('contentChanged', false);
      emit('save', drawingContent);
    } else {
      console.error('Failed to save drawing:', result.error);
    }
  } catch (error) {
    console.error('Error saving drawing:', error);
  }
}

// ============================
// Dictation (Speech-to-Text) logic
// ============================

/**
 * Resample audio from the native sample rate to 16kHz mono.
 * Uses linear interpolation for simplicity.
 */
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

/**
 * Toggle dictation on/off.
 * On first use, initializes the Whisper model (downloads ~40MB if needed).
 */
async function toggleDictation() {
  if (isDictating.value) {
    stopDictation();
    return;
  }

  // Initialize Whisper model if not yet ready
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

  // Request microphone access
  try {
    dictationStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
  } catch (err) {
    console.error('Microphone access denied:', err);
    return;
  }

  // Set up Web Audio pipeline to capture raw PCM samples
  dictationAudioContext = new AudioContext();
  const source = dictationAudioContext.createMediaStreamSource(dictationStream);
  // ScriptProcessorNode: buffer size 4096, 1 input channel, 1 output channel
  dictationProcessor = dictationAudioContext.createScriptProcessor(4096, 1, 1);
  dictationRawSamples = [];

  dictationProcessor.onaudioprocess = (e) => {
    const channelData = e.inputBuffer.getChannelData(0);
    dictationRawSamples.push(new Float32Array(channelData));
  };

  source.connect(dictationProcessor);
  dictationProcessor.connect(dictationAudioContext.destination);

  isDictating.value = true;

  // Process accumulated audio every 5 seconds
  dictationInterval = window.setInterval(async () => {
    if (dictationRawSamples.length === 0) return;

    // Grab current samples and clear buffer
    const chunks = dictationRawSamples.slice();
    dictationRawSamples = [];

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const fullAudio = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      fullAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Resample to 16kHz
    const nativeSampleRate = dictationAudioContext?.sampleRate || 44100;
    const resampled = resampleTo16kHz(fullAudio, nativeSampleRate);

    // Send to main process for Whisper inference
    try {
      const result = await window.electronAPI.speechTranscribe(Array.from(resampled));
      if (result.success && result.text && result.text.length > 0) {
        // Append transcribed text to the editor content
        const trimmedText = result.text.trim();
        if (trimmedText) {
          // Add a space before new text if content doesn't end with whitespace
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

/**
 * Stop dictation: release microphone, clean up audio nodes, clear interval.
 */
function stopDictation() {
  isDictating.value = false;

  if (dictationInterval) {
    clearInterval(dictationInterval);
    dictationInterval = null;
  }

  // Process any remaining audio before stopping
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

    // Fire-and-forget final transcription
    window.electronAPI.speechTranscribe(Array.from(resampled)).then((result) => {
      if (result.success && result.text && result.text.trim()) {
        const needsSpace = content.value.length > 0 && !/\s$/.test(content.value);
        content.value += (needsSpace ? ' ' : '') + result.text.trim();
        onContentChange();
      }
    }).catch(() => {});
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
    dictationStream.getTracks().forEach(track => track.stop());
    dictationStream = null;
  }
}

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
  
  // Spacebar to toggle video play/pause (only when not in textarea)
  if (e.key === ' ' && isVideoFile.value && videoRef.value) {
    // Don't trigger if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    
    e.preventDefault();
    toggleVideoPlayback();
  }
  
  // Spacebar to toggle audio play/pause (only when not in textarea)
  if (e.key === ' ' && isAudioFile.value && audioRef.value) {
    // Don't trigger if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    
    e.preventDefault();
    if (audioRef.value.paused) {
      audioRef.value.play();
    } else {
      audioRef.value.pause();
    }
  }
}

// Prevent Electron from navigating when files are dropped anywhere on the window
function preventGlobalDrop(event: DragEvent) {
  // Only prevent default to stop navigation; don't stopPropagation so Vue handlers still fire
  event.preventDefault();
}
function preventGlobalDragOver(event: DragEvent) {
  event.preventDefault();
}

// Add keyboard listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyboard);
}

onMounted(() => {
  document.addEventListener('drop', preventGlobalDrop, true);
  document.addEventListener('dragover', preventGlobalDragOver, true);
});

// Cleanup
onUnmounted(() => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  // Stop dictation if active
  if (isDictating.value) {
    stopDictation();
  }
  // Remove speech status listener
  window.electronAPI.removeSpeechStatusListener();
  // Remove global drag-drop listeners
  document.removeEventListener('drop', preventGlobalDrop, true);
  document.removeEventListener('dragover', preventGlobalDragOver, true);
  // Remove keyboard listener
  window.removeEventListener('keydown', handleKeyboard);
});
</script>

<style scoped lang="scss">
.note-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  position: relative;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--text3) 60%, transparent);
  background: transparent;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  -webkit-app-region: drag;
  position: sticky;
  top: 0;
  z-index: 10;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-title-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  -webkit-app-region: drag;
  user-select: none;
}

.file-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-with-toggle {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  
  .file-extension-badge {
    border-radius: 3px 0 0 3px;
  }
}

.file-extension-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.4rem;
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--base2);
  background: transparent;
  border: 1px solid var(--base2);
  border-radius: 3px;
  opacity: 0.7;
  flex-shrink: 0;
}

.preview-toggle {
  background: transparent;
  border: 1px solid var(--base2);
  border-left: none;
  border-radius: 0 3px 3px 0;
  padding: 0.20rem 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--base2);
  opacity: 0.7;
  transition: all 0.2s ease;
  flex-shrink: 0;
  height: 100%;
  
  &:hover {
    background: var(--base2);
    color: var(--base1);
    opacity: 1;
  }
  
  svg {
    display: block;
  }
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  -webkit-app-region: no-drag;
}

.unsaved-indicator {
  color: var(--base2);
}

.saving-indicator {
  color: var(--text2);
  font-style: italic;
}

.odt-editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.odt-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text1);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s, border-color 0.15s;
  
  &:hover {
    background: var(--bg-active);
    border-color: var(--border-color);
  }
  
  &:active, &.active {
    background: var(--accent-color, #4a9eff);
    color: #fff;
    border-color: var(--accent-color, #4a9eff);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 6px;
  flex-shrink: 0;
}

.toolbar-select {
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text1);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  
  &:hover {
    border-color: var(--text2);
  }
  
  &:focus {
    border-color: var(--accent-color, #4a9eff);
  }
}

.odt-richtext-editor {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  outline: none;
  color: var(--text1);
  font-family: Georgia, 'Times New Roman', Times, serif;
  font-size: 1rem;
  line-height: 1.8;
  cursor: text;
  
  &:empty::before {
    content: 'Start typing...';
    color: var(--text2);
    opacity: 0.5;
  }
  
  h1 { font-size: 2em; margin: 0.67em 0; font-weight: bold; }
  h2 { font-size: 1.5em; margin: 0.75em 0; font-weight: bold; }
  h3 { font-size: 1.17em; margin: 0.83em 0; font-weight: bold; }
  h4 { font-size: 1em; margin: 1em 0; font-weight: bold; }
  h5 { font-size: 0.83em; margin: 1.17em 0; font-weight: bold; }
  h6 { font-size: 0.67em; margin: 1.33em 0; font-weight: bold; }
  
  p { margin: 0.5em 0; }
  
  ul, ol {
    padding-left: 2em;
    margin: 0.5em 0;
  }
  
  li { margin: 0.25em 0; }
  
  a {
    color: var(--accent-color, #4a9eff);
    text-decoration: underline;
  }
  
  blockquote {
    border-left: 3px solid var(--border-color);
    padding-left: 1em;
    margin: 0.5em 0;
    color: var(--text2);
  }
}

.text-editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--base1) 85%, transparent);
  backdrop-filter: blur(4px);
  border: 2px dashed var(--accent-color, #6366f1);
  border-radius: 8px;
  margin: 0.5rem;
  pointer-events: none;
}

.drop-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent-color, #6366f1);
  
  svg {
    opacity: 0.8;
  }
  
  p {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
  }
}

.editor-textarea {
  flex: 1;
  padding: 2rem;
  background: transparent;
  color: var(--text1);
  border: none;
  outline: none;
  font-family: Helvetica, sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  resize: none;
  cursor: text;
  -webkit-app-region: no-drag;
  
  &::placeholder {
    color: var(--text2);
  }
  
  &.code-editor {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Menlo', 'Consolas', 'DejaVu Sans Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    tab-size: 4;
    -moz-tab-size: 4;
    white-space: pre;
    overflow-wrap: normal;
    word-wrap: normal;
  }
}

.markdown-preview-mode {
  flex: 1;
  padding: 2rem;
  background: transparent;
  color: var(--text1);
  overflow: auto;
  -webkit-app-region: no-drag;
  font-family: Helvetica, sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin: 1.2em 0 0.4em 0;
    font-weight: 600;
    color: var(--text1);
    line-height: 1.4;

    &:first-child {
      margin-top: 0;
    }
  }
  
  :deep(h1) { font-size: 2em; }
  :deep(h2) { font-size: 1.5em; }
  :deep(h3) { font-size: 1.25em; }
  :deep(h4) { font-size: 1.1em; }
  :deep(h5) { font-size: 1em; }
  :deep(h6) { font-size: 0.9em; color: var(--text2); }
  
  :deep(strong) {
    font-weight: 600;
    color: var(--accent-color);
  }
  
  :deep(em) { font-style: italic; }
  
  :deep(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
  
  :deep(code) {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Menlo', 'Consolas', monospace;
    font-size: 0.9em;
    background: color-mix(in srgb, var(--text2) 15%, transparent);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    color: var(--base2);
  }
  
  :deep(pre) {
    background: color-mix(in srgb, var(--text2) 10%, transparent);
    border: 1px solid var(--text3);
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    margin: 0.75em 0;
    
    code {
      background: none;
      padding: 0;
      color: var(--text1);
      font-size: 0.875em;
      line-height: 1.5;
    }
  }
  
  :deep(mark) {
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    color: var(--text1);
    padding: 0.1em 0.3em;
    border-radius: 4px;
  }
  
  :deep(ul), :deep(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }
  
  :deep(li) {
    margin: 0;
    
    &.task {
      list-style: none;
      display: flex;
      align-items: baseline;
      
      input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        min-width: 16px;
        border: 1.5px solid var(--text2);
        border-radius: 4px;
        background: transparent;
        margin-right: 0.5em;
        cursor: pointer;
        position: relative;
        top: 3px;
        transition: all 0.15s ease;
        flex-shrink: 0;

        &:checked {
          background: var(--accent-color);
          border-color: var(--accent-color);
        }

        &:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 5px;
          height: 9px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        &[data-half] {
          background: linear-gradient(to top, var(--accent-color) 50%, transparent 50%);
          border-color: var(--accent-color);
        }

        &:hover {
          border-color: var(--accent-color);
        }
      }

      &:has(input:checked) {
        color: var(--text2);
        text-decoration: line-through;
        text-decoration-color: var(--text2);
      }
    }
  }
  
  :deep(table) {
    border-collapse: collapse;
    margin: 0.75em 0;
    width: auto;
  }
  
  :deep(th), :deep(td) {
    border: 1px solid var(--text3);
    padding: 0.5em 1em;
  }
  
  :deep(thead tr) {
    background: color-mix(in srgb, var(--text2) 10%, transparent);
    font-weight: 600;
  }
  
  :deep(a) {
    color: var(--accent-color);
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    display: block;
  }
  
  :deep(blockquote) {
    margin: 0.75em 0;
    padding: 0 1em;
    border-left: 4px solid var(--accent-color);
    color: var(--text2);
  }
  
  :deep(hr) {
    border: none;
    border-top: 2px solid var(--text3);
    margin: 1em 0;
  }
  
  :deep(p) {
    margin: 0.5em 0;

    &:first-child {
      margin-top: 0;
    }
  }
  
  // Obsidian-style embed styles
  :deep(.embed-image) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    display: block;
    margin: 0.5em 0;
  }
  
  :deep(.embed-video-container) {
    margin: 0.5em 0;
    max-width: 100%;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--text3);
    background: #000;
    
    .embed-video {
      max-width: 100%;
      max-height: 500px;
      display: block;
      cursor: pointer;
      width: 100%;

      &::-webkit-media-controls {
        display: none !important;
      }
    }

    .embed-video-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.7rem;
      background: var(--bg-primary);
      border-top: 1px solid var(--text3);
    }

    .embed-video-play {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      min-width: 28px;
      border-radius: 50%;
      border: none;
      background: var(--accent-color);
      color: white;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s ease;

      &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
      }
    }

    .embed-video-time {
      font-size: 0.65rem;
      color: var(--text2);
      font-variant-numeric: tabular-nums;
      min-width: 2.2em;
      text-align: center;
      user-select: none;
    }

    .embed-video-progress {
      flex: 1;
      cursor: pointer;
      padding: 0.3rem 0;
      display: flex;
      align-items: center;
    }

    .embed-video-progress-track {
      width: 100%;
      height: 3px;
      background: var(--bg-hover);
      border-radius: 2px;
      overflow: hidden;
    }

    .embed-video-progress-fill {
      height: 100%;
      background: var(--accent-color);
      border-radius: 2px;
      transition: width 0.05s linear;
    }
  }
  
  :deep(.embed-audio-container) {
    margin: 0.5em 0;
    max-width: 500px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--text3);
    background: var(--bg-primary);
    
    .embed-audio {
      display: none;
    }

    .embed-audio-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.7rem;
    }

    .embed-audio-play {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      min-width: 28px;
      border-radius: 50%;
      border: none;
      background: var(--accent-color);
      color: white;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s ease;

      &:hover {
        transform: scale(1.08);
        filter: brightness(1.1);
      }
    }

    .embed-audio-time {
      font-size: 0.65rem;
      color: var(--text2);
      font-variant-numeric: tabular-nums;
      min-width: 2.2em;
      text-align: center;
      user-select: none;
    }

    .embed-audio-progress {
      flex: 1;
      cursor: pointer;
      padding: 0.3rem 0;
      display: flex;
      align-items: center;
    }

    .embed-audio-progress-track {
      width: 100%;
      height: 3px;
      background: var(--bg-hover);
      border-radius: 2px;
      overflow: hidden;
    }

    .embed-audio-progress-fill {
      height: 100%;
      background: var(--accent-color);
      border-radius: 2px;
      transition: width 0.05s linear;
    }
  }

  // Shared volume controls for embedded media
  :deep(.embed-volume-wrapper) {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.2rem;
  }

  :deep(.embed-volume-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text2);
    cursor: pointer;
    padding: 0;
    transition: color 0.15s ease;

    &:hover {
      color: var(--text1);
    }
  }

  :deep(.embed-volume-slider) {
    width: 60px;
    height: 3px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bg-hover);
    border-radius: 2px;
    outline: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent-color);
      cursor: pointer;
      border: none;
    }
  }
  
  :deep(.embed-pdf-container) {
    margin: 0.5em 0;
    border: 1px solid var(--text3);
    border-radius: 8px;
    overflow: hidden;
    
    .embed-pdf {
      width: 100%;
      height: 600px;
      border: none;
      display: block;
    }
  }
  
  :deep(.embed-note-link) {
    margin: 0.5em 0;
    padding: 0.5em 0.75em;
    background: color-mix(in srgb, var(--text2) 8%, transparent);
    border: 1px solid var(--text3);
    border-radius: 6px;
    
    a {
      color: var(--accent-color);
      text-decoration: none;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
  
  :deep(.embed-placeholder) {
    margin: 0.5em 0;
    padding: 0.5em 0.75em;
    background: color-mix(in srgb, var(--text2) 6%, transparent);
    border: 1px dashed var(--text3);
    border-radius: 6px;
    color: var(--text2);
    font-size: 0.9em;
    display: flex;
    align-items: center;
    gap: 0.4em;
    
    .embed-placeholder-icon {
      font-size: 1em;
    }
  }
}

.image-viewer {
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
    background: url('../assets/pattern.png');
    background-size: cover;
    background-position: center;
    opacity: 0.01;
    pointer-events: none;
  }
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  position: relative;
  z-index: 1;
}

.image-loading {
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

.image-error {
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

.video-viewer {
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
    background: url('../assets/pattern.png');
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

.pdf-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  -webkit-app-region: no-drag;
  background: var(--base1);
  position: relative;
}

.pdf-preview {
  width: 100%;
  height: 100%;
  border: none;
  position: relative;
  z-index: 1;
}

.pdf-error {
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
  
  .pdf-error-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
}

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
    background: url('../assets/pattern.png');
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

// Dictation button
.dictation-btn {
  position: absolute;
  bottom: 1.25rem;
  right: 1.25rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--text3);
  background: var(--base1);
  color: var(--text2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 20;
  -webkit-app-region: no-drag;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &:hover {
    background: var(--bg-hover, var(--text3));
    color: var(--text1);
    border-color: var(--text2);
  }

  &.active {
    background: #e53e3e;
    color: #fff;
    border-color: #e53e3e;
    box-shadow: 0 2px 12px rgba(229, 62, 62, 0.4);
  }

  &.loading {
    opacity: 0.6;
    cursor: wait;
  }

  &:disabled {
    cursor: wait;
  }

  svg {
    display: block;
  }

  .spin {
    animation: spin 1.2s linear infinite;
  }
}

.dictation-pulse {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e53e3e;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
}

.empty-message {
  text-align: center;
  color: var(--text2);
  
  .empty-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }
  
  .empty-logo-icon {
    width: 100px;
    height: 100px;
    object-fit: contain;
  }
  
  .empty-logo-text {
    font-family: 'Inter', sans-serif;
    font-size: 4rem;
    font-weight: 600;
    color: var(--text1);
    letter-spacing: -0.02em;
    cursor: default;
  }
  
  p {
    margin: 0.5rem 0;
    font-size: 1.1rem;
  }
  
  .hint {
    font-size: 0.9rem;
    color: var(--text2);
  }
}
</style>
