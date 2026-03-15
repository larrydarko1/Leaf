import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { AiModelInfo, AiStatus } from '../../types/ai';

export function useAIModel() {
    const status = ref<AiStatus>({
        isModelLoaded: false,
        currentModelPath: null,
        currentModelName: null,
        isGenerating: false,
        modelsDir: '',
        contextTokens: 0,
        contextSize: 0,
    });

    const availableModels = ref<AiModelInfo[]>([]);
    const isLoading = ref(false);
    const selectedModelPath = ref('');
    const lastUsedModelName = ref<string | null>(null);

    // Dropdown
    const showDropdown = ref(false);
    const dropdownRef = ref<HTMLElement | null>(null);
    const dropdownPosition = ref<{ top: string; left: string; minWidth: string }>({
        top: '0px',
        left: '0px',
        minWidth: '0px',
    });

    const previousModelMatch = computed(() => {
        if (!lastUsedModelName.value || status.value.isModelLoaded) return null;
        return (
            availableModels.value.find(
                (m) => m.name === lastUsedModelName.value || m.path.endsWith(lastUsedModelName.value!),
            ) || null
        );
    });

    const isReady = computed(() => status.value.isModelLoaded);
    const isAnyGenerating = computed(() => status.value.isGenerating);

    const selectedModelLabel = computed(() => {
        if (!selectedModelPath.value) return 'Select a model...';
        const model = availableModels.value.find((m) => m.path === selectedModelPath.value);
        return model ? truncate(model.name, 30) : 'Select a model...';
    });

    function truncate(text: string, max: number): string {
        return text.length > max ? text.slice(0, max) + '...' : text;
    }

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

    function selectModel(model: AiModelInfo) {
        selectedModelPath.value = model.path;
        showDropdown.value = false;
    }

    function handleDropdownClickOutside(event: MouseEvent) {
        if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
            showDropdown.value = false;
        }
    }

    async function refreshModels() {
        try {
            const result = await window.electronAPI.aiListModels();
            if (result.success) availableModels.value = result.models;
        } catch (error) {
            console.error('Failed to list models:', error);
        }
    }

    async function refreshStatus() {
        try {
            status.value = await window.electronAPI.aiGetStatus();
        } catch (error) {
            console.error('Failed to get AI status:', error);
        }
    }

    /** Load a model by path (defaults to selectedModelPath). Caller handles post-load orchestration. */
    async function loadModel(path: string = selectedModelPath.value): Promise<{ success: boolean; error?: string }> {
        if (!path) return { success: false, error: 'No model selected' };
        isLoading.value = true;
        try {
            const result = await window.electronAPI.aiLoadModel(path);
            if (result.success) {
                await refreshStatus();
                return { success: true };
            }
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        } finally {
            isLoading.value = false;
        }
    }

    /** Bare unload — caller must stop generation and save conversation before calling. */
    async function unloadModel() {
        try {
            if (status.value.currentModelName) {
                lastUsedModelName.value = status.value.currentModelName;
            }
            await window.electronAPI.aiUnloadModel();
            await refreshStatus();
            if (previousModelMatch.value) {
                selectedModelPath.value = previousModelMatch.value.path;
            }
        } catch (error) {
            console.error('Failed to unload model:', error);
        }
    }

    /**
     * Load the previously used model and optionally restore chat history.
     * Caller handles `startNewConversation` if there was no active conversation.
     */
    async function loadPreviousModel(
        chatHistory: { role: string; content: string }[],
        hasActiveConversation: boolean,
    ): Promise<{ success: boolean; error?: string }> {
        const result = await loadModel(previousModelMatch.value?.path ?? '');
        if (result.success && hasActiveConversation && chatHistory.length > 0) {
            try {
                await window.electronAPI.aiRestoreChatHistory(
                    chatHistory
                        .filter((m) => m.role !== 'system')
                        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                );
            } catch (err) {
                console.error('Failed to restore chat history:', err);
            }
        }
        return result;
    }

    async function openModelsFolder() {
        try {
            await window.electronAPI.aiOpenModelsDir();
        } catch (error) {
            console.error('Failed to open models dir:', error);
        }
    }

    onMounted(() => {
        document.addEventListener('click', handleDropdownClickOutside);
    });

    onUnmounted(() => {
        document.removeEventListener('click', handleDropdownClickOutside);
    });

    return {
        status,
        availableModels,
        isLoading,
        selectedModelPath,
        lastUsedModelName,
        showDropdown,
        dropdownRef,
        dropdownPosition,
        previousModelMatch,
        isReady,
        isAnyGenerating,
        selectedModelLabel,
        truncate,
        toggleDropdown,
        selectModel,
        refreshModels,
        refreshStatus,
        loadModel,
        unloadModel,
        loadPreviousModel,
        openModelsFolder,
    };
}
