// AI Service - Manages local LLM inference via node-llama-cpp
// This runs in the Electron main process and handles model loading, 
// unloading, and chat inference with streaming token support.

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

// Default models directory: ~/leaf-models/
const DEFAULT_MODELS_DIR = path.join(os.homedir(), 'leaf-models');

let llama = null;       // Llama instance (from node-llama-cpp)
let model = null;       // Currently loaded model
let context = null;     // Active context
let session = null;     // Active chat session

// Track state
let isModelLoaded = false;
let currentModelPath = null;
let isGenerating = false;
let currentAbortController = null; // For stopping generation
let pendingConversationHistory = null; // Stored history to inject as summary on next prompt
let trackedMessages = []; // All messages in current conversation (for auto-compaction)

// Auto-compaction threshold: when token usage exceeds this % of context size,
// the session is reset and a summary is injected on the next prompt.
const COMPACTION_THRESHOLD = 0.90;

/**
 * Ensure the models directory exists
 */
async function ensureModelsDir() {
    try {
        await fs.mkdir(DEFAULT_MODELS_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create models directory:', err);
    }
}

/**
 * Dynamically import node-llama-cpp (ESM module from CJS)
 */
async function getLlamaInstance() {
    if (llama) return llama;

    // node-llama-cpp is ESM, so we need dynamic import
    const { getLlama } = await import('node-llama-cpp');
    llama = await getLlama();
    return llama;
}

/**
 * List available .gguf model files in the models directory
 */
/**
 * Filename prefixes/patterns that indicate non-model GGUF files
 * (e.g. multimodal projectors, tokenizers, adapters)
 */
const NON_MODEL_PREFIXES = [
    'mmproj-',        // multimodal projection files
    'projector-',     // alternative projector naming
    'tokenizer',      // tokenizer files
    'adapter',        // LoRA adapter files
];

/**
 * Check if a .gguf file is likely a loadable chat model
 * (filters out projectors, tokenizers, adapters, etc.)
 */
function isModelFile(filename) {
    const lower = filename.toLowerCase();
    if (!lower.endsWith('.gguf')) return false;
    return !NON_MODEL_PREFIXES.some(prefix => lower.startsWith(prefix));
}

/**
 * Recursively scan a directory for .gguf model files
 */
async function scanForModels(dir, baseDir) {
    const models = [];
    let entries;

    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return models;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Recurse into subdirectories (max 2 levels deep to avoid scanning too far)
            const depth = path.relative(baseDir, fullPath).split(path.sep).length;
            if (depth <= 2) {
                const subModels = await scanForModels(fullPath, baseDir);
                models.push(...subModels);
            }
        } else if (entry.isFile() && isModelFile(entry.name)) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(baseDir, fullPath);
            // Use folder/filename as display name if nested, otherwise just filename
            const displayName = relativePath.includes(path.sep)
                ? relativePath
                : entry.name;

            models.push({
                name: displayName,
                path: fullPath,
                size: stats.size,
                sizeFormatted: formatFileSize(stats.size),
                modified: stats.mtime.toISOString()
            });
        }
    }

    return models;
}

async function listModels() {
    await ensureModelsDir();

    try {
        const models = await scanForModels(DEFAULT_MODELS_DIR, DEFAULT_MODELS_DIR);

        // Sort by name for consistent ordering
        models.sort((a, b) => a.name.localeCompare(b.name));

        return { success: true, models, modelsDir: DEFAULT_MODELS_DIR };
    } catch (error) {
        return { success: false, error: error.message, models: [], modelsDir: DEFAULT_MODELS_DIR };
    }
}

/**
 * Load a model from a .gguf file path
 */
