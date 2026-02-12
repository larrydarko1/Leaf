// Conversation Service - Persists LLM chat conversations as JSON files
// Conversations are stored in the app's userData directory:
//   macOS: ~/Library/Application Support/Leaf/conversations/
//   Windows: %APPDATA%/Leaf/conversations/
//   Linux: ~/.config/Leaf/conversations/

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

let conversationsDir = null;

/**
 * Initialize the conversations directory.
 * Must be called after app.whenReady() since it uses app.getPath().
 */
function init(userDataPath) {
    conversationsDir = path.join(userDataPath, 'conversations');
    // Ensure directory exists synchronously on init
    if (!fsSync.existsSync(conversationsDir)) {
        fsSync.mkdirSync(conversationsDir, { recursive: true });
    }
}

/**
 * Generate a unique conversation ID
 */
function generateId() {
    return crypto.randomUUID();
}

/**
 * Derive a title from the first user message
 */
function deriveTitle(messages) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New Conversation';
    const text = firstUserMsg.content.trim();
    if (text.length <= 60) return text;
    return text.slice(0, 57) + '...';
}

/**
 * Get the file path for a conversation
 */
function getConversationPath(id) {
    return path.join(conversationsDir, `${id}.json`);
}

/**
 * Create a new conversation and save it
 * @param {string} modelName - Name of the model used
 * @returns {{ success: boolean, conversation?: object, error?: string }}
 */
async function createConversation(modelName) {
    try {
        const now = new Date().toISOString();
        const conversation = {
            id: generateId(),
            title: 'New Conversation',
            model: modelName || 'unknown',
            createdAt: now,
            updatedAt: now,
            messages: []
        };

        await fs.writeFile(
            getConversationPath(conversation.id),
            JSON.stringify(conversation, null, 2),
            'utf-8'
        );

        return { success: true, conversation };
    } catch (error) {
        console.error('Failed to create conversation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save/update a conversation (full overwrite)
 * @param {object} conversation - The conversation object to save
 */
async function saveConversation(conversation) {
    try {
        conversation.updatedAt = new Date().toISOString();
        // Auto-derive title from first user message if still default
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
        return { success: false, error: error.message };
    }
}

/**
 * Add a message to a conversation and persist it
 * @param {string} conversationId
 * @param {object} message - { role: 'user'|'assistant', content: string }
 */
async function addMessage(conversationId, message) {
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
        return { success: false, error: error.message };
    }
}

/**
 * Update the last message in a conversation (used for streaming completion)
 * @param {string} conversationId
 * @param {string} content - The final content of the assistant message
 */
async function updateLastMessage(conversationId, content) {
    try {
        const conversation = await getConversation(conversationId);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }

        if (conversation.messages.length === 0) {
            return { success: false, error: 'No messages to update' };
        }

        const lastMsg = conversation.messages[conversation.messages.length - 1];
        lastMsg.content = content;

        return await saveConversation(conversation);
    } catch (error) {
        console.error('Failed to update last message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a single conversation by ID
 * @param {string} id
 * @returns {object|null}
 */
async function getConversation(id) {
    try {
        const filePath = getConversationPath(id);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * List all conversations (metadata only, no messages)
 * Returns sorted by updatedAt descending (most recent first)
 */
async function listConversations() {
    try {
        const entries = await fs.readdir(conversationsDir, { withFileTypes: true });
        const conversations = [];

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                try {
                    const filePath = path.join(conversationsDir, entry.name);
                    const data = await fs.readFile(filePath, 'utf-8');
                    const conv = JSON.parse(data);
                    // Return metadata only (exclude full messages for performance)
                    conversations.push({
                        id: conv.id,
                        title: conv.title,
                        model: conv.model,
                        createdAt: conv.createdAt,
                        updatedAt: conv.updatedAt,
                        messageCount: conv.messages ? conv.messages.length : 0
                    });
                } catch (err) {
                    console.error(`Failed to read conversation file ${entry.name}:`, err);
                }
            }
        }

        // Sort by most recently updated
        conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        return { success: true, conversations };
    } catch (error) {
        console.error('Failed to list conversations:', error);
        return { success: false, conversations: [], error: error.message };
    }
}

/**
 * Load a full conversation (including messages)
 * @param {string} id
 */
async function loadConversation(id) {
    try {
        const conversation = await getConversation(id);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }
        return { success: true, conversation };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete a conversation
 * @param {string} id
 */
async function deleteConversation(id) {
    try {
        const filePath = getConversationPath(id);
        await fs.unlink(filePath);
        return { success: true };
    } catch (error) {
        console.error('Failed to delete conversation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Rename a conversation
 * @param {string} id
 * @param {string} newTitle
 */
async function renameConversation(id, newTitle) {
    try {
        const conversation = await getConversation(id);
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }
        conversation.title = newTitle;
        return await saveConversation(conversation);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    init,
    createConversation,
    saveConversation,
    addMessage,
    updateLastMessage,
    getConversation,
    listConversations,
    loadConversation,
    deleteConversation,
    renameConversation
};
