/**
 * Language Service — manages user-editable language files stored as JSON
 * files under ~/.leaf/locales/.
 *
 * Architecture mirrors theme.ts:
 *   - Each *.json file in ~/.leaf/locales/ is a language preset.
 *   - ~/.leaf/state.json records which language id is active.
 *   - Bundled defaults from <app>/assets/locales/ are copied in once on
 *     first launch; user edits are never overwritten.
 *
 * Language JSON shape:
 *   {
 *     "common": { "save": "...", ... },
 *     "app": { "title": "...", ... },
 *     ...
 *   }
 */

import { shell, type IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { LEAF_HOME, LOCALES_DIR, STATE_FILE, getBundledLocalesDir } from '@/main/lib/paths';
import { log } from '@/main/lib/logger';
import type { LanguageInfo, LanguageState } from '@/schemas/vault';

const DEFAULT_LANGUAGE_ID = 'en';
const LANGUAGE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
let seeded = false;

export function register(ipc: IpcMain): void {
    ipc.handle('language:list', listLanguages);

    ipc.handle('language:setActive', async (_event, id: unknown) => {
        return setActiveLanguage(id as string);
    });

    ipc.handle('language:load', async (_event, id: unknown) => {
        return loadLanguageContent(id as string);
    });

    ipc.handle('language:openLeafDir', async () => {
        try {
            await fs.mkdir(LOCALES_DIR, { recursive: true });
            await shell.openPath(LOCALES_DIR);
            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });
}

/** Idempotent: copy bundled language files into ~/.leaf/locales/ if absent. */
export async function ensureSeeded(): Promise<void> {
    if (seeded) return;
    try {
        await fs.mkdir(LOCALES_DIR, { recursive: true });

        const bundled = getBundledLocalesDir();
        if (existsSync(bundled)) {
            const entries = await fs.readdir(bundled, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
                const dest = path.join(LOCALES_DIR, entry.name);
                if (existsSync(dest)) continue;
                await fs.copyFile(path.join(bundled, entry.name), dest);
                log.info(`[language] Seeded ${entry.name}`);
            }
        }

        seeded = true;
    } catch (err) {
        log.error('[language] seeding failed:', err);
    }
}

async function readState(): Promise<LanguageState> {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf-8');
        return JSON.parse(data) as LanguageState;
    } catch {
        return {};
    }
}

async function writeState(state: LanguageState): Promise<void> {
    await fs.mkdir(LEAF_HOME, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export function isValidLanguageId(id: string): boolean {
    return typeof id === 'string' && LANGUAGE_ID_PATTERN.test(id);
}

async function listLanguagesArray(): Promise<LanguageInfo[]> {
    await ensureSeeded();
    const languages: LanguageInfo[] = [];

    try {
        const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                const id = entry.name.replace(/\.json$/, '');
                if (isValidLanguageId(id)) {
                    languages.push({
                        id,
                        name: id.toUpperCase(),
                        path: path.join(LOCALES_DIR, entry.name),
                    });
                }
            }
        }
    } catch (err) {
        log.warn('[language] listLanguages failed:', err);
    }

    // Sort alphabetically
    languages.sort((a, b) => a.id.localeCompare(b.id));
    return languages;
}

export async function listLanguages(): Promise<{
    success: boolean;
    languages?: LanguageInfo[];
    activeId: string;
    localesDir: string;
    error?: string;
}> {
    try {
        const languages = await listLanguagesArray();
        const state = await readState();
        return {
            success: true,
            languages,
            activeId: typeof state.activeLanguage === 'string' ? state.activeLanguage : DEFAULT_LANGUAGE_ID,
            localesDir: LOCALES_DIR,
        };
    } catch (err) {
        log.error('[language] list failed:', err);
        return {
            success: false,
            error: (err as Error).message,
            languages: [],
            activeId: DEFAULT_LANGUAGE_ID,
            localesDir: LOCALES_DIR,
        };
    }
}

export async function setActiveLanguage(id: string): Promise<{
    success: boolean;
    error?: string;
}> {
    if (typeof id !== 'string' || !isValidLanguageId(id)) {
        return { success: false, error: 'Invalid language id' };
    }
    const file = path.join(LOCALES_DIR, `${id}.json`);
    if (!existsSync(file)) return { success: false, error: 'Language not found' };
    try {
        const state = await readState();
        await writeState({ ...state, activeLanguage: id });
        return { success: true };
    } catch (err) {
        return { success: false, error: (err as Error).message };
    }
}

export async function loadLanguageContent(id: string): Promise<{
    success: boolean;
    content?: Record<string, unknown>;
    error?: string;
}> {
    if (typeof id !== 'string' || !isValidLanguageId(id)) {
        return { success: false, error: 'Invalid language id' };
    }
    const file = path.join(LOCALES_DIR, `${id}.json`);
    if (!existsSync(file)) {
        return { success: false, error: 'Language file not found' };
    }
    try {
        const data = await fs.readFile(file, 'utf-8');
        const content = JSON.parse(data) as Record<string, unknown>;
        return { success: true, content };
    } catch (err) {
        log.error(`[language] failed to load ${id}:`, err);
        return { success: false, error: (err as Error).message };
    }
}
