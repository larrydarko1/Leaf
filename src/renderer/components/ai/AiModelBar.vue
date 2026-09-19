<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { AiModelInfo, AiStatus } from '@/schemas/ai';
import { useSystemPrompt } from '@/renderer/composables/ai/useSystemPrompt';
import { useI18n } from 'vue-i18n';

type Props = {
    status: AiStatus;
    availableModels: AiModelInfo[];
    isLoading: boolean;
    selectedModelPath: string | null;
    selectedModelLabel: string;
    showHistory: boolean;
    isAnyGenerating: boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    'select-model': [model: AiModelInfo];
    'load-model': [];
    'unload-model': [];
    'open-models-folder': [];
    'refresh-models': [];
    'toggle-history': [];
    'new-conversation': [];
    'close': [];
}>();

const { t } = useI18n();

const dropdownRef = ref<HTMLElement | null>(null);
const showDropdown = ref(false);
const dropdownPosition = ref<Record<string, string>>({});
const { prompts, activeId, refresh: refreshPrompts, setActive } = useSystemPrompt();
const promptDropdownRef = ref<HTMLElement | null>(null);
const showPromptDropdown = ref(false);
const promptDropdownPosition = ref<Record<string, string>>({});
const activePromptName = computed(() => {
    const found = prompts.value.find((p) => p.id === activeId.value);
    return (
        (found?.name !== undefined && found.name !== '' ? found.name : null) ??
        (activeId.value !== null && activeId.value !== '' ? activeId.value : 'default')
    );
});

function toggleDropdown(): void {
    if (showDropdown.value) {
        showDropdown.value = false;
        return;
    }
    if (dropdownRef.value !== null) {
        const rect = dropdownRef.value.getBoundingClientRect();
        const menuWidth = Math.min(rect.width + 60, window.innerWidth - rect.left - 12);
        dropdownPosition.value = {
            top: `${rect.bottom + 4}px`,
            left: `${rect.left}px`,
            minWidth: `${menuWidth}px`,
        };
    }
    showDropdown.value = true;
}

function handleSelectModel(model: AiModelInfo): void {
    showDropdown.value = false;
    emit('select-model', model);
}

function handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    if (dropdownRef.value !== null && !dropdownRef.value.contains(target)) {
        showDropdown.value = false;
    }
    if (promptDropdownRef.value !== null && !promptDropdownRef.value.contains(target)) {
        showPromptDropdown.value = false;
    }
}

function togglePromptDropdown(): void {
    if (showPromptDropdown.value) {
        showPromptDropdown.value = false;
        return;
    }
    if (promptDropdownRef.value !== null) {
        const rect = promptDropdownRef.value.getBoundingClientRect();
        promptDropdownPosition.value = {
            top: `${rect.bottom + 4}px`,
            right: `${Math.max(12, window.innerWidth - rect.right)}px`,
            minWidth: '220px',
            maxWidth: '300px',
        };
    }
    showPromptDropdown.value = true;
}

async function handleSelectPrompt(id: string): Promise<void> {
    showPromptDropdown.value = false;
    await setActive(id);
}

function handleRefresh(): void {
    emit('refresh-models');
    void refreshPrompts();
}

function truncate(str: string, len: number): string {
    return str.length > len ? str.slice(0, len) + '…' : str;
}

