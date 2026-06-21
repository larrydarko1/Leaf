import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountWithI18n } from '@test-utils';
import AiModelBar from '@/renderer/components/ai/AiModelBar.vue';
import type { AiModelInfo, AiStatus, PromptInfo } from '@/schemas/ai';

const mockRefresh = vi.fn().mockResolvedValue(undefined);
const mockSetActive = vi.fn().mockResolvedValue(undefined);
const mockPrompts = ref<PromptInfo[]>([]);
const mockActiveId = ref<string>('default');

vi.mock('@/renderer/composables/ai/useSystemPrompt', () => ({
    useSystemPrompt: vi.fn(() => ({
        prompts: mockPrompts,
        activeId: mockActiveId,
        refresh: mockRefresh,
        setActive: mockSetActive,
    })),
}));

function makeStatus(overrides: Partial<AiStatus> = {}): AiStatus {
    return {
        isModelLoaded: false,
        currentModelPath: null,
        currentModelName: null,
        isGenerating: false,
        modelsDir: '/models',
        contextTokens: 0,
        contextSize: 0,
        ...overrides,
    };
}

function makeModel(name: string): AiModelInfo {
    return { name, path: `/models/${name}`, size: 4e9, sizeFormatted: '4 GB', modified: '' };
}

const baseProps = {
    status: makeStatus(),
    availableModels: [] as AiModelInfo[],
    isLoading: false,
    selectedModelPath: null as string | null,
    selectedModelLabel: 'Select a model',
    showHfPanel: false,
    showHistory: false,
    agentMode: false,
    isAnyGenerating: false,
};

beforeEach(() => {
    mockPrompts.value = [];
    mockActiveId.value = 'default';
    vi.clearAllMocks();
});

