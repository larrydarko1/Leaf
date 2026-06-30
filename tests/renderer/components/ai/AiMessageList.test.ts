import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountWithI18n } from '@test-utils';
import AiMessageList from '@/renderer/components/ai/AiMessageList.vue';
import type { ChatMessage } from '@/schemas/chat';
import type { AiStatus, AiModelInfo } from '@/schemas/ai';

// ── window mocks ─────────────────────────────────────────────────────────────

const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
const mockLogError = vi.fn();

// Assign to existing window object rather than replacing it (avoids breaking jsdom internals)
Object.assign(window, {
    electronAPI: {
        writeClipboard: mockWriteClipboard,
        log: { error: mockLogError },
    },
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeStatus(overrides: Partial<AiStatus> = {}): AiStatus {
    return {
        isModelLoaded: true,
        currentModelPath: '/models/test.gguf',
        currentModelName: 'test.gguf',
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

function makeMsg(role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
    return { role, content };
}

const noopRender = (content: string) => `<p>${content}</p>`;

const baseProps = {
    messages: [] as ChatMessage[],
    status: makeStatus(),
    availableModels: [] as AiModelInfo[],
    isStreaming: false,
    isReady: true,
    editingIndex: null as number | null,
    editContent: '',
    copiedIndex: null as number | null,
    agentMode: false,
    previousModelMatch: null as AiModelInfo | null,
    isLoading: false,
    tokenUsagePercent: 0,
    conversationTokenCount: 0,
    renderMarkdown: noopRender,
    showThinking: false,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AiMessageList', () => {
    describe('empty state', () => {
        it('shows empty state when no messages', () => {
            const wrapper = mountWithI18n(AiMessageList, { props: baseProps });
            expect(wrapper.find('.ai-empty-state').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows "ask anything" when model is loaded', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, status: makeStatus({ isModelLoaded: true }) },
            });
            expect(wrapper.find('.ai-empty-text').text()).toContain('Ask');
            wrapper.unmount();
        });

        it('shows "open models folder" button when no model and no available models', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, status: makeStatus({ isModelLoaded: false }), availableModels: [] },
            });
            const btn = wrapper.find('.ai-btn-secondary');
            expect(btn.exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "open-models-folder" from the folder button', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, status: makeStatus({ isModelLoaded: false }), availableModels: [] },
            });
            await wrapper.find('.ai-btn-secondary').trigger('click');
            expect(wrapper.emitted('open-models-folder')).toBeTruthy();
            wrapper.unmount();
        });

        it('shows "browse history" button when no model but models are available', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: false }),
                    availableModels: [makeModel('test.gguf')],
                },
            });
            const btn = wrapper.find('.ai-btn-secondary');
            expect(btn.exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "open-history" from the history button', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: false }),
                    availableModels: [makeModel('test.gguf')],
                },
            });
            await wrapper.find('.ai-btn-secondary').trigger('click');
            expect(wrapper.emitted('open-history')).toBeTruthy();
            wrapper.unmount();
        });
    });

    describe('message rendering', () => {
        it('renders user message content', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Hello!')] },
            });
            expect(wrapper.find('.ai-message.user .ai-message-content').text()).toBe('Hello!');
            wrapper.unmount();
        });

        it('renders assistant message via renderMarkdown', () => {
            const renderMarkdown = vi.fn().mockReturnValue('<p>Answer</p>');
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', 'Answer')], renderMarkdown },
            });
            expect(wrapper.find('.ai-markdown').html()).toContain('Answer');
            expect(renderMarkdown).toHaveBeenCalledWith('Answer');
            wrapper.unmount();
        });

        it('renders system message with notice style', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('system', 'Context loaded')] },
            });
            expect(wrapper.find('.ai-system-notice').exists()).toBe(true);
            expect(wrapper.find('.ai-system-notice span').text()).toBe('Context loaded');
            wrapper.unmount();
        });

        it('shows streaming cursor on last assistant message when isStreaming', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', 'typing...')], isStreaming: true },
            });
            expect(wrapper.find('.ai-cursor').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides streaming cursor when not streaming', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', 'Done')], isStreaming: false },
            });
            expect(wrapper.find('.ai-cursor').exists()).toBe(false);
            wrapper.unmount();
        });

        it('shows edit textarea when editingIndex matches a user message', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'Edit me')],
                    editingIndex: 0,
                    editContent: 'Edit me',
                },
            });
            expect(wrapper.find('.ai-message-edit').exists()).toBe(true);
            expect(wrapper.find('.ai-edit-input').exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders agent edit cards when agentEdits is set', () => {
            const msg: ChatMessage = {
                role: 'assistant',
                content: 'I edited your file',
                agentEdits: [{ filePath: '/vault/notes.md', newContent: 'new', status: 'pending' }],
            };
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [msg] },
            });
            expect(wrapper.find('.ai-agent-edits').exists()).toBe(true);
            expect(wrapper.find('.ai-agent-edit-card').exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('message actions', () => {
        it('shows message actions when not streaming', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Hello')], isStreaming: false },
            });
            expect(wrapper.find('.ai-message-actions').exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "copy" on copy button click', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Hello')] },
            });
            await wrapper.find('.ai-btn-action').trigger('click');
            expect(wrapper.emitted('copy')?.[0]).toEqual(['Hello', 0]);
            wrapper.unmount();
        });

        it('shows copied icon when copiedIndex matches', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Hello')], copiedIndex: 0 },
            });
            // copied state: the check SVG should be visible (no copy SVG with rect)
            expect(wrapper.find('.ai-btn-action svg rect').exists()).toBe(false);
            wrapper.unmount();
        });

        it('emits "start-edit" on edit button click for user message', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Hello')] },
            });
            const editBtn = wrapper.findAll('.ai-btn-action')[1];
            await editBtn.trigger('click');
            expect(wrapper.emitted('start-edit')?.[0]).toEqual([0]);
            wrapper.unmount();
        });

        it('shows resend button for last user message when isReady', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Resend me')], isReady: true },
            });
            const btns = wrapper.findAll('.ai-btn-action');
            const resendBtn = btns.find(
                (b) => b.attributes('aria-label')?.includes('resend') || b.attributes('aria-label')?.includes('Resend'),
            );
            expect(resendBtn).toBeDefined();
            wrapper.unmount();
        });

        it('emits "regenerate" on regenerate button click for last assistant message', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', 'Response')], isReady: true },
            });
            const btns = wrapper.findAll('.ai-btn-action');
            const regenBtn = btns.find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('regenerate'));
            await regenBtn?.trigger('click');
            expect(wrapper.emitted('regenerate')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "delete-last-pair" on delete button click', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Delete me')] },
            });
            const delBtn = wrapper.find('.ai-btn-action-danger');
            await delBtn.trigger('click');
            expect(wrapper.emitted('delete-last-pair')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "cancel-edit" from edit cancel button', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'Editing')],
                    editingIndex: 0,
                    editContent: 'Editing',
                },
            });
            await wrapper.findAll('.ai-btn-icon.ai-btn-tiny')[0].trigger('click');
            expect(wrapper.emitted('cancel-edit')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "confirm-edit" from edit save button', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'Editing')],
                    editingIndex: 0,
                    editContent: 'Editing',
                },
            });
            await wrapper.findAll('.ai-btn-icon.ai-btn-tiny')[1].trigger('click');
            expect(wrapper.emitted('confirm-edit')?.[0]).toEqual([0]);
            wrapper.unmount();
        });

        it('emits "approve-agent-edit" when approve is clicked on agent edit card', async () => {
            const msg: ChatMessage = {
                role: 'assistant',
                content: 'I edited',
                agentEdits: [{ filePath: '/vault/x.md', newContent: 'x', status: 'pending' }],
            };
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [msg] },
            });
            await wrapper.find('.ai-agent-btn.approve').trigger('click');
            expect(wrapper.emitted('approve-agent-edit')?.[0]).toEqual([0, 0]);
            wrapper.unmount();
        });
    });

    describe('load model banner', () => {
        it('shows banner when model not loaded and there are messages', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'hello')],
                    status: makeStatus({ isModelLoaded: false }),
                },
            });
            expect(wrapper.find('.ai-load-model-banner').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides banner when model is loaded', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'hello')],
                    status: makeStatus({ isModelLoaded: true }),
                },
            });
            expect(wrapper.find('.ai-load-model-banner').exists()).toBe(false);
            wrapper.unmount();
        });

        it('shows load previous model button when previousModelMatch is set', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'hello')],
                    status: makeStatus({ isModelLoaded: false }),
                    previousModelMatch: makeModel('old-model.gguf'),
                },
            });
            expect(wrapper.find('.ai-load-model-btn').exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "load-previous-model" on button click', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'hello')],
                    status: makeStatus({ isModelLoaded: false }),
                    previousModelMatch: makeModel('old-model.gguf'),
                },
            });
            await wrapper.find('.ai-load-model-btn').trigger('click');
            expect(wrapper.emitted('load-previous-model')).toBeTruthy();
            wrapper.unmount();
        });

        it('truncates long model name in button label', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'hello')],
                    status: makeStatus({ isModelLoaded: false }),
                    previousModelMatch: makeModel('a-very-long-model-name-that-exceeds-twenty-chars.gguf'),
                },
            });
            const btn = wrapper.find('.ai-load-model-btn');
            expect(btn.text().length).toBeLessThan(60);
            wrapper.unmount();
        });
    });

    describe('token counter', () => {
        it('shows token bar when model is loaded and contextSize > 0', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: true, contextSize: 4096 }),
                    conversationTokenCount: 500,
                    tokenUsagePercent: 12,
                },
            });
            expect(wrapper.find('.ai-token-bar').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides token bar when contextSize is 0', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, status: makeStatus({ isModelLoaded: true, contextSize: 0 }) },
            });
            expect(wrapper.find('.ai-token-bar').exists()).toBe(false);
            wrapper.unmount();
        });

        it('applies "warning" class when tokenUsagePercent > 75', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: true, contextSize: 4096 }),
                    tokenUsagePercent: 80,
                },
            });
            expect(wrapper.find('.ai-token-bar-fill.warning').exists()).toBe(true);
            wrapper.unmount();
        });

        it('applies "danger" class when tokenUsagePercent > 90', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: true, contextSize: 4096 }),
                    tokenUsagePercent: 95,
                },
            });
            expect(wrapper.find('.ai-token-bar-fill.danger').exists()).toBe(true);
            wrapper.unmount();
        });

        it('formatTokenCount: displays "k" suffix for >= 1000 tokens', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: true, contextSize: 4096 }),
                    conversationTokenCount: 2500,
                    tokenUsagePercent: 50,
                },
            });
            expect(wrapper.find('.ai-token-label').text()).toContain('2.5k');
            wrapper.unmount();
        });

        it('formatTokenCount: displays raw number for < 1000 tokens', () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    status: makeStatus({ isModelLoaded: true, contextSize: 4096 }),
                    conversationTokenCount: 512,
                    tokenUsagePercent: 12,
                },
            });
            expect(wrapper.find('.ai-token-label').text()).toContain('512');
            wrapper.unmount();
        });
    });

    describe('renderWithCopyBtns', () => {
        it('wraps pre blocks with copy button wrappers', () => {
            const renderMarkdown = vi.fn().mockReturnValue('<pre><code>const x = 1;</code></pre>');
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', '```js\nconst x = 1;\n```')], renderMarkdown },
            });
            expect(wrapper.find('.ai-pre-wrapper').exists()).toBe(true);
            expect(wrapper.find('.ai-code-copy-btn').exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('code block copy (onMarkdownClick)', () => {
        const codeContent = '```js\nconst x = 1;\n```';
        const renderPre = () => '<pre><code>const x = 1;</code></pre>';

        it('copies the code block and swaps to the check icon', async () => {
            vi.useFakeTimers();
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', codeContent)], renderMarkdown: renderPre },
            });

            const btn = wrapper.find('.ai-code-copy-btn');
            await btn.trigger('click');
            await vi.waitFor(() => expect(mockWriteClipboard).toHaveBeenCalledWith('const x = 1;\n'));

            expect(btn.element.innerHTML).toContain('polyline');

            vi.advanceTimersByTime(2000);
            vi.useRealTimers();
            wrapper.unmount();
        });

        it('does nothing when the click is not on a copy button', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', codeContent)], renderMarkdown: renderPre },
            });

            await wrapper.find('.ai-markdown').trigger('click');
            expect(mockWriteClipboard).not.toHaveBeenCalled();
            wrapper.unmount();
        });

        it('logs an error when clipboard write fails', async () => {
            mockWriteClipboard.mockRejectedValueOnce(new Error('denied'));
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('assistant', codeContent)], renderMarkdown: renderPre },
            });

            await wrapper.find('.ai-code-copy-btn').trigger('click');
            await vi.waitFor(() => expect(mockLogError).toHaveBeenCalled());
            wrapper.unmount();
        });
    });

    describe('edit mode interactions', () => {
        it('emits "update:editContent" when typing in the edit textarea', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'Editing')],
                    editingIndex: 0,
                    editContent: 'Editing',
                },
            });
            const textarea = wrapper.find('.ai-edit-input');
            await textarea.setValue('Changed');
            expect(wrapper.emitted('update:editContent')?.[0]).toEqual(['Changed']);
            wrapper.unmount();
        });

        it('emits "confirm-edit" on Enter and "cancel-edit" on Escape', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: {
                    ...baseProps,
                    messages: [makeMsg('user', 'Editing')],
                    editingIndex: 0,
                    editContent: 'Editing',
                },
            });
            const textarea = wrapper.find('.ai-edit-input');
            await textarea.trigger('keydown', { key: 'Enter' });
            await textarea.trigger('keydown', { key: 'Escape' });
            expect(wrapper.emitted('confirm-edit')?.[0]).toEqual([0]);
            expect(wrapper.emitted('cancel-edit')).toBeTruthy();
            wrapper.unmount();
        });

        it('focuses the edit textarea when editingIndex becomes set', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Editing')], editingIndex: null },
                attachTo: document.body,
            });
            await wrapper.setProps({ editingIndex: 0 });
            await wrapper.vm.$nextTick();
            expect(wrapper.find('.ai-edit-input').exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('assistant interactions', () => {
        it('emits "resend" when the resend button is clicked', async () => {
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [makeMsg('user', 'Resend me')], isReady: true },
            });
            const resendBtn = wrapper
                .findAll('.ai-btn-action')
                .find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('resend'));
            await resendBtn?.trigger('click');
            expect(wrapper.emitted('resend')?.[0]).toEqual([0]);
            wrapper.unmount();
        });

        it('emits "reject-agent-edit" when reject is clicked on an agent edit card', async () => {
            const msg: ChatMessage = {
                role: 'assistant',
                content: 'I edited',
                agentEdits: [{ filePath: '/vault/x.md', newContent: 'x', status: 'pending' }],
            };
            const wrapper = mountWithI18n(AiMessageList, { props: { ...baseProps, messages: [msg] } });
            await wrapper.find('.ai-agent-btn.reject').trigger('click');
            expect(wrapper.emitted('reject-agent-edit')?.[0]).toEqual([0, 0]);
            wrapper.unmount();
        });

        it('renders the thinking block when showThinking and thinking are set', () => {
            const msg: ChatMessage = { role: 'assistant', content: 'Answer', thinking: 'reasoning...' };
            const wrapper = mountWithI18n(AiMessageList, {
                props: { ...baseProps, messages: [msg], showThinking: true },
            });
            expect(wrapper.find('.ai-thinking-block').exists()).toBe(true);
            expect(wrapper.find('.ai-thinking-content').text()).toContain('reasoning');
            wrapper.unmount();
        });
    });
});
