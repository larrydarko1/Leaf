import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Hoisted shared paths — `vi.hoisted` is the only way to share state between
// the test body and `vi.mock` factories (which are themselves hoisted).
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

// Mock electron (the service imports `shell`). Shell APIs are only used by
// IPC handlers which aren't exercised here.
vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));

// Mock the logger to keep test output clean.
vi.mock('../../src/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/main/lib/paths', () => ({
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

beforeEach(() => {
    resetTmp();
    vi.resetModules();
});

afterEach(() => {
    resetTmp();
});

// Static import for parseFrontmatter only — getActiveSystemPrompt and
// ensureSeeded are imported fresh per-test (because the service caches the
// `seeded` flag at module scope).
import { parseFrontmatter } from '../../src/main/services/systemPrompt';

describe('parseFrontmatter', () => {
    it('returns empty meta and full body when there is no frontmatter', () => {
        const { meta, body } = parseFrontmatter('Hello world');
        expect(meta).toEqual({});
        expect(body).toBe('Hello world');
    });

    it('parses name and description', () => {
        const input = `---
name: Coding Assistant
description: Programming help
---
You are an engineer.`;
        const { meta, body } = parseFrontmatter(input);
        expect(meta.name).toBe('Coding Assistant');
        expect(meta.description).toBe('Programming help');
        expect(body.trim()).toBe('You are an engineer.');
    });

    it('strips matching surrounding quotes', () => {
        const input = `---
name: "Quoted Name"
description: 'Single quoted'
---
body`;
        const { meta } = parseFrontmatter(input);
        expect(meta.name).toBe('Quoted Name');
        expect(meta.description).toBe('Single quoted');
    });

    it('lowercases keys but preserves value casing', () => {
        const input = `---
Name: PascalCase
DESCRIPTION: Mixed Case Value
---
body`;
        const { meta } = parseFrontmatter(input);
        expect(meta.name).toBe('PascalCase');
        expect(meta.description).toBe('Mixed Case Value');
    });

    it('handles CRLF line endings', () => {
        const input = '---\r\nname: Win\r\n---\r\nbody\r\n';
        const { meta, body } = parseFrontmatter(input);
        expect(meta.name).toBe('Win');
        expect(body.trim()).toBe('body');
    });

    it('treats malformed frontmatter (no closing) as plain body', () => {
        const input = `---
name: Broken
no closing fence
this is body`;
        const { meta, body } = parseFrontmatter(input);
        expect(meta).toEqual({});
        expect(body).toBe(input);
    });
});

describe('ensureSeeded + getActiveSystemPrompt', () => {
    it('seeds bundled defaults into PROMPTS_DIR', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), `---\nname: Default\n---\nseeded body`);
        fs.writeFileSync(path.join(BUNDLED_DIR, 'coding.md'), 'no frontmatter coder');

        // Re-import to get a fresh `seeded` flag.
        const mod = await import('../../src/main/services/systemPrompt');
        await mod.ensureSeeded();

        expect(fs.existsSync(path.join(PROMPTS_DIR, 'default.md'))).toBe(true);
        expect(fs.existsSync(path.join(PROMPTS_DIR, 'coding.md'))).toBe(true);
        expect(fs.existsSync(STATE_FILE)).toBe(true);

        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        expect(state.activePrompt).toBe('default');
    });

    it('does not overwrite existing user-edited prompt files', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), 'BUNDLED');
        fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(PROMPTS_DIR, 'default.md'), 'USER EDIT');

        const mod = await import('../../src/main/services/systemPrompt');
        await mod.ensureSeeded();

        expect(fs.readFileSync(path.join(PROMPTS_DIR, 'default.md'), 'utf-8')).toBe('USER EDIT');
    });

    it('returns the active prompt body with frontmatter stripped', async () => {
        fs.writeFileSync(
            path.join(BUNDLED_DIR, 'default.md'),
            `---\nname: Default\ndescription: foo\n---\nThis is the system prompt.`,
        );
        const mod = await import('../../src/main/services/systemPrompt');
        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('This is the system prompt.');
    });

    it('honours state.activePrompt when reading active prompt', async () => {
        fs.writeFileSync(path.join(BUNDLED_DIR, 'default.md'), 'default body');
        fs.writeFileSync(path.join(BUNDLED_DIR, 'coding.md'), 'coding body');

        const mod = await import('../../src/main/services/systemPrompt');
        await mod.ensureSeeded();
        // Switch active prompt by writing state directly.
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'coding' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('coding body');
    });

    it('returns empty string when active prompt file is missing', async () => {
        const mod = await import('../../src/main/services/systemPrompt');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: 'nonexistent' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('');
    });

    it('rejects prompt ids with invalid characters in state', async () => {
        const mod = await import('../../src/main/services/systemPrompt');
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activePrompt: '../etc/passwd' }), 'utf-8');

        const body = await mod.getActiveSystemPrompt();
        expect(body).toBe('');
    });
});
