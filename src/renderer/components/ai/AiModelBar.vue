<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { AiModelInfo, AiStatus } from '../../types/ai';

defineProps<{
    status: AiStatus;
    availableModels: AiModelInfo[];
    isLoading: boolean;
    selectedModelPath: string | null;
    selectedModelLabel: string;
    showHfPanel: boolean;
    showHistory: boolean;
    agentMode: boolean;
    isAnyGenerating: boolean;
}>();

const emit = defineEmits<{
    (e: 'select-model', model: AiModelInfo): void;
    (e: 'load-model'): void;
    (e: 'unload-model'): void;
    (e: 'open-models-folder'): void;
    (e: 'refresh-models'): void;
    (e: 'toggle-hf-panel'): void;
    (e: 'toggle-history'): void;
    (e: 'toggle-agent-mode'): void;
    (e: 'new-conversation'): void;
    (e: 'close'): void;
}>();

// Dropdown state managed locally — the DOM element lives here
const dropdownRef = ref<HTMLElement | null>(null);
const showDropdown = ref(false);
const dropdownPosition = ref<Record<string, string>>({});

function toggleDropdown() {
    if (showDropdown.value) {
        showDropdown.value = false;
        return;
    }
    if (dropdownRef.value) {
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
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
        showDropdown.value = false;
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));

function truncate(str: string, len: number): string {
    return str.length > len ? str.slice(0, len) + '…' : str;
}
</script>

<template>
    <div class="ai-model-bar">
        <div class="ai-model-pill">
            <div v-if="!status.isModelLoaded" class="ai-model-selector">
                <div ref="dropdownRef" class="ai-dropdown">
                    <button 
                        class="ai-dropdown-trigger" 
                        :disabled="isLoading" 
                        @click="toggleDropdown()"
                    >
                        <span class="ai-dropdown-label">{{ selectedModelLabel }}</span>
                        <svg class="ai-dropdown-chevron" :class="{ open: showDropdown }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <Teleport to="body">
                        <div 
                            v-if="showDropdown" 
                            class="ai-dropdown-menu"
                            :style="dropdownPosition"
                        >
                            <div 
                                v-if="availableModels.length === 0" 
                                class="ai-dropdown-empty"
                            >
                                No models found
                            </div>
                            <div 
                                v-for="m in availableModels" 
                                :key="m.path" 
                                class="ai-dropdown-item"
                                :class="{ selected: selectedModelPath === m.path }"
                                @click="handleSelectModel(m)"
                            >
                                <span class="ai-dropdown-item-name">{{ truncate(m.name, 30) }}</span>
                                <span class="ai-dropdown-item-size">{{ m.sizeFormatted }}</span>
                            </div>
                        </div>
                    </Teleport>
                </div>
                <button 
                    class="ai-btn-small" 
                    :disabled="!selectedModelPath || isLoading" 
                    @click="$emit('load-model')"
                >
                    {{ isLoading ? '...' : 'Load' }}
                </button>
            </div>
            <div v-else class="ai-model-status">
                <span class="ai-model-indicator"></span>
                <span class="ai-model-name">{{ status.currentModelName }}</span>
                <button class="ai-btn-icon ai-btn-danger" title="Unload model" :disabled="status.isGenerating" @click="$emit('unload-model')">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="ai-bar-actions">
            <button class="ai-btn-icon" title="Open models folder" @click="$emit('open-models-folder')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.12.28.256.554.53L11 4c.816.816 1.224 1.224 1.712 1.495.274.15.56.263.86.348.536.153 1.113.153 2.268.153h.374c2.632 0 3.949 0 4.804.77.079.07.154.145.224.224C22 7.85 22 9.166 22 11.798V14c0 3.771 0 5.657-1.172 6.828C19.657 22 17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172C2 19.657 2 17.771 2 14V6.95z"/>
                </svg>
            </button>
            <button 
                class="ai-btn-icon" 
                :class="{ 'ai-btn-active': showHfPanel }" 
                title="Download models from Hugging Face"
                @click="$emit('toggle-hf-panel')"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </button>
            <button class="ai-btn-icon" title="Refresh model list" @click="$emit('refresh-models')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
            </button>
            <button 
                class="ai-btn-icon" 
                :class="{ 'ai-btn-active': showHistory }" 
                title="Conversation history"
                @click="$emit('toggle-history')"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
            </button>
            <button 
                v-if="status.isModelLoaded"
                class="ai-btn-icon" 
                :class="{ 'ai-btn-active': agentMode }" 
                title="Agent mode — AI can read and edit files"
                @click="$emit('toggle-agent-mode')"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
            </button>
            <button 
                class="ai-btn-icon" 
                title="New conversation" 
                @click="$emit('new-conversation')"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
            <button class="ai-btn-icon" title="Close" @click="$emit('close')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.ai-model-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
}

