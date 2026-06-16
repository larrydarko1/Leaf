<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TabState } from '../composables/editor/useEditorTabs';

defineProps<{
    tabs: TabState[];
    activeIndex: number;
}>();

const { t } = useI18n();

const emit = defineEmits<{
    switch: [index: number];
    close: [index: number];
    reorder: [from: number, to: number];
}>();

// Pre-load a transparent 1x1 GIF so it's decoded before the first drag event
const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const dragGhost = new Image();
dragGhost.src = TRANSPARENT_GIF;

const dragStartIndex = ref(-1);
const dragOverIndex = ref(-1);

function getFileNameWithoutExtension(name: string): string {
    const last = name.lastIndexOf('.');
    return last > 0 ? name.substring(0, last) : name;
}

function handleMiddleClick(e: MouseEvent, index: number) {
    if (e.button === 1) {
        e.preventDefault();
        emit('close', index);
    }
}

function onDragStart(e: DragEvent, index: number) {
    dragStartIndex.value = index;
    if (e.dataTransfer !== null) {
        e.dataTransfer.effectAllowed = 'move';
        // Suppress the default favicon ghost with a pre-loaded transparent image
        e.dataTransfer.setDragImage(dragGhost, 0, 0);
    }
}

function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (e.dataTransfer !== null) e.dataTransfer.dropEffect = 'move';
    dragOverIndex.value = index;
}

function onDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragStartIndex.value !== -1 && dragStartIndex.value !== index) {
        emit('reorder', dragStartIndex.value, index);
    }
    dragStartIndex.value = -1;
    dragOverIndex.value = -1;
}

function onDragEnd() {
    dragStartIndex.value = -1;
    dragOverIndex.value = -1;
}
</script>

<template>
    <div
        v-if="tabs.length > 0"
        class="tab-bar"
        role="tablist"
        :aria-label="t('app.open_files')">
        <div
            v-for="(tab, i) in tabs"
            :key="tab.file.path"
            class="tab"
            :class="{
                'active': i === activeIndex,
                'unsaved': tab.hasUnsavedChanges,
                'dragging': i === dragStartIndex,
                'drop-left': i === dragOverIndex && dragStartIndex > i,
                'drop-right': i === dragOverIndex && dragStartIndex < i,
            }"
            role="tab"
            :aria-selected="i === activeIndex"
            :aria-label="`${getFileNameWithoutExtension(tab.file.name)}${tab.hasUnsavedChanges ? ' (unsaved)' : ''}`"
            :title="tab.file.relativePath"
            draggable="true"
            tabindex="0"
            @click="emit('switch', i)"
            @keydown.enter="emit('switch', i)"
            @keydown.space.prevent="emit('switch', i)"
            @mousedown="handleMiddleClick($event, i)"
            @auxclick.prevent
            @dragstart="onDragStart($event, i)"
            @dragover="onDragOver($event, i)"
            @drop="onDrop($event, i)"
            @dragend="onDragEnd">
            <span
                class="tab-name"
                aria-hidden="false"
                >{{ getFileNameWithoutExtension(tab.file.name) }}</span
            >
            <span
                v-if="tab.hasUnsavedChanges"
                class="tab-dot"
                :aria-label="t('app.tab_unsaved_indicator')"
                role="status" />
            <button
                class="tab-close"
                :aria-label="t('app.tab_close_button', { filename: tab.file.name })"
                :title="t('app.tab_close_button', { filename: tab.file.name })"
                @click.stop="emit('close', i)">
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    aria-hidden="true"
                    focusable="false">
                    <line
                        x1="2"
                        y1="2"
                        x2="8"
                        y2="8" />
                    <line
                        x1="8"
                        y1="2"
                        x2="2"
                        y2="8" />
                </svg>
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
/* ––– Tab Bar Container ––– */

.tab-bar {
    display: flex;
    align-items: stretch;
    height: 36px;
    background: $base1;
    border-bottom: 1px solid color-mix(in srgb, $text3 80%, transparent);
    overflow: auto hidden;
    flex-shrink: 0;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

/* ––– Tab Item ––– */

.tab {
    display: flex;
    align-items: center;
    background: $base1;
    gap: $space-2;
    padding: 0 $space-3 0 $space-4;
    min-width: 80px;
    max-width: 180px;
    border-right: 1px solid color-mix(in srgb, $text3 60%, transparent);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    position: relative;
    transition: background $transition-fast;
    color: $text2;
    font-size: $font-size-sm;

    &:hover {
        background: $bg-hover;
        color: $text1;

        .tab-close {
            opacity: 1;
        }
    }

    &.dragging {
        opacity: 0.4;
    }

    &.drop-left {
        box-shadow: inset 2px 0 0 $accent-color;
    }

    &.drop-right {
        box-shadow: inset -2px 0 0 $accent-color;
    }

    &.active {
        background: $bg-secondary;
        color: $text1;
        font-weight: $font-weight-medium;

        .tab-close {
            opacity: 1;
        }

        &::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: $accent-color;
        }
    }
}

/* ––– Tab Content ––– */

.tab-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-dot {
    width: 6px;
    height: 6px;
    border-radius: $border-radius-xl;
    background: $accent-color;
    flex-shrink: 0;
}

/* ––– Tab Close Button ––– */

.tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    min-width: 16px;
    border-radius: $border-radius-xs;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0;
    transition: all $transition-fast;
    flex-shrink: 0;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }
}
</style>
