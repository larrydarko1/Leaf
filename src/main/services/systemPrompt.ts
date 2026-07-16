/**
 * System Prompt Service — manages user-editable system-prompt templates
 * stored as markdown files under ~/.leaf/prompts/.
 *
 * Architecture:
 *   - Each *.md file in ~/.leaf/prompts/ is a template.
 *   - Optional YAML-ish frontmatter (`name`, `description`) is parsed for
 *     the picker UI; the body (after `---`) is the actual system prompt.
 *   - ~/.leaf/state.json records which template id is active.
 *   - Bundled defaults from <app>/assets/prompts/ are copied in once on
 *     first launch; user edits are never overwritten.
 *   - The active prompt is read fresh on every model load / chat reset,
 *     so OS-level edits take effect on the next reset.
 */

import type { IpcMain } from 'electron';
import { shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { LEAF_HOME, PROMPTS_DIR, getBundledPromptsDir } from '@/main/lib/paths';
import { readState as readRawState, updateState } from '@/main/lib/appState';
import { log } from '@/main/lib/logger';
import { type PromptInfo, type PromptState, PromptStateSchema } from '@/schemas/ai';

const DEFAULT_PROMPT_ID = 'default';
const PROMPT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
let seedPromise: Promise<void> | null = null;

export function register(ipc: IpcMain): void {
    ipc.handle('systemPrompt:list', async () => {
        try {
            const prompts = await listPrompts();
            const state = await readState();
            return {
                success: true,
                prompts,
                activeId: state.activePrompt ?? DEFAULT_PROMPT_ID,
                promptsDir: PROMPTS_DIR,
            };
        } catch (err) {
            log.error('[systemPrompt] list failed:', err);
            return {
                success: false,
                error: (err as Error).message,
                prompts: [],
                activeId: DEFAULT_PROMPT_ID,
                promptsDir: PROMPTS_DIR,
            };
        }
    });

    ipc.handle('systemPrompt:setActive', async (_event, id: unknown) => {
        if (typeof id !== 'string' || !isValidPromptId(id)) {
            return { success: false, error: 'Invalid prompt id' };
        }
        const file = path.join(PROMPTS_DIR, `${id}.md`);
        if (!existsSync(file)) return { success: false, error: 'Prompt not found' };
        try {
            await updateState((s) => ({ ...s, activePrompt: id }));
            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });

    ipc.handle('systemPrompt:openLeafDir', async () => {
        try {
            await fs.mkdir(LEAF_HOME, { recursive: true });
            await shell.openPath(LEAF_HOME);
            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });
}

/**
 * Read and return the currently-active system prompt body.
 * Returns an empty string if none is configured or the file is missing —
 * callers should treat empty as "no system prompt".
 */
export async function getActiveSystemPrompt(): Promise<string> {
    try {
        await ensureSeeded();
        const state = await readState();
        const id = state.activePrompt ?? DEFAULT_PROMPT_ID;
        if (!isValidPromptId(id)) return '';
        const file = path.join(PROMPTS_DIR, `${id}.md`);
        if (!existsSync(file)) return '';
        const raw = await fs.readFile(file, 'utf-8');
        const { body } = parseFrontmatter(raw);
        return body.trim();
    } catch (err) {
        log.warn('[systemPrompt] read active prompt failed:', err);
        return '';
    }
}

/**
 * Idempotent: copy bundled prompt files into ~/.leaf/prompts/ if absent.
 *
 * Memoised on the in-flight promise (not a boolean flag) so that concurrent
 * callers all await the same run instead of racing through the copy loop and
 * the state read-modify-write. The "start it once" decision happens
 * synchronously, before any await, so there's no window for a second caller
 * to slip past. Resets to null on failure so a later call can retry.
 */
export function ensureSeeded(): Promise<void> {
    if (seedPromise === null) {
        // On failure, log and reset the memo so a later call can retry, and
        // swallow so callers never see a rejection — seeding is non-fatal.
        seedPromise = doSeed().catch((err) => {
            seedPromise = null;
            log.error('[systemPrompt] seeding failed:', err);
        });
    }
    return seedPromise;
}

/**
 * Minimal YAML-ish frontmatter parser. Recognises a leading `---` block
 * containing `key: value` lines (string values, optional quotes). Anything
 * after the closing `---` is the body. No dependencies; intentionally
 * limited to keep the format approachable for hand-editing.
 *
 * Exported for unit testing.
 */
export function parseFrontmatter(content: string): {
    meta: { name?: string; description?: string };
    body: string;
} {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (match === null) return { meta: {}, body: content };

    const meta: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
        const keyValue = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
        if (keyValue === null) continue;
        let value = keyValue[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        meta[keyValue[1].toLowerCase()] = value;
    }
    return { meta, body: match[2] };
}

async function doSeed(): Promise<void> {
    await fs.mkdir(PROMPTS_DIR, { recursive: true });

    const bundled = getBundledPromptsDir();
    if (existsSync(bundled)) {
        const entries = await fs.readdir(bundled, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
            const dest = path.join(PROMPTS_DIR, entry.name);
            if (existsSync(dest)) continue;
            await fs.copyFile(path.join(bundled, entry.name), dest);
            log.info(`[systemPrompt] Seeded ${entry.name}`);
        }
    }

    await updateState((s) => (s.activePrompt === undefined ? { ...s, activePrompt: DEFAULT_PROMPT_ID } : s));
}

async function listPrompts(): Promise<PromptInfo[]> {
    await ensureSeeded();
    let entries;
    try {
        entries = await fs.readdir(PROMPTS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }

    const list: PromptInfo[] = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
        const id = entry.name.replace(/\.md$/i, '');
        if (!isValidPromptId(id)) continue;

        const file = path.join(PROMPTS_DIR, entry.name);
        let meta: { name?: string; description?: string } = {};
        try {
            const raw = await fs.readFile(file, 'utf-8');
            meta = parseFrontmatter(raw).meta;
        } catch {
            /* ignore unreadable file */
        }

        list.push({
            id,
            name: meta.name?.trim() ?? id,
            description: meta.description?.trim() ?? '',
            path: file,
        });
    }

    list.sort((a, b) => {
        // Pin "default" first, then alphabetical.
        if (a.id === DEFAULT_PROMPT_ID && b.id !== DEFAULT_PROMPT_ID) return -1;
        if (b.id === DEFAULT_PROMPT_ID && a.id !== DEFAULT_PROMPT_ID) return 1;
        return a.name.localeCompare(b.name);
    });
    return list;
}

/** Read the shared state file and validate the prompt-relevant view of it. */
async function readState(): Promise<PromptState> {
    const raw = await readRawState();
    const result = PromptStateSchema.safeParse(raw);
    return result.success ? result.data : {};
}

function isValidPromptId(id: string): boolean {
    return PROMPT_ID_PATTERN.test(id) && id.length > 0 && id.length <= 64;
}
