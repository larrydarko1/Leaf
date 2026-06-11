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
import { LEAF_HOME, PROMPTS_DIR, STATE_FILE, getBundledPromptsDir } from '../lib/paths';
import { log } from '../lib/logger';

type PromptInfo = {
    id: string;
    name: string;
    description: string;
    path: string;
};

type PromptState = {
    activePrompt?: string;
    // Other services (theme.ts) may write additional keys to state.json.
    // We preserve them on every write.
    [key: string]: unknown;
};

const DEFAULT_PROMPT_ID = 'default';
const PROMPT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

let seeded = false;

export function register(ipc: IpcMain): void {
    ipc.handle('systemPrompt:list', async () => {
        try {
            const prompts = await listPrompts();
            const state = await readState();
            return {
                success: true,
                prompts,
                activeId: state.activePrompt || DEFAULT_PROMPT_ID,
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
            const state = await readState();
            await writeState({ ...state, activePrompt: id });
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
        const id = state.activePrompt || DEFAULT_PROMPT_ID;
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

/** Idempotent: copy bundled prompt files into ~/.leaf/prompts/ if absent. */
export async function ensureSeeded(): Promise<void> {
    if (seeded) return;
    try {
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

        if (!existsSync(STATE_FILE)) {
            await writeState({ activePrompt: DEFAULT_PROMPT_ID });
        } else {
            // Backfill activePrompt if state exists but lacks it (e.g. theme
            // service wrote first on a fresh install).
            const state = await readState();
            if (!state.activePrompt) {
                await writeState({ ...state, activePrompt: DEFAULT_PROMPT_ID });
            }
        }

        seeded = true;
    } catch (err) {
        log.error('[systemPrompt] seeding failed:', err);
    }
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
            name: meta.name?.trim() || id,
            description: meta.description?.trim() || '',
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
    if (!match) return { meta: {}, body: content };

    const meta: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
        if (!kv) continue;
        let v = kv[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        meta[kv[1].toLowerCase()] = v;
    }
    return { meta, body: match[2] };
}

async function readState(): Promise<PromptState> {
    try {
        if (!existsSync(STATE_FILE)) return {};
        const raw = await fs.readFile(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch (err) {
        log.warn('[systemPrompt] state read failed:', err);
        return {};
    }
}

async function writeState(state: PromptState): Promise<void> {
    await fs.mkdir(LEAF_HOME, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function isValidPromptId(id: string): boolean {
    return PROMPT_ID_PATTERN.test(id) && id.length > 0 && id.length <= 64;
}
