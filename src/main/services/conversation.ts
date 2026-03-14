// Conversation Service - Persists LLM chat conversations as JSON files
// Conversations are stored in the app's userData directory:
//   macOS: ~/Library/Application Support/Leaf/conversations/
//   Windows: %APPDATA%/Leaf/conversations/
//   Linux: ~/.config/Leaf/conversations/

import type { IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

let conversationsDir: string | null = null;

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

interface Conversation {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
    tokenCount: number;
}

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

function generateId(): string {
    return randomUUID();
}

function deriveTitle(messages: Message[]): string {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New Conversation';
    const text = firstUserMsg.content.trim();
    if (text.length <= 60) return text;
    return text.slice(0, 57) + '...';
}

function getConversationPath(id: string): string {
    return path.join(conversationsDir!, `${id}.json`);
}

export async function createConversation(modelName: string): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
    try {
        const now = new Date().toISOString();
        const conversation: Conversation = {
            id: generateId(),
            title: 'New Conversation',
            model: modelName || 'unknown',
            createdAt: now,
            updatedAt: now,
            messages: [],
            tokenCount: 0,
        };

        await fs.writeFile(
            getConversationPath(conversation.id),
            JSON.stringify(conversation, null, 2),
            'utf-8'
        );

        return { success: true, conversation };
    } catch (error) {
        console.error('Failed to create conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function saveConversation(conversation: Conversation): Promise<{ success: boolean; error?: string }> {
    try {
        conversation.updatedAt = new Date().toISOString();
        if (conversation.title === 'New Conversation' && conversation.messages.length > 0) {
            conversation.title = deriveTitle(conversation.messages);
        }

        await fs.writeFile(
            getConversationPath(conversation.id),
            JSON.stringify(conversation, null, 2),
            'utf-8'
        );

        return { success: true };
    } catch (error) {
        console.error('Failed to save conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function addMessage(conversationId: string, message: Message): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }

        message.timestamp = new Date().toISOString();
        conversation.messages.push(message);

        return await saveConversation(conversation);
    } catch (error) {
        console.error('Failed to add message:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function updateLastMessage(conversationId: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }

        if (conversation.messages.length === 0) {
            return { success: false, error: 'No messages to update' };
        }

        conversation.messages[conversation.messages.length - 1].content = content;

        return await saveConversation(conversation);
    } catch (error) {
        console.error('Failed to update last message:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function getConversation(id: string): Promise<Conversation | null> {
    try {
        const filePath = getConversationPath(id);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Conversation;
    } catch {
        return null;
    }
}

export async function listConversations(): Promise<{ success: boolean; conversations: object[]; error?: string }> {
    try {
        const entries = await fs.readdir(conversationsDir!, { withFileTypes: true });
        const conversations = [];

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                try {
                    const filePath = path.join(conversationsDir!, entry.name);
                    const data = await fs.readFile(filePath, 'utf-8');
                    const conv = JSON.parse(data) as Conversation;
                    conversations.push({
                        id: conv.id,
                        title: conv.title,
                        model: conv.model,
                        createdAt: conv.createdAt,
                        updatedAt: conv.updatedAt,
                        messageCount: conv.messages ? conv.messages.length : 0,
                        tokenCount: conv.tokenCount || 0,
                    });
                } catch (err) {
                    console.error(`Failed to read conversation file ${entry.name}:`, err);
                }
            }
        }

        conversations.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return { success: true, conversations };
    } catch (error) {
        console.error('Failed to list conversations:', error);
        return { success: false, conversations: [], error: (error as Error).message };
    }
}

export async function loadConversation(id: string): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
    try {
        const conversation = await getConversation(id);
        if (!conversation) {
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
        console.error('Failed to delete conversation:', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function renameConversation(id: string, newTitle: string): Promise<{ success: boolean; error?: string }> {
    try {
        const conversation = await getConversation(id);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }
        conversation.title = newTitle;
        return await saveConversation(conversation);
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export function register(ipc: IpcMain): void {
    ipc.handle('conversations:list', async () => listConversations());

    ipc.handle('conversations:create', async (_event, modelName: string) => {
        if (typeof modelName !== 'string') return { success: false, error: 'Invalid model name' };
        return createConversation(modelName);
    });

    ipc.handle('conversations:load', async (_event, id: string) => {
        if (typeof id !== 'string') return { success: false, error: 'Invalid id' };
        return loadConversation(id);
    });

    ipc.handle('conversations:save', async (_event, conversation: Conversation) => {
        if (typeof conversation !== 'object' || conversation === null) return { success: false, error: 'Invalid conversation' };
        return saveConversation(conversation);
    });

    ipc.handle('conversations:addMessage', async (_event, conversationId: string, message: Message) => {
        if (typeof conversationId !== 'string' || typeof message !== 'object') return { success: false, error: 'Invalid arguments' };
        return addMessage(conversationId, message);
    });

    ipc.handle('conversations:updateLastMessage', async (_event, conversationId: string, content: string) => {
        if (typeof conversationId !== 'string' || typeof content !== 'string') return { success: false, error: 'Invalid arguments' };
        return updateLastMessage(conversationId, content);
    });

    ipc.handle('conversations:delete', async (_event, id: string) => {
        if (typeof id !== 'string') return { success: false, error: 'Invalid id' };
        return deleteConversation(id);
    });

    ipc.handle('conversations:rename', async (_event, id: string, newTitle: string) => {
        if (typeof id !== 'string' || typeof newTitle !== 'string') return { success: false, error: 'Invalid arguments' };
        return renameConversation(id, newTitle);
    });
}
