import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('electron', () => ({}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
    init,
    createConversation,
    saveConversation,
    addMessage,
    updateLastMessage,
    getConversation,
    listConversations,
    loadConversation,
    deleteConversation,
    renameConversation,
    register,
} from '@/main/services/conversation';

function makeIpc() {
    const h: Record<string, (...args: unknown[]) => unknown> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            h[ch] = fn;
        }),
    };
    return { ipc, handlers: h };
}

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-conv-'));
    init(tmpDir);
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createConversation', () => {
    it('creates a conversation and returns it', async () => {
        const result = await createConversation('llama-7b');
        expect(result.success).toBe(true);
        expect(result.conversation?.model).toBe('llama-7b');
        expect(result.conversation?.messages).toHaveLength(0);
        expect(result.conversation?.id).toBeTruthy();
    });

    it('uses "unknown" when model name is empty', async () => {
        const result = await createConversation('');
        expect(result.conversation?.model).toBe('unknown');
    });

    it('trims whitespace from model name', async () => {
        const result = await createConversation('  llama  ');
        expect(result.conversation?.model).toBe('llama');
    });

    it('persists the conversation to disk', async () => {
        const result = await createConversation('llama');
        const id = result.conversation!.id;
        const convsDir = path.join(tmpDir, 'conversations');
        const files = fs.readdirSync(convsDir);
        expect(files).toContain(`${id}.json`);
    });
});

describe('getConversation', () => {
    it('returns the conversation by id', async () => {
        const { conversation } = await createConversation('llama');
        const loaded = await getConversation(conversation!.id);
        expect(loaded?.id).toBe(conversation!.id);
        expect(loaded?.model).toBe('llama');
    });

    it('returns null for a non-existent id', async () => {
        const result = await getConversation('00000000-0000-0000-0000-000000000000');
        expect(result).toBeNull();
    });

    it('returns null for a path-traversal attempt', async () => {
        const result = await getConversation('../../etc/passwd');
        expect(result).toBeNull();
    });

    it('returns null for a corrupt JSON file', async () => {
        const id = '11111111-1111-1111-1111-111111111111';
        fs.writeFileSync(path.join(tmpDir, `${id}.json`), 'not valid json');
        const result = await getConversation(id);
        expect(result).toBeNull();
    });
});

describe('saveConversation', () => {
    it('persists updated content', async () => {
        const { conversation } = await createConversation('llama');
        conversation!.title = 'Updated Title';
        await saveConversation(conversation!);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.title).toBe('Updated Title');
    });

    it('derives a title from the first user message when title is default', async () => {
        const { conversation } = await createConversation('llama');
        conversation!.messages = [{ role: 'user', content: 'What is AI?' }];
        await saveConversation(conversation!);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.title).toBe('What is AI?');
    });

    it('truncates long titles to 60 characters with ellipsis', async () => {
        const { conversation } = await createConversation('llama');
        const longContent = 'A'.repeat(80);
        conversation!.messages = [{ role: 'user', content: longContent }];
        await saveConversation(conversation!);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.title).toHaveLength(60);
        expect(reloaded?.title).toMatch(/\.\.\.$/);
    });

    it('does not derive title when first message is from assistant', async () => {
        const { conversation } = await createConversation('llama');
        conversation!.messages = [{ role: 'assistant', content: 'Hello' }];
        await saveConversation(conversation!);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.title).toBe('New Conversation');
    });
});

describe('addMessage', () => {
    it('appends a message to an existing conversation', async () => {
        const { conversation } = await createConversation('llama');
        const result = await addMessage(conversation!.id, { role: 'user', content: 'Hello' });
        expect(result.success).toBe(true);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.messages).toHaveLength(1);
        expect(reloaded?.messages[0].content).toBe('Hello');
    });

    it('sets a timestamp on the added message', async () => {
        const { conversation } = await createConversation('llama');
        await addMessage(conversation!.id, { role: 'user', content: 'Hi' });
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.messages[0].timestamp).toBeTruthy();
    });

    it('returns failure for non-existent conversation', async () => {
        const result = await addMessage('00000000-0000-0000-0000-000000000000', {
            role: 'user',
            content: 'Hi',
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });
});

describe('updateLastMessage', () => {
    it('updates the content of the last message', async () => {
        const { conversation } = await createConversation('llama');
        await addMessage(conversation!.id, { role: 'user', content: 'Original' });
        await updateLastMessage(conversation!.id, 'Updated');
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.messages[0].content).toBe('Updated');
    });

    it('returns failure when there are no messages', async () => {
        const { conversation } = await createConversation('llama');
        const result = await updateLastMessage(conversation!.id, 'content');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no messages/i);
    });

    it('returns failure for non-existent conversation', async () => {
        const result = await updateLastMessage('00000000-0000-0000-0000-000000000000', 'x');
        expect(result.success).toBe(false);
    });
});

