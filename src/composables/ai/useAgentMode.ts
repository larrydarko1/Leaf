import { ref } from 'vue';
import type { Ref } from 'vue';
import type { ChatMessage, AgentFileEdit } from '../../types/chat';

export const AGENT_SYSTEM_PROMPT = `You are an AI assistant with the ability to edit files. When the user asks you to modify a file, you MUST output your proposed changes using this exact format:

<file_edit path="RELATIVE_FILE_PATH">
NEW FILE CONTENT HERE
</file_edit>

Rules:
- The path must be relative to the workspace root.
- Include the COMPLETE new file content inside the tags.
- You can include multiple <file_edit> blocks for multiple files.
- Always explain what you changed before or after the edit block.
- If the user just asks a question without requesting an edit, respond normally without <file_edit> tags.`;

// Simple path helper — the backend handles proper resolution
const pathHelper = {
    resolve: (...parts: string[]) =>
        parts.filter(Boolean).join('/').replace(/\/+/g, '/')
};

export function useAgentMode(
    messages: Ref<ChatMessage[]>,
    workspacePath: { readonly value: string | null },
    onFileChanged: (path: string) => void
) {
    const agentMode = ref(false);

    function toggleAgentMode() {
        agentMode.value = !agentMode.value;
    }

    function parseAgentEdits(response: string): { cleanContent: string; edits: AgentFileEdit[] } {
        const edits: AgentFileEdit[] = [];
        const editRegex = /<file_edit\s+path="([^"]+)">\n?([\s\S]*?)<\/file_edit>/g;
        let match;
        let cleanContent = response;
        while ((match = editRegex.exec(response)) !== null) {
            edits.push({ filePath: match[1], newContent: match[2].trimEnd(), status: 'pending' });
            cleanContent = cleanContent.replace(match[0], '').trim();
        }
        return { cleanContent, edits };
    }

    async function processAgentEdits(_msgIndex: number, edits: AgentFileEdit[]) {
        if (!workspacePath.value) return;
        for (const edit of edits) {
            const fullPath = pathHelper.resolve(workspacePath.value, edit.filePath);
            try {
                const result = await window.electronAPI.agentProposeEdit(
                    fullPath,
                    edit.newContent,
                    workspacePath.value
                );
                if (result.success) {
                    edit.editId = result.editId;
                    edit.originalContent = result.originalContent;
                    edit.newContent = result.newContent!;
                    edit.relativePath = result.relativePath;
                    edit.isNewFile = result.isNewFile;
                    edit.status = 'pending';
                } else {
                    edit.status = 'error';
                    edit.error = result.error || 'Failed to propose edit';
                }
            } catch (err) {
                edit.status = 'error';
                edit.error = (err as Error).message;
            }
        }
    }

    async function approveAgentEdit(msgIndex: number, editIdx: number) {
        const edit = messages.value[msgIndex]?.agentEdits?.[editIdx];
        if (!edit?.editId || edit.status !== 'pending') return;
        try {
            const result = await window.electronAPI.agentApproveEdit(edit.editId);
            if (result.success) { edit.status = 'approved'; onFileChanged(edit.filePath); }
            else { edit.error = result.error || 'Failed to approve edit'; }
        } catch (err) { edit.error = (err as Error).message; }
    }

    async function rejectAgentEdit(msgIndex: number, editIdx: number) {
        const edit = messages.value[msgIndex]?.agentEdits?.[editIdx];
        if (!edit?.editId || edit.status !== 'pending') return;
        try {
            const result = await window.electronAPI.agentRejectEdit(edit.editId);
            if (result.success) { edit.status = 'rejected'; onFileChanged(edit.filePath); }
            else { edit.error = result.error || 'Failed to reject edit'; }
        } catch (err) { edit.error = (err as Error).message; }
    }

    return {
        agentMode,
        toggleAgentMode,
        parseAgentEdits,
        processAgentEdits,
        approveAgentEdit,
        rejectAgentEdit,
    };
}
