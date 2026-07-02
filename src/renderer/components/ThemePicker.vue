<script setup lang="ts">
import { onMounted } from 'vue';
import { useTheme } from '@/renderer/composables/ui/useTheme';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
        :aria-label="t('theme.selection_panel')">
        <header class="theme-header">
            <span class="theme-title">{{ t('theme.title') }}</span>
            <div
                class="header-actions"
                role="toolbar"
                :aria-label="t('theme.panel_controls')">
                <button
                    class="icon-btn"
                    :title="t('theme.refresh_list')"
                    :aria-label="t('theme.refresh_list')"
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
                    :title="t('theme.close_panel')"
                    :aria-label="t('theme.close_panel')"
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
            :aria-label="t('theme.available_themes')">
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
                >{{ t('theme.no_themes_found') }}</div
            >
        </div>

        <footer class="theme-footer">
            <button
                class="footer-btn"
                :aria-label="t('theme.open_folder')"
                @click="handleOpenFolder">
                {{ t('theme.open_folder') }}
            </button>
            <p class="footer-hint">
                {{ t('theme.footer_hint_intro') }}
                <code>{{ t('theme.footer_hint_file_type') }}</code>
                files in
                <code>{{ t('theme.footer_hint_path') }}</code>
                {{ t('theme.footer_hint_action') }}
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
    border-left: $border-width-thin $text3;
    width: $size-28;
    min-width: $size-27;
}

/* ––– Header ––– */

.theme-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-3 $space-4;
    border-bottom: $border-width-thin $text3;
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
    border: $border-width-thin transparent;
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
    border: $border-width-thin $border-color;
}

.swatch {
    width: $size-5;
    height: $size-11;
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
    border-top: $border-width-thin $text3;
    padding: $space-2 $space-4 $space-3;
    flex-shrink: 0;
}

.footer-btn {
    width: 100%;
    background: none;
    border: $border-width-thin $border-color;
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
        background: $bg-primary;
        color: $accent-color;
        padding: 0 $space-1;
        border-radius: $border-radius-xs;
        font-family: $font-family-mono;
    }
}

/* ––– Scrollbar Styling ––– */

.theme-list {
    @include scrollbar;
}
</style>
