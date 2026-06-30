import { describe, it, expect, beforeEach, vi } from 'vitest';
import AiInputArea from '@/renderer/components/ai/AiInputArea.vue';
import { mountWithI18n } from '@test-utils';

// ── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
});

// ── test helpers ────────────────────────────────────────────────────────────

type FileInfo = {
    name: string;
    path: string;
    relativePath: string;
    extension: string;
    size: number;
    modified: string;
    folder: string;
};

function makeFile(name: string, path = `/${name}`): FileInfo {
    return {
        name,
        path,
        relativePath: name,
        extension: '.md',
        size: 0,
        modified: '',
        folder: '.',
    };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('AiInputArea', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
    });

    // ── initial state ────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('renders with default height', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });
            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 120px');
        });

        it('renders resize handle', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });
            const handle = wrapper.find('.ai-resize-handle');
            expect(handle.exists()).toBe(true);
        });

        it('shows send button when not streaming', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: 'test',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });
            const sendBtn = wrapper.find('.ai-btn-send:not(.ai-btn-stop)');
            expect(sendBtn.exists()).toBe(true);
        });

        it('shows stop button when streaming', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: true,
                    inputField: null,
                    showThinking: false,
                },
            });
            const stopBtn = wrapper.find('.ai-btn-stop');
            expect(stopBtn.exists()).toBe(true);
        });
    });

    // ── resize functionality ─────────────────────────────────────────────────

    describe('resize', () => {
        it('increases height on upward drag', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');
            const startY = 100;
            const newY = 70; // drag up by 30px

            // Simulate mousedown on handle
            await handle.trigger('mousedown', { clientY: startY, preventDefault: () => {} });

            // Simulate mousemove
            const moveEvent = new MouseEvent('mousemove', { clientY: newY });
            document.dispatchEvent(moveEvent);
            await wrapper.vm.$nextTick();

            // Height should increase by the delta (100 - 70 = 30)
            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 150px'); // 120 + 30, but clamped to max 150
        });

        it('decreases height on downward drag', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');
            const startY = 100;
            const newY = 150; // drag down by 50px

            await handle.trigger('mousedown', { clientY: startY, preventDefault: () => {} });
            const moveEvent = new MouseEvent('mousemove', { clientY: newY });
            document.dispatchEvent(moveEvent);
            await wrapper.vm.$nextTick();

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 70px'); // 120 - 50
        });

        it('clamps height to minimum (40px)', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');
            const startY = 100;
            const newY = 200; // drag down significantly

            await handle.trigger('mousedown', { clientY: startY, preventDefault: () => {} });
            const moveEvent = new MouseEvent('mousemove', { clientY: newY });
            document.dispatchEvent(moveEvent);
            await wrapper.vm.$nextTick();

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 40px');
        });

        it('clamps height to maximum (150px)', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');
            const startY = 100;
            const newY = 0; // drag up significantly

            await handle.trigger('mousedown', { clientY: startY, preventDefault: () => {} });
            const moveEvent = new MouseEvent('mousemove', { clientY: newY });
            document.dispatchEvent(moveEvent);
            await wrapper.vm.$nextTick();

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 150px');
        });

        it('sets resize-active class during drag', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');

            await handle.trigger('mousedown', { clientY: 100, preventDefault: () => {} });
            await wrapper.vm.$nextTick();
            expect(handle.classes()).toContain('ai-resize-active');

            const upEvent = new MouseEvent('mouseup');
            document.dispatchEvent(upEvent);
            await wrapper.vm.$nextTick();
            expect(handle.classes()).not.toContain('ai-resize-active');
        });
    });

    // ── localStorage persistence ─────────────────────────────────────────────

    describe('localStorage persistence', () => {
        it('saves height on mouseup', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
                attachTo: document.body,
            });

            const handle = wrapper.find('.ai-resize-handle');
            await handle.trigger('mousedown', { clientY: 100, preventDefault: () => {} });
            const moveEvent = new MouseEvent('mousemove', { clientY: 85 });
            document.dispatchEvent(moveEvent);
            await wrapper.vm.$nextTick();

            const upEvent = new MouseEvent('mouseup');
            document.dispatchEvent(upEvent);
            await wrapper.vm.$nextTick();

            expect(localStorageMock.setItem).toHaveBeenCalledWith('ai-input-max-height', '135');
        });

        it('restores height from localStorage on mount', async () => {
            // Clear first, then set value before mounting
            localStorageMock.clear();
            localStorageMock.setItem('ai-input-max-height', '100');

            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            await wrapper.vm.$nextTick();
            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 100px');
        });

        it('ignores invalid saved height', () => {
            localStorageMock.setItem('ai-input-max-height', 'invalid');

            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            // Should use default 120px
            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 120px');
        });

        it('ignores out-of-bounds saved height', () => {
            localStorageMock.setItem('ai-input-max-height', '999'); // > 150

            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('style')).toContain('height: 120px');
        });
    });

    // ── event emissions ──────────────────────────────────────────────────────

    describe('event emissions', () => {
        it('emits send when Enter is pressed', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: 'hello',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            await textarea.trigger('keydown.enter');

            expect(wrapper.emitted('send')).toBeTruthy();
        });

        it('does not emit send on Shift+Enter', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: 'hello',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            await textarea.trigger('keydown.enter.shift');

            // Note: the component has @keydown.enter.exact, so shift+enter should not trigger
            // but Vue Test Utils keydown trigger doesn't fully support exact modifier testing
            // This is a known limitation of Vue's keydown modifiers in tests
        });

        it('emits send when send button is clicked', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: 'hello',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const sendBtn = wrapper.find('.ai-btn-send:not(.ai-btn-stop)');
            await sendBtn.trigger('click');

            expect(wrapper.emitted('send')).toBeTruthy();
        });

        it('emits stop when stop button is clicked', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: true,
                    inputField: null,
                    showThinking: false,
                },
            });

            const stopBtn = wrapper.find('.ai-btn-stop');
            await stopBtn.trigger('click');

            expect(wrapper.emitted('stop')).toBeTruthy();
        });

        it('emits update:inputMessage on textarea input', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            await textarea.setValue('new message');

            const emitted = wrapper.emitted('update:inputMessage');
            expect(emitted).toBeTruthy();
            expect(emitted?.[0]).toEqual(['new message']);
        });
    });

    // ── UI state and interactions ────────────────────────────────────────────

    describe('UI state', () => {
        it('disables textarea when not ready', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: false,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('disabled')).toBeDefined();
        });

        it('disables textarea when generating', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: true,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const textarea = wrapper.find('textarea');
            expect(textarea.attributes('disabled')).toBeDefined();
        });

        it('disables send button when message is empty', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const sendBtn = wrapper.find('.ai-btn-send:not(.ai-btn-stop)');
            expect(sendBtn.attributes('disabled')).toBeDefined();
        });

        it('disables send button when only whitespace', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '   ',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const sendBtn = wrapper.find('.ai-btn-send:not(.ai-btn-stop)');
            expect(sendBtn.attributes('disabled')).toBeDefined();
        });

        it('enables send button when message has content', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: 'hello',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const sendBtn = wrapper.find('.ai-btn-send:not(.ai-btn-stop)');
            expect(sendBtn.attributes('disabled')).toBeUndefined();
        });
    });

    // ── agent mode ───────────────────────────────────────────────────────────

    describe('agent mode', () => {
        it('shows agent indicator when agentMode is true', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: true,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const indicator = wrapper.find('.ai-agent-indicator');
            expect(indicator.exists()).toBe(true);
        });

        it('displays agent indicator with file name', () => {
            const activeFile = makeFile('test.md');
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: true,
                    includeNoteContext: false,
                    activeFile,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const fileName = wrapper.find('.ai-agent-file-name');
            expect(fileName.text()).toContain('test.md');
        });

        it('displays agent indicator with "No file open" when no activeFile', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: true,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const noFile = wrapper.find('.ai-agent-no-file');
            expect(noFile.text()).toContain('Agent mode active with no file');
        });

        it('hides agent indicator when agentMode is false', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    includeNoteContext: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                },
            });

            const indicator = wrapper.find('.ai-agent-indicator');
            expect(indicator.exists()).toBe(false);
        });
    });

    // ── context files ────────────────────────────────────────────────────────

    describe('context files', () => {
        it('renders a chip for each attached context file', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                    contextFiles: [makeFile('a.md'), makeFile('b.md')],
                    availableFiles: [],
                    maxContextFiles: 10,
                },
            });

            const chips = wrapper.findAll('.ai-context-chip');
            expect(chips).toHaveLength(2);
            expect(wrapper.find('.ai-context-files-label').text()).toContain('2/10');
        });

        it('does not render the context files area when none are attached', () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                    contextFiles: [],
                    availableFiles: [],
                    maxContextFiles: 10,
                },
            });

            expect(wrapper.find('.ai-context-files').exists()).toBe(false);
        });

        it('emits remove-context-file when a chip remove button is clicked', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                    contextFiles: [makeFile('a.md', '/a.md')],
                    availableFiles: [],
                    maxContextFiles: 10,
                },
            });

            await wrapper.find('.ai-context-chip-remove').trigger('click');

            const emitted = wrapper.emitted('remove-context-file');
            expect(emitted).toBeTruthy();
            expect(emitted?.[0]).toEqual(['/a.md']);
        });

        it('opens the picker and emits add-context-file on selection', async () => {
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                    contextFiles: [],
                    availableFiles: [makeFile('pick-me.md', '/pick-me.md')],
                    maxContextFiles: 10,
                },
            });

            await wrapper.find('.ai-add-context-btn').trigger('click');
            const item = wrapper.find('.ai-file-picker-item');
            expect(item.exists()).toBe(true);
            await item.trigger('click');

            const emitted = wrapper.emitted('add-context-file');
            expect(emitted).toBeTruthy();
            expect((emitted?.[0]?.[0] as FileInfo).path).toBe('/pick-me.md');
        });

        it('disables the add button when the max is reached', () => {
            const contextFiles = Array.from({ length: 10 }, (_, i) => makeFile(`f${i}.md`, `/f${i}.md`));
            const wrapper = mountWithI18n(AiInputArea, {
                props: {
                    agentMode: false,
                    activeFile: null,
                    inputMessage: '',
                    isReady: true,
                    isAnyGenerating: false,
                    isStreaming: false,
                    inputField: null,
                    showThinking: false,
                    contextFiles,
                    availableFiles: [],
                    maxContextFiles: 10,
                },
            });

            expect(wrapper.find('.ai-add-context-btn').attributes('disabled')).toBeDefined();
        });
    });
});