void props;

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    void refreshPrompts();
});
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
    <div
        class="ai-model-bar row"
        role="toolbar"
        :aria-label="t('ai.model_controls')">
        <!-- Model selection and status pill -->
        <div class="ai-model-pill row fill">
            <!-- Model selector (when not loaded) -->
            <div
                v-if="!status.isModelLoaded"
                class="ai-model-selector row fill">
                <div
                    ref="dropdownRef"
                    class="ai-dropdown fill">
                    <button
                        class="ai-dropdown-trigger menu-trigger"
                        :disabled="isLoading"
                        aria-haspopup="listbox"
                        :aria-expanded="showDropdown"
                        @click="toggleDropdown()">
                        <span class="ai-dropdown-label menu-trigger-label">{{ selectedModelLabel }}</span>
                        <svg
                            class="ai-dropdown-chevron menu-chevron"
                            :class="{ open: showDropdown }"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    <Teleport to="body">
                        <div
                            v-if="showDropdown"
                            class="ai-dropdown-menu menu"
                            role="listbox"
                            :style="dropdownPosition">
                            <div
                                v-if="availableModels.length === 0"
                                class="ai-dropdown-empty menu-empty">
                                {{ t('ai.no_models_found') }}
                            </div>
                            <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
                            <div
                                v-for="model in availableModels"
                                :key="model.path"
                                v-memo="[model.path, selectedModelPath]"
                                class="ai-dropdown-item menu-item"
                                :class="{ selected: selectedModelPath === model.path }"
                                role="option"
                                :aria-selected="selectedModelPath === model.path"
                                @click="handleSelectModel(model)">
                                <span class="ai-dropdown-item-name menu-item-name">{{ truncate(model.name, 30) }}</span>
                                <span class="ai-dropdown-item-size menu-item-meta">{{ model.sizeFormatted }}</span>
                            </div>
                        </div>
                    </Teleport>
                </div>
                <button
                    class="ai-btn-small btn-accent"
                    :disabled="selectedModelPath === null || selectedModelPath === '' || isLoading"
                    @click="$emit('load-model')">
                    {{ isLoading ? t('ai.loading') : t('ai.load') }}
                </button>
            </div>

            <!-- Model status (when loaded) -->
            <div
                v-else
                class="ai-model-status row fill">
                <span
                    class="ai-model-indicator"
                    aria-hidden="true"></span>
                <span class="ai-model-name truncate">{{ status.currentModelName }}</span>
                <button
                    class="ai-btn-icon ai-btn-danger icon-btn icon-btn-lg icon-btn-danger"
                    :title="t('ai.unload_model')"
                    :aria-label="t('ai.unload_current_model')"
                    :disabled="status.isGenerating"
                    @click="$emit('unload-model')">
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="ai-bar-actions row">
            <!-- Open models folder -->
            <button
                class="ai-btn-icon icon-btn icon-btn-lg"
                :title="t('ai.open_models_folder')"
                :aria-label="t('ai.open_models_folder')"
                @click="$emit('open-models-folder')">
                <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true">
                    <path
                        d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.12.28.256.554.53L11 4c.816.816 1.224 1.224 1.712 1.495.274.15.56.263.86.348.536.153 1.113.153 2.268.153h.374c2.632 0 3.949 0 4.804.77.079.07.154.145.224.224C22 7.85 22 9.166 22 11.798V14c0 3.771 0 5.657-1.172 6.828C19.657 22 17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172C2 19.657 2 17.771 2 14V6.95z" />
                </svg>
            </button>

            <!-- System prompt picker -->
            <div
                ref="promptDropdownRef"
                class="ai-prompt-picker row">
                <button
                    class="ai-btn-icon icon-btn icon-btn-lg"
                    :class="{ 'ai-btn-active icon-btn-accent': showPromptDropdown }"
                    :title="`${t('ai.system_prompt')}: ${activePromptName}`"
                    :aria-label="`${t('ai.system_prompt')}: ${activePromptName}`"
                    aria-haspopup="listbox"
                    :aria-expanded="showPromptDropdown"
                    @click="togglePromptDropdown()">
                    <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </button>
                <Teleport to="body">
                    <div
                        v-if="showPromptDropdown"
                        class="ai-dropdown-menu ai-prompt-menu menu"
                        role="listbox"
                        :style="promptDropdownPosition">
                        <div class="ai-prompt-menu-header menu-header">{{ t('ai.system_prompt') }}</div>
                        <div
                            v-if="prompts.length === 0"
                            class="ai-dropdown-empty menu-empty">
                            {{ t('ai.no_prompts_found') }}
                        </div>
                        <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
                        <div
                            v-for="prompt in prompts"
                            :key="prompt.id"
                            v-memo="[prompt.id, activeId]"
                            class="ai-dropdown-item ai-prompt-item menu-item menu-item-stacked"
                            :class="{ selected: prompt.id === activeId }"
                            role="option"
                            :aria-selected="prompt.id === activeId"
                            @click="handleSelectPrompt(prompt.id)">
                            <div class="ai-prompt-item-main stack fill">
                                <span class="ai-prompt-item-name">{{ prompt.name }}</span>
                                <span
                                    v-if="prompt.description"
                                    class="ai-prompt-item-desc">
                                    {{ prompt.description }}
                                </span>
                            </div>
                        </div>
                    </div>
                </Teleport>
            </div>

            <!-- Refresh models folder -->
            <button
                class="ai-btn-icon icon-btn icon-btn-lg"
                :title="t('ai.refresh_models_folder')"
                :aria-label="t('ai.refresh_models_folder')"
                @click="handleRefresh()">
                <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
            </button>

            <!-- Conversation history -->
            <button
                class="ai-btn-icon icon-btn icon-btn-lg"
                :class="{ 'ai-btn-active icon-btn-accent': showHistory }"
                :title="t('ai.conversation_history')"
                :aria-label="t('ai.conversation_history')"
                :aria-pressed="showHistory"
                @click="$emit('toggle-history')">
                <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <circle
                        cx="12"
                        cy="12"
                        r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            </button>

            <!-- New conversation -->
            <button
                class="ai-btn-icon icon-btn icon-btn-lg"
                :title="t('ai.new_conversation')"
                :aria-label="t('ai.new_conversation')"
                @click="$emit('new-conversation')">
                <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <line
                        x1="12"
                        y1="5"
                        x2="12"
                        y2="19" />
                    <line
                        x1="5"
                        y1="12"
                        x2="19"
                        y2="12" />
                </svg>
            </button>

            <!-- Close -->
            <button
                class="ai-btn-icon icon-btn icon-btn-lg"
                :title="t('ai.close')"
                :aria-label="t('ai.close')"
                @click="$emit('close')">
                <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18" />
                    <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18" />
                </svg>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.ai-model-bar {
    flex-shrink: 0;
    gap: $space-2;
    padding: $space-2 $space-3;
}

