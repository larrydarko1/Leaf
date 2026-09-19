<script setup lang="ts">
import { onMounted } from 'vue';
import { useLanguage } from '@/renderer/composables/ui/useLanguage';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const { languages, activeId, refresh, setActive, openLocalesFolder } = useLanguage();

async function handleSelect(id: string): Promise<void> {
    if (id === activeId.value) return;
    await setActive(id);
}

async function handleOpenFolder(): Promise<void> {
    await openLocalesFolder();
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
        class="language-panel panel panel-aside"
        :aria-label="t('language.selection_panel')">
        <header class="panel-header">
            <span class="panel-title">{{ t('language.title') }}</span>
            <div
                class="panel-actions"
                role="toolbar"
                :aria-label="t('language.panel_controls')">
                <button
                    class="icon-btn"
                    :title="t('language.refresh_list')"
                    :aria-label="t('language.refresh_list')"
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
                    :title="t('language.close_panel')"
                    :aria-label="t('language.close_panel')"
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
            class="language-list scroll-y"
            role="listbox"
            :aria-label="t('language.available_languages')">
            <button
                v-for="language in languages"
                :key="language.id"
                class="language-item list-item"
                :class="{ active: language.id === activeId }"
                role="option"
                :aria-selected="language.id === activeId"
                :aria-label="`${language.name} ${t('language.language')}`"
                @click="handleSelect(language.id)">
                <span class="language-name fill truncate">{{ language.name }}</span>
                <svg
                    v-if="language.id === activeId"
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
                v-if="!languages.length"
                class="language-empty list-empty"
                role="status"
                >{{ t('language.no_languages_found') }}</div
            >
        </div>

        <footer class="panel-footer">
            <button
                class="btn-block"
                :aria-label="t('language.open_folder')"
                @click="handleOpenFolder">
                {{ t('language.open_folder') }}…
            </button>
            <p class="hint panel-hint">
                {{ t('language.footer_hint_intro') }} <code>{{ t('language.footer_hint_file_type') }}</code>
                {{ t('language.footer_hint_path') }} {{ t('language.footer_hint_action') }}
            </p>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
/* ––– Language List ––– */

.language-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
}

.language-name {
    font-size: $font-size-sm;
}
</style>
