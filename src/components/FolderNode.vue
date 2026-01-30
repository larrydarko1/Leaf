<template>
  <div class="tree-node">
    <div
      v-if="node.type === 'folder'"
      class="folder-item"
      :style="{ paddingLeft: (depth * 16 + 10) + 'px' }"
      @click="$emit('selectFolder', node.path)"
    >
      <svg 
        class="chevron" 
        :class="{ expanded: isExpanded }"
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <svg 
        class="folder-icon" 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="folder-name">{{ node.name }}</span>
    </div>

    <div
      v-else
      class="file-item"
      :class="{ active: isSelected, renaming: isRenaming }"
      :style="{ paddingLeft: (depth * 16 + 10) + 'px' }"
      @click="node.file && $emit('selectFile', node.file)"
    >
      <svg 
        class="file-icon" 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <input
        v-if="isRenaming"
        ref="renameInput"
        :value="renameValue"
        @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
        class="file-name-input"
        @keydown.enter="$emit('rename')"
        @keydown.esc="$emit('cancelRename')"
        @blur="$emit('rename')"
        @click.stop
      />
      <span v-else class="file-name">{{ node.name }}</span>
    </div>

    <!-- Recursively render children -->
    <template v-if="node.type === 'folder' && isExpanded && node.children">
      <FolderNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :selected-file="selectedFile"
        :renaming-file="renamingFile"
        :rename-value="renameValue"
        :expanded-folders="expandedFolders"
        @select-file="$emit('selectFile', $event)"
        @select-folder="$emit('selectFolder', $event)"
        @rename="$emit('rename')"
        @cancel-rename="$emit('cancelRename')"
        @update-rename-value="$emit('updateRenameValue', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { FileInfo } from '../types/electron';

export interface TreeNode {
  path: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  file?: FileInfo;
}

const props = defineProps<{
  node: TreeNode;
  depth: number;
  selectedFile: FileInfo | null;
  renamingFile: FileInfo | null;
  renameValue: string;
  expandedFolders: Set<string>;
}>();

defineEmits<{
  selectFile: [file: FileInfo];
  selectFolder: [path: string];
  rename: [];
  cancelRename: [];
  updateRenameValue: [value: string];
}>();

const renameInput = ref<HTMLInputElement | null>(null);

const isExpanded = computed(() => {
  return props.node.type === 'folder' && props.expandedFolders.has(props.node.path);
});

const isRenaming = computed(() => {
  return props.node.type === 'file' && 
         props.renamingFile?.path === props.node.file?.path;
});

const isSelected = computed(() => {
  return props.node.type === 'file' && 
         props.selectedFile?.path === props.node.file?.path;
});

watch(isRenaming, (renaming) => {
  if (renaming) {
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
.tree-node {
  user-select: none;
}

.folder-item,
.file-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem 0.5rem 0;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 5px;
  margin: 1px 0;
  gap: 0.4rem;
  
  &:hover {
    background: var(--base1);
    margin-left: 10px;
  }
}

.folder-item {
  color: var(--text1);
  font-size: 0.875rem;
  font-weight: 500;

  .chevron {
    flex-shrink: 0;
    color: var(--text2);
    transition: transform 0.2s ease;
    margin-left: 0.125rem;
    
    &.expanded {
      transform: rotate(90deg);
    }
  }

  .folder-icon {
    flex-shrink: 0;
    color: var(--text2);
    opacity: 0.8;
  }

  .folder-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.file-item {
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

  .file-icon {
    flex-shrink: 0;
    color: var(--text2);
    opacity: 0.7;
    margin-left: 1.75rem; // Align with folder content
  }
}

.file-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.file-name-input {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text1);
  background: var(--base4);
  border: none;
  border-radius: 5px;
  padding: 0.15rem 0.35rem;
  outline: none;
  font-family: inherit;
  font-weight: 500;
  line-height: 1.4;
  transition: background 0.15s ease;
  
  &:focus {
    background: var(--base3);
  }
}
</style>