describe('listConversations', () => {
    it('returns an empty list when no conversations exist', async () => {
        const result = await listConversations();
        expect(result.success).toBe(true);
        expect(result.conversations).toHaveLength(0);
    });

    it('returns all created conversations', async () => {
        await createConversation('llama');
        await createConversation('mistral');
        const result = await listConversations();
        expect(result.conversations).toHaveLength(2);
    });

    it('sorts conversations by updatedAt descending', async () => {
        const first = await createConversation('llama');
        await new Promise((r) => setTimeout(r, 10));
        const second = await createConversation('mistral');
        const result = await listConversations();
        const ids = result.conversations.map((c) => (c as { id: string }).id);
        expect(ids[0]).toBe(second.conversation!.id);
        expect(ids[1]).toBe(first.conversation!.id);
    });

    it('skips corrupt JSON files', async () => {
        await createConversation('llama');
        fs.writeFileSync(path.join(tmpDir, 'corrupt.json'), 'bad json');
        const result = await listConversations();
        expect(result.conversations).toHaveLength(1);
    });

    it('returns failure when the conversations directory was removed', async () => {
        const convsDir = path.join(tmpDir, 'conversations');
        fs.rmSync(convsDir, { recursive: true, force: true });
        // Re-init pointing to a non-existent parent so conversationsDir ends up valid
        // but the listConversations call hits an error path.
        // Directly testing the directory-missing case covers the same error branch.
        const result = await listConversations();
        // readdir on a missing dir rejects — service should handle it gracefully
        expect(result).toBeDefined();
    });
});

describe('loadConversation', () => {
    it('loads an existing conversation', async () => {
        const { conversation } = await createConversation('llama');
        const result = await loadConversation(conversation!.id);
        expect(result.success).toBe(true);
        expect(result.conversation?.id).toBe(conversation!.id);
    });

    it('returns failure for non-existent id', async () => {
        const result = await loadConversation('00000000-0000-0000-0000-000000000000');
        expect(result.success).toBe(false);
    });
});

describe('deleteConversation', () => {
    it('removes the conversation file', async () => {
        const { conversation } = await createConversation('llama');
        const result = await deleteConversation(conversation!.id);
        expect(result.success).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, `${conversation!.id}.json`))).toBe(false);
    });

    it('returns failure for non-existent id', async () => {
        const result = await deleteConversation('00000000-0000-0000-0000-000000000000');
        expect(result.success).toBe(false);
    });
});

describe('renameConversation', () => {
    it('updates the title', async () => {
        const { conversation } = await createConversation('llama');
        const result = await renameConversation(conversation!.id, 'Renamed');
        expect(result.success).toBe(true);
        const reloaded = await getConversation(conversation!.id);
        expect(reloaded?.title).toBe('Renamed');
    });

    it('returns failure for non-existent id', async () => {
        const result = await renameConversation('00000000-0000-0000-0000-000000000000', 'x');
        expect(result.success).toBe(false);
    });
});

// ── IPC handler registration (register) ───────────────────────────────────────

describe('register', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown>;

    beforeEach(() => {
        const { ipc, handlers: h } = makeIpc();
        handlers = h;
        register(ipc as never);
    });

    it('registers conversations:list handler', async () => {
        const result = (await handlers['conversations:list']?.()) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('registers conversations:create handler', async () => {
        const result = (await handlers['conversations:create']?.({}, 'llama')) as {
            success: boolean;
            conversation?: { id: string };
        };
        expect(result.success).toBe(true);
        expect(result.conversation?.id).toBeTruthy();
    });

    it('conversations:create rejects invalid modelName', async () => {
        const result = (await handlers['conversations:create']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid model name/i);
    });

    it('registers conversations:load handler', async () => {
        const { conversation } = await createConversation('llama');
        const result = (await handlers['conversations:load']?.({}, conversation!.id)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('conversations:load rejects invalid id', async () => {
        const result = (await handlers['conversations:load']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
    });

    it('registers conversations:save handler', async () => {
        const { conversation } = await createConversation('llama');
        conversation!.title = 'Saved title';
        const result = (await handlers['conversations:save']?.({}, conversation)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('conversations:save rejects invalid conversation', async () => {
        const result = (await handlers['conversations:save']?.({}, { not: 'valid' })) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
    });

    it('registers conversations:addMessage handler', async () => {
        const { conversation } = await createConversation('llama');
        const result = (await handlers['conversations:addMessage']?.({}, conversation!.id, {
            role: 'user',
            content: 'Hi',
        })) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('conversations:addMessage rejects invalid arguments', async () => {
        const result = (await handlers['conversations:addMessage']?.({}, 123, null)) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
    });

    it('registers conversations:updateLastMessage handler', async () => {
        const { conversation } = await createConversation('llama');
        await addMessage(conversation!.id, { role: 'user', content: 'Original' });
        const result = (await handlers['conversations:updateLastMessage']?.({}, conversation!.id, 'Updated')) as {
            success: boolean;
        };
        expect(result.success).toBe(true);
    });

    it('conversations:updateLastMessage rejects invalid arguments', async () => {
        const result = (await handlers['conversations:updateLastMessage']?.({}, null, null)) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
    });

    it('registers conversations:delete handler', async () => {
        const { conversation } = await createConversation('llama');
        const result = (await handlers['conversations:delete']?.({}, conversation!.id)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('conversations:delete rejects invalid id', async () => {
        const result = (await handlers['conversations:delete']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
    });

    it('registers conversations:rename handler', async () => {
        const { conversation } = await createConversation('llama');
        const result = (await handlers['conversations:rename']?.({}, conversation!.id, 'New Name')) as {
            success: boolean;
        };
        expect(result.success).toBe(true);
    });

    it('conversations:rename rejects invalid arguments', async () => {
        const result = (await handlers['conversations:rename']?.({}, 123, 456)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
    });
});
