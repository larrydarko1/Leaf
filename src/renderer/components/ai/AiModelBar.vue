<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { AiModelInfo, AiStatus } from '@/schemas/ai';
import { useSystemPrompt } from '@/renderer/composables/ai/useSystemPrompt';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    status: AiStatus;
    availableModels: AiModelInfo[];
    isLoading: boolean;
    selectedModelPath: string | null;
    selectedModelLabel: string;
    showHfPanel: boolean;
    showHistory: boolean;
    agentMode: boolean;
    isAnyGenerating: boolean;
};

const props = defineProps<Props>();
void props;

const emit = defineEmits<{
    'select-model': [model: AiModelInfo];
    'load-model': [];
    'unload-model': [];
    'open-models-folder': [];
    'refresh-models': [];
    'toggle-hf-panel': [];
    'toggle-history': [];
    'toggle-agent-mode': [];
    'new-conversation': [];
    'close': [];
}>();

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

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    void refreshPrompts();
});
onUnmounted(() => document.removeEventListener('click', handleClickOutside));

function toggleDropdown() {
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

function handleSelectModel(model: AiModelInfo) {
    showDropdown.value = false;
    emit('select-model', model);
}

function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;
    if (dropdownRef.value !== null && !dropdownRef.value.contains(target)) {
        showDropdown.value = false;
    }
    if (promptDropdownRef.value !== null && !promptDropdownRef.value.contains(target)) {
        showPromptDropdown.value = false;
    }
}

