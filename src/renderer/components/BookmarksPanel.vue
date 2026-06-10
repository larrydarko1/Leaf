<script setup lang="ts">
import { computed } from 'vue';
import { useListKeyboardNavigation } from '../composables/ui/useListKeyboardNavigation';
import type { FileInfo } from '../types/electron';

const props = defineProps<{
    files: FileInfo[];
    bookmarkedPaths: string[];
    selectedFiles: FileInfo[];
    activeFile: FileInfo | null;
}>();

const emit = defineEmits<{
    selectFile: [file: FileInfo, event?: MouseEvent];
    openFile: [file: FileInfo];
    removeBookmark: [filePath: string];
}>();

const bookmarkedFiles = computed(() => {
    return props.bookmarkedPaths
        .map((path) => props.files.find((f) => f.path === path))
        .filter((f): f is FileInfo => f !== undefined);
});

useListKeyboardNavigation(
    () => bookmarkedFiles.value,
    {
        onSelect: (file) => selectFile(file),
        onOpen: (file) => openFile(file),
    },
    {
        wrap: true,
        getExternalIndex: () => bookmarkedFiles.value.findIndex((f) => isFileSelected(f)),
    },
);

function isFileSelected(file: FileInfo): boolean {
    return props.selectedFiles.some((f) => f.path === file.path);
}

function selectFile(file: FileInfo, event?: MouseEvent) {
    emit('selectFile', file, event);
}

function openFile(file: FileInfo) {
    emit('openFile', file);
}

function removeBookmark(file: FileInfo) {
    emit('removeBookmark', file.path);
}
</script>

<template>
    <section
        class="bookmarks-panel"
        aria-label="Bookmarks">
        <header class="bookmarks-header">
            <div class="header-title">
                <svg
                    class="star-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true">
                    <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round" />
                </svg>
                <h2>Bookmarks</h2>
            </div>
            <div
                v-if="bookmarkedFiles.length > 0"
                class="bookmarks-info"
                aria-live="polite">
                {{ bookmarkedFiles.length }} {{ bookmarkedFiles.length === 1 ? 'file' : 'files' }}
            </div>
        </header>

        <div class="bookmarks-results">
            <div
                v-if="bookmarkedFiles.length === 0"
                class="bookmarks-empty-state">
                <svg
                    class="empty-icon"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true">
                    <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round" />
                </svg>
                <p>No bookmarked files</p>
                <p class="hint">Right-click a file and select "Add to Bookmarks"</p>
            </div>
            <ul
                v-else
                class="bookmarks-results-list"
                role="list">
                <li
                    v-for="file in bookmarkedFiles"
                    :key="file.path"
                    role="listitem"
                    class="bookmark-item"
                    :class="{
                        active: activeFile?.path === file.path,
                        selected: isFileSelected(file),
                    }"
                    :aria-current="activeFile?.path === file.path ? 'true' : undefined"
                    :aria-selected="isFileSelected(file)"
                    @click="selectFile(file, $event)"
                    @dblclick="openFile(file)">
                    <div class="file-info">
                        <svg
                            class="file-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true">
                            <path
                                d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round" />
                            <path
                                d="M13 2V9H20"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round" />
                        </svg>
                        <div class="file-details">
                            <div class="file-name">{{ file.name }}</div>
                            <div class="file-path">{{ file.folder === '.' ? 'Root' : file.folder }}</div>
                        </div>
                        <button
                            class="unbookmark-btn"
                            :aria-label="`Remove ${file.name} from bookmarks`"
                            @click.stop="removeBookmark(file)">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true">
                                <path
                                    d="M18 6L6 18M6 6L18 18"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </section>
</template>

<style scoped lang="scss">
/* ––– Container ––– */

.bookmarks-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $bg-secondary;
}

/* ––– Header ––– */

.bookmarks-header {
    padding: $space-2 $space-3;
    border-bottom: 1px solid $text3;
}

.header-title {
    display: flex;
    align-items: center;
    gap: $space-2;
    margin-bottom: $space-2;

    h2 {
        margin: 0;
        font-size: $font-size-xs;
        font-weight: $font-weight-semibold;
        color: $text-primary;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .star-icon {
        color: $accent-color;
    }
}

.bookmarks-info {
    font-size: $font-size-xs;
    color: $text-muted;
}

/* ––– Results Container ––– */

.bookmarks-results {
    flex: 1;
    overflow: hidden auto;
}

/* ––– Empty State ––– */

.bookmarks-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $space-11 $space-6;
    text-align: center;
    color: $text-muted;

    .empty-icon {
        opacity: 0.3;
        margin-bottom: $space-4;
    }

    p {
        margin: $space-1 0;
        font-size: $font-size-sm;

        &:first-of-type {
            font-weight: $font-weight-medium;
            color: $text-primary;
        }
    }

    .hint {
        font-size: $font-size-xs;
        color: $text-muted;
        margin-top: $space-2;
    }
}

/* ––– List Items ––– */

.bookmarks-results-list {
    padding: $space-1;
}

.bookmark-item {
    padding: $space-2 $space-3;
    border-radius: $border-radius-lg;
    cursor: pointer;
    transition: background $transition-fast;
    margin-bottom: $space-0;
    user-select: none;

    &:hover {
        background: $bg-hover;

        .unbookmark-btn {
            opacity: 1;
        }
    }

    &.selected {
        background: $bg-selected;
    }

    &.active {
        background: $bg-selected;
        color: $text1;

        .unbookmark-btn {
            color: $text1;
            opacity: 0.7;

            &:hover {
                opacity: 1;
            }
        }
    }
}

.file-info {
    display: flex;
    align-items: center;
    gap: $space-3;
}

.file-icon {
    flex-shrink: 0;
    color: $text-muted;
}

.file-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.file-name {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-path {
    font-size: $font-size-xs;
    color: $text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ––– Unbookmark Button ––– */

.unbookmark-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: $space-1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-muted;
    border-radius: $border-radius-sm;
    cursor: pointer;
    transition: all $transition-base;
    opacity: 0;

    &:hover {
        background: $bg-tertiary;
        color: $text-primary;
    }
}

/* ––– Scrollbar ––– */

.bookmarks-results::-webkit-scrollbar {
    width: 6px;
}

.bookmarks-results::-webkit-scrollbar-track {
    background: transparent;
}

.bookmarks-results::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb;
    border-radius: $border-radius-xs;

    &:hover {
        background: $scrollbar-thumb-hover;
    }
}
</style>