// The model name and its status share one rounded well, so the bar reads as two
// objects — what is loaded, and what can be done — rather than six controls.
.ai-model-pill {
    padding: $space-1 $space-2;
    background: $bg-primary;
    border: $border-width-thin $text3;
    border-radius: $border-radius-lg;
}

.ai-model-selector {
    gap: $space-2;
}

.ai-dropdown {
    position: relative;
}

// Teleported to the body and positioned against the trigger by script, so unlike
// the other menus it is fixed rather than absolute, and has to clear the editor's
// own stacking contexts.
.ai-dropdown-menu {
    position: fixed;
    z-index: $z-extreme;
}

.ai-model-status {
    padding: 0 $space-1;
}

// The lit dot that says a model is resident. The glow is what separates "loaded"
// from "selected" at this size.
.ai-model-indicator {
    flex-shrink: 0;
    width: $size-4;
    height: $size-4;
    background: $accent-color;
    border-radius: $border-radius-round;
    box-shadow: $accent-shadow;
}

.ai-model-name {
    color: $text2;
    font-size: $font-size-xs;
}

// The action cluster is its own pill, tighter than `.panel-actions` because the
// buttons are the row rather than trailing a title.
.ai-bar-actions {
    flex-shrink: 0;
    gap: $space-0;
    padding: $space-0 $space-1;
    background: $bg-primary;
    border: $border-width-thin $text3;
    border-radius: $border-radius-xl;
}

// –– System prompt picker ––––––––––––––––––––

.ai-prompt-picker {
    position: relative;
}

// Held open to a minimum height so the list does not resize under the pointer as
// the descriptions wrap.
.ai-prompt-menu {
    min-height: $size-26;
}

.ai-prompt-item {
    margin-bottom: $space-1;
}

.ai-prompt-item-main {
    gap: $space-0;
}

.ai-prompt-item-name {
    font-size: $font-size-xs;
    line-height: $line-height;
}

.ai-prompt-item-desc {
    color: $text2;
    font-size: $font-size-xs;
    line-height: $line-height;
}
</style>
