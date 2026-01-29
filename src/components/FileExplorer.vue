<template>
  <div class="file-explorer">
    <div class="file-list">
      <div
        v-for="file in sortedFiles"
        :key="file.path"
        class="file-item"
        :class="{ active: selectedFile?.path === file.path }"
        @click="selectFile(file)"
      >
        <div class="file-info">
          <div class="file-name">{{ getFileNameWithoutExtension(file.name) }}</div>
          <div class="file-folder" v-if="file.folder !== '.'">{{ file.folder }}</div>
        </div>
      </div>
      
      <div v-if="files.length === 0" class="empty-state">
        <p>No notes found in this folder.</p>
        <p class="hint">Create .txt, .md, or .rtf files to get started.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FileInfo } from '../types/electron';

const props = defineProps<{
  files: FileInfo[];
  currentFolder: string | null;
  selectedFile: FileInfo | null;
}>();

const emit = defineEmits<{
  selectFile: [file: FileInfo];
}>();

const sortedFiles = computed(() => {
  return [...props.files].sort((a, b) => {
    // Sort by folder first, then by name
    const folderCompare = a.folder.localeCompare(b.folder);
    if (folderCompare !== 0) return folderCompare;
    return a.name.localeCompare(b.name);
  });
});

function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

function selectFile(file: FileInfo) {
  emit('selectFile', file);
}
</script>

<style scoped lang="scss">
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border-left: 2px solid transparent;
  
  &:hover {
    background: var(--bg-hover);
  }
  
  &.active {
    background: var(--bg-hover);
    border-left-color: var(--accent-color);
    
    .file-name {
      color: var(--accent-color);
      font-weight: 500;
    }
  }
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 0.875rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.file-folder {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  
  p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  
  .hint {
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
}
</style>
