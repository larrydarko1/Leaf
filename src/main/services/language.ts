/**
 * Language Service — manages user-editable language files stored as JSON
 * files under ~/.leaf/locales/.
 *
 * Architecture mirrors theme.ts:
 *   - Each *.json file in ~/.leaf/locales/ is a language preset.
 *   - ~/.leaf/state.json records which language id is active.
 *   - Bundled defaults from <app>/assets/locales/ are copied in on first
 *     launch. On later launches, existing users get new keys backfilled from
 *     the bundle without losing their own values; files that still match the
 *     hash recorded for the last bundled copy (i.e. untouched) are fully
 *     re-synced. A hidden manifest (~/.leaf/locales/.manifest.json) tracks
 *     that hash per locale id. User-created locales have no bundled twin and
 *     are never visited at all.
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
import { createHash } from 'crypto';
import { LEAF_HOME, LOCALES_DIR, STATE_FILE, getBundledLocalesDir } from '@/main/lib/paths';
import { log } from '@/main/lib/logger';
import { type LanguageInfo, type LanguageState, LanguageStateSchema } from '@/schemas/vault';

/** Maps locale id -> sha256 of the bundled content it was last synced to. */
type LocaleManifest = Record<string, string>;

const DEFAULT_LANGUAGE_ID = 'en';
const LANGUAGE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MANIFEST_FILE = path.join(LOCALES_DIR, '.manifest.json');
let seeded = false;

export function register(ipc: IpcMain): void {
    ipc.handle('language:list', listLanguages);

    ipc.handle('language:setActive', async (_event, id: unknown) => {
        if (typeof id !== 'string') return { success: false, error: 'Invalid language id' };
        return setActiveLanguage(id);
    });

    ipc.handle('language:load', async (_event, id: unknown) => {
        if (typeof id !== 'string') return { success: false, error: 'Invalid language id' };
        return loadLanguageContent(id);
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

/** Idempotent: reconcile bundled language files into ~/.leaf/locales/. */
export async function ensureSeeded(): Promise<void> {
    if (seeded) return;
    try {
        await fs.mkdir(LOCALES_DIR, { recursive: true });

        const bundled = getBundledLocalesDir();
        if (existsSync(bundled)) {
            const manifest = await readManifest();
            let manifestChanged = false;

            const entries = await fs.readdir(bundled, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;

                const id = entry.name.replace(/\.json$/, '');
                const src = path.join(bundled, entry.name);
                const dest = path.join(LOCALES_DIR, entry.name);
                const bundledContent = await fs.readFile(src);
                const bundledHash = hashContent(bundledContent);

                if (!existsSync(dest)) {
                    await fs.writeFile(dest, bundledContent);
                    manifest[id] = bundledHash;
                    manifestChanged = true;
                    log.info(`[language] Seeded ${entry.name}`);
                    continue;
                }

                const destRaw = await fs.readFile(dest);
                const destHash = hashContent(destRaw);
                const lastSyncedHash = manifest[id];

                if (lastSyncedHash !== undefined && destHash === lastSyncedHash) {
                    if (bundledHash !== lastSyncedHash) {
                        await fs.writeFile(dest, bundledContent);
                        manifest[id] = bundledHash;
                        manifestChanged = true;
                        log.info(`[language] Re-synced ${entry.name} to bundled version`);
                    }
                    continue;
                }

                try {
                    const destJson: unknown = JSON.parse(destRaw.toString('utf-8'));
                    const bundledJson: unknown = JSON.parse(bundledContent.toString('utf-8'));
                    if (
                        isPlainObject(destJson) &&
                        isPlainObject(bundledJson) &&
                        fillMissingKeys(destJson, bundledJson)
                    ) {
                        await fs.writeFile(dest, JSON.stringify(destJson, null, 2) + '\n');
                        log.info(`[language] Backfilled missing keys in ${entry.name}`);
                    }
                } catch (err) {
                    log.warn(`[language] could not merge ${entry.name}, leaving as-is:`, err);
                }
            }

            if (manifestChanged) await writeManifest(manifest);
        }

        seeded = true;
    } catch (err) {
        log.error('[language] seeding failed:', err);
    }
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

export function isValidLanguageId(id: string): boolean {
    return typeof id === 'string' && LANGUAGE_ID_PATTERN.test(id);
}

async function readState(): Promise<LanguageState> {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf-8');
        const result = LanguageStateSchema.safeParse(JSON.parse(data));
        if (result.success) {
            return result.data;
        } else {
            log.warn('[language] state validation failed:', result.error);
            return {};
        }
    } catch {
        return {};
    }
}

async function writeState(state: LanguageState): Promise<void> {
    await fs.mkdir(LEAF_HOME, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function hashContent(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively add keys present in `source` but missing from `target`,
 * preserving every value already in `target` (i.e. the user's edits and
 * existing translations). Returns true if anything was added.
 */
function fillMissingKeys(target: Record<string, unknown>, source: Record<string, unknown>): boolean {
    let changed = false;
    for (const [key, sourceValue] of Object.entries(source)) {
        const targetValue = target[key];
        if (!(key in target)) {
            target[key] = structuredClone(sourceValue);
            changed = true;
        } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
            if (fillMissingKeys(targetValue, sourceValue)) changed = true;
        }
        // else: key already present as a leaf (or type differs) — keep the user's value.
    }
    return changed;
}

async function readManifest(): Promise<LocaleManifest> {
    try {
        const data: string = await fs.readFile(MANIFEST_FILE, 'utf-8');
        const parsed: unknown = JSON.parse(data);
        if (parsed !== null && typeof parsed === 'object') return parsed as LocaleManifest;
    } catch {
        // No manifest yet (first run, or pre-dates this tracking).
    }
    return {};
}

async function writeManifest(manifest: LocaleManifest): Promise<void> {
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
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
