<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { FileInfo } from '../types/electron';
import {
    isImageFile as checkImage,
    isVideoFile as checkVideo,
    isAudioFile as checkAudio,
    isPdfFile as checkPdf,
    isDrawingFile as checkDrawing,
    isCodeFile as checkCode,
} from '../utils/fileTypes';
import { useTreeNodeDrag } from '../composables/vault/useTreeNodeDrag';

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
    selectedFiles: FileInfo[];
    activeFile: FileInfo | null;
    renamingFile: FileInfo | null;
    selectedFolder: string | null;
    renamingFolder: string | null;
    renameValue: string;
    expandedFolders: Set<string>;
    bookmarkedFiles?: string[];
}>();

const emit = defineEmits<{
    selectFile: [file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]];
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

const { isDragging, isDragOver, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useTreeNodeDrag(
        () => props.node,
        () => props.activeFile,
        (filePath, target) => emit('moveFile', filePath, target),
        (folderPath, target) => emit('moveFolder', folderPath, target),
    );

const isImageFile = computed(() => props.node.type === 'file' && checkImage(props.node.file?.extension ?? ''));
const isVideoFile = computed(() => props.node.type === 'file' && checkVideo(props.node.file?.extension ?? ''));
const isAudioFile = computed(() => props.node.type === 'file' && checkAudio(props.node.file?.extension ?? ''));
const isPdfFile = computed(() => props.node.type === 'file' && checkPdf(props.node.file?.extension ?? ''));
const isDrawingFile = computed(() => props.node.type === 'file' && checkDrawing(props.node.file?.extension ?? ''));
const isCodeFile = computed(() => props.node.type === 'file' && checkCode(props.node.file?.extension ?? ''));

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
        return props.selectedFiles.some((f) => f.path === props.node.file?.path);
    } else if (props.node.type === 'folder') {
        return props.selectedFolder === props.node.path;
    }
    return false;
});

const isActive = computed(() => {
    if (props.node.type === 'file') {
        return props.activeFile?.path === props.node.file?.path;
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

function handleFileClick(event: MouseEvent) {
    if (props.node.file) {
        emit('selectFile', props.node.file, event, undefined);
    }
}
</script>

<template>
    <div class="tree-node">
        <div
            v-if="node.type === 'folder'"
            class="folder-item"
            :class="{ active: isSelected, renaming: isRenaming, 'drag-over': isDragOver, 'is-dragging': isDragging }"
            :style="{ paddingLeft: depth * 16 + 10 + 'px' }"
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
            <!-- Closed folder icon -->
            <svg
                v-if="!isExpanded"
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
            <!-- Open folder icon -->
            <svg
                v-else
                class="folder-icon folder-icon-open"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h9a2 2 0 0 1 2 2v1"></path>
                <path d="M5 11h15a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2L3 13a2 2 0 0 1 2-2z"></path>
            </svg>
            <input
                v-if="isRenaming"
                ref="renameInput"
                :value="renameValue"
                class="folder-name-input"
                @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
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
            :class="{
                selected: isSelected,
                active: isActive,
                renaming: isRenaming,
                'is-dragging': isDragging,
                'media-image': isImageFile,
                'media-video': isVideoFile,
                'media-audio': isAudioFile,
                'media-pdf': isPdfFile,
                'media-drawing': isDrawingFile,
            }"
            :style="{ paddingLeft: depth * 16 + 10 + 'px' }"
            draggable="true"
            @click="handleFileClick"
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
            <!-- Audio icon for audio files -->
            <svg
                v-else-if="isAudioFile"
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
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
            <!-- PDF icon for PDF files -->
            <svg
                v-else-if="isPdfFile"
                class="file-icon pdf-icon"
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
                <path d="M10 12h4"></path>
                <path d="M10 16h4"></path>
            </svg>
            <!-- Drawing icon for drawing files -->
            <svg
                v-else-if="isDrawingFile"
                class="file-icon drawing-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <circle cx="11" cy="11" r="2"></circle>
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
                class="file-name-input"
                @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
                @keydown.enter="$emit('rename')"
                @keydown.esc="$emit('cancelRename')"
                @blur="$emit('rename')"
                @click.stop
            />
            <span v-else class="file-name">{{ node.name }}</span>
            <svg
                v-if="node.file && bookmarkedFiles?.includes(node.file.path)"
                class="bookmark-star"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                />
            </svg>
        </div>

        <!-- Recursively render children -->
        <template v-if="node.type === 'folder' && isExpanded && node.children">
            <FolderNode
                v-for="child in node.children"
                :key="child.path"
                :node="child"
                :depth="depth + 1"
                :selected-files="selectedFiles"
                :active-file="activeFile"
                :renaming-file="renamingFile"
                :selected-folder="selectedFolder"
                :renaming-folder="renamingFolder"
                :rename-value="renameValue"
                :expanded-folders="expandedFolders"
                :bookmarked-files="bookmarkedFiles"
                @select-file="
                    (file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]) =>
                        $emit('selectFile', file, event, visibleFiles)
                "
                @select-folder="$emit('selectFolder', $event)"
                @toggle-folder="$emit('toggleFolder', $event)"
                @rename="$emit('rename')"
                @cancel-rename="$emit('cancelRename')"
                @update-rename-value="$emit('updateRenameValue', $event)"
                @context-menu="
                    (type: 'file' | 'folder', path: string, event: MouseEvent) =>
                        $emit('contextMenu', type, path, event)
                "
                @move-file="
                    (filePath: string, targetFolderPath: string) => $emit('moveFile', filePath, targetFolderPath)
                "
                @move-folder="
                    (folderPath: string, targetFolderPath: string) => $emit('moveFolder', folderPath, targetFolderPath)
                "
            />
        </template>
    </div>
</template>

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
        background: var(--bg-hover);
        margin: 1px 10px 1px 10px;
    }
}

.folder-item {
    color: var(--text1);
    font-size: 0.875rem;
    font-weight: 500;

    &.active {
        background: var(--bg-selected);
        margin: 1px 10px 1px 10px;

        .folder-name {
            color: var(--accent-color);
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
        background: var(--accent-color-alpha) !important;
        border: 2px dashed var(--accent-color);
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
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 5px;
        padding: 0.15rem 0.35rem;
        outline: none;
        font-family: inherit;
        font-weight: 500;
        line-height: 1.4;
        transition: background 0.15s ease;

        &:focus {
            background: var(--bg-primary);
            border-color: var(--accent-color);
        }
    }
}

.file-item {
    // Selected but not active (multi-select)
    &.selected {
        background: var(--bg-selected);
        margin: 1px 10px 1px 10px;

        .file-name {
            font-weight: 500;
        }
    }

    // Active file (being edited)
    &.active {
        background: var(--bg-selected);
        margin: 1px 10px 1px 10px;

        .file-name {
            color: var(--text1);
            font-weight: 500;
        }

        .file-icon {
            opacity: 1;
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

    &.media-drawing .drawing-icon {
        color: var(--text2);
        opacity: 0.9;
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

.bookmark-star {
    flex-shrink: 0;
    color: var(--accent-color);
    margin-left: 4px;
    opacity: 0.8;
}

.file-item.active .bookmark-star {
    color: white;
    opacity: 1;
}

.file-name-input {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text1);
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    padding: 0.15rem 0.35rem;
    outline: none;
    font-family: inherit;
    font-weight: 500;
    line-height: 1.4;
    transition: background 0.15s ease;

    &:focus {
        background: var(--bg-primary);
        border-color: var(--accent-color);
    }
}
</style>