async function loadModel(modelPath) {
    try {
        // Unload existing model first
        if (isModelLoaded) {
            await unloadModel();
        }

        // Check if file exists
        if (!fsSync.existsSync(modelPath)) {
            return { success: false, error: `Model file not found: ${modelPath}` };
        }

        const llamaInstance = await getLlamaInstance();

        console.log(`Loading model: ${modelPath}`);
        model = await llamaInstance.loadModel({ modelPath });

        context = await model.createContext();

        const { LlamaChatSession } = await import('node-llama-cpp');
        session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });

        isModelLoaded = true;
        currentModelPath = modelPath;

        console.log('Model loaded successfully');
        return {
            success: true,
            modelName: path.basename(modelPath)
        };
    } catch (error) {
        console.error('Failed to load model:', error);
        isModelLoaded = false;
        currentModelPath = null;
        model = null;
        context = null;
        session = null;
        return { success: false, error: error.message };
    }
}

/**
 * Unload the currently loaded model and free resources
 */
async function unloadModel() {
    try {
        if (session) {
            session = null;
        }
        if (context) {
            await context.dispose();
            context = null;
        }
        if (model) {
            await model.dispose();
            model = null;
        }

        isModelLoaded = false;
        currentModelPath = null;
        isGenerating = false;
        pendingConversationHistory = null;
        trackedMessages = [];

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to unload model:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send a chat message and stream tokens back via callback
 * @param {string} userMessage - The user's message
 * @param {function} onToken - Callback for each generated token chunk
 * @param {string} [noteContext] - Optional note content to include as context
 * @returns {Promise<{success: boolean, response?: string, error?: string}>}
 */
async function chat(userMessage, onToken, noteContext = null) {
    if (!isModelLoaded || !session) {
        return { success: false, error: 'No model loaded. Please load a model first.' };
    }

    if (isGenerating) {
        return { success: false, error: 'Already generating a response. Please wait.' };
    }

    isGenerating = true;
    currentAbortController = new AbortController();

    try {
        // Build the prompt with optional note context
        let prompt = userMessage;

        // If we have pending conversation history from a restored session,
        // inject it as context summary and clear it (one-time injection)
        if (pendingConversationHistory) {
            const summary = buildConversationSummary(pendingConversationHistory);
            pendingConversationHistory = null;
            prompt = `Here is a summary of our previous conversation for context:\n\n---\n${summary}\n---\n\n${prompt}`;
        }

        if (noteContext) {
            prompt = `Here is the content of the current note for context:\n\n---\n${noteContext}\n---\n\nUser question: ${prompt}`;
        }

        let fullResponse = '';

        const response = await session.prompt(prompt, {
            signal: currentAbortController.signal,
            stopOnAbortSignal: true,
            onTextChunk: (text) => {
                fullResponse += text;
                if (onToken) {
                    onToken(text);
                }
            }
        });

        // Track messages for auto-compaction
        trackedMessages.push({ role: 'user', content: userMessage });
        trackedMessages.push({ role: 'assistant', content: fullResponse });

        // Check if we need to auto-compact the context
        let compacted = false;
        try {
            const seq = session.sequence;
            if (seq) {
                const usage = seq.nextTokenIndex / seq.contextSize;
                if (usage >= COMPACTION_THRESHOLD) {
                    console.log(`Context usage at ${Math.round(usage * 100)}% — auto-compacting...`);
                    // Store all tracked messages for summary injection
                    pendingConversationHistory = [...trackedMessages];
                    // Reset the LLM session (frees token memory)
                    const { LlamaChatSession } = await import('node-llama-cpp');
                    session = new LlamaChatSession({
                        contextSequence: context.getSequence()
                    });
                    compacted = true;
                    console.log('Auto-compaction complete. Summary will be injected on next prompt.');
                }
            }
        } catch (compactErr) {
            console.error('Auto-compaction check failed:', compactErr);
        }

        isGenerating = false;
        currentAbortController = null;
        return { success: true, response: fullResponse, compacted };
    } catch (error) {
        isGenerating = false;
        currentAbortController = null;
        console.error('Chat error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Stop the currently running generation
 */
function stopChat() {
    if (isGenerating && currentAbortController) {
        currentAbortController.abort();
        isGenerating = false;
        currentAbortController = null;
        console.log('Generation stopped by user');
        return { success: true };
    }
    return { success: false, error: 'No generation in progress.' };
}

/**
 * Reset the chat session (clear conversation history)
 */
async function resetChat() {
    if (!isModelLoaded || !model || !context) {
        return { success: false, error: 'No model loaded.' };
    }

    try {
        pendingConversationHistory = null;
        trackedMessages = [];
        const { LlamaChatSession } = await import('node-llama-cpp');
        session = new LlamaChatSession({
            contextSequence: context.getSequence()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Store conversation history to be injected as context summary on the next prompt.
 * This avoids re-processing all tokens through the model (which can crash Metal),
 * and instead builds a compact summary that gets prepended to the next user message.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {{success: boolean, error?: string}}
 */
async function restoreChatHistory(messages) {
    if (!messages || messages.length === 0) {
        pendingConversationHistory = null;
        return { success: true };
    }

    try {
        pendingConversationHistory = messages;
        trackedMessages = [...messages]; // Also track them for future auto-compaction
        console.log(`Stored ${messages.length} messages for context restoration`);
        return { success: true };
    } catch (error) {
        console.error('Failed to store chat history:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Build a compact summary of previous conversation messages.
 * Truncates long messages to keep the summary within reasonable token limits.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string}
 */
function buildConversationSummary(messages) {
    const MAX_MSG_LENGTH = 300;
    const MAX_MESSAGES = 20;

    // Take the most recent messages if conversation is very long
    const recentMessages = messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;

    const lines = recentMessages.map(m => {
        const role = m.role === 'user' ? 'User' : 'Assistant';
        const content = m.content.length > MAX_MSG_LENGTH
            ? m.content.slice(0, MAX_MSG_LENGTH) + '...'
            : m.content;
        return `${role}: ${content}`;
    });

    return lines.join('\n');
}

/**
 * Get current AI service status
 */
function getStatus() {
    let contextTokens = 0;
    let contextSize = 0;

    if (isModelLoaded && session) {
        try {
            const seq = session.sequence;
            if (seq) {
                contextTokens = seq.nextTokenIndex;
                contextSize = seq.contextSize;
            }
        } catch (e) {
            // Sequence may not be available yet
        }
    }

    return {
        isModelLoaded,
        currentModelPath,
        currentModelName: currentModelPath ? path.basename(currentModelPath) : null,
        isGenerating,
        modelsDir: DEFAULT_MODELS_DIR,
        contextTokens,
        contextSize
    };
}

/**
 * Open the models directory in the system file manager
 */
async function openModelsDir() {
    await ensureModelsDir();
    const { shell } = require('electron');
    await shell.openPath(DEFAULT_MODELS_DIR);
    return { success: true };
}

// Utility: format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Wire up all AI IPC handlers.
 * @param {Electron.IpcMain} ipc
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function register(ipc, getMainWindow) {
    ipc.handle('ai:listModels', async () => listModels());

    ipc.handle('ai:loadModel', async (event, modelPath) => {
        if (typeof modelPath !== 'string') return { success: false, error: 'Invalid model path' };
        return loadModel(modelPath);
    });

    ipc.handle('ai:unloadModel', async () => unloadModel());

    ipc.handle('ai:chat', async (event, userMessage, noteContext) => {
        if (typeof userMessage !== 'string') return { success: false, error: 'Invalid message' };
        return chat(
            userMessage,
            (token) => {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) win.webContents.send('ai:token', token);
            },
            noteContext,
        );
    });

    ipc.handle('ai:stopChat', async () => stopChat());
    ipc.handle('ai:resetChat', async () => resetChat());

    ipc.handle('ai:restoreChatHistory', async (event, messages) => {
        if (!Array.isArray(messages)) return { success: false, error: 'Invalid messages' };
        return restoreChatHistory(messages);
    });

    ipc.handle('ai:getStatus', async () => getStatus());
    ipc.handle('ai:openModelsDir', async () => openModelsDir());
}

module.exports = {
    register,
    listModels,
    loadModel,
    unloadModel,
    chat,
    stopChat,
    resetChat,
    restoreChatHistory,
    getStatus,
    openModelsDir,
    DEFAULT_MODELS_DIR
};
