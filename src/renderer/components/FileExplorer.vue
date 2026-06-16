<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import type { FileInfo, FolderInfo } from '../types/electron';
import FolderNode from './FolderNode.vue';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';
import { useFolderTree } from '../composables/vault/useFolderTree';

const props = defineProps<{
    files: FileInfo[];
    folders?: FolderInfo[];
    currentFolder: string | null;
    selectedFiles: FileInfo[];
    activeFile: FileInfo | null;
    renamingFile: FileInfo | null;
    selectedFolder: string | null;
    renamingFolder: string | null;
    bookmarkedFiles?: string[];
}>();

const emit = defineEmits<{
    selectFile: [file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]];
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
    toggleBookmark: [filePath: string];
}>();

const renameValue = ref('');
const isDragOverRoot = ref(false);

const { expandedFolders, folderTree, flattenedItems, visibleFiles, toggleFolder, getFileNameWithoutExtension } =
    useFolderTree(
        () => props.files,
        () => props.folders,
        () => props.currentFolder,
    );

// Context menu state
const contextMenu = ref({
    visible: false,
    position: { x: 0, y: 0 },
    type: '' as 'file' | 'folder',
    targetPath: '',
});

const contextMenuItems = computed<ContextMenuItem[]>(() => {
    if (contextMenu.value.type === 'folder') {
        return [
            { label: 'Rename', action: 'rename', shortcut: 'F2' },
            { label: 'Delete', action: 'delete' },
        ];
    } else {
        // Check if file is bookmarked
        const isBookmarked = props.bookmarkedFiles?.includes(contextMenu.value.targetPath) ?? false;
        return [
            { label: isBookmarked ? 'Remove from Bookmarks' : 'Add to Bookmarks', action: 'bookmark' },
            { label: 'Rename', action: 'rename', shortcut: 'F2' },
            { label: 'Delete', action: 'delete' },
        ];
    }
});

// Watch for renaming file changes
watch(
    () => props.renamingFile,
    (newRenamingFile) => {
        if (newRenamingFile !== null) {
            renameValue.value = getFileNameWithoutExtension(newRenamingFile.name);
        }
    },
);

// Watch for renaming folder changes
watch(
    () => props.renamingFolder,
    (newRenamingFolder) => {
        if (newRenamingFolder !== null && newRenamingFolder !== '') {
            renameValue.value = newRenamingFolder.split('/').pop() ?? newRenamingFolder;
        }
    },
);

// Set up keyboard listeners
onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});

// Keyboard navigation handler
function handleKeyDown(e: KeyboardEvent) {
    // Don't navigate if we're renaming
    if (props.renamingFile !== null || (props.renamingFolder !== null && props.renamingFolder !== '')) return;

    // Don't intercept arrow keys when focus is inside an editable element (e.g. the note editor)
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        return;
    }

    // Only handle arrow keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    e.preventDefault();

    // Handle left/right for folder expand/collapse
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (props.selectedFolder !== null && props.selectedFolder !== '') {
            const isExpanded = expandedFolders.value.has(props.selectedFolder);
            if (e.key === 'ArrowRight' && !isExpanded) {
                // Expand folder
                expandedFolders.value.add(props.selectedFolder);
                expandedFolders.value = new Set(expandedFolders.value);
            } else if (e.key === 'ArrowLeft' && isExpanded) {
                // Collapse folder
                expandedFolders.value.delete(props.selectedFolder);
                expandedFolders.value = new Set(expandedFolders.value);
            }
        }
        return;
    }

    const items = flattenedItems.value;
    if (items.length === 0) return;

    // Find current index — check selectedFolder first because editorTabs.activeFile
    // remains set even after folder selection, so activeFile alone can't be trusted.
    let currentIndex = -1;
    if (props.selectedFolder !== null && props.selectedFolder !== '') {
        const idx = items.findIndex((item) => item.type === 'folder' && item.folderPath === props.selectedFolder);
        if (idx !== -1) currentIndex = idx;
    }
    if (currentIndex === -1 && props.activeFile !== null) {
        currentIndex = items.findIndex((item) => item.type === 'file' && item.file?.path === props.activeFile?.path);
    }

    // Calculate new index
    let newIndex: number;
    if (e.key === 'ArrowDown') {
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }

    // Select the new item
    const newItem = items[newIndex];
    if (newItem.type === 'file' && newItem.file !== null && newItem.file !== undefined) {
        emit('selectFile', newItem.file);
    } else if (
        newItem.type === 'folder' &&
        newItem.folderPath !== null &&
        newItem.folderPath !== undefined &&
        newItem.folderPath !== ''
    ) {
        emit('selectFolder', newItem.folderPath);
    }
}

function selectFile(file: FileInfo, event?: MouseEvent) {
    if (props.renamingFile === null && (props.renamingFolder === null || props.renamingFolder === '')) {
        emit('selectFile', file, event, visibleFiles.value);
    }
}

