<script setup lang="ts">
import { onMounted } from 'vue';
import { useTheme } from '../composables/ui/useTheme';

const emit = defineEmits<{ close: [] }>();

const { themes, activeId, refresh, setActive, openThemesFolder } = useTheme();

onMounted(() => {
    refresh();
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
    <aside class="theme-panel">
        <header class="theme-header">
            <span class="theme-title">Theme</span>
            <div class="header-actions">
                <button class="icon-btn" title="Refresh list" @click="handleRefresh">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <path d="M21 4v5h-5" />
                    </svg>
                </button>
                <button class="icon-btn" title="Close" @click="emit('close')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
                    </svg>
                </button>
            </div>
        </header>

        <div class="theme-list">
            <button
                v-for="theme in themes"
                :key="theme.id"
                class="theme-item"
                :class="{ active: theme.id === activeId }"
                @click="handleSelect(theme.id)"
            >
                <span class="theme-swatches">
                    <span class="swatch" :style="{ background: theme.colors['bg-primary'] || '#000' }"></span>
                    <span class="swatch" :style="{ background: theme.colors['bg-secondary'] || '#000' }"></span>
                    <span class="swatch" :style="{ background: theme.colors['accent-color'] || '#3eb489' }"></span>
                    <span class="swatch" :style="{ background: theme.colors['text1'] || '#fff' }"></span>
                </span>
                <span class="theme-meta">
                    <span class="theme-name">{{ theme.name }}</span>
                    <span v-if="theme.description" class="theme-desc">{{ theme.description }}</span>
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
                >
                    <path d="M5 12l5 5 9-11" />
                </svg>
            </button>

            <div v-if="!themes.length" class="theme-empty">No themes found.</div>
        </div>

        <footer class="theme-footer">
            <button class="footer-btn" @click="handleOpenFolder">Open themes folder…</button>
            <p class="footer-hint">
                Drop <code>.json</code> files in <code>~/.leaf/themes/</code> to add presets. Edit one to customise.
            </p>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
.theme-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $base1;
    border-left: 1px solid $text3;
    width: 340px;
    min-width: 280px;
}

.theme-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid $text3;
    flex-shrink: 0;
}

.theme-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: $text1;
}

.header-actions {
    display: inline-flex;
    gap: 2px;
}

.icon-btn {
    background: none;
    border: none;
    padding: 5px;
    border-radius: 5px;
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

.theme-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
}

.theme-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.55rem 0.65rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: $text1;
    text-align: left;
    cursor: pointer;
    margin-bottom: 3px;
    transition: background 0.12s;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: color-mix(in srgb, var(--accent-color) 35%, transparent);
    }
}

.theme-swatches {
    display: inline-flex;
    flex-shrink: 0;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid $border-color;
}

.swatch {
    width: 10px;
    height: 24px;
    display: block;
}

.theme-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.theme-name {
    font-size: 0.82rem;
    font-weight: 500;
    color: $text1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.theme-desc {
    font-size: 0.7rem;
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
    padding: 1.5rem 0.5rem;
    text-align: center;
    color: $text-muted;
    font-size: 0.8rem;
}

.theme-footer {
    border-top: 1px solid $text3;
    padding: 0.55rem 0.75rem 0.7rem;
    flex-shrink: 0;
}

.footer-btn {
    width: 100%;
    background: none;
    border: 1px solid $border-color;
    border-radius: 6px;
    padding: 0.4rem 0.55rem;
    font-size: 0.75rem;
    color: $text1;
    cursor: pointer;

    &:hover {
        background: $bg-hover;
        border-color: $text2;
    }
}

.footer-hint {
    margin: 0.5rem 0 0 0;
    font-size: 0.68rem;
    color: $text-muted;
    line-height: 1.4;

    code {
        font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
        font-size: 0.95em;
        background: color-mix(in srgb, var(--text2) 10%, transparent);
        padding: 1px 4px;
        border-radius: 3px;
    }
}

.theme-list::-webkit-scrollbar {
    width: 6px;
}

.theme-list::-webkit-scrollbar-track {
    background: transparent;
}

.theme-list::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb;
    border-radius: 3px;

    &:hover {
        background: $scrollbar-thumb-hover;
    }
}
</style>
