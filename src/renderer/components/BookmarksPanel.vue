<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import IconClose from '@/renderer/components/icons/IconClose.vue';
import IconFile from '@/renderer/components/icons/IconFile.vue';
import IconStar from '@/renderer/components/icons/IconStar.vue';
import { useListKeyboardNavigation } from '@/renderer/composables/ui/useListKeyboardNavigation';
import type { FileInfo } from '@/schemas/vault';

type Props = {
    files: FileInfo[];
    bookmarkedPaths: string[];
    selectedFiles: FileInfo[];
    activeFile: FileInfo | null;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    selectFile: [file: FileInfo, event?: MouseEvent | KeyboardEvent];
    openFile: [file: FileInfo];
    removeBookmark: [filePath: string];
}>();

const { t } = useI18n();

const bookmarkedFiles = computed(() => {
    return props.bookmarkedPaths
        .map((path) => props.files.find((f) => f.path === path))
        .filter((f): f is FileInfo => f !== undefined);
});

function isFileSelected(file: FileInfo): boolean {
    return props.selectedFiles.some((f) => f.path === file.path);
}

function selectFile(file: FileInfo, event?: MouseEvent | KeyboardEvent): void {
    emit('selectFile', file, event);
}

function openFile(file: FileInfo): void {
    emit('openFile', file);
}

function removeBookmark(file: FileInfo): void {
    emit('removeBookmark', file.path);
}

useListKeyboardNavigation(
    () => bookmarkedFiles.value,
    {
        onSelect: (file: FileInfo): void => selectFile(file),
        onOpen: (file: FileInfo): void => openFile(file),
    },
    {
        wrap: true,
        getExternalIndex: (): number => bookmarkedFiles.value.findIndex((f) => isFileSelected(f)),
    },
);
</script>

<template>
    <section
        class="bookmarks-panel panel"
        :aria-label="t('bookmarks.bookmarks_panel')">
        <header class="bookmarks-header panel-header">
            <div class="header-title">
                <IconStar
                    class="star-icon"
                    width="16"
                    height="16"
                    fill="currentColor" />
                <h2 class="panel-label">{{ t('bookmarks.title') }}</h2>
            </div>
            <div
                v-if="bookmarkedFiles.length > 0"
                class="bookmarks-info"
                aria-live="polite">
                {{ bookmarkedFiles.length }}
                {{ bookmarkedFiles.length === 1 ? t('bookmarks.file') : t('bookmarks.files') }}
            </div>
        </header>

        <div class="bookmarks-results scroll-y">
            <div
                v-if="bookmarkedFiles.length === 0"
                class="bookmarks-empty-state empty-state">
                <IconStar
                    class="empty-state-icon"
                    width="48"
                    height="48"
                    stroke-width="1.5" />
                <p>{{ t('bookmarks.no_bookmarks') }}</p>
                <p class="hint">{{ t('bookmarks.add_bookmark_hint') }}</p>
            </div>
            <ul
                v-else
                class="bookmarks-results-list list-body">
                <!-- eslint-disable-next-line a11y/no-static-element-interactions -->
                <li
                    v-for="file in bookmarkedFiles"
                    :key="file.path"
                    v-memo="[file.path, activeFile?.path, selectedFiles.some((f) => f.path === file.path)]"
                    class="bookmark-item result-item"
                    :class="{
                        active: activeFile?.path === file.path,
                        selected: isFileSelected(file),
                    }"
                    :aria-current="activeFile?.path === file.path ? 'true' : undefined"
                    :aria-selected="isFileSelected(file)"
                    tabindex="0"
                    @click="selectFile(file, $event)"
                    @dblclick="openFile(file)"
                    @keydown.enter="openFile(file)"
                    @keydown.space.prevent="selectFile(file, $event)">
                    <div class="file-info">
                        <IconFile
                            class="file-icon"
                            width="16"
                            height="16" />
                        <div class="file-details">
                            <div class="file-name truncate">{{ file.name }}</div>
                            <div class="file-path truncate">{{
                                file.folder === '.' ? t('bookmarks.root_folder') : file.folder
                            }}</div>
                        </div>
                        <button
                            class="unbookmark-btn icon-btn-subtle icon-btn-on-hover"
                            :aria-label="t('bookmarks.remove_file_bookmark', { file: file.name })"
                            @click.stop="removeBookmark(file)">
                            <IconClose
                                width="14"
                                height="14" />
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </section>
</template>

<style scoped lang="scss">
/* ––– Header ––– */

// Stacks a label row over a count, not a title row — back to normal flow.
.bookmarks-header {
    display: block;
}

.header-title {
    display: flex;
    align-items: center;
    gap: $space-2;
    margin-bottom: $space-2;
}

.star-icon {
    color: $accent-color;
}

.bookmarks-info {
    font-size: $font-size-xs;
    color: $text-muted;
}

/* ––– Results Container ––– */

.bookmarks-results {
    flex: 1;
}

.bookmarks-empty-state p {
    margin: $space-1 0;
    font-size: $font-size-sm;

    &:first-of-type {
        font-weight: $font-weight-medium;
        color: $text-primary;
    }
}

/* ––– Bookmark Row ––– */

// The remove button is revealed by its row, so the rule belongs to the row.
.bookmark-item {
    &:hover .unbookmark-btn {
        opacity: 1;
    }

    &.active .unbookmark-btn {
        color: $text1;
        opacity: $opacity-mid-high;

        &:hover {
            opacity: 1;
        }
    }
}
</style>
