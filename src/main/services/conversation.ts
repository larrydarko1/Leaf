/**
 * Conversation Service — persists LLM chat conversations as JSON files.
 * Stored in the app's userData directory (e.g. ~/Library/Application Support/Leaf/conversations/).
 */

import type { IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { assertSafeFileName, resolveInsideBoundary } from '@/main/lib/validation';
import { log } from '@/main/lib/logger';
import { z } from 'zod';
import {
    type Conversation,
    type ConversationMessage,
    ConversationSchema,
    ConversationMessageSchema,
} from '@/schemas/ai';

type ConversationSummary = {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    tokenCount: number;
};

let conversationsDir: string | null = null;

/**
 * Initialize the conversations directory.
 * Must be called after app.whenReady() since it uses app.getPath().
 */
export function init(userDataPath: string): void {
    conversationsDir = path.join(userDataPath, 'conversations');
    if (!existsSync(conversationsDir)) {
        mkdirSync(conversationsDir, { recursive: true });
    }
}

export async function createConversation(
    modelName: string,
): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
    try {
        const now = new Date().toISOString();
        const conversation: Conversation = {
            id: generateId(),
            title: 'New Conversation',
            model: modelName.trim() !== '' ? modelName.trim() : 'unknown',
            createdAt: now,
            updatedAt: now,
            messages: [],
            tokenCount: 0,
        };

        await writeFileAtomic(getConversationPath(conversation.id), JSON.stringify(conversation, null, 2));

        return { success: true, conversation };
    } catch (error) {
        log.error('Failed to create conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function saveConversation(conversation: Conversation): Promise<{ success: boolean; error?: string }> {
    try {
        conversation.updatedAt = new Date().toISOString();
        if (conversation.title === 'New Conversation' && conversation.messages.length > 0) {
            conversation.title = deriveTitle(conversation.messages);
        }

        await writeFileAtomic(getConversationPath(conversation.id), JSON.stringify(conversation, null, 2));

        return { success: true };
    } catch (error) {
        log.error('Failed to save conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function addMessage(
    conversationId: string,
    message: ConversationMessage,
): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await findConversation(conversationId);
        if (conversation === null) {
            return { success: false, error: 'Conversation not found' };
        }

        message.timestamp = new Date().toISOString();
        conversation.messages.push(message);

        return await saveConversation(conversation);
    } catch (error) {
        log.error('Failed to add message:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function updateLastMessage(
    conversationId: string,
    content: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await findConversation(conversationId);
        if (conversation === null) {
            return { success: false, error: 'Conversation not found' };
        }

        if (conversation.messages.length === 0) {
            return { success: false, error: 'No messages to update' };
        }

        conversation.messages[conversation.messages.length - 1].content = content;

        return await saveConversation(conversation);
    } catch (error) {
        log.error('Failed to update last message:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function findConversation(id: string): Promise<Conversation | null> {
    try {
        const filePath = getConversationPath(id);
        const data = await fs.readFile(filePath, 'utf-8');
        const result = ConversationSchema.safeParse(JSON.parse(data));
        if (!result.success) {
            log.error('Corrupt conversation file:', result.error.message);
            return null;
        }
        return result.data;
    } catch {
        return null;
    }
}

export async function readConversations(): Promise<{ success: boolean; conversations: object[]; error?: string }> {
    try {
        if (conversationsDir === null) {
            return { success: false, conversations: [], error: 'Conversations directory not initialized' };
        }
        const dir = conversationsDir;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const conversations: ConversationSummary[] = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const summary = await findConversationSummary(dir, entry.name);
            if (summary !== null) conversations.push(summary);
        }

        conversations.sort((a, b): number => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return { success: true, conversations };
    } catch (error) {
        log.error('Failed to read conversations', error);
        return { success: false, conversations: [], error: (error as Error).message };
    }
}

export async function loadConversation(
    id: string,
): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
    try {
        const conversation = await findConversation(id);
        if (conversation === null) {
            return { success: false, error: 'Conversation not found' };
        }
        return { success: true, conversation };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteConversation(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getConversationPath(id);
        await fs.unlink(filePath);
        return { success: true };
    } catch (error) {
        log.error('Failed to delete conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function renameConversation(id: string, newTitle: string): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await findConversation(id);
        if (conversation === null) {
            return { success: false, error: 'Conversation not found' };
        }
        conversation.title = newTitle;
        return await saveConversation(conversation);
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export function register(ipc: IpcMain): void {
    ipc.handle(
        'conversations:list',
        async (): Promise<{ success: boolean; conversations: object[]; error?: string }> => readConversations(),
    );

    ipc.handle(
        'conversations:create',
        async (
            _event,
            modelName: unknown,
        ): Promise<{ success: boolean; conversation?: Conversation; error?: string }> => {
            const parsed = z.string().min(1).safeParse(modelName);
            if (!parsed.success) return { success: false, error: 'Invalid model name' };
            return createConversation(parsed.data);
        },
    );

    ipc.handle(
        'conversations:load',
        async (_event, id: unknown): Promise<{ success: boolean; conversation?: Conversation; error?: string }> => {
            const parsed = z.string().min(1).safeParse(id);
            if (!parsed.success) return { success: false, error: 'Invalid id' };
            return loadConversation(parsed.data);
        },
    );

    ipc.handle(
        'conversations:save',
        async (_event, conversation: unknown): Promise<{ success: boolean; error?: string }> => {
            const parsed = ConversationSchema.safeParse(conversation);
            if (!parsed.success) return { success: false, error: 'Invalid conversation' };
            return saveConversation(parsed.data);
        },
    );

    ipc.handle(
        'conversations:addMessage',
        async (_event, conversationId: unknown, message: unknown): Promise<{ success: boolean; error?: string }> => {
            const idParsed = z.string().min(1).safeParse(conversationId);
            const msgParsed = ConversationMessageSchema.safeParse(message);
            if (!idParsed.success || !msgParsed.success) return { success: false, error: 'Invalid arguments' };
            return addMessage(idParsed.data, msgParsed.data);
        },
    );

    ipc.handle(
        'conversations:updateLastMessage',
        async (_event, conversationId: unknown, content: unknown): Promise<{ success: boolean; error?: string }> => {
            const idParsed = z.string().min(1).safeParse(conversationId);
            const contentParsed = z.string().safeParse(content);
            if (!idParsed.success || !contentParsed.success) return { success: false, error: 'Invalid arguments' };
            return updateLastMessage(idParsed.data, contentParsed.data);
        },
    );

    ipc.handle('conversations:delete', async (_event, id: unknown): Promise<{ success: boolean; error?: string }> => {
        const parsed = z.string().min(1).safeParse(id);
        if (!parsed.success) return { success: false, error: 'Invalid id' };
        return deleteConversation(parsed.data);
    });

    ipc.handle(
        'conversations:rename',
        async (_event, id: unknown, newTitle: unknown): Promise<{ success: boolean; error?: string }> => {
            const idParsed = z.string().min(1).safeParse(id);
            const titleParsed = z.string().min(1).safeParse(newTitle);
            if (!idParsed.success || !titleParsed.success) return { success: false, error: 'Invalid arguments' };
            return renameConversation(idParsed.data, titleParsed.data);
        },
    );
}

/** Write content to a file atomically: write to .tmp, then rename into place. */
async function writeFileAtomic(filePath: string, data: string): Promise<void> {
    const tmp = filePath + '.tmp';
    await fs.writeFile(tmp, data, 'utf-8');
    await fs.rename(tmp, filePath);
}

function generateId(): string {
    return randomUUID();
}

function deriveTitle(messages: ConversationMessage[]): string {
    const firstUserMsg = messages.find((m): boolean => m.role === 'user');
    if (firstUserMsg === undefined) return 'New Conversation';
    const text = firstUserMsg.content.trim();
    if (text.length <= 60) return text;
    return text.slice(0, 57) + '...';
}

function getConversationPath(id: string): string {
    // Prevent path traversal via crafted IDs like "../../etc/passwd"
    if (conversationsDir === null) {
        throw new Error('Conversations directory not initialized');
    }
    assertSafeFileName(id);
    const filePath = path.join(conversationsDir, `${id}.json`);
    resolveInsideBoundary(filePath, conversationsDir);
    return filePath;
}

async function findConversationSummary(dir: string, fileName: string): Promise<ConversationSummary | null> {
    try {
        const data = await fs.readFile(path.join(dir, fileName), 'utf-8');
        const parsed = ConversationSchema.safeParse(JSON.parse(data));
        if (!parsed.success) {
            log.error('Skipping corrupt conversation file', { file: fileName, error: parsed.error.message });
            return null;
        }
        const conv = parsed.data;
        return {
            id: conv.id,
            title: conv.title,
            model: conv.model,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0,
            tokenCount: conv.tokenCount !== undefined && conv.tokenCount !== 0 ? conv.tokenCount : 0,
        };
    } catch (err) {
        log.error('Failed to read conversation file', { file: fileName }, err);
        return null;
    }
}
