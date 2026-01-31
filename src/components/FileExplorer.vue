<template>
  <div class="file-explorer">
    <div 
      class="file-list"
      :class="{ 'drag-over-root': isDragOverRoot }"
      @dragover.prevent="handleRootDragOver"
      @dragleave="handleRootDragLeave"
      @drop.prevent="handleRootDrop"
    >
      <!-- Recursive folder tree component -->
      <FolderNode
        v-for="node in folderTree"
        :key="node.path"
        :node="node"
        :depth="0"
        :selected-file="selectedFile"
        :renaming-file="renamingFile"
        :selected-folder="selectedFolder"
        :renaming-folder="renamingFolder"
        :rename-value="renameValue"
        :expanded-folders="expandedFolders"
        @select-file="selectFile"
        @select-folder="selectFolder"
        @toggle-folder="toggleFolder"
        @rename="confirmRename"
        @cancel-rename="cancelRename"
        @update-rename-value="renameValue = $event"
        @context-menu="handleContextMenu"
        @move-file="handleMoveFile"
        @move-folder="handleMoveFolder"
      />
      
      <div v-if="files.length === 0" class="empty-state">
        <p>No notes found.</p>
        <p class="hint">Create .txt or .md files to get started.</p>
      </div>
    </div>
    
    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :position="contextMenu.position"
      :items="contextMenuItems"
      @close="closeContextMenu"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FileInfo, FolderInfo } from '../types/electron';
import FolderNode, { type TreeNode } from './FolderNode.vue';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';

const props = defineProps<{
  files: FileInfo[];
  folders?: FolderInfo[];
  currentFolder: string | null;
  selectedFile: FileInfo | null;
  renamingFile: FileInfo | null;
  selectedFolder: string | null;
  renamingFolder: string | null;
}>();

const emit = defineEmits<{
  selectFile: [file: FileInfo];
  selectFolder: [path: string];
  renameFile: [file: FileInfo, newName: string];
  renameFolder: [path: string, newName: string];
  deleteFile: [file: FileInfo];
  deleteFolder: [path: string];
  cancelRename: [];
  startRenameFile: [file: FileInfo];
  startRenameFolder: [path: string];
  moveFile: [filePath: string, targetFolderPath: string];
  moveFolder: [folderPath: string, targetFolderPath: string];
}>();

const renameValue = ref('');
const expandedFolders = ref<Set<string>>(new Set());
const isDragOverRoot = ref(false);

// Context menu state
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  type: '' as 'file' | 'folder',
  targetPath: ''
});

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  if (contextMenu.value.type === 'folder') {
    return [
      { label: 'Rename', action: 'rename', shortcut: 'F2' },
      { label: 'Delete', action: 'delete' }
    ];
  } else {
    return [
      { label: 'Rename', action: 'rename', shortcut: 'F2' },
      { label: 'Delete', action: 'delete' }
    ];
  }
});

// Build a folder tree from flat file list
const folderTree = computed(() => {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  // First pass: create folder nodes from explicit folders list
  if (props.folders) {
    props.folders.forEach(folder => {
      if (!folderMap.has(folder.relativePath)) {
        const folderNode: TreeNode = {
          path: folder.relativePath,
          name: folder.name,
          type: 'folder',
          children: []
        };
        folderMap.set(folder.relativePath, folderNode);
      }
    });
  }

  // Second pass: create folder nodes from file paths (for backwards compatibility)
  props.files.forEach(file => {
    if (file.folder === '.') return;
    
    const parts = file.folder.split(/[/\\]/);
    let currentPath = '';
    
    parts.forEach((part) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!folderMap.has(currentPath)) {
        const folderNode: TreeNode = {
          path: currentPath,
          name: part,
          type: 'folder',
          children: []
        };
        folderMap.set(currentPath, folderNode);
      }
    });
  });

  // Third pass: build the tree hierarchy
  folderMap.forEach((node, path) => {
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    if (parentPath === '' || !parentPath) {
      // Top-level folder
      root.push(node);
    } else {
      // Nested folder - add to parent
      const parent = folderMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  });

  // Fourth pass: add files to their folders and root
  props.files.forEach(file => {
    const fileNode: TreeNode = {
      path: file.path,
      name: getFileNameWithoutExtension(file.name),
      type: 'file',
      file
    };

    if (file.folder === '.') {
      // Add to root
      root.push(fileNode);
    } else {
      // Add to folder
      const parent = folderMap.get(file.folder);
      if (parent && parent.children) {
        parent.children.push(fileNode);
      }
    }
  });

  // Sort everything
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root);
  return root;
});

function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

function selectFile(file: FileInfo) {
  if (!props.renamingFile && !props.renamingFolder) {
    emit('selectFile', file);
  }
}

function selectFolder(folderPath: string) {
  if (!props.renamingFile && !props.renamingFolder) {
    emit('selectFolder', folderPath);
  }
}

function toggleFolder(folderPath: string) {
  if (expandedFolders.value.has(folderPath)) {
    expandedFolders.value.delete(folderPath);
  } else {
    expandedFolders.value.add(folderPath);
  }
  // Trigger reactivity
  expandedFolders.value = new Set(expandedFolders.value);
}

