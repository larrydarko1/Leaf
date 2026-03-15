// AI Service - Manages local LLM inference via node-llama-cpp
// This runs in the Electron main process and handles model loading,
// unloading, and chat inference with streaming token support.

import type { IpcMain, BrowserWindow } from 'electron';
import { shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { DEFAULT_MODELS_DIR } from '../lib/paths';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llama: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let context: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;

let isModelLoaded = false;
let currentModelPath: string | null = null;
let isGenerating = false;
let currentAbortController: AbortController | null = null;
let pendingConversationHistory: Array<{ role: string; content: string }> | null = null;
let trackedMessages: Array<{ role: string; content: string }> = [];

const COMPACTION_THRESHOLD = 0.9;

async function ensureModelsDir(): Promise<void> {
    try {
        await fs.mkdir(DEFAULT_MODELS_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create models directory:', err);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLlamaInstance(): Promise<any> {
    if (llama) return llama;
    const { getLlama } = await import('node-llama-cpp');
    llama = await getLlama();
    return llama;
}

const NON_MODEL_PREFIXES = ['mmproj-', 'projector-', 'tokenizer', 'adapter'];

function isModelFile(filename: string): boolean {
    const lower = filename.toLowerCase();
    if (!lower.endsWith('.gguf')) return false;
    return !NON_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface ModelEntry {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    modified: string;
}

async function scanForModels(dir: string, baseDir: string): Promise<ModelEntry[]> {
    const models: ModelEntry[] = [];
    let entries;

    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return models;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            const depth = path.relative(baseDir, fullPath).split(path.sep).length;
            if (depth <= 2) {
                const subModels = await scanForModels(fullPath, baseDir);
                models.push(...subModels);
            }
        } else if (entry.isFile() && isModelFile(entry.name)) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(baseDir, fullPath);
            const displayName = relativePath.includes(path.sep) ? relativePath : entry.name;

            models.push({
                name: displayName,
                path: fullPath,
                size: stats.size,
                sizeFormatted: formatFileSize(stats.size),
                modified: stats.mtime.toISOString(),
            });
        }
    }

    return models;
}

async function listModels(): Promise<{ success: boolean; models: ModelEntry[]; modelsDir: string; error?: string }> {
    await ensureModelsDir();

    try {
        const models = await scanForModels(DEFAULT_MODELS_DIR, DEFAULT_MODELS_DIR);
        models.sort((a, b) => a.name.localeCompare(b.name));
        return { success: true, models, modelsDir: DEFAULT_MODELS_DIR };
    } catch (error) {
        return { success: false, error: (error as Error).message, models: [], modelsDir: DEFAULT_MODELS_DIR };
    }
}

// Architectures whose Metal (GPU) backend has known execution failures.
// For these we force CPU-only inference (gpuLayers: 0).
// - mistral3: 262K-context YaRN model; Metal command buffers fail on decode
//   with status 5 (MTLCommandBufferStatusError) on Apple Silicon.
const CPU_ONLY_ARCHITECTURES = new Set(['mistral3']);

async function getModelLoadOptions(modelPath: string): Promise<{ gpuLayers?: number }> {
    try {
        const { readGgufFileInfo } = await import('node-llama-cpp');
        const info = await readGgufFileInfo(modelPath);
        const arch = info.metadata?.['general']?.['architecture'] as string | undefined;
        if (arch && CPU_ONLY_ARCHITECTURES.has(arch.toLowerCase())) {
            console.log(`[ai] Architecture '${arch}' requires CPU-only inference — disabling GPU layers.`);
            return { gpuLayers: 0 };
        }
    } catch (err) {
        console.warn('[ai] Could not read GGUF metadata, using default load options:', err);
    }
    return {};
}

async function loadModel(modelPath: string): Promise<{ success: boolean; modelName?: string; error?: string }> {
    try {
        if (isModelLoaded) {
            await unloadModel();
        }

        // Only allow loading models from the designated models directory
        const resolvedModel = path.resolve(modelPath);
        const resolvedModelsDir = path.resolve(DEFAULT_MODELS_DIR);
        if (resolvedModel !== resolvedModelsDir && !resolvedModel.startsWith(resolvedModelsDir + path.sep)) {
            return { success: false, error: 'Access denied: model must be inside the models directory.' };
        }

        if (!existsSync(modelPath)) {
            return { success: false, error: `Model file not found: ${modelPath}` };
        }

        const llamaInstance = await getLlamaInstance();

        console.log(`Loading model: ${modelPath}`);
        const loadOptions = await getModelLoadOptions(modelPath);
        model = await llamaInstance.loadModel({ modelPath, ...loadOptions });
        context = await model.createContext();

        const { LlamaChatSession } = await import('node-llama-cpp');
        session = new LlamaChatSession({ contextSequence: context.getSequence() });

        isModelLoaded = true;
        currentModelPath = modelPath;

        console.log('Model loaded successfully');
        return { success: true, modelName: path.basename(modelPath) };
    } catch (error) {
        console.error('Failed to load model:', error);
        isModelLoaded = false;
        currentModelPath = null;
        model = null;
        context = null;
        session = null;
        return { success: false, error: (error as Error).message };
    }
}

async function unloadModel(): Promise<{ success: boolean; error?: string }> {
    try {
        session = null;
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

        if (global.gc) {
            global.gc();
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to unload model:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function chat(
    userMessage: string,
    onToken: (token: string) => void,
    noteContext: string | null = null,
): Promise<{ success: boolean; response?: string; compacted?: boolean; error?: string }> {
    if (!isModelLoaded || !session) {
        return { success: false, error: 'No model loaded. Please load a model first.' };
    }

    if (isGenerating) {
        return { success: false, error: 'Already generating a response. Please wait.' };
    }

    isGenerating = true;
    currentAbortController = new AbortController();

    try {
        let prompt = userMessage;

        if (pendingConversationHistory) {
            const summary = buildConversationSummary(pendingConversationHistory);
            pendingConversationHistory = null;
            prompt = `Here is a summary of our previous conversation for context:\n\n---\n${summary}\n---\n\n${prompt}`;
        }

        if (noteContext) {
            prompt = `Here is the content of the current note for context:\n\n---\n${noteContext}\n---\n\nUser question: ${prompt}`;
        }

        let fullResponse = '';

        await session.prompt(prompt, {
            signal: currentAbortController.signal,
            stopOnAbortSignal: true,
            onTextChunk: (text: string) => {
                fullResponse += text;
                onToken(text);
            },
        });

        trackedMessages.push({ role: 'user', content: userMessage });
        trackedMessages.push({ role: 'assistant', content: fullResponse });

        let compacted = false;
        try {
            const seq = session.sequence;
            if (seq) {
                const usage = seq.nextTokenIndex / seq.contextSize;
                if (usage >= COMPACTION_THRESHOLD) {
                    console.log(`Context usage at ${Math.round(usage * 100)}% — auto-compacting...`);
                    pendingConversationHistory = [...trackedMessages];
                    const { LlamaChatSession } = await import('node-llama-cpp');
                    // Reuse existing sequence to avoid exhausting sequence slots
                    if (seq && !seq.disposed) {
                        await seq.clearHistory();
                        session = new LlamaChatSession({ contextSequence: seq });
                    } else {
                        session = new LlamaChatSession({ contextSequence: context.getSequence() });
                    }
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
        return { success: false, error: (error as Error).message };
    }
}

function stopChat(): { success: boolean; error?: string } {
    if (isGenerating && currentAbortController) {
        currentAbortController.abort();
        isGenerating = false;
        currentAbortController = null;
        console.log('Generation stopped by user');
        return { success: true };
    }
    return { success: false, error: 'No generation in progress.' };
}

async function resetChat(): Promise<{ success: boolean; error?: string }> {
    if (!isModelLoaded || !model || !context) {
        return { success: false, error: 'No model loaded.' };
    }

    try {
        pendingConversationHistory = null;
        trackedMessages = [];
        const { LlamaChatSession } = await import('node-llama-cpp');
        // Reuse the existing sequence (clear its KV cache) instead of
        // calling context.getSequence() which allocates a new slot and
        // can exhaust the context's sequence limit, crashing Metal.
        const existingSeq = session?.sequence;
        if (existingSeq && !existingSeq.disposed) {
            await existingSeq.clearHistory();
            session = new LlamaChatSession({ contextSequence: existingSeq });
        } else {
            session = new LlamaChatSession({ contextSequence: context.getSequence() });
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

async function restoreChatHistory(
    messages: Array<{ role: string; content: string }>,
): Promise<{ success: boolean; error?: string }> {
    if (!messages || messages.length === 0) {
        pendingConversationHistory = null;
        return { success: true };
    }

    try {
        pendingConversationHistory = messages;
        trackedMessages = [...messages];
        console.log(`Stored ${messages.length} messages for context restoration`);
        return { success: true };
    } catch (error) {
        console.error('Failed to store chat history:', error);
        return { success: false, error: (error as Error).message };
    }
}

function buildConversationSummary(messages: Array<{ role: string; content: string }>): string {
    const MAX_MSG_LENGTH = 300;
    const MAX_MESSAGES = 20;

    const recentMessages = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;

    return recentMessages
        .map((m) => {
            const role = m.role === 'user' ? 'User' : 'Assistant';
            const content = m.content.length > MAX_MSG_LENGTH ? m.content.slice(0, MAX_MSG_LENGTH) + '...' : m.content;
            return `${role}: ${content}`;
        })
        .join('\n');
}

function getStatus(): object {
    let contextTokens = 0;
    let contextSize = 0;

    if (isModelLoaded && session) {
        try {
            const seq = session.sequence;
            if (seq) {
                contextTokens = seq.nextTokenIndex;
                contextSize = seq.contextSize;
            }
        } catch {
            /* sequence may not be available yet */
        }
    }

    return {
        isModelLoaded,
        currentModelPath,
        currentModelName: currentModelPath ? path.basename(currentModelPath) : null,
        isGenerating,
        modelsDir: DEFAULT_MODELS_DIR,
        contextTokens,
        contextSize,
    };
}

async function openModelsDir(): Promise<{ success: boolean }> {
    await ensureModelsDir();
    await shell.openPath(DEFAULT_MODELS_DIR);
    return { success: true };
}

export function register(ipc: IpcMain, getMainWindow: () => BrowserWindow | null): void {
    ipc.handle('ai:listModels', async () => listModels());

    ipc.handle('ai:loadModel', async (_event, modelPath: string) => {
        if (typeof modelPath !== 'string') return { success: false, error: 'Invalid model path' };
        return loadModel(modelPath);
    });

    ipc.handle('ai:unloadModel', async () => unloadModel());

    ipc.handle('ai:chat', async (_event, userMessage: string, noteContext: string) => {
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

    ipc.handle('ai:restoreChatHistory', async (_event, messages: Array<{ role: string; content: string }>) => {
        if (!Array.isArray(messages)) return { success: false, error: 'Invalid messages' };
        return restoreChatHistory(messages);
    });

    ipc.handle('ai:getStatus', async () => getStatus());
    ipc.handle('ai:openModelsDir', async () => openModelsDir());
}

/** Graceful shutdown: unload the model and free resources. */
export async function cleanup(): Promise<void> {
    if (isModelLoaded) {
        await unloadModel();
    }
}
