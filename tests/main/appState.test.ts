import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Hoisted shared paths — `vi.hoisted` is the only way to share state between
// the test body and `vi.mock` factories (which are themselves hoisted).
const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const tmpRoot = join(tmpdir(), `leaf-appstate-test-${process.pid}-${Date.now()}`);
    const leafHome = join(tmpRoot, '.leaf');
    return {
        TMP_ROOT: tmpRoot,
        LEAF_HOME: leafHome,
        STATE_FILE: join(leafHome, 'state.json'),
    };
});

vi.mock('@/main/lib/paths', () => ({
    LEAF_HOME: PATHS.LEAF_HOME,
    STATE_FILE: PATHS.STATE_FILE,
}));

const { LEAF_HOME, STATE_FILE } = PATHS;

function resetTmp() {
    fs.rmSync(LEAF_HOME, { recursive: true, force: true });
}

beforeEach(() => {
    resetTmp();
    vi.resetModules();
});

afterEach(() => {
    resetTmp();
});

describe('appState', () => {
    it('readState returns {} when the file does not exist', async () => {
        const { readState } = await import('@/main/lib/appState');
        expect(await readState()).toEqual({});
    });

    it('updateState creates the file and persists the mutation', async () => {
        const { readState, updateState } = await import('@/main/lib/appState');
        await updateState((s) => ({ ...s, activePrompt: 'coding' }));

        expect(await readState()).toEqual({ activePrompt: 'coding' });
        const onDisk = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        expect(onDisk.activePrompt).toBe('coding');
    });

    it('preserves keys written by other services (no clobbering)', async () => {
        const { readState, updateState } = await import('@/main/lib/appState');
        await updateState((s) => ({ ...s, activeTheme: 'dark' }));
        await updateState((s) => ({ ...s, activeLanguage: 'en' }));
        await updateState((s) => ({ ...s, activePrompt: 'default' }));

        expect(await readState()).toEqual({
            activeTheme: 'dark',
            activeLanguage: 'en',
            activePrompt: 'default',
        });
    });

    it('serialises concurrent read-modify-writes without losing any of them', async () => {
        const { readState, updateState } = await import('@/main/lib/appState');
        // Fire three interleaving RMW updates at once. Without the lock, each
        // would read the same empty base and the last writer would win,
        // dropping the other two keys. Under the lock all three survive.
        await Promise.all([
            updateState((s) => ({ ...s, activeTheme: 'dark' })),
            updateState((s) => ({ ...s, activeLanguage: 'en' })),
            updateState((s) => ({ ...s, activePrompt: 'default' })),
        ]);

        expect(await readState()).toEqual({
            activeTheme: 'dark',
            activeLanguage: 'en',
            activePrompt: 'default',
        });
    });

    it('recovers from an unparseable state file by treating it as empty', async () => {
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.writeFileSync(STATE_FILE, '{ this is not json');
        const { readState, updateState } = await import('@/main/lib/appState');

        expect(await readState()).toEqual({});
        await updateState((s) => ({ ...s, activePrompt: 'default' }));
        expect(await readState()).toEqual({ activePrompt: 'default' });
    });

    it('does not leave the temp file behind after a write', async () => {
        const { updateState } = await import('@/main/lib/appState');
        await updateState((s) => ({ ...s, activeTheme: 'dark' }));

        const leftovers = fs.readdirSync(LEAF_HOME).filter((f) => f.includes('.tmp'));
        expect(leftovers).toEqual([]);
    });
});