.ai-model-pill {
    flex: 1;
    min-width: 0;
    background: var(--bg-primary);
    border: 1px solid var(--text3);
    border-radius: 10px;
    padding: 0.2rem 0.35rem;
    display: flex;
    align-items: center;
}

.ai-model-selector {
    display: flex;
    align-items: center;
    gap: 0.375rem;
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
    gap: 0.35rem;
    width: 100%;
    padding: 0.25rem 0.4rem;
    background: transparent;
    color: var(--text1);
    border: none;
    font-size: 0.75rem;
    cursor: pointer;
    text-align: left;
    border-radius: 6px;
    transition: background 0.15s;

    &:hover:not(:disabled) { background: var(--bg-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.ai-dropdown-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text2);
}

.ai-dropdown-chevron {
    flex-shrink: 0;
    color: var(--text2);
    transition: transform 0.2s;
    &.open { transform: rotate(180deg); }
}

.ai-dropdown-menu {
    position: fixed;
    background: var(--bg-secondary, var(--bg-primary));
    border: 1px solid var(--text3);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    padding: 0.3rem;
    z-index: 10000;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    max-height: 200px;
    max-width: calc(100vw - 24px);
    overflow-y: auto;
    overflow-x: hidden;
}

.ai-dropdown-empty {
    padding: 0.5rem 0.65rem;
    font-size: 0.75rem;
    color: var(--text2);
    text-align: center;
}

.ai-dropdown-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text1);
    transition: background 0.12s;

    &:hover { background: var(--bg-hover); }
    &.selected { background: var(--bg-hover); color: var(--accent-color); }
}

.ai-dropdown-item-name {
    flex: 1;
    min-width: 0;
    word-break: break-word;
    line-height: 1.35;
}

.ai-dropdown-item-size {
    flex-shrink: 0;
    font-size: 0.68rem;
    color: var(--text2);
    opacity: 0.7;
}

.ai-model-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
    min-width: 0;
    padding: 0 0.2rem;
}

.ai-model-indicator {
    width: 7px;
    height: 7px;
    background: var(--accent-color);
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px var(--accent-color);
}

.ai-model-name {
    font-size: 0.75rem;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ai-bar-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    flex-shrink: 0;
    background: var(--bg-primary);
    border: 1px solid var(--text3);
    border-radius: 10px;
    padding: 0.15rem 0.2rem;
}

.ai-btn-icon {
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;

    &:hover:not(:disabled) { background: var(--bg-hover); color: var(--text1); }
    &:disabled { opacity: 0.3; cursor: not-allowed; }
}

.ai-btn-danger {
    &:hover:not(:disabled) { color: var(--danger-color); }
}

.ai-btn-active {
    color: var(--accent-color) !important;
    background: var(--bg-hover);
}

.ai-btn-small {
    padding: 0.25rem 0.55rem;
    background: var(--accent-color);
    color: var(--base1);
    border: none;
    border-radius: 7px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.2s, transform 0.15s;

    &:hover:not(:disabled) { opacity: 0.85; transform: scale(1.03); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
}
</style>
