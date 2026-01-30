<template>
  <div class="file-explorer">
    <div class="file-list">
      <div
        v-for="file in sortedFiles"
        :key="file.path"
        class="file-item"
        :class="{ active: selectedFile?.path === file.path, renaming: renamingFile?.path === file.path }"
        @click="selectFile(file)"
      >
        <div class="file-info">
          <input
            v-if="renamingFile?.path === file.path"
            ref="renameInput"
            v-model="renameValue"
            class="file-name-input"
            @keydown.enter="confirmRename"
            @keydown.esc="cancelRename"
            @blur="confirmRename"
            @click.stop
          />
          <div v-else class="file-name">{{ getFileNameWithoutExtension(file.name) }}</div>
          <div class="file-folder" v-if="file.folder !== '.'">{{ file.folder }}</div>
        </div>
      </div>
      
      <div v-if="files.length === 0" class="empty-state">
        <p>No notes found.</p>
        <p class="hint">Create .txt, .md, or .rtf files to get started.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue';
import type { FileInfo } from '../types/electron';

const props = defineProps<{
  files: FileInfo[];
  currentFolder: string | null;
  selectedFile: FileInfo | null;
  renamingFile: FileInfo | null;
}>();

const emit = defineEmits<{
  selectFile: [file: FileInfo];
  rename: [file: FileInfo, newName: string];
  cancelRename: [];
}>();

const renameInput = ref<HTMLInputElement | null>(null);
const renameValue = ref('');

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
  if (!props.renamingFile) {
    emit('selectFile', file);
  }
}

function confirmRename() {
  if (props.renamingFile && renameValue.value.trim() !== '') {
    const currentName = getFileNameWithoutExtension(props.renamingFile.name);
    if (renameValue.value.trim() !== currentName) {
      emit('rename', props.renamingFile, renameValue.value.trim());
    } else {
      emit('cancelRename');
    }
  } else {
    emit('cancelRename');
  }
}

function cancelRename() {
  emit('cancelRename');
}

// Watch for renaming file changes and focus input
watch(() => props.renamingFile, (newRenamingFile) => {
  if (newRenamingFile) {
    const fileName = getFileNameWithoutExtension(newRenamingFile.name);
    renameValue.value = fileName;
    nextTick(() => {
      if (renameInput.value) {
        renameInput.value.focus();
        renameInput.value.select();
      }
    });
  }
});
</script>

<style scoped lang="scss">
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--base3);
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.625rem 1rem;
  margin-bottom: 0.125rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 5px;
  
  &:hover {
    background: var(--base1);
    margin-left: 10px;
  }
  
  &.active {
    background: var(--base1);
    margin-left: 10px;
    
    .file-name {
      color: var(--base2);
      font-weight: 500;
    }
  }
  
  &.renaming {
    cursor: default;
  }
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 0.875rem;
  color: var(--text1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.file-name-input {
  font-size: 0.875rem;
  color: var(--text1);
  background: var(--base4);
  border: none;
  border-radius: 5px;
  padding: 0.15rem 0.35rem;
  width: 100%;
  outline: none;
  font-family: inherit;
  font-weight: 500;
  line-height: 1.4;
  transition: border-color 0.15s ease;
  
  &:focus {
    background: var(--base3);
  }
}

.file-folder {
  font-size: 0.7rem;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text2);
  
  p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  
  .hint {
    font-size: 0.8rem;
    color: var(--text2);
  }
}
</style>
