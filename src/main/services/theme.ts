/**
 * Theme Service — manages user-editable theme presets stored as JSON
 * files under ~/.leaf/themes/.
 *
 * Architecture mirrors systemPrompt.ts:
 *   - Each *.json file in ~/.leaf/themes/ is a theme preset.
 *   - ~/.leaf/state.json records which theme id is active.
 *   - Bundled defaults from <app>/assets/themes/ are copied in once on
 *     first launch; user edits are never overwritten.
 *
 * Theme JSON shape:
 *   {
 *     "name": "Dark",
 *     "description": "Optional human-readable description",
 *     "colors": {
 *        "text1": "#ffffff",
 *        "bg-primary": "#1e1e1e",
 *        ...
 *     }
 *   }
 *
 * The renderer is responsible for applying `colors` to :root as CSS
 * custom properties.
 */

import type { IpcMain } from 'electron';
import { shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { LEAF_HOME, THEMES_DIR, STATE_FILE, getBundledThemesDir } from '../lib/paths';
import { log } from '../lib/logger';

type ThemeInfo = {
    id: string;
    name: string;
    description: string;
    colors: Record<string, string>;
    path: string;
};

type ThemeState = {
    activeTheme?: string;
    // (other keys, e.g. activePrompt, are preserved untouched)
    [key: string]: unknown;
};

const DEFAULT_THEME_ID = 'dark';
const THEME_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

let seeded = false;

export function register(ipc: IpcMain): void {
    ipc.handle('theme:list', async () => {
        try {
            const themes = await listThemes();
            const state = await readState();
            return {
                success: true,
                themes,
                activeId: typeof state.activeTheme === 'string' ? state.activeTheme : DEFAULT_THEME_ID,
                themesDir: THEMES_DIR,
            };
        } catch (err) {
            log.error('[theme] list failed:', err);
            return {
                success: false,
                error: (err as Error).message,
                themes: [],
                activeId: DEFAULT_THEME_ID,
                themesDir: THEMES_DIR,
            };
        }
    });

    ipc.handle('theme:setActive', async (_event, id: unknown) => {
        if (typeof id !== 'string' || !isValidThemeId(id)) {
            return { success: false, error: 'Invalid theme id' };
        }
        const file = path.join(THEMES_DIR, `${id}.json`);
        if (!existsSync(file)) return { success: false, error: 'Theme not found' };
        try {
            const state = await readState();
            await writeState({ ...state, activeTheme: id });
            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });

    ipc.handle('theme:openLeafDir', async () => {
        try {
            await fs.mkdir(THEMES_DIR, { recursive: true });
            await shell.openPath(THEMES_DIR);
            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });
}

/** Idempotent: copy bundled theme files into ~/.leaf/themes/ if absent. */
export async function ensureSeeded(): Promise<void> {
    if (seeded) return;
    try {
        await fs.mkdir(THEMES_DIR, { recursive: true });

        const bundled = getBundledThemesDir();
        if (existsSync(bundled)) {
            const entries = await fs.readdir(bundled, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
                const dest = path.join(THEMES_DIR, entry.name);
                if (existsSync(dest)) continue;
                await fs.copyFile(path.join(bundled, entry.name), dest);
                log.info(`[theme] Seeded ${entry.name}`);
            }
        }

        seeded = true;
    } catch (err) {
        log.error('[theme] seeding failed:', err);
    }
}

async function listThemes(): Promise<ThemeInfo[]> {
    await ensureSeeded();
    let entries;
    try {
        entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
    } catch {
        return [];
    }

    const list: ThemeInfo[] = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
        const id = entry.name.replace(/\.json$/i, '');
        if (!isValidThemeId(id)) continue;

        const file = path.join(THEMES_DIR, entry.name);
        try {
            const raw = await fs.readFile(file, 'utf-8');
            const parsed = JSON.parse(raw);
            const info = normalizeTheme(id, file, parsed);
            if (info) list.push(info);
        } catch (err) {
            log.warn(`[theme] failed to parse ${entry.name}:`, err);
        }
    }

    list.sort((a, b) => {
        // Pin "dark" first, then alphabetical.
        if (a.id === DEFAULT_THEME_ID && b.id !== DEFAULT_THEME_ID) return -1;
        if (b.id === DEFAULT_THEME_ID && a.id !== DEFAULT_THEME_ID) return 1;
        return a.name.localeCompare(b.name);
    });
    return list;
}

function normalizeTheme(id: string, filePath: string, raw: unknown): ThemeInfo | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;

    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : id;
    const description = typeof obj.description === 'string' ? obj.description.trim() : '';

    const colorsRaw = obj.colors;
    const colors: Record<string, string> = {};
    if (colorsRaw && typeof colorsRaw === 'object') {
        for (const [key, value] of Object.entries(colorsRaw as Record<string, unknown>)) {
            if (typeof value !== 'string') continue;
            // Only allow safe CSS-variable keys (letters, digits, dashes, underscore).
            if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) continue;
            colors[key] = value;
        }
    }

    return { id, name, description, colors, path: filePath };
}

async function readState(): Promise<ThemeState> {
    try {
        if (!existsSync(STATE_FILE)) return {};
        const raw = await fs.readFile(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch (err) {
        log.warn('[theme] state read failed:', err);
        return {};
    }
}

async function writeState(state: ThemeState): Promise<void> {
    await fs.mkdir(LEAF_HOME, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function isValidThemeId(id: string): boolean {
    return THEME_ID_PATTERN.test(id) && id.length > 0 && id.length <= 64;
}
