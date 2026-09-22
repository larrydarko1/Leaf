import fs from 'fs';
import path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const tmpRoot = join(tmpdir(), `leaf-prompt-test-${process.pid}-${Date.now()}`);
    const leafHome = join(tmpRoot, '.leaf');
    return {
        TMP_ROOT: tmpRoot,
        LEAF_HOME: leafHome,
        DEFAULT_MODELS_DIR: join(leafHome, 'models'),
        PROMPTS_DIR: join(leafHome, 'prompts'),
        STATE_FILE: join(leafHome, 'state.json'),
        BUNDLED_DIR: join(tmpRoot, 'bundled-prompts'),
    };
});

vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/main/lib/paths', () => ({
    LEAF_HOME: PATHS.LEAF_HOME,
    DEFAULT_MODELS_DIR: PATHS.DEFAULT_MODELS_DIR,
    PROMPTS_DIR: PATHS.PROMPTS_DIR,
    STATE_FILE: PATHS.STATE_FILE,
    getBundledPromptsDir: () => PATHS.BUNDLED_DIR,
    getWhisperModelDir: () => '',
    migrateLegacyPaths: () => undefined,
}));

const { LEAF_HOME, PROMPTS_DIR, STATE_FILE, BUNDLED_DIR } = PATHS;

function resetTmp() {
    fs.rmSync(LEAF_HOME, { recursive: true, force: true });
    fs.rmSync(BUNDLED_DIR, { recursive: true, force: true });
    fs.mkdirSync(BUNDLED_DIR, { recursive: true });
}

async function metaOfDefault(content: string): Promise<{ name: string; description: string }> {
    fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), content);
    const { register } = await import('@/main/services/systemPrompt');
    const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    register({
        handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
            handlers[channel] = fn;
        }),
    } as never);
    const result = (await handlers['systemPrompt:list']!()) as {
        prompts: { id: string; name: string; description: string }[];
    };
    return result.prompts.find((p) => p.id === 'default')!;
}

async function bodyOfDefault(content: string): Promise<string> {
    fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), content);
    const mod = await import('@/main/services/systemPrompt');
    return await mod.getActiveSystemPrompt();
}

async function makeHandlers() {
    const mod = await import('@/main/services/systemPrompt');
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            handlers[ch] = fn;
        }),
    };
    mod.register(ipc as never);
    return handlers;
}

beforeEach(() => {
    resetTmp();
    vi.resetModules();
});

afterEach(() => {
    resetTmp();
});

describe('frontmatter handling', () => {
    it('returns the full body when there is no frontmatter', async () => {
        expect(await bodyOfDefault('Hello world')).toBe('Hello world');
    });

    it('parses name and description, and strips them from the body', async () => {
        const input = `---
name: Coding Assistant
description: Programming help
---
You are an engineer.`;
        expect(await metaOfDefault(input)).toMatchObject({
            name: 'Coding Assistant',
            description: 'Programming help',
        });
        expect(await bodyOfDefault(input)).toBe('You are an engineer.');
    });

    it('strips matching surrounding quotes', async () => {
        const input = `---
name: "Quoted Name"
description: 'Single quoted'
---
body`;
        expect(await metaOfDefault(input)).toMatchObject({ name: 'Quoted Name', description: 'Single quoted' });
    });

    it('lowercases keys but preserves value casing', async () => {
        const input = `---
Name: PascalCase
DESCRIPTION: Mixed Case Value
---
body`;
        expect(await metaOfDefault(input)).toMatchObject({ name: 'PascalCase', description: 'Mixed Case Value' });
    });

    it('handles CRLF line endings', async () => {
        const input = '---\r\nname: Win\r\n---\r\nbody\r\n';
        expect(await metaOfDefault(input)).toMatchObject({ name: 'Win' });
        expect(await bodyOfDefault(input)).toBe('body');
    });

    it('treats malformed frontmatter (no closing) as plain body', async () => {
        const input = `---
name: Broken
no closing fence
this is body`;
        expect(await bodyOfDefault(input)).toBe(input);
    });
});

