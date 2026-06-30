<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { FileInfo, TreeNode } from '@/schemas/vault';
import {
    isImageFile as checkImage,
    isVideoFile as checkVideo,
    isAudioFile as checkAudio,
    isPdfFile as checkPdf,
    isDrawingFile as checkDrawing,
    isCodeFile as checkCode,
} from '@/renderer/utils/fileTypes';
import { useTreeNodeDrag } from '@/renderer/composables/vault/useTreeNodeDrag';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
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
};

const props = defineProps<Props>();

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

// Marquee-on-hover: scroll truncated names so the full text becomes readable.
const folderNameTextEl = ref<HTMLElement | null>(null);
const fileNameTextEl = ref<HTMLElement | null>(null);
const folderScrollDistance = ref(0);
const fileScrollDistance = ref(0);
const folderScrollStyle = computed(() => scrollStyle(folderScrollDistance.value));
const fileScrollStyle = computed(() => scrollStyle(fileScrollDistance.value));

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
        void nextTick(() => {
            if (renameInput.value !== null) {
                renameInput.value.focus();
                renameInput.value.select();
            }
        });
    }
});

function handleFolderClick() {
    emit('selectFolder', props.node.path);
}

function handleFileClick(event: MouseEvent) {
    if (props.node.file !== undefined) {
        emit('selectFile', props.node.file, event, undefined);
    }
}

function scrollStyle(distance: number): Record<string, string> {
    if (distance <= 0) return {};
    const duration = Math.max(1.2, distance / 40 + 0.8);
    return {
        '--scroll-distance': `-${distance}px`,
        '--scroll-duration': `${duration}s`,
    };
}

function onFolderNameEnter() {
    const el = folderNameTextEl.value;
    if (el === null) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow > 0) folderScrollDistance.value = overflow + 6;
}

function onFolderNameLeave() {
    folderScrollDistance.value = 0;
}

function onFileNameEnter() {
    const el = fileNameTextEl.value;
    if (el === null) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow > 0) fileScrollDistance.value = overflow + 6;
}

function onFileNameLeave() {
    fileScrollDistance.value = 0;
}

const getFileTypeLabel = (): string => {
    if (isImageFile.value) return t('file.image');
    if (isVideoFile.value) return t('file.video');
    if (isAudioFile.value) return t('file.audio');
    if (isPdfFile.value) return t('file.pdf');
    if (isDrawingFile.value) return t('file.drawing');
    if (isCodeFile.value) return t('file.code');
    return t('file.text');
};
</script>

