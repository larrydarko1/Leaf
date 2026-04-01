<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useListKeyboardNavigation } from '../composables/ui/useListKeyboardNavigation';
import type { FileInfo } from '../types/electron';

const props = defineProps<{
    files: FileInfo[];
    selectedFiles: FileInfo[];
    activeFile: FileInfo | null;
}>();

const emit = defineEmits<{
    selectFile: [file: FileInfo, event?: MouseEvent];
    openFile: [file: FileInfo];
    close: [];
}>();

const searchInput = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');

// Focus the search input when mounted
onMounted(() => {
    searchInput.value?.focus();
});

// Fuzzy search implementation
const searchResults = computed(() => {
    if (!searchQuery.value.trim()) {
        return [];
    }

    const query = searchQuery.value.toLowerCase();
    const results = props.files
        .map((file) => {
            const fileName = file.name.toLowerCase();
            const folderPath = file.folder.toLowerCase();

            // Calculate match score (simple fuzzy matching)
            let score = 0;
            if (fileName.includes(query)) {
                score += 100;
                // Bonus for exact match at start
                if (fileName.startsWith(query)) {
                    score += 50;
                }
            }

            // Also search in folder path
            if (folderPath.includes(query)) {
                score += 30;
            }

            // Fuzzy match: check if all characters in query appear in order
            let queryIndex = 0;
            for (let i = 0; i < fileName.length && queryIndex < query.length; i++) {
                if (fileName[i] === query[queryIndex]) {
                    queryIndex++;
                    score += 1;
                }
            }

            return { file, score, matched: score > 0 };
        })
        .filter((result) => result.matched)
        .sort((a, b) => b.score - a.score)
        .map((result) => result.file);

    return results;
});

const { selectedIndex, resetIndex } = useListKeyboardNavigation<FileInfo>(
    () => searchResults.value,
    {
        onSelect: (file) => emit('selectFile', file),
        onOpen: openSelectedResult,
        onEscape: () => {
            if (searchQuery.value) clearSearch();
            else emit('close');
        },
    },
    {
        wrap: false,
        scrollSelector: '.search-result-item.keyboard-selected',
        ignoreWhen: (target) =>
            (target.tagName === 'TEXTAREA' || target.isContentEditable) &&
            target !== (searchInput.value as HTMLElement | null),
    },
);

// Reset keyboard selection when search results change
watch(searchResults, resetIndex);

function isFileSelected(file: FileInfo): boolean {
    return props.selectedFiles.some((f) => f.path === file.path);
}

function selectFile(file: FileInfo, event?: MouseEvent) {
    const index = searchResults.value.findIndex((f) => f.path === file.path);
    if (index >= 0) selectedIndex.value = index;
    emit('selectFile', file, event);
}

function openFile(file: FileInfo) {
    emit('openFile', file);
}

function clearSearch() {
    searchQuery.value = '';
    resetIndex();
    searchInput.value?.focus();
}

function openSelectedResult() {
    const idx = selectedIndex.value;
    if (idx >= 0 && idx < searchResults.value.length) {
        openFile(searchResults.value[idx]);
    }
}

// Highlight matching text
function highlightMatch(text: string): string {
    if (!searchQuery.value.trim()) return text;

    const query = searchQuery.value;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}
</script>

<template>
    <div class="search-panel">
        <div class="search-header">
            <div class="search-input-wrapper">
                <svg
                    class="search-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <input
                    ref="searchInput"
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search files..."
                    class="search-input"
                    @keydown.escape="clearSearch"
                    @keydown.enter="openSelectedResult"
                />
                <button v-if="searchQuery" class="clear-button" title="Clear search" @click="clearSearch">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <div v-if="searchQuery" class="search-info">
                {{ searchResults.length }} {{ searchResults.length === 1 ? 'result' : 'results' }}
            </div>
        </div>

        <div class="search-results">
            <div v-if="!searchQuery" class="search-empty-state">
                <p>Type to search files by name</p>
            </div>
            <div v-else-if="searchResults.length === 0" class="search-empty-state">
                <p>No files found</p>
            </div>
            <div v-else class="search-results-list">
                <div
                    v-for="(file, index) in searchResults"
                    :key="file.path"
                    class="search-result-item"
                    :class="{
                        active: activeFile?.path === file.path,
                        selected: isFileSelected(file),
                        'keyboard-selected': selectedIndex === index,
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
                            <div class="file-name" v-html="highlightMatch(file.name)"></div>
                            <div class="file-path">{{ file.folder === '.' ? '' : file.folder }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.search-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $bg-secondary;
}

.search-header {
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid $text3;
}

.search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: 10px;
    padding: 0.35rem 0.6rem;
    transition: border-color 0.2s;

    &:focus-within {
        border-color: $accent-color;
    }
}

.search-icon {
    color: $text-muted;
    flex-shrink: 0;
    margin-right: 8px;
}

.search-input {
    flex: 1;
    border: none;
    background: none;
    color: $text-primary;
    font-size: 0.8rem;
    outline: none;
    font-family: inherit;

    &::placeholder {
        color: $text-muted;
    }
}

.clear-button {
    background: none;
    border: none;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-muted;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    margin-left: 4px;

    &:hover {
        background: $bg-tertiary;
        color: $text-primary;
    }
}

.search-info {
    margin-top: 8px;
    font-size: 12px;
    color: $text-muted;
}

.search-results {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

.search-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: $text-muted;
    font-size: 14px;
}

.search-results-list {
    padding: 4px;
}

.search-result-item {
    padding: 0.45rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;
    margin-bottom: 2px;
    user-select: none;

    &:hover {
        background: $bg-hover;
    }

    &.selected {
        background: $bg-selected;
    }

    &.active {
        background: $bg-selected;
        color: $text1;

        .file-path,
        .file-icon {
            color: $text1;
        }
    }

    &.keyboard-selected {
        outline: 2px solid $accent-color;
        outline-offset: -2px;
    }
}

.file-info {
    display: flex;
    align-items: center;
    gap: 10px;
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
    gap: 2px;
}

.file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    :deep(mark) {
        background: $accent-color-alpha;
        color: $accent-color;
        padding: 1px 2px;
        border-radius: 3px;
        font-weight: 600;
    }
}

.file-path {
    font-size: 11px;
    color: $text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Scrollbar styling */
.search-results::-webkit-scrollbar {
    width: 6px;
}

.search-results::-webkit-scrollbar-track {
    background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb;
    border-radius: 3px;

    &:hover {
        background: $scrollbar-thumb-hover;
    }
}
</style>