function togglePromptDropdown() {
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

async function handleSelectPrompt(id: string) {
    showPromptDropdown.value = false;
    await setActive(id);
}

function handleRefresh() {
    emit('refresh-models');
    void refreshPrompts();
}

function truncate(str: string, len: number): string {
    return str.length > len ? str.slice(0, len) + '…' : str;
}
</script>

<template>
    <div
        class="ai-model-bar"
        role="toolbar"
        :aria-label="t('ai.model_controls')">
        <!-- Model selection and status pill -->
        <div class="ai-model-pill">
            <!-- Model selector (when not loaded) -->
            <div
                v-if="!status.isModelLoaded"
                class="ai-model-selector">
                <div
                    ref="dropdownRef"
                    class="ai-dropdown">
                    <button
                        class="ai-dropdown-trigger"
                        :disabled="isLoading"
                        aria-haspopup="listbox"
                        :aria-expanded="showDropdown"
                        @click="toggleDropdown()">
                        <span class="ai-dropdown-label">{{ selectedModelLabel }}</span>
                        <svg
                            class="ai-dropdown-chevron"
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
                            class="ai-dropdown-menu"
                            role="listbox"
                            :style="dropdownPosition">
                            <div
                                v-if="availableModels.length === 0"
                                class="ai-dropdown-empty">
                                {{ t('ai.no_models_found') }}
                            </div>
                            <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
                            <div
                                v-for="model in availableModels"
                                :key="model.path"
                                v-memo="[model.path, selectedModelPath]"
                                class="ai-dropdown-item"
                                :class="{ selected: selectedModelPath === model.path }"
                                role="option"
                                :aria-selected="selectedModelPath === model.path"
                                @click="handleSelectModel(model)">
                                <span class="ai-dropdown-item-name">{{ truncate(model.name, 30) }}</span>
                                <span class="ai-dropdown-item-size">{{ model.sizeFormatted }}</span>
                            </div>
                        </div>
                    </Teleport>
                </div>
                <button
                    class="ai-btn-small"
                    :disabled="selectedModelPath === null || selectedModelPath === '' || isLoading"
                    @click="$emit('load-model')">
                    {{ isLoading ? t('ai.loading') : t('ai.load') }}
                </button>
            </div>

            <!-- Model status (when loaded) -->
            <div
                v-else
                class="ai-model-status">
                <span
                    class="ai-model-indicator"
                    aria-hidden="true"></span>
                <span class="ai-model-name">{{ status.currentModelName }}</span>
                <button
                    class="ai-btn-icon ai-btn-danger"
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
        <div class="ai-bar-actions">
            <!-- Open models folder -->
            <button
                class="ai-btn-icon"
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
                class="ai-prompt-picker">
                <button
                    class="ai-btn-icon"
                    :class="{ 'ai-btn-active': showPromptDropdown }"
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
                        class="ai-dropdown-menu ai-prompt-menu"
                        role="listbox"
                        :style="promptDropdownPosition">
                        <div class="ai-prompt-menu-header">{{ t('ai.system_prompt') }}</div>
                        <div
                            v-if="prompts.length === 0"
                            class="ai-dropdown-empty">
                            {{ t('ai.no_prompts_found') }}
                        </div>
                        <!-- eslint-disable-next-line a11y/click-events-have-key-events a11y/interactive-supports-focus -->
                        <div
                            v-for="prompt in prompts"
                            :key="prompt.id"
                            v-memo="[prompt.id, activeId]"
                            class="ai-dropdown-item ai-prompt-item"
                            :class="{ selected: prompt.id === activeId }"
                            role="option"
                            :aria-selected="prompt.id === activeId"
                            @click="handleSelectPrompt(prompt.id)">
                            <div class="ai-prompt-item-main">
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

            <!-- Download from Hugging Face -->
            <button
                class="ai-btn-icon"
                :class="{ 'ai-btn-active': showHfPanel }"
                :title="t('ai.hf_model_browser')"
                :aria-label="t('ai.hf_model_browser')"
                :aria-pressed="showHfPanel"
                @click="$emit('toggle-hf-panel')">
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line
                        x1="12"
                        y1="15"
                        x2="12"
                        y2="3" />
                </svg>
            </button>

            <!-- Refresh models folder -->
            <button
                class="ai-btn-icon"
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
                class="ai-btn-icon"
                :class="{ 'ai-btn-active': showHistory }"
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

            <!-- Agent mode toggle -->
            <button
                v-if="status.isModelLoaded"
                class="ai-btn-icon"
                :class="{ 'ai-btn-active': agentMode }"
                :title="t('ai.agent_mode')"
                :aria-label="t('ai.agent_mode')"
                :aria-pressed="agentMode"
                @click="$emit('toggle-agent-mode')">
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
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
            </button>

            <!-- New conversation -->
            <button
                class="ai-btn-icon"
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
                class="ai-btn-icon"
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
/* ––– Root Container ––– */

.ai-model-bar {
    display: flex;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-3;
    flex-shrink: 0;
}

/* ––– Model Pill (Selector + Status) ––– */

.ai-model-pill {
    flex: 1;
    min-width: 0;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-lg;
    padding: $space-1 $space-2;
    display: flex;
    align-items: center;
}

.ai-model-selector {
    display: flex;
    align-items: center;
    gap: $space-2;
    flex: 1;
    min-width: 0;
}

.ai-dropdown {
    flex: 1;
    min-width: 0;
    position: relative;
}

.ai-dropdown-trigger {
    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    padding: $space-1 $space-2;
    background: transparent;
    color: $text1;
    border: none;
    font-size: $font-size-xs;
    cursor: pointer;
    text-align: left;
    border-radius: $border-radius;
    transition: background $transition-fast;

    &:hover:not(:disabled) {
        background: $bg-hover;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.ai-dropdown-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: $text2;
}

.ai-dropdown-chevron {
    flex-shrink: 0;
    color: $text2;
    transition: transform $transition-base;

    &.open {
        transform: rotate(180deg);
    }
}

.ai-dropdown-menu {
    position: fixed;
    background: var(--bg-secondary, $bg-primary);
    border: 1px solid $text3;
    border-radius: $border-radius-lg;
    box-shadow: 0 6px 20px rgb(0 0 0 / 20%);
    padding: $space-2;
    z-index: $z-extreme;
    backdrop-filter: blur(20px);
    max-height: 200px;
    max-width: calc(100vw - 24px);
    overflow: hidden auto;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.ai-dropdown-empty {
    padding: $space-2 $space-3;
    font-size: $font-size-xs;
    color: $text2;
    text-align: center;
}

.ai-dropdown-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-2;
    padding: $space-2 $space-3;
    border-radius: $border-radius;
    cursor: pointer;
    font-size: $font-size-xs;
    color: $text1;
    transition: background $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.selected {
        background: $bg-hover;
        color: $accent-color;
    }
}

.ai-dropdown-item-name {
    flex: 1;
    min-width: 0;
    overflow-wrap: break-word;
    line-height: $line-height;
}

.ai-dropdown-item-size {
    flex-shrink: 0;
    font-size: $font-size-xs;
    color: $text2;
    opacity: 0.7;
}

.ai-model-status {
    display: flex;
    align-items: center;
    gap: $space-2;
    flex: 1;
    min-width: 0;
    padding: 0 $space-1;
}

.ai-model-indicator {
    width: 7px;
    height: 7px;
    background: $accent-color;
    border-radius: $border-radius-round;
    flex-shrink: 0;
    box-shadow: 0 0 4px $accent-color;
}

.ai-model-name {
    font-size: $font-size-xs;
    color: $text2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ––– Action Buttons Container ––– */

.ai-bar-actions {
    display: flex;
    align-items: center;
    gap: $space-0;
    flex-shrink: 0;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-xl;
    padding: $space-0 $space-1;
}

.ai-btn-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-2;
    border-radius: $border-radius;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-base;
    flex-shrink: 0;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.ai-btn-danger {
    &:hover:not(:disabled) {
        color: $danger-color;
    }
}

.ai-btn-active {
    color: $accent-color;
    background: $bg-hover;
}

.ai-btn-small {
    padding: $space-1 $space-2;
    background: $accent-color;
    color: $base1;
    border: none;
    border-radius: $border-radius-lg;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition:
        opacity $transition-base,
        transform $transition-fast;

    &:hover:not(:disabled) {
        opacity: 0.85;
        transform: scale(1.03);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
}

/* ––– System Prompt Picker ––– */

.ai-prompt-picker {
    position: relative;
    display: flex;
    align-items: center;
}

.ai-prompt-menu {
    padding: $space-2;
    min-height: 250px;
}

.ai-prompt-menu-header {
    padding: $space-1 $space-2 $space-1;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $text2;
}

.ai-prompt-item {
    align-items: flex-start;
    margin-bottom: $space-1;
}

.ai-prompt-item-main {
    display: flex;
    flex-direction: column;
    gap: $space-0;
    min-width: 0;
    flex: 1;
}

.ai-prompt-item-name {
    font-size: $font-size-xs;
    line-height: $line-height;
}

.ai-prompt-item-desc {
    font-size: $font-size-xs;
    color: $text2;
    line-height: $line-height;
}
</style>
