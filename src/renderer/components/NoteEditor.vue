<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { isImageFile as checkImage, isVideoFile as checkVideo, isAudioFile as checkAudio, isPdfFile as checkPdf, isCodeFile as checkCode, isMarkdownFile as checkMarkdown, isDrawingFile as checkDrawing } from '../utils/fileTypes';
import { marked } from 'marked';
import DrawingCanvas from './DrawingCanvas.vue';
import ImageViewer from './editor/ImageViewer.vue';
import VideoViewer from './editor/VideoViewer.vue';
import AudioViewer from './editor/AudioViewer.vue';
import PdfViewer from './editor/PdfViewer.vue';
import type { FileInfo } from '../types/electron';
import { useEmbedResolver } from '../composables/editor/useEmbedResolver';
import { useEditorDrop } from '../composables/editor/useEditorDrop';
import { useDictation } from '../composables/editor/useDictation';
import { useNotePersistence } from '../composables/editor/useNotePersistence';
import { useMarkdownEditor } from '../composables/editor/useMarkdownEditor';

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

// Textarea ref for cursor position on drop
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Obsidian-style embed resolver (must be initialized before useNotePersistence)
const { embedCache, embedCacheVersion, resolveEmbeds, getEmbedMediaType, clearCache: clearEmbedCache } = useEmbedResolver(
  () => props.file,
  () => props.workspacePath
);

// Note persistence: content, save, load, auto-save
const { content, originalContent, hasUnsavedChanges, isSaving, lastLoadedPath, justSaved, onContentChange, saveFile, loadFile, handleDrawingSave, clearAutoSaveTimeout } = useNotePersistence(
  () => props.file,
  () => !!props.file && checkMarkdown(props.file.extension),
  resolveEmbeds,
  (c) => emit('save', c),
  (v) => emit('contentChanged', v)
);

/** Reload the current file's content from disk */
async function reloadContent() {
  if (props.file) {
    await loadFile(props.file);
  }
}

defineExpose({ reloadContent });

// Dictation
const { isDictating, isDictationLoading, toggleDictation, stopDictation } = useDictation(content, onContentChange);

// Check if current file is an image
const isImageFile   = computed(() => !!props.file && checkImage(props.file.extension));
const isVideoFile   = computed(() => !!props.file && checkVideo(props.file.extension));
const isAudioFile   = computed(() => !!props.file && checkAudio(props.file.extension));
const isPdfFile     = computed(() => !!props.file && checkPdf(props.file.extension));
const isCodeFile    = computed(() => !!props.file && checkCode(props.file.extension));
const isMarkdownFile = computed(() => !!props.file && checkMarkdown(props.file.extension));
const isDrawingFile = computed(() => !!props.file && checkDrawing(props.file.extension));

// Check if current file supports dictation (txt or md only)
const isDictatable = computed(() => {
  if (!props.file) return false;
  const ext = props.file.extension.toLowerCase();
  return ext === '.txt' || ext === '.md';
});

// Simple time formatter for markdown embed controls
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Markdown editor: preview state, toolbar, keyboard, preview event handlers
const { showPreview, renderedMarkdown, mdFormatText, mdInsertHeading, onTextareaKeydown, onMarkdownPreviewClick, onMarkdownPreviewInput } = useMarkdownEditor(
  () => isMarkdownFile.value,
  content,
  embedCacheVersion,
  embedCache,
  getEmbedMediaType,
  textareaRef,
  onContentChange,
  formatTime
);

function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