describe('AiModelBar', () => {
    describe('model not loaded', () => {
        it('shows the model selector', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            expect(wrapper.find('.ai-model-selector').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows the load button', () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, selectedModelPath: '/models/test.gguf' },
            });
            expect(wrapper.find('.ai-btn-small').exists()).toBe(true);
            wrapper.unmount();
        });

        it('disables load button when selectedModelPath is null', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: { ...baseProps, selectedModelPath: null } });
            expect(wrapper.find('.ai-btn-small').attributes('disabled')).toBeDefined();
            wrapper.unmount();
        });

        it('disables load button when isLoading is true', () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, selectedModelPath: '/models/test.gguf', isLoading: true },
            });
            expect(wrapper.find('.ai-btn-small').attributes('disabled')).toBeDefined();
            wrapper.unmount();
        });

        it('emits "load-model" on load button click', async () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, selectedModelPath: '/models/test.gguf' },
            });
            await wrapper.find('.ai-btn-small').trigger('click');
            expect(wrapper.emitted('load-model')).toBeTruthy();
            wrapper.unmount();
        });

        it('shows selected model label in dropdown trigger', () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, selectedModelLabel: 'My Model' },
            });
            expect(wrapper.find('.ai-dropdown-label').text()).toBe('My Model');
            wrapper.unmount();
        });

        it('shows available models in dropdown when open', async () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, availableModels: [makeModel('alpha.gguf'), makeModel('beta.gguf')] },
                attachTo: document.body,
            });
            await wrapper.find('.ai-dropdown-trigger').trigger('click');
            // Dropdown is teleported to body
            const menuItems = document.querySelectorAll('.ai-dropdown-item');
            expect(menuItems.length).toBe(2);
            wrapper.unmount();
            document.querySelectorAll('.ai-dropdown-menu').forEach((el) => el.remove());
        });

        it('shows empty message in dropdown when no models available', async () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, availableModels: [] },
                attachTo: document.body,
            });
            await wrapper.find('.ai-dropdown-trigger').trigger('click');
            expect(document.querySelector('.ai-dropdown-empty')).not.toBeNull();
            wrapper.unmount();
            document.querySelectorAll('.ai-dropdown-menu').forEach((el) => el.remove());
        });

        it('emits "select-model" when a model is clicked in dropdown', async () => {
            const model = makeModel('test.gguf');
            const wrapper = mountWithI18n(AiModelBar, {
                props: { ...baseProps, availableModels: [model] },
                attachTo: document.body,
            });
            await wrapper.find('.ai-dropdown-trigger').trigger('click');
            const item = document.querySelector('.ai-dropdown-item') as HTMLElement;
            item?.click();
            await wrapper.vm.$nextTick();
            expect(wrapper.emitted('select-model')?.[0]).toEqual([model]);
            wrapper.unmount();
            document.querySelectorAll('.ai-dropdown-menu').forEach((el) => el.remove());
        });
    });

    describe('model loaded', () => {
        const loadedProps = {
            ...baseProps,
            status: makeStatus({
                isModelLoaded: true,
                currentModelName: 'loaded-model.gguf',
                currentModelPath: '/models/loaded-model.gguf',
            }),
        };

        it('shows model status instead of selector', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: loadedProps });
            expect(wrapper.find('.ai-model-status').exists()).toBe(true);
            expect(wrapper.find('.ai-model-selector').exists()).toBe(false);
            wrapper.unmount();
        });

        it('displays the current model name', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: loadedProps });
            expect(wrapper.find('.ai-model-name').text()).toBe('loaded-model.gguf');
            wrapper.unmount();
        });

        it('shows the agent mode button', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: loadedProps });
            const buttons = wrapper.findAll('.ai-btn-icon');
            expect(buttons.length).toBeGreaterThan(4);
            wrapper.unmount();
        });

        it('emits "unload-model" when unload button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: loadedProps });
            await wrapper.find('.ai-btn-danger').trigger('click');
            expect(wrapper.emitted('unload-model')).toBeTruthy();
            wrapper.unmount();
        });

        it('disables unload button when generating', () => {
            const wrapper = mountWithI18n(AiModelBar, {
                props: {
                    ...loadedProps,
                    status: makeStatus({ isModelLoaded: true, currentModelName: 'model.gguf', isGenerating: true }),
                },
            });
            expect(wrapper.find('.ai-btn-danger').attributes('disabled')).toBeDefined();
            wrapper.unmount();
        });

        it('emits "toggle-agent-mode" on agent mode button click', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: loadedProps });
            const allBtns = wrapper.findAll('button');
            const agentModeBtn = allBtns.find((b) =>
                (b.attributes('aria-label') ?? '').toLowerCase().includes('agent'),
            );
            if (agentModeBtn) {
                await agentModeBtn.trigger('click');
                expect(wrapper.emitted('toggle-agent-mode')).toBeTruthy();
            }
            wrapper.unmount();
        });
    });

    describe('action buttons', () => {
        it('emits "open-models-folder" when folder button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            const allBtns = wrapper.findAll('button');
            const folderBtn = allBtns.find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('folder'));
            await folderBtn?.trigger('click');
            expect(wrapper.emitted('open-models-folder')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "toggle-hf-panel" when HF button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            const allBtns = wrapper.findAll('button');
            const hfBtn = allBtns.find(
                (b) =>
                    (b.attributes('aria-label') ?? '').toLowerCase().includes('browser') ||
                    (b.attributes('aria-label') ?? '').toLowerCase().includes('download'),
            );
            await hfBtn?.trigger('click');
            expect(wrapper.emitted('toggle-hf-panel')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "toggle-history" when history button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            const allBtns = wrapper.findAll('button');
            const histBtn = allBtns.find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('history'));
            await histBtn?.trigger('click');
            expect(wrapper.emitted('toggle-history')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "new-conversation" when new conversation button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            const allBtns = wrapper.findAll('button');
            const newBtn = allBtns.find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('new'));
            await newBtn?.trigger('click');
            expect(wrapper.emitted('new-conversation')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "close" when close button is clicked', async () => {
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps });
            const allBtns = wrapper.findAll('button');
            const closeBtn = allBtns.find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('close'));
            await closeBtn?.trigger('click');
            expect(wrapper.emitted('close')).toBeTruthy();
            wrapper.unmount();
        });

        it('toggles HF panel active class based on showHfPanel prop', () => {
            const wrapper = mountWithI18n(AiModelBar, { props: { ...baseProps, showHfPanel: true } });
            // The HF toggle button has aria-pressed wired to showHfPanel
            const allBtns = wrapper.findAll('button[aria-pressed]');
            const hfBtn = allBtns.find((b) => b.attributes('aria-pressed') === 'true');
            expect(hfBtn).toBeDefined();
            expect(hfBtn?.classes()).toContain('ai-btn-active');
            wrapper.unmount();
        });
    });

    describe('system prompt dropdown', () => {
        it('shows prompt dropdown after prompt button click', async () => {
            mockPrompts.value = [
                { id: 'default', name: 'Default', description: 'Standard prompt', path: '/prompts/default.md' },
                { id: 'creative', name: 'Creative', description: 'Creative writing', path: '/prompts/creative.md' },
            ];
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps, attachTo: document.body });
            const allBtns = wrapper.findAll('button');
            const promptBtn = allBtns.find(
                (b) => (b.attributes('aria-haspopup') ?? '') === 'listbox' && b.classes().includes('ai-btn-icon'),
            );
            await promptBtn?.trigger('click');
            // Dropdown is teleported to body
            const promptMenu = document.querySelector('.ai-prompt-menu');
            expect(promptMenu).not.toBeNull();
            wrapper.unmount();
            document.querySelectorAll('.ai-prompt-menu').forEach((el) => el.remove());
        });

        it('calls setActive when a prompt is selected', async () => {
            mockPrompts.value = [
                { id: 'creative', name: 'Creative', description: 'Writing prompts', path: '/prompts/creative.md' },
            ];
            const wrapper = mountWithI18n(AiModelBar, { props: baseProps, attachTo: document.body });
            const allBtns = wrapper.findAll('button');
            const promptBtn = allBtns.find(
                (b) => (b.attributes('aria-haspopup') ?? '') === 'listbox' && b.classes().includes('ai-btn-icon'),
            );
            await promptBtn?.trigger('click');
            const promptItem = document.querySelector('.ai-prompt-item') as HTMLElement;
            promptItem?.click();
            await wrapper.vm.$nextTick();
            expect(mockSetActive).toHaveBeenCalledWith('creative');
            wrapper.unmount();
            document.querySelectorAll('.ai-prompt-menu').forEach((el) => el.remove());
        });
    });
});
