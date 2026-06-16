<script setup lang="ts">
import { onMounted } from 'vue';
import { useTheme } from '../composables/ui/useTheme';

const emit = defineEmits<{ close: [] }>();

const { themes, activeId, refresh, setActive, openThemesFolder } = useTheme();

onMounted(() => {
    void refresh();
});

async function handleSelect(id: string) {
    if (id === activeId.value) return;
    await setActive(id);
}

async function handleOpenFolder() {
    await openThemesFolder();
}

async function handleRefresh() {
    await refresh();
}
</script>

<template>
    <aside
        class="theme-panel"
        aria-label="Theme selection panel">
        <header class="theme-header">
            <span class="theme-title">Theme</span>
            <div
                class="header-actions"
                role="toolbar"
                aria-label="Theme panel controls">
                <button
                    class="icon-btn"
                    title="Refresh list"
                    aria-label="Refresh theme list"
                    @click="handleRefresh">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <path d="M21 4v5h-5" />
                    </svg>
                </button>
                <button
                    class="icon-btn"
                    title="Close"
                    aria-label="Close theme panel"
                    @click="emit('close')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true">
                        <path
                            d="M18 6L6 18M6 6l12 12"
                            stroke-linecap="round" />
                    </svg>
                </button>
            </div>
        </header>

        <div
            class="theme-list"
            role="listbox"
            aria-label="Available themes">
            <button
                v-for="theme in themes"
                :key="theme.id"
                class="theme-item"
                :class="{ active: theme.id === activeId }"
                role="option"
                :aria-selected="theme.id === activeId"
                :aria-label="`${theme.name} theme${theme.description ? ': ' + theme.description : ''}`"
                @click="handleSelect(theme.id)">
                <span
                    class="theme-swatches"
                    aria-hidden="true">
                    <span
                        class="swatch"
                        :style="{ background: theme.colors['bg-primary'] || '#000' }"></span>
                    <span
                        class="swatch"
                        :style="{ background: theme.colors['bg-secondary'] || '#000' }"></span>
                    <span
                        class="swatch"
                        :style="{ background: theme.colors['accent-color'] || '#3eb489' }"></span>
                    <span
                        class="swatch"
                        :style="{ background: theme.colors['text1'] || '#fff' }"></span>
                </span>
                <span class="theme-meta">
                    <span class="theme-name">{{ theme.name }}</span>
                    <span
                        v-if="theme.description"
                        class="theme-desc"
                        >{{ theme.description }}</span
                    >
                </span>
                <svg
                    v-if="theme.id === activeId"
                    class="check"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M5 12l5 5 9-11" />
                </svg>
            </button>

            <div
                v-if="!themes.length"
                class="theme-empty"
                role="status"
                >No themes found.</div
            >
        </div>

        <footer class="theme-footer">
            <button
                class="footer-btn"
                aria-label="Open themes folder"
                @click="handleOpenFolder">
                Open themes folder…
            </button>
            <p class="footer-hint">
                Drop <code>.json</code> files in <code>~/.leaf/themes/</code> to add presets. Edit one to customise.
            </p>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
/* ––– Theme Panel Container ––– */

.theme-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $base1;
    border-left: 1px solid $text3;
    width: 340px;
    min-width: 280px;
}

/* ––– Header ––– */

.theme-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-3 $space-4;
    border-bottom: 1px solid $text3;
    flex-shrink: 0;
}

.theme-title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $text1;
}

.header-actions {
    display: inline-flex;
    gap: $space-0;
}

.icon-btn {
    background: none;
    border: none;
    padding: $space-1;
    border-radius: $border-radius;
    color: $text-muted;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }
}

/* ––– Theme List ––– */

.theme-list {
    flex: 1;
    overflow-y: auto;
    padding: $border-radius;
}

.theme-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-2 $space-3;
    background: none;
    border: 1px solid transparent;
    border-radius: $border-radius-lg;
    color: $text1;
    text-align: left;
    cursor: pointer;
    margin-bottom: $space-1;
    transition: background $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: color-mix(in srgb, $accent-color 35%, transparent);
    }
}

/* ––– Theme Swatches ––– */

.theme-swatches {
    display: inline-flex;
    flex-shrink: 0;
    border-radius: $border-radius;
    overflow: hidden;
    border: 1px solid $border-color;
}

.swatch {
    width: 10px;
    height: 24px;
    display: block;
}

/* ––– Theme Metadata ––– */

.theme-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.theme-name {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $text1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.theme-desc {
    font-size: $font-size-xs;
    color: $text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.check {
    color: $accent-color;
    flex-shrink: 0;
}

.theme-empty {
    padding: $space-6 $space-2;
    text-align: center;
    color: $text-muted;
    font-size: $font-size-sm;
}

/* ––– Footer ––– */

.theme-footer {
    border-top: 1px solid $text3;
    padding: $space-2 $space-4 $space-3;
    flex-shrink: 0;
}

.footer-btn {
    width: 100%;
    background: none;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    padding: $border-radius $border-radius-lg;
    font-size: $space-3;
    color: $text1;
    cursor: pointer;

    &:hover {
        background: $bg-hover;
        border-color: $text2;
    }
}

.footer-hint {
    margin: $space-2 0 0 0;
    font-size: $font-size-xs;
    color: $text-muted;
    line-height: $line-height;

    code {
        font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
        font-size: $font-size-xs;
        background: color-mix(in srgb, $text2 10%, transparent);
        padding: $space-1 $space-2;
        border-radius: $border-radius-xs;
    }
}

/* ––– Scrollbar Styling ––– */

.theme-list::-webkit-scrollbar {
    width: 6px;
}

.theme-list::-webkit-scrollbar-track {
    background: transparent;
}

.theme-list::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb;
    border-radius: $border-radius-xs;

    &:hover {
        background: $scrollbar-thumb-hover;
    }
}
</style>
