<script setup lang="ts">
import type { TabState } from '../composables/editor/useEditorTabs';

defineProps<{
    tabs: TabState[];
    activeIndex: number;
}>();

const emit = defineEmits<{
    switch: [index: number];
    close: [index: number];
}>();

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
</script>

<template>
    <div class="tab-bar" role="tablist">
        <div
            v-for="(tab, i) in tabs"
            :key="tab.file.path"
            class="tab"
            :class="{ active: i === activeIndex, unsaved: tab.hasUnsavedChanges }"
            role="tab"
            :aria-selected="i === activeIndex"
            :title="tab.file.relativePath"
            @click="emit('switch', i)"
            @mousedown="handleMiddleClick($event, i)"
            @auxclick.prevent
        >
            <span class="tab-name">{{ getFileNameWithoutExtension(tab.file.name) }}</span>
            <span v-if="tab.hasUnsavedChanges" class="tab-dot" title="Unsaved changes" />
            <button class="tab-close" :title="`Close ${tab.file.name}`" @click.stop="emit('close', i)">
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                </svg>
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.tab-bar {
    display: flex;
    align-items: stretch;
    height: 36px;
    background: $base1;
    border-bottom: 1px solid color-mix(in srgb, var(--text3) 80%, transparent);
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.tab {
    display: flex;
    align-items: center;
    background: $base1;
    gap: 6px;
    padding: 0 10px 0 14px;
    min-width: 80px;
    max-width: 180px;
    border-right: 1px solid color-mix(in srgb, var(--text3) 60%, transparent);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    position: relative;
    transition: background 0.12s ease;
    color: $text2;
    font-size: 0.8rem;

    &:hover {
        background: $bg-hover;
        color: $text1;

        .tab-close {
            opacity: 1;
        }
    }

    &.active {
        background: $bg-secondary;
        color: $text1;
        font-weight: 500;

        .tab-close {
            opacity: 1;
        }

        // bottom border highlight to indicate active tab
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
    border-radius: 50%;
    background: $accent-color;
    flex-shrink: 0;
}

.tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    min-width: 16px;
    border-radius: 3px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0;
    transition: all 0.12s ease;
    flex-shrink: 0;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }
}
</style>