<template>
    <div class="tree-node">
        <!-- Folder item -->
        <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
        <div
            v-if="node.type === 'folder'"
            class="folder-item"
            :class="{
                'active': isSelected,
                'renaming': isRenaming,
                'drag-over': isDragOver,
                'is-dragging': isDragging,
            }"
            :style="{ paddingLeft: depth * 16 + 10 + 'px' }"
            role="treeitem"
            :aria-expanded="isExpanded"
            :aria-selected="isSelected"
            :aria-level="depth + 1"
            :aria-label="`Folder: ${node.name}`"
            draggable="true"
            @click="handleFolderClick"
            @contextmenu.prevent="$emit('contextMenu', 'folder', node.path, $event)"
            @mouseenter="onFolderNameEnter"
            @mouseleave="onFolderNameLeave"
            @focusin="onFolderNameEnter"
            @focusout="onFolderNameLeave"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop">
            <!-- Expand/collapse button -->
            <button
                class="chevron-button"
                :aria-label="`${isExpanded ? 'Collapse' : 'Expand'} folder: ${node.name}`"
                :aria-pressed="isExpanded"
                @click.stop="$emit('toggleFolder', node.path)">
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
                    aria-hidden="true"
                    focusable="false">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>

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
                aria-hidden="true"
                focusable="false">
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
                aria-hidden="true"
                focusable="false">
                <path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h9a2 2 0 0 1 2 2v1"></path>
                <path d="M5 11h15a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2L3 13a2 2 0 0 1 2-2z"></path>
            </svg>

            <!-- Folder name input (renaming) -->
            <input
                v-if="isRenaming"
                ref="renameInput"
                :value="renameValue"
                class="folder-name-input"
                type="text"
                :aria-label="`${t('file.rename')}: ${node.name}`"
                @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
                @keydown.esc="$emit('cancelRename')"
                @blur="$emit('rename')"
                @click.stop />

            <!-- Folder name display -->
            <span
                v-else
                class="folder-name">
                <span
                    ref="folderNameTextEl"
                    class="name-text"
                    :class="{ scrolling: folderScrollDistance > 0 }"
                    :style="folderScrollStyle"
                    >{{ node.name }}</span
                >
            </span>
        </div>

        <!-- File item -->
        <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
        <div
            v-else
            class="file-item"
            :class="{
                'selected': isSelected,
                'active': isActive,
                'renaming': isRenaming,
                'is-dragging': isDragging,
                'media-image': isImageFile,
                'media-video': isVideoFile,
                'media-audio': isAudioFile,
                'media-pdf': isPdfFile,
                'media-drawing': isDrawingFile,
            }"
            :style="{ paddingLeft: depth * 16 + 10 + 'px' }"
            role="treeitem"
            :aria-selected="isSelected"
            :aria-current="isActive ? 'page' : false"
            :aria-level="depth + 1"
            :aria-label="`${getFileTypeLabel()}: ${node.name}${node.file?.path && bookmarkedFiles?.includes(node.file.path) ? `, ${t('file.bookmarked')}` : ''}`"
            draggable="true"
            @click="handleFileClick"
            @contextmenu.prevent="node.file && $emit('contextMenu', 'file', node.file.path, $event)"
            @mouseenter="onFileNameEnter"
            @mouseleave="onFileNameLeave"
            @focusin="onFileNameEnter"
            @focusout="onFileNameLeave"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd">
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
                aria-hidden="true"
                focusable="false">
                <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"></rect>
                <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"></circle>
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
                aria-hidden="true"
                focusable="false">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect
                    x="1"
                    y="5"
                    width="15"
                    height="14"
                    rx="2"
                    ry="2"></rect>
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
                aria-hidden="true"
                focusable="false">
                <path d="M9 18V5l12-2v13"></path>
                <circle
                    cx="6"
                    cy="18"
                    r="3"></circle>
                <circle
                    cx="18"
                    cy="16"
                    r="3"></circle>
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
                aria-hidden="true"
                focusable="false">
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
                aria-hidden="true"
                focusable="false">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <circle
                    cx="11"
                    cy="11"
                    r="2"></circle>
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
                aria-hidden="true"
                focusable="false">
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
                aria-hidden="true"
                focusable="false">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>

            <!-- File name input (renaming) -->
            <input
                v-if="isRenaming"
                ref="renameInput"
                :value="renameValue"
                class="file-name-input"
                type="text"
                :aria-label="`${t('file.rename')}: ${node.name}`"
                @input="$emit('updateRenameValue', ($event.target as HTMLInputElement).value)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
                @keydown.esc="$emit('cancelRename')"
                @blur="$emit('rename')"
                @click.stop />

            <!-- File name display -->
            <span
                v-else
                class="file-name">
                <span
                    ref="fileNameTextEl"
                    class="name-text"
                    :class="{ scrolling: fileScrollDistance > 0 }"
                    :style="fileScrollStyle"
                    >{{ node.name }}</span
                >
            </span>

            <!-- Bookmark indicator -->
            <svg
                v-if="node.file && bookmarkedFiles?.includes(node.file.path)"
                class="bookmark-star"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                :aria-label="t('file.bookmarked')"
                role="img">
                <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
        </div>

        <!-- Recursively render children -->
        <template v-if="node.type === 'folder' && isExpanded && node.children">
            <div
                role="group"
                :aria-label="`${t('file.content_of')}: ${node.name}`">
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
                        (folderPath: string, targetFolderPath: string) =>
                            $emit('moveFolder', folderPath, targetFolderPath)
                    " />
            </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