// Watch for file changes
watch(() => props.file, async (newFile) => {
  // If the file path hasn't changed, skip the full reload.
  // This prevents autosave-triggered FS watcher refreshes from overwriting content.
  if (newFile && newFile.path === lastLoadedPath.value) {
    // If we just saved, clear the flag and skip entirely
    if (justSaved.value) {
      justSaved.value = false;
      return;
    }
    // Same file but not our save — could be an external change.
    // Only reload if we have no unsaved changes (don't overwrite user's work).
    if (!hasUnsavedChanges.value) {
      const result = await window.electronAPI.readFile(newFile.path);
      if (result.success && result.content !== undefined && result.content !== content.value) {
        content.value = result.content;
        originalContent.value = result.content;
      }
    }
    return;
  }

  // Different file — do a full load with state reset
  lastLoadedPath.value = newFile?.path || null;

  // Clear embed cache when switching files
  clearEmbedCache();
  
  if (newFile) {
    const ext = newFile.extension.toLowerCase();
    
    if (checkImage(ext) || checkVideo(ext) || checkAudio(ext) || checkPdf(ext)) {
      // Media file: clear text state (sub-components handle their own loading)
      content.value = '';
      originalContent.value = '';
      hasUnsavedChanges.value = false;
    } else {
      // Text file: load content
      await loadFile(newFile);
    }
  } else {
    content.value = '';
    originalContent.value = '';
    hasUnsavedChanges.value = false;
  }
}, { immediate: true });

// Editor drag-and-drop
const { isDragOverEditor, onEditorDragEnter, onEditorDragOver, onEditorDragLeave, onFileDrop } = useEditorDrop(
  isMarkdownFile,
  () => props.file,
  () => props.workspacePath,
  textareaRef,
  showPreview,
  content,
  onContentChange
);

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
}

// Prevent Electron from navigating when files are dropped anywhere on the window
function preventGlobalDrop(event: DragEvent) {
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
  clearAutoSaveTimeout();
  if (isDictating.value) {
    stopDictation();
  }
  window.electronAPI.removeSpeechStatusListener();
  document.removeEventListener('drop', preventGlobalDrop, true);
  document.removeEventListener('dragover', preventGlobalDragOver, true);
  window.removeEventListener('keydown', handleKeyboard);
});
</script>

<template>
  <div class="note-editor">
    <div v-if="file" class="editor-header">
      <div class="file-info">
        <div class="file-title-container">
          <div class="badge-with-toggle">
            <span class="file-extension-badge">{{ file.extension }}</span>
            <button 
              v-if="isMarkdownFile"
              class="preview-toggle"
              :title="showPreview ? 'Edit' : 'Preview'"
              @click="showPreview = !showPreview"
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
          <h2 class="file-title">{{ getFileNameWithoutExtension(file.name) }}</h2>
        </div>
      </div>
      <div class="editor-actions">
        <span v-if="isSaving" class="saving-indicator">Saving...</span>
        <span v-else-if="hasUnsavedChanges" class="unsaved-indicator">Unsaved</span>
      </div>
    </div>
    
    <!-- Media viewers -->
    <ImageViewer v-if="file && isImageFile" :file-path="file.path" :file-name="file.name" />
    <VideoViewer v-else-if="file && isVideoFile" :file-path="file.path" />
    <PdfViewer v-else-if="file && isPdfFile" :file-path="file.path" />
    <AudioViewer v-else-if="file && isAudioFile" :file-path="file.path" />
    
    <!-- Drawing canvas for drawing files -->
    <DrawingCanvas
      v-else-if="file && isDrawingFile"
      :file-path="file.path"
      :initial-content="content"
      @save="handleDrawingSave"
      @content-changed="(hasChanges) => hasUnsavedChanges = hasChanges"
    />

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

      <!-- Markdown formatting toolbar -->
      <div v-if="isMarkdownFile && !showPreview" class="md-toolbar">
        <button class="md-toolbar-btn" title="Bold (⌘B)" @mousedown.prevent="mdFormatText('bold')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Italic (⌘I)" @mousedown.prevent="mdFormatText('italic')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Strikethrough" @mousedown.prevent="mdFormatText('strikethrough')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.1 0 1.4.8 2.3 2.3 3"></path>
            <path d="M4 12h16"></path>
            <path d="M17 16c0 2.3-2 4-5.5 4-2 0-3.7-.4-5.5-1.5"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Highlight (⌘⇧H)" @mousedown.prevent="mdFormatText('highlight')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Inline code" @mousedown.prevent="mdFormatText('code')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>
        <div class="md-toolbar-separator"></div>
        <select class="md-toolbar-select" title="Heading level" @change="mdInsertHeading($event)">
          <option value="" selected disabled>Heading</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
        </select>
        <div class="md-toolbar-separator"></div>
        <button class="md-toolbar-btn" title="Bullet list" @mousedown.prevent="mdFormatText('ul')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Numbered list" @mousedown.prevent="mdFormatText('ol')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="10" y1="6" x2="21" y2="6"></line>
            <line x1="10" y1="12" x2="21" y2="12"></line>
            <line x1="10" y1="18" x2="21" y2="18"></line>
            <path d="M4 6h1v4"></path>
            <path d="M4 10h2"></path>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Checkbox" @mousedown.prevent="mdFormatText('checkbox')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        </button>
        <div class="md-toolbar-separator"></div>
        <button class="md-toolbar-btn" title="Blockquote" @mousedown.prevent="mdFormatText('quote')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 11H6a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 017 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0010 11zM20 11h-4a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 0117 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0020 11z"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Link (⌘K)" @mousedown.prevent="mdFormatText('link')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </button>
        <button class="md-toolbar-btn" title="Horizontal rule" @mousedown.prevent="mdFormatText('hr')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
          </svg>
        </button>
      </div>

      <!-- Edit mode -->
      <textarea
        v-if="!showPreview || !isMarkdownFile"
        ref="textareaRef"
        v-model="content"
        class="editor-textarea"
        :class="{ 'code-editor': isCodeFile }"
        :placeholder="isCodeFile ? 'Start coding...' : 'Start writing...'"
        @input="onContentChange"
        @keydown="onTextareaKeydown"
      ></textarea>
      
      <!-- Preview mode for markdown -->
      <div 
        v-if="showPreview && isMarkdownFile"
        class="markdown-preview-mode"
        @click="onMarkdownPreviewClick"
        @input="onMarkdownPreviewInput"
        v-html="renderedMarkdown"
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
          <img draggable="false" src="../assets/icons/icon.png" alt="Leaf" class="empty-logo-icon" />
          <span class="empty-logo-text">leaf.</span>
        </div>
        <p>Select a note to start editing</p>
        <p class="hint">or create a new one from your notes folder</p>
      </div>
    </div>
  </div>
