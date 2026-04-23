import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useAgentMode } from '../../src/renderer/composables/ai/useAgentMode';
import type { AgentFileEdit, ChatMessage } from '../../src/renderer/types/chat';

// ── electronAPI mock ─────────────────────────────────────────────────────────

const mockAgentProposeEdit = vi.fn();
const mockAgentApproveEdit = vi.fn();
const mockAgentRejectEdit = vi.fn();

Object.defineProperty(globalThis, 'window', {
    value: {
        electronAPI: {
            agentProposeEdit: mockAgentProposeEdit,
            agentApproveEdit: mockAgentApproveEdit,
            agentRejectEdit: mockAgentRejectEdit,
            log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        },
    },
    writable: true,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAgent(workspacePath: string | null = '/workspace') {
    const messages = ref<ChatMessage[]>([]);
    const onFileChanged = vi.fn();
    const agent = useAgentMode(messages, { value: workspacePath }, onFileChanged);
    return { agent, messages, onFileChanged };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('useAgentMode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAgentProposeEdit.mockResolvedValue({
            success: true,
            editId: 'edit-1',
            originalContent: 'old',
            newContent: 'new',
            relativePath: 'file.md',
            isNewFile: false,
        });
        mockAgentApproveEdit.mockResolvedValue({ success: true });
        mockAgentRejectEdit.mockResolvedValue({ success: true });
    });

    // ── initial state ────────────────────────────────────────────────────────
    describe('initial state', () => {
        it('starts with agentMode disabled', () => {
            const { agent } = makeAgent();
            expect(agent.agentMode.value).toBe(false);
        });
    });

    // ── toggleAgentMode ──────────────────────────────────────────────────────
    describe('toggleAgentMode', () => {
        it('enables agent mode when off', () => {
            const { agent } = makeAgent();
            agent.toggleAgentMode();
            expect(agent.agentMode.value).toBe(true);
        });

        it('disables agent mode when on', () => {
            const { agent } = makeAgent();
            agent.toggleAgentMode();
            agent.toggleAgentMode();
            expect(agent.agentMode.value).toBe(false);
        });
    });

    // ── parseAgentEdits ──────────────────────────────────────────────────────
    describe('parseAgentEdits', () => {
        it('returns empty edits and original content for plain text', () => {
            const { agent } = makeAgent();
            const result = agent.parseAgentEdits('Just a normal response with no edits.');
            expect(result.edits).toHaveLength(0);
            expect(result.cleanContent).toBe('Just a normal response with no edits.');
        });

        it('parses a single file_edit block', () => {
            const { agent } = makeAgent();
            const response = `Here is the fix:\n\n<file_edit path="src/index.ts">\nconsole.log('hello');\n</file_edit>`;
            const result = agent.parseAgentEdits(response);
            expect(result.edits).toHaveLength(1);
            expect(result.edits[0].filePath).toBe('src/index.ts');
            expect(result.edits[0].newContent).toBe("console.log('hello');");
            expect(result.edits[0].status).toBe('pending');
        });

        it('parses multiple file_edit blocks', () => {
            const { agent } = makeAgent();
            const response = `
<file_edit path="a.ts">
const a = 1;
</file_edit>
Some explanation.
<file_edit path="b.ts">
const b = 2;
</file_edit>`;
            const result = agent.parseAgentEdits(response);
            expect(result.edits).toHaveLength(2);
            expect(result.edits[0].filePath).toBe('a.ts');
            expect(result.edits[1].filePath).toBe('b.ts');
        });

        it('removes file_edit blocks from cleanContent', () => {
            const { agent } = makeAgent();
            const response = `Here is the change:\n\n<file_edit path="x.ts">\ncode\n</file_edit>\n\nDone.`;
            const result = agent.parseAgentEdits(response);
            expect(result.cleanContent).not.toContain('<file_edit');
            expect(result.cleanContent).not.toContain('</file_edit>');
            expect(result.cleanContent).toContain('Here is the change:');
            expect(result.cleanContent).toContain('Done.');
        });

        it('trims trailing whitespace from parsed content', () => {
            const { agent } = makeAgent();
            const response = `<file_edit path="f.ts">\nconst x = 1;   \n   \n</file_edit>`;
            const result = agent.parseAgentEdits(response);
            expect(result.edits[0].newContent).toBe('const x = 1;');
        });

        it('returns empty edits for a response with no matching tags', () => {
            const { agent } = makeAgent();
            const result = agent.parseAgentEdits('<file_edit>missing path attribute</file_edit>');
            expect(result.edits).toHaveLength(0);
        });
    });

    // ── processAgentEdits ────────────────────────────────────────────────────
    describe('processAgentEdits', () => {
        it('calls agentProposeEdit with the resolved path', async () => {
            const { agent } = makeAgent('/workspace');
            const edits = [{ filePath: 'src/app.ts', newContent: 'new code', status: 'pending' as const }];
            await agent.processAgentEdits(0, edits);
            expect(mockAgentProposeEdit).toHaveBeenCalledWith('/workspace/src/app.ts', 'new code', '/workspace');
        });

        it('sets edit metadata on success', async () => {
            const { agent } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'src/app.ts', newContent: 'code', status: 'pending' };
            mockAgentProposeEdit.mockResolvedValue({
                success: true,
                editId: 'eid-42',
                originalContent: 'old code',
                newContent: 'code',
                relativePath: 'src/app.ts',
                isNewFile: false,
            });
            await agent.processAgentEdits(0, [edit]);
            expect(edit.editId).toBe('eid-42');
            expect(edit.originalContent).toBe('old code');
            expect(edit.status).toBe('pending');
        });

        it('sets status to error when propose fails', async () => {
            const { agent } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'src/app.ts', newContent: 'code', status: 'pending' };
            mockAgentProposeEdit.mockResolvedValue({ success: false, error: 'Permission denied' });
            await agent.processAgentEdits(0, [edit]);
            expect(edit.status).toBe('error');
            expect(edit.error).toBe('Permission denied');
        });

        it('sets status to error on thrown exception', async () => {
            const { agent } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'src/app.ts', newContent: 'code', status: 'pending' };
            mockAgentProposeEdit.mockRejectedValue(new Error('Network error'));
            await agent.processAgentEdits(0, [edit]);
            expect(edit.status).toBe('error');
            expect(edit.error).toBe('Network error');
        });

        it('does nothing when workspacePath is null', async () => {
            const { agent } = makeAgent(null);
            const edit = { filePath: 'src/app.ts', newContent: 'code', status: 'pending' as const };
            await agent.processAgentEdits(0, [edit]);
            expect(mockAgentProposeEdit).not.toHaveBeenCalled();
        });

        it('processes multiple edits in order', async () => {
            const { agent } = makeAgent('/ws');
            const edits = [
                { filePath: 'a.ts', newContent: 'a', status: 'pending' as const },
                { filePath: 'b.ts', newContent: 'b', status: 'pending' as const },
            ];
            await agent.processAgentEdits(0, edits);
            expect(mockAgentProposeEdit).toHaveBeenCalledTimes(2);
            expect(mockAgentProposeEdit.mock.calls[0][0]).toContain('a.ts');
            expect(mockAgentProposeEdit.mock.calls[1][0]).toContain('b.ts');
        });
    });

    // ── approveAgentEdit ─────────────────────────────────────────────────────
    describe('approveAgentEdit', () => {
        it('calls agentApproveEdit with the editId', async () => {
            const { agent, messages } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: 'Done.',
                    agentEdits: [{ filePath: 'f.ts', newContent: 'x', editId: 'eid-1', status: 'pending' }],
                },
            ];
            await agent.approveAgentEdit(0, 0);
            expect(mockAgentApproveEdit).toHaveBeenCalledWith('eid-1');
        });

        it('sets status to approved on success', async () => {
            const { agent, messages } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'f.ts', newContent: 'x', editId: 'eid-1', status: 'pending' };
            messages.value = [{ role: 'assistant', content: '', agentEdits: [edit] }];
            await agent.approveAgentEdit(0, 0);
            expect(edit.status).toBe('approved');
        });

        it('calls onFileChanged with the filePath on success', async () => {
            const { agent, messages, onFileChanged } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'src/component.ts', newContent: 'x', editId: 'eid-1', status: 'pending' }],
                },
            ];
            await agent.approveAgentEdit(0, 0);
            expect(onFileChanged).toHaveBeenCalledWith('src/component.ts');
        });

        it('does nothing when edit has no editId', async () => {
            const { agent, messages } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'f.ts', newContent: 'x', status: 'pending' }],
                },
            ];
            await agent.approveAgentEdit(0, 0);
            expect(mockAgentApproveEdit).not.toHaveBeenCalled();
        });

        it('does nothing when edit is not in pending state', async () => {
            const { agent, messages } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'f.ts', newContent: 'x', editId: 'eid-1', status: 'approved' }],
                },
            ];
            await agent.approveAgentEdit(0, 0);
            expect(mockAgentApproveEdit).not.toHaveBeenCalled();
        });

        it('sets error on failure', async () => {
            const { agent, messages } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'f.ts', newContent: 'x', editId: 'eid-1', status: 'pending' };
            messages.value = [{ role: 'assistant', content: '', agentEdits: [edit] }];
            mockAgentApproveEdit.mockResolvedValue({ success: false, error: 'Conflict' });
            await agent.approveAgentEdit(0, 0);
            expect(edit.error).toBe('Conflict');
        });
    });

    // ── rejectAgentEdit ──────────────────────────────────────────────────────
    describe('rejectAgentEdit', () => {
        it('calls agentRejectEdit with the editId', async () => {
            const { agent, messages } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'f.ts', newContent: 'x', editId: 'eid-2', status: 'pending' }],
                },
            ];
            await agent.rejectAgentEdit(0, 0);
            expect(mockAgentRejectEdit).toHaveBeenCalledWith('eid-2');
        });

        it('sets status to rejected on success', async () => {
            const { agent, messages } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'f.ts', newContent: 'x', editId: 'eid-2', status: 'pending' };
            messages.value = [{ role: 'assistant', content: '', agentEdits: [edit] }];
            await agent.rejectAgentEdit(0, 0);
            expect(edit.status).toBe('rejected');
        });

        it('calls onFileChanged with the filePath on success', async () => {
            const { agent, messages, onFileChanged } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'src/utils.ts', newContent: 'x', editId: 'eid-2', status: 'pending' }],
                },
            ];
            await agent.rejectAgentEdit(0, 0);
            expect(onFileChanged).toHaveBeenCalledWith('src/utils.ts');
        });

        it('does nothing when edit has no editId', async () => {
            const { agent, messages } = makeAgent();
            messages.value = [
                {
                    role: 'assistant',
                    content: '',
                    agentEdits: [{ filePath: 'f.ts', newContent: 'x', status: 'pending' }],
                },
            ];
            await agent.rejectAgentEdit(0, 0);
            expect(mockAgentRejectEdit).not.toHaveBeenCalled();
        });

        it('sets error on failure', async () => {
            const { agent, messages } = makeAgent();
            const edit: AgentFileEdit = { filePath: 'f.ts', newContent: 'x', editId: 'eid-2', status: 'pending' };
            messages.value = [{ role: 'assistant', content: '', agentEdits: [edit] }];
            mockAgentRejectEdit.mockResolvedValue({ success: false, error: 'Already applied' });
            await agent.rejectAgentEdit(0, 0);
            expect(edit.error).toBe('Already applied');
        });
    });
});