/* ––– Tree Node Base ––– */

.tree-node {
    user-select: none;
}

/* ––– Folder Item ––– */

.folder-item,
.file-item {
    display: flex;
    align-items: center;
    padding: $space-2 $space-4 $space-2 0;
    cursor: pointer;
    transition: all $transition-fast;
    border-radius: $border-radius;
    margin: $space-0 0;
    gap: $space-2;

    &:hover {
        background: $bg-hover;
        margin: $space-0 $space-2 $space-0 $space-2;
    }
}

.folder-item {
    color: $text1;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;

    &.active {
        background: $bg-selected;
        margin: $space-0 $space-2 $space-0 $space-2;

        .folder-name {
            color: $accent-color;
            font-weight: $font-weight-medium;
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
        background: $accent-color-alpha;
        border: 2px dashed $accent-color;
        margin: $space-0 $space-2 $space-0 $space-2;
    }

    .chevron {
        flex-shrink: 0;
        color: $text2;
        transition: transform $transition-base;
        margin-left: $space-0;
        cursor: pointer;

        &.expanded {
            transform: rotate(90deg);
        }
    }

    .chevron-button {
        background: none;
        border: none;
        margin: 0;
        padding: 0;
        outline: none;
    }

    .folder-icon {
        flex-shrink: 0;
        color: $text2;
        opacity: 0.8;
    }

    .folder-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .folder-name-input {
        flex: 1;
        font-size: $font-size-sm;
        color: $text1;
        background: $bg-primary;
        border: 1px solid $border-color;
        border-radius: $border-radius;
        padding: $space-0 $space-1;
        outline: none;
        font-family: inherit;
        font-weight: $font-weight-medium;
        line-height: $line-height;
        transition: background $transition-fast;

        &:focus {
            background: $bg-primary;
            border-color: $accent-color;
        }
    }
}

/* ––– File Item ––– */

.file-item {
    &.selected {
        background: $bg-selected;
        margin: $space-0 $space-2 $space-0 $space-2;

        .file-name {
            font-weight: $font-weight-medium;
        }
    }

    &.active {
        background: $bg-selected;
        margin: $space-0 $space-2 $space-0 $space-2;

        .file-name {
            color: $text1;
            font-weight: $font-weight-medium;
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
        color: $text2;
        opacity: 0.7;
        margin: $space-0 $space-2 $space-0 $space-2;
    }

    &.media-drawing .drawing-icon {
        color: $text2;
        opacity: 0.9;
    }
}

/* ––– File Name & Metadata ––– */

.file-name {
    flex: 1;
    min-width: 0;
    font-size: $font-size-sm;
    color: $text1;
    overflow: hidden;
    line-height: $line-height;
}

/* ––– Truncated name marquee on hover ––– */

.name-text {
    display: block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.scrolling {
        width: max-content;
        max-width: none;
        overflow: visible;
        text-overflow: clip;
        animation: name-scroll var(--scroll-duration, 2s) linear infinite;
    }
}

@keyframes name-scroll {
    0%,
    12% {
        transform: translateX(0);
    }

    50%,
    62% {
        transform: translateX(var(--scroll-distance, 0));
    }

    100% {
        transform: translateX(0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .name-text.scrolling {
        animation: none;
    }
}

.bookmark-star {
    flex-shrink: 0;
    color: $accent-color;
    margin-left: $space-1;
    opacity: 0.8;
}

.file-item.active .bookmark-star {
    color: $text1;
    opacity: 1;
}

/* ––– Input Fields ––– */

.file-name-input {
    flex: 1;
    font-size: $font-size-sm;
    color: $text1;
    background: $bg-primary;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    padding: $space-0 $space-1;
    outline: none;
    font-family: inherit;
    font-weight: $font-weight-medium;
    line-height: $line-height;
    transition: background $transition-fast;

    &:focus {
        background: $bg-primary;
        border-color: $accent-color;
    }
}
</style>