</template>

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
  max-width: 50%;
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

.md-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--base1) 60%, transparent);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid color-mix(in srgb, var(--text2) 12%, transparent);
  flex-shrink: 0;
  flex-wrap: wrap;
  -webkit-app-region: no-drag;
}

.md-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--text2) 15%, transparent);
    color: var(--text1);
  }

  &:active {
    background: var(--accent-color, #4a9eff);
    color: #fff;
    transform: scale(0.92);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.md-toolbar-separator {
  width: 1px;
  height: 16px;
  background: color-mix(in srgb, var(--text2) 20%, transparent);
  margin: 0 4px;
  flex-shrink: 0;
  border-radius: 1px;
}

.md-toolbar-select {
  height: 26px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--text2) 15%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text2) 8%, transparent);
  color: var(--text1);
  font-size: 11px;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--text2) 30%, transparent);
    background: color-mix(in srgb, var(--text2) 15%, transparent);
  }

  &:focus {
    border-color: var(--accent-color, #4a9eff);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #4a9eff) 20%, transparent);
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
  
  // Collapsible heading sections (Obsidian-style folding)
  :deep(.collapsible-heading) {
    position: relative;
    cursor: default;
    
    .heading-fold-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-right: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      vertical-align: middle;
      border-radius: 3px;
      color: var(--text2);
      
      svg {
        transition: transform 0.2s ease;
        transform: rotate(90deg);
      }
      
      &:hover {
        opacity: 1;
        color: var(--accent-color);
        background: color-mix(in srgb, var(--text2) 10%, transparent);
      }
    }
    
    &:hover .heading-fold-toggle {
      opacity: 0.6;
    }
    
    &.collapsed .heading-fold-toggle {
      opacity: 0.6;
      
      svg {
        transform: rotate(0deg);
      }
    }
  }
  
  :deep(.heading-section-content) {
    &.collapsed {
      display: none;
    }
  }
  
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
        top: 5.5px;
        transition: all 0.15s ease;
        display: inline-block;
        vertical-align: baseline;

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