function selectFolder(folderPath: string) {
    if (props.renamingFile === null && (props.renamingFolder === null || props.renamingFolder === '')) {
        emit('selectFolder', folderPath);
    }
}

function handleContextMenu(type: 'file' | 'folder', path: string, event: MouseEvent) {
    contextMenu.value = {
        visible: true,
        position: { x: event.clientX, y: event.clientY },
        type,
        targetPath: path,
    };
}

function closeContextMenu() {
    contextMenu.value.visible = false;
}

function handleContextMenuAction(action: string) {
    const { type, targetPath } = contextMenu.value;

    if (action === 'bookmark') {
        if (type === 'file') {
            emit('toggleBookmark', targetPath);
        }
    } else if (action === 'rename') {
        if (type === 'folder') {
            emit('startRenameFolder', targetPath);
        } else if (type === 'file') {
            const file = props.files.find((f) => f.path === targetPath);
            if (file !== undefined) {
                emit('startRenameFile', file);
            }
        }
    } else if (action === 'delete') {
        if (type === 'folder') {
            emit('deleteFolder', targetPath);
        } else if (type === 'file') {
            const file = props.files.find((f) => f.path === targetPath);
            if (file !== undefined) {
                emit('deleteFile', file);
            }
        }
    }

    closeContextMenu();
}

function confirmRename() {
    if (props.renamingFile !== null && renameValue.value.trim() !== '') {
        const currentName = getFileNameWithoutExtension(props.renamingFile.name);
        if (renameValue.value.trim() !== currentName) {
            emit('renameFile', props.renamingFile, renameValue.value.trim());
        } else {
            emit('cancelRename');
        }
    } else if (props.renamingFolder !== null && props.renamingFolder !== '' && renameValue.value.trim() !== '') {
        const currentName = props.renamingFolder.split('/').pop() ?? props.renamingFolder;
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
    if (event.dataTransfer !== null) {
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
    if (data !== undefined && data !== '') {
        if (data.startsWith('file:')) {
            const filePath = data.substring(5);
            emit('moveFile', filePath, '.');
        } else if (data.startsWith('folder:')) {
            const folderPath = data.substring(7);
            emit('moveFolder', folderPath, '.');
        }
    }
}
</script>

<template>
    <div class="file-explorer">
        <div
            class="file-list"
            :class="{ 'drag-over-root': isDragOverRoot }"
            @dragover.prevent="handleRootDragOver"
            @dragleave="handleRootDragLeave"
            @drop.prevent="handleRootDrop">
            <!-- Recursive folder tree component -->
            <FolderNode
                v-for="node in folderTree"
                :key="node.path"
                :node="node"
                :depth="0"
                :selected-files="selectedFiles"
                :active-file="activeFile"
                :renaming-file="renamingFile"
                :selected-folder="selectedFolder"
                :renaming-folder="renamingFolder"
                :rename-value="renameValue"
                :expanded-folders="expandedFolders"
                :bookmarked-files="bookmarkedFiles"
                @select-file="selectFile"
                @select-folder="selectFolder"
                @toggle-folder="toggleFolder"
                @rename="confirmRename"
                @cancel-rename="cancelRename"
                @update-rename-value="renameValue = $event"
                @context-menu="handleContextMenu"
                @move-file="handleMoveFile"
                @move-folder="handleMoveFolder" />

            <div
                v-if="files.length === 0"
                class="empty-state">
                <p>No files found.</p>
                <p class="hint">Add text, code, or media files to get started.</p>
            </div>
        </div>

        <!-- Context Menu -->
        <ContextMenu
            :visible="contextMenu.visible"
            :position="contextMenu.position"
            :items="contextMenuItems"
            @close="closeContextMenu"
            @action="handleContextMenuAction" />
    </div>
</template>

<style scoped lang="scss">
/* ––– File Explorer ––– */

.file-explorer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: $bg-secondary;
    overflow: hidden;
}

/* ––– File List ––– */

.file-list {
    flex: 1;
    overflow-y: auto;
    padding: $space-1 0;

    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: $border-radius-xs;
        transition: background $transition-base;
    }

    &:hover::-webkit-scrollbar-thumb {
        background: $scrollbar-thumb;
    }

    &:hover::-webkit-scrollbar-thumb:hover {
        background: $scrollbar-thumb-hover;
    }

    &.drag-over-root {
        background: $bg-hover;
        outline: 2px dashed $text2;
        outline-offset: -4px;
    }
}

/* ––– Empty State ––– */

.empty-state {
    padding: $space-8 $space-4;
    text-align: center;
    color: $text2;

    p {
        margin: $space-2 0;
        font-size: $font-size-base;
    }

    .hint {
        font-size: $font-size-sm;
        color: $text2;
    }
}
</style>
