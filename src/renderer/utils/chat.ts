import type { ChatMessage } from '@/schemas/chat';

type ModelTurn = { role: 'user' | 'assistant'; content: string };

/** The turns the model is given back: everything but the app's own system notes. */
export function toModelTurns(messages: readonly Pick<ChatMessage, 'role' | 'content'>[]): ModelTurn[] {
    return messages.flatMap((m): ModelTurn[] => (m.role === 'system' ? [] : [{ role: m.role, content: m.content }]));
}
