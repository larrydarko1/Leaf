<script setup lang="ts">
import { onMounted } from 'vue';
import { useTheme } from '@/renderer/composables/ui/useTheme';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const { themes, activeId, refresh, setActive, openThemesFolder } = useTheme();

async function handleSelect(id: string): Promise<void> {
    if (id === activeId.value) return;
    await setActive(id);
}

async function handleOpenFolder(): Promise<void> {
    await openThemesFolder();
}

async function handleRefresh(): Promise<void> {
    await refresh();
}

onMounted(() => {
    void refresh();
});
</script>

<template>
    <aside
        class="theme-panel panel panel-aside"
        :aria-label="t('theme.selection_panel')">
        <header class="panel-header">
            <span class="panel-title">{{ t('theme.title') }}</span>
            <div
                class="panel-actions"
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
            class="theme-list scroll-y"
            role="listbox"
            :aria-label="t('theme.available_themes')">
            <button
                v-for="theme in themes"
                :key="theme.id"
                class="list-item theme-item"
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
                    <span class="theme-name truncate">{{ theme.name }}</span>
                    <span
                        v-if="theme.description"
                        class="theme-desc truncate"
                        >{{ theme.description }}</span
                    >
                </span>
                <svg
                    v-if="theme.id === activeId"
                    class="list-check"
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
                class="theme-empty list-empty"
                role="status"
                >{{ t('theme.no_themes_found') }}</div
            >
        </div>

        <footer class="panel-footer">
            <button
                class="btn-block"
                :aria-label="t('theme.open_folder')"
                @click="handleOpenFolder">
                {{ t('theme.open_folder') }}
            </button>
            <p class="panel-hint">
                {{ t('theme.footer_hint_intro') }}
                <code>{{ t('theme.footer_hint_file_type') }}</code>
                {{ t('theme.footer_hint_files_in') }}
                <code>{{ t('theme.footer_hint_path') }}</code>
                {{ t('theme.footer_hint_action') }}
            </p>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
/* ––– Theme List ––– */

.theme-list {
    flex: 1;
    padding: $space-1;
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
}

.theme-desc {
    font-size: $font-size-xs;
    color: $text-muted;
}
</style>