describe('seeding, via getActiveSystemPrompt', () => {
    it('seeds bundled defaults into PROMPTS_DIR', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), `---\nname: Default\n---\nseeded body`);
        fs.writeFileSync(path.join(BUNDLED_DIR, 'coding.md'), 'no frontmatter coder');

        const mod = await import('@/main/services/systemPrompt');
        await mod.getActiveSystemPrompt();

        expect(fs.existsSync(path.join(PROMPTS_DIR, 'default.md'))).toBe(true);
        expect(fs.existsSync(path.join(PROMPTS_DIR, 'coding.md'))).toBe(true);
        expect(fs.existsSync(STATE_FILE)).toBe(true);

        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        expect(state.activePrompt).toBe('default');
    });

    it('seeds exactly once under concurrent calls (memoised in-flight promise)', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), 'body');

        const mod = await import('@/main/services/systemPrompt');
        const copySpy = vi.spyOn(fs.promises, 'copyFile');
        await Promise.all(Array.from({ length: 10 }, () => mod.getActiveSystemPrompt()));

        expect(copySpy).toHaveBeenCalledTimes(1);
        expect(copySpy).toHaveBeenCalledWith(
            path.join(BUNDLED_DIR, 'default.md'),
            path.join(PROMPTS_DIR, 'default.md'),
        );
        copySpy.mockRestore();
    });

    it('does not overwrite existing user-edited prompt files', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), 'BUNDLED');
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(PROMPTS_DIR, 'default.md'), 'USER EDIT');

        const mod = await import('@/main/services/systemPrompt');
        await mod.getActiveSystemPrompt();

        expect(fs.readFileSync(path.join(PROMPTS_DIR, 'default.md'), 'utf-8')).toBe('USER EDIT');
    });

    it('returns the active prompt body with frontmatter stripped', async () => {
        fs.writeFileSync(
            path.join(BUNDLED_DIR, 'default.md'),
            `---\nname: Default\ndescription: foo\n---\nThis is the system prompt.`,
        );
        const mod = await import('@/main/services/systemPrompt');
        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('This is the system prompt.');
    });

    it('honours state.activePrompt when reading active prompt', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), 'default body');
        fs.writeFileSync(path.join(BUNDLED_DIR, 'coding.md'), 'coding body');

        const mod = await import('@/main/services/systemPrompt');
        await mod.getActiveSystemPrompt();
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'coding' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('coding body');
    });

    it('returns empty string when active prompt file is missing', async () => {
        const mod = await import('@/main/services/systemPrompt');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'nonexistent' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('');
    });

    it('rejects prompt ids with invalid characters in state', async () => {
        const mod = await import('@/main/services/systemPrompt');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: '../etc/passwd' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('');
    });
});

describe('systemPrompt:list', () => {
    it('returns empty list when prompts directory does not exist', async () => {
        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:list']?.()) as { success: boolean; prompts: unknown[] };
        expect(result.success).toBe(true);
        expect(result.prompts).toHaveLength(0);
    });

    it('returns prompts sorted with default first, then alphabetically', async () => {
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(PROMPTS_DIR, 'zebra.md'), '---\nname: Zebra\n---\nbody');
        fs.writeFileSync(path.join(PROMPTS_DIR, 'alpha.md'), '---\nname: Alpha\n---\nbody');
        fs.writeFileSync(path.join(PROMPTS_DIR, 'default.md'), '---\nname: Default\n---\nbody');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'default' }));

        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:list']?.()) as {
            success: boolean;
            prompts: { id: string; name: string }[];
            activeId: string;
        };
        expect(result.success).toBe(true);
        expect(result.prompts[0]!.id).toBe('default');
        expect(result.prompts.map((p) => p.id)).toEqual(['default', 'alpha', 'zebra']);
        expect(result.activeId).toBe('default');
    });

    it('skips files with invalid prompt ids', async () => {
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(PROMPTS_DIR, 'valid.md'), 'body');
        fs.writeFileSync(path.join(PROMPTS_DIR, 'invalid name.md'), 'body'); // space in name
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'valid' }));

        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:list']?.()) as { prompts: unknown[] };
        expect(result.prompts).toHaveLength(1);
    });
});

describe('systemPrompt:setActive', () => {
    it('returns failure for non-string id', async () => {
        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:setActive']?.({}, 123)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for an id with invalid characters', async () => {
        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:setActive']?.({}, '../etc/passwd')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when the prompt file does not exist', async () => {
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:setActive']?.({}, 'missing')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('sets the active prompt and updates the state file', async () => {
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(PROMPTS_DIR, 'custom.md'), 'body');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'default' }));

        const handlers = await makeHandlers();
        const result = (await handlers['systemPrompt:setActive']?.({}, 'custom')) as { success: boolean };
        expect(result.success).toBe(true);

        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as { activePrompt: string };
        expect(state.activePrompt).toBe('custom');
    });
});
