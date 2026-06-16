<script setup lang="ts">
import { onMounted } from 'vue';
import { useLanguage } from '../composables/ui/useLanguage';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const emit = defineEmits<{ close: [] }>();

const { languages, activeId, refresh, setActive, openLocalesFolder } = useLanguage();

onMounted(() => {
    void refresh();
});

async function handleSelect(id: string) {
    if (id === activeId.value) return;
    await setActive(id);
}

async function handleOpenFolder() {
    await openLocalesFolder();
}

async function handleRefresh() {
    await refresh();
}
</script>

<template>
    <aside
        class="language-panel"
        aria-label="Language selection panel">
        <header class="language-header">
            <span class="language-title">{{ t('app.language_selector') }}</span>
            <div
                class="header-actions"
                role="toolbar"
                aria-label="Language panel controls">
                <button
                    class="icon-btn"
                    title="Refresh list"
                    aria-label="Refresh language list"
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
                    aria-label="Close language panel"
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
            class="language-list"
            role="listbox"
            aria-label="Available languages">
            <button
                v-for="language in languages"
                :key="language.id"
                class="language-item"
                :class="{ active: language.id === activeId }"
                role="option"
                :aria-selected="language.id === activeId"
                :aria-label="`${language.name} language`"
                @click="handleSelect(language.id)">
                <span class="language-name">{{ language.name }}</span>
                <svg
                    v-if="language.id === activeId"
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
                v-if="!languages.length"
                class="language-empty"
                role="status"
                >No languages found.</div
            >
        </div>

        <footer class="language-footer">
            <button
                class="footer-btn"
                aria-label="Open locales folder"
                @click="handleOpenFolder">
                Open locales folder…
            </button>
            <p class="footer-hint">
                Drop <code>.json</code> files in <code>~/.leaf/locales/</code> to add languages. Edit one to customize.
            </p>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
/* ––– Language Panel Container ––– */

.language-panel {
    display: flex;
    flex-direction: column;
    background: $base1;
    border-left: 1px solid $text3;
    overflow: hidden;
    color: $text1;
    width: 340px;
    min-width: 280px;
}

/* ––– Header ––– */

.language-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-3;
    border-bottom: 1px solid $text3;
    flex-shrink: 0;
}

.language-title {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    letter-spacing: 0.02em;
}

.header-actions {
    display: flex;
    gap: $space-1;
}

.icon-btn {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-1;
    border-radius: $border-radius-lg;
    transition: all $transition-base;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }

    svg {
        display: block;
    }
}

/* ––– Language List ––– */

.language-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow-y: auto;
    padding: 0;
    scrollbar-width: thin;
    scrollbar-color: $text3 transparent;

    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: $text3;
        border-radius: $border-radius-sm;

        &:hover {
            background: $text2;
        }
    }
}

.language-item {
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

/* ––– Language Metadata ––– */

.language-name {
    flex: 1;
    font-size: $font-size-sm;
}

.check {
    flex-shrink: 0;
    color: $accent-color;
}

.language-empty {
    padding: $space-4 $space-3;
    text-align: center;
    font-size: $font-size-xs;
    color: $text3;
}

/* ––– Footer ––– */

.language-footer {
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
    margin: 0;
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
</style>