function handleContextMenu(type: 'file' | 'folder', path: string, event: MouseEvent) {
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    type,
    targetPath: path
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function handleContextMenuAction(action: string) {
  const { type, targetPath } = contextMenu.value;
  
  if (action === 'rename') {
    if (type === 'folder') {
      emit('startRenameFolder', targetPath);
    } else if (type === 'file') {
      const file = props.files.find(f => f.path === targetPath);
      if (file) {
        emit('startRenameFile', file);
      }
    }
  } else if (action === 'delete') {
    if (type === 'folder') {
      if (confirm(`Are you sure you want to delete this folder and all its contents?`)) {
        emit('deleteFolder', targetPath);
      }
    } else if (type === 'file') {
      const file = props.files.find(f => f.path === targetPath);
      if (file && confirm(`Are you sure you want to delete "${file.name}"?`)) {
        emit('deleteFile', file);
      }
    }
  }
}

function confirmRename() {
  if (props.renamingFile && renameValue.value.trim() !== '') {
    const currentName = getFileNameWithoutExtension(props.renamingFile.name);
    if (renameValue.value.trim() !== currentName) {
      emit('renameFile', props.renamingFile, renameValue.value.trim());
    } else {
      emit('cancelRename');
    }
  } else if (props.renamingFolder && renameValue.value.trim() !== '') {
    const currentName = props.renamingFolder.split('/').pop() || props.renamingFolder;
    if (renameValue.value.trim() !== currentName) {
      emit('renameFolder', props.renamingFolder, renameValue.value.trim());
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

function handleMoveFile(filePath: string, targetFolderPath: string) {
  emit('moveFile', filePath, targetFolderPath);
}

function handleMoveFolder(folderPath: string, targetFolderPath: string) {
  emit('moveFolder', folderPath, targetFolderPath);
}

function handleRootDragOver(event: DragEvent) {
  event.preventDefault();
  isDragOverRoot.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleRootDragLeave(event: DragEvent) {
  // Only set to false if we're leaving the root container entirely
  const target = event.target as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement;
  
  if (!target.contains(relatedTarget)) {
    isDragOverRoot.value = false;
  }
}

function handleRootDrop(event: DragEvent) {
  isDragOverRoot.value = false;
  
  const data = event.dataTransfer?.getData('text/plain');
  if (data) {
    if (data.startsWith('file:')) {
      const filePath = data.substring(5);
      emit('moveFile', filePath, '.');
    } else if (data.startsWith('folder:')) {
      const folderPath = data.substring(7);
      emit('moveFolder', folderPath, '.');
    }
  }
}

// Watch for renaming file changes
watch(() => props.renamingFile, (newRenamingFile) => {
  if (newRenamingFile) {
    const fileName = getFileNameWithoutExtension(newRenamingFile.name);
    renameValue.value = fileName;
  }
});

// Watch for renaming folder changes
watch(() => props.renamingFolder, (newRenamingFolder) => {
  if (newRenamingFolder) {
    const folderName = newRenamingFolder.split('/').pop() || newRenamingFolder;
    renameValue.value = folderName;
  }
});

// Helper to get all folder paths from files and explicit folders
const allFolderPaths = computed(() => {
  const paths = new Set<string>();
  
  // Add explicit folders
  if (props.folders) {
    props.folders.forEach(folder => {
      paths.add(folder.relativePath);
    });
  }
  
  // Add folders from file paths
  props.files.forEach(file => {
    if (file.folder === '.') return;
    const parts = file.folder.split(/[/\\]/);
    let currentPath = '';
    parts.forEach(part => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      paths.add(currentPath);
    });
  });
  
  return paths;
});

// Load expanded folders from localStorage
watch(() => props.currentFolder, (newFolder) => {
  if (newFolder) {
    const saved = localStorage.getItem(`leaf-expanded-folders-${newFolder}`);
    if (saved) {
      try {
        expandedFolders.value = new Set(JSON.parse(saved));
      } catch (e) {
        // If parse fails, expand all by default
        expandedFolders.value = new Set(allFolderPaths.value);
      }
    } else {
      // By default, expand all folders
      expandedFolders.value = new Set(allFolderPaths.value);
    }
  }
}, { immediate: true });

// Save expanded folders to localStorage
watch(expandedFolders, (newExpanded) => {
  if (props.currentFolder) {
    localStorage.setItem(
      `leaf-expanded-folders-${props.currentFolder}`,
      JSON.stringify(Array.from(newExpanded))
    );
  }
}, { deep: true });
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
  
  &.drag-over-root {
    background: var(--base1);
    outline: 2px dashed var(--text2);
    outline-offset: -4px;
  }
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

// Scrollbar styling
.file-list::-webkit-scrollbar {
  width: 8px;
}

.file-list::-webkit-scrollbar-track {
  background: transparent;
}

.file-list::-webkit-scrollbar-thumb {
  background: var(--text2);
  border-radius: 4px;
  opacity: 0.3;
  
  &:hover {
    background: var(--text1);
    opacity: 0.5;
  }
}
</style>
