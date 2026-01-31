<template>
  <div class="tree-node">
    <div
      v-if="node.type === 'folder'"
      class="folder-item"
      :class="{ active: isSelected, renaming: isRenaming, 'drag-over': isDragOver, 'is-dragging': isDragging }"
      :style="{ paddingLeft: (depth * 16 + 10) + 'px' }"
      draggable="true"
      @click="handleFolderClick"
      @contextmenu.prevent="$emit('contextMenu', 'folder', node.path, $event)"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
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
        @click.stop="$emit('toggleFolder', node.path)"
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
      <input
        v-if="isRenaming"
        ref="renameInput"
        :value="renameValue"
        @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
        class="folder-name-input"
        @keydown.enter="$emit('rename')"
        @keydown.esc="$emit('cancelRename')"
        @blur="$emit('rename')"
        @click.stop
      />
      <span v-else class="folder-name">{{ node.name }}</span>
    </div>

    <div
      v-else
      class="file-item"
      :class="{ active: isSelected, renaming: isRenaming, 'is-dragging': isDragging }"
      :style="{ paddingLeft: (depth * 16 + 10) + 'px' }"
      draggable="true"
      @click="node.file && $emit('selectFile', node.file)"
      @contextmenu.prevent="node.file && $emit('contextMenu', 'file', node.file.path, $event)"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <!-- Image icon for image files -->
      <svg 
        v-if="isImageFile"
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
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <!-- Video icon for video files -->
      <svg 
        v-else-if="isVideoFile"
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
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
      <!-- Code icon for code files -->
      <svg 
        v-else-if="isCodeFile"
        class="file-icon code-icon" 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      <!-- Document icon for text files -->
      <svg 
        v-else
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
        :selected-folder="selectedFolder"
        :renaming-folder="renamingFolder"
        :rename-value="renameValue"
        :expanded-folders="expandedFolders"
        @select-file="$emit('selectFile', $event)"
        @select-folder="$emit('selectFolder', $event)"
        @toggle-folder="$emit('toggleFolder', $event)"
        @rename="$emit('rename')"
        @cancel-rename="$emit('cancelRename')"
        @update-rename-value="$emit('updateRenameValue', $event)"
        @context-menu="(type: 'file' | 'folder', path: string, event: MouseEvent) => $emit('contextMenu', type, path, event)"
        @move-file="(filePath: string, targetFolderPath: string) => $emit('moveFile', filePath, targetFolderPath)"
        @move-folder="(folderPath: string, targetFolderPath: string) => $emit('moveFolder', folderPath, targetFolderPath)"
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
  selectedFolder: string | null;
  renamingFolder: string | null;
  renameValue: string;
  expandedFolders: Set<string>;
}>();

const emit = defineEmits<{
  selectFile: [file: FileInfo];
  selectFolder: [path: string];
  toggleFolder: [path: string];
  rename: [];
  cancelRename: [];
  updateRenameValue: [value: string];
  contextMenu: [type: 'file' | 'folder', path: string, event: MouseEvent];
  moveFile: [filePath: string, targetFolderPath: string];
  moveFolder: [folderPath: string, targetFolderPath: string];
}>();

const renameInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const isDragOver = ref(false);

// Image file extensions
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

// Video file extensions
const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

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

const isImageFile = computed(() => {
  if (props.node.type !== 'file' || !props.node.file) return false;
  return imageExtensions.includes(props.node.file.extension.toLowerCase());
});

const isVideoFile = computed(() => {
  if (props.node.type !== 'file' || !props.node.file) return false;
  return videoExtensions.includes(props.node.file.extension.toLowerCase());
});

const isCodeFile = computed(() => {
  if (props.node.type !== 'file' || !props.node.file) return false;
  return codeExtensions.includes(props.node.file.extension.toLowerCase());
});

const isExpanded = computed(() => {
  return props.node.type === 'folder' && props.expandedFolders.has(props.node.path);
});

const isRenaming = computed(() => {
  if (props.node.type === 'file') {
    return props.renamingFile?.path === props.node.file?.path;
  } else if (props.node.type === 'folder') {
    return props.renamingFolder === props.node.path;
  }
  return false;
});

const isSelected = computed(() => {
  if (props.node.type === 'file') {
    return props.selectedFile?.path === props.node.file?.path;
  } else if (props.node.type === 'folder') {
    return props.selectedFolder === props.node.path;
  }
  return false;
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

function handleFolderClick() {
  // Single click selects the folder
  emit('selectFolder', props.node.path);
}

function handleDragStart(event: DragEvent) {
  isDragging.value = true;
  event.dataTransfer!.effectAllowed = 'move';
  
  if (props.node.type === 'file' && props.node.file) {
    // Set data with type prefix for files
    event.dataTransfer!.setData('text/plain', 'file:' + props.node.file.path);
  } else if (props.node.type === 'folder') {
    // Set data with type prefix for folders
    event.dataTransfer!.setData('text/plain', 'folder:' + props.node.path);
  }
  
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleDragEnd() {
  isDragging.value = false;
}

function handleDragOver(event: DragEvent) {
  if (props.node.type === 'folder') {
    event.preventDefault();
    isDragOver.value = true;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false;
  
  if (props.node.type === 'folder') {
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      if (data.startsWith('file:')) {
        const filePath = data.substring(5);
        // Don't allow moving to the same folder the file is already in
        const file = props.selectedFile;
        if (file && file.path === filePath && file.folder === props.node.path) {
          return;
        }
        emit('moveFile', filePath, props.node.path);
      } else if (data.startsWith('folder:')) {
        const folderPath = data.substring(7);
        // Don't allow moving a folder into itself or if it's the same folder
        if (folderPath === props.node.path || props.node.path.startsWith(folderPath + '/')) {
          return;
        }
        emit('moveFolder', folderPath, props.node.path);
      }
    }
  }
}
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
    margin: 1px 10px 1px 10px;
  }
}

.folder-item {
  color: var(--text1);
  font-size: 0.875rem;
  font-weight: 500;

  &.active {
    background: var(--base1);
    margin: 1px 10px 1px 10px;
    
    .folder-name {
      color: var(--base2);
      font-weight: 500;
    }
  }
  
  &.renaming {
    cursor: default;
  }

  &.is-dragging {
    opacity: 0.5;
    cursor: move;
  }

  &.drag-over {
    background: var(--base2) !important;
    border: 2px dashed var(--text2);
    margin: 1px 10px 1px 10px;
  }

  .chevron {
    flex-shrink: 0;
    color: var(--text2);
    transition: transform 0.2s ease;
    margin-left: 0.125rem;
    cursor: pointer;
    
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
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .folder-name-input {
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
}

.file-item {
  &.active {
    background: var(--base1);
    margin: 1px 10px 1px 10px;
    
    .file-name {
      color: var(--base2);
      font-weight: 500;
    }
  }
  
  &.renaming {
    cursor: default;
  }

  &.is-dragging {
    opacity: 0.5;
    cursor: move;
  }

  .file-icon {
    flex-shrink: 0;
    color: var(--text2);
    opacity: 0.7;
    margin: 1px 10px 1px 10px;
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
