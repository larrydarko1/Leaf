import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSystemPrompt } from '@/renderer/composables/ai/useSystemPrompt';

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    systemPromptList: vi.fn(),
    systemPromptSetActive: vi.fn(),
    log: { error: vi.fn(), warn: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

const samplePrompts = [
    { id: 'default', name: 'Default', description: 'The default prompt', path: '/prompts/default.md' },
    { id: 'coding', name: 'Coding', description: 'A coding assistant prompt', path: '/prompts/coding.md' },
];

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useSystemPrompt', () => {
    let sp: ReturnType<typeof useSystemPrompt>;

    beforeEach(() => {
        vi.clearAllMocks();
        sp = useSystemPrompt();
    });

    // ── initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('starts with an empty prompts list', () => {
            expect(sp.prompts.value).toHaveLength(0);
        });

        it('starts with activeId set to "default"', () => {
            expect(sp.activeId.value).toBe('default');
        });

        it('starts with isLoading false', () => {
            expect(sp.isLoading.value).toBe(false);
        });
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    describe('refresh', () => {
        it('populates prompts from the IPC response', async () => {
            mockAPI.systemPromptList.mockResolvedValue({
                success: true,
                prompts: samplePrompts,
                activeId: 'default',
            });
            await sp.refresh();
            expect(sp.prompts.value).toHaveLength(2);
            expect(sp.prompts.value[0].id).toBe('default');
        });

        it('updates activeId from the IPC response', async () => {
            mockAPI.systemPromptList.mockResolvedValue({
                success: true,
                prompts: samplePrompts,
                activeId: 'coding',
            });
            await sp.refresh();
            expect(sp.activeId.value).toBe('coding');
        });

        it('sets isLoading to false after completion', async () => {
            mockAPI.systemPromptList.mockResolvedValue({ success: true, prompts: [], activeId: 'default' });
            await sp.refresh();
            expect(sp.isLoading.value).toBe(false);
        });

        it('sets isLoading to false even when the IPC call throws', async () => {
            mockAPI.systemPromptList.mockRejectedValue(new Error('IPC error'));
            await sp.refresh();
            expect(sp.isLoading.value).toBe(false);
        });

        it('does not update prompts when the IPC response indicates failure', async () => {
            mockAPI.systemPromptList.mockResolvedValue({ success: false, error: 'Not initialised' });
            await sp.refresh();
            // Should remain whatever was set before (empty in this case)
            expect(sp.prompts.value).toHaveLength(0);
        });
    });

    // ── setActive ─────────────────────────────────────────────────────────────

    describe('setActive', () => {
        beforeEach(async () => {
            mockAPI.systemPromptList.mockResolvedValue({
                success: true,
                prompts: samplePrompts,
                activeId: 'default',
            });
            await sp.refresh();
        });

        it('returns true and updates activeId on success', async () => {
            mockAPI.systemPromptSetActive.mockResolvedValue({ success: true });
            const result = await sp.setActive('coding');
            expect(result).toBe(true);
            expect(sp.activeId.value).toBe('coding');
        });

        it('returns false and does not update activeId when the IPC call reports failure', async () => {
            mockAPI.systemPromptSetActive.mockResolvedValue({ success: false, error: 'Not found' });
            const result = await sp.setActive('coding');
            expect(result).toBe(false);
            expect(sp.activeId.value).toBe('default'); // unchanged
        });

        it('returns false when the IPC call throws', async () => {
            mockAPI.systemPromptSetActive.mockRejectedValue(new Error('IPC error'));
            const result = await sp.setActive('coding');
            expect(result).toBe(false);
        });
    });
});
