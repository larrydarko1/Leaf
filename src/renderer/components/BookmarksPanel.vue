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

// Get actual file objects for bookmarked paths
const bookmarkedFiles = computed(() => {
    return props.bookmarkedPaths
        .map((path) => props.files.find((f) => f.path === path))
        .filter((f): f is FileInfo => f !== undefined);
});

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
</script>

<template>
    <div class="bookmarks-panel">
        <div class="bookmarks-header">
            <div class="header-title">
                <svg
                    class="star-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <h3>Bookmarks</h3>
            </div>
            <div v-if="bookmarkedFiles.length > 0" class="bookmarks-info">
                {{ bookmarkedFiles.length }} {{ bookmarkedFiles.length === 1 ? 'file' : 'files' }}
            </div>
        </div>

        <div class="bookmarks-results">
            <div v-if="bookmarkedFiles.length === 0" class="bookmarks-empty-state">
                <svg
                    class="empty-icon"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <p>No bookmarked files</p>
                <p class="hint">Right-click a file and select "Add to Bookmarks"</p>
            </div>
            <div v-else class="bookmarks-results-list">
                <div
                    v-for="file in bookmarkedFiles"
                    :key="file.path"
                    class="bookmark-item"
                    :class="{
                        active: activeFile?.path === file.path,
                        selected: isFileSelected(file),
                    }"
                    @click="selectFile(file, $event)"
                    @dblclick="openFile(file)"
                >
                    <div class="file-info">
                        <svg
                            class="file-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <path
                                d="M13 2V9H20"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <div class="file-details">
                            <div class="file-name">{{ file.name }}</div>
                            <div class="file-path">{{ file.folder === '.' ? 'Root' : file.folder }}</div>
                        </div>
                        <button class="unbookmark-btn" title="Remove from bookmarks" @click.stop="removeBookmark(file)">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M18 6L6 18M6 6L18 18"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.bookmarks-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
}

.bookmarks-header {
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--text3);
}

.header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;

    h3 {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-primary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .star-icon {
        color: var(--accent-color);
    }
}

.bookmarks-info {
    font-size: 12px;
    color: var(--text-muted);
}

.bookmarks-results {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

.bookmarks-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-muted);

    .empty-icon {
        opacity: 0.3;
        margin-bottom: 16px;
    }

    p {
        margin: 4px 0;
        font-size: 14px;

        &:first-of-type {
            font-weight: 500;
            color: var(--text-primary);
        }
    }

    .hint {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 8px;
    }
}

.bookmarks-results-list {
    padding: 4px;
}

.bookmark-item {
    padding: 0.45rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;
    margin-bottom: 2px;
    user-select: none;

    &:hover {
        background: var(--bg-hover);

        .unbookmark-btn {
            opacity: 1;
        }
    }

    &.selected {
        background: var(--bg-selected);
    }

    &.active {
        background: var(--bg-selected);
        color: var(--text1);

        .unbookmark-btn {
            color: var(--text1);
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
    gap: 10px;
}

.file-icon {
    flex-shrink: 0;
    color: var(--text-muted);
}

.file-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-path {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.unbookmark-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0;

    &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }
}

/* Scrollbar styling */
.bookmarks-results::-webkit-scrollbar {
    width: 6px;
}

.bookmarks-results::-webkit-scrollbar-track {
    background: transparent;
}

.bookmarks-results::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;

    &:hover {
        background: var(--scrollbar-thumb-hover);
    }
}
</style>
