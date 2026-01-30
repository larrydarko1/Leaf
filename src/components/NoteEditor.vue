<template>
  <div class="note-editor">
    <div class="editor-header" v-if="file">
      <div class="file-info">
        <div class="file-title-container">
          <h2 class="file-title">{{ getFileNameWithoutExtension(file.name) }}</h2>
          <span class="file-extension-badge">{{ file.extension }}</span>
        </div>
      </div>
      <div class="editor-actions">
        <span v-if="isSaving" class="saving-indicator">Saving...</span>
        <span v-else-if="hasUnsavedChanges" class="unsaved-indicator">Unsaved</span>
      </div>
    </div>
    
    <textarea
      v-if="file"
      v-model="content"
      class="editor-textarea"
      :placeholder="'Start writing...'"
      @input="onContentChange"
    ></textarea>
    
    <div v-else class="editor-empty">
      <div class="empty-message">
        <p>Select a note to start editing</p>
        <p class="hint">or create a new one from your notes folder</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import type { FileInfo } from '../types/electron';

const props = defineProps<{
  file: FileInfo | null;
}>();

const emit = defineEmits<{
  save: [content: string];
  contentChanged: [hasChanges: boolean];
}>();

const content = ref('');
const originalContent = ref('');
const hasUnsavedChanges = ref(false);
const isSaving = ref(false);
let autoSaveTimeout: number | null = null;

function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

// Watch for file changes
watch(() => props.file, async (newFile) => {
  if (newFile) {
    await loadFile(newFile);
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
    } else {
      console.error('Failed to read file:', result.error);
    }
  } catch (error) {
    console.error('Error loading file:', error);
  }
}

function onContentChange() {
  hasUnsavedChanges.value = content.value !== originalContent.value;
  emit('contentChanged', hasUnsavedChanges.value);
  
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Set new timeout for auto-save (7 seconds after user stops typing)
  if (hasUnsavedChanges.value) {
    autoSaveTimeout = window.setTimeout(() => {
      saveFile();
    }, 3000);
  }
}

async function saveFile() {
  if (!props.file || !hasUnsavedChanges.value || isSaving.value) return;
  
  isSaving.value = true;
  
  try {
    const result = await window.electronAPI.writeFile(props.file.path, content.value);
    if (result.success) {
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

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
}

// Add keyboard listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyboard);
}

// Cleanup
onUnmounted(() => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
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
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-message {
  text-align: center;
  color: var(--text2);
  
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
