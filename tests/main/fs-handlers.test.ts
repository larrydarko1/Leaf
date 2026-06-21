/**
 * Tests for the remaining IPC handlers in src/main/services/fs.ts.
 * Uses real temp directories; mocks only electron and logger.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTrashItem = vi.fn().mockResolvedValue(undefined);
const mockShowSaveDialog = vi.fn();
const mockShowOpenDialog = vi.fn();

vi.mock('electron', () => ({
    dialog: { showOpenDialog: mockShowOpenDialog, showSaveDialog: mockShowSaveDialog },
    shell: { trashItem: mockTrashItem, openExternal: vi.fn() },
}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── IPC helper ────────────────────────────────────────────────────────────────

type IpcHandler = (_event: null, ...args: unknown[]) => Promise<unknown>;

function makeMockIpc() {
    const handlers = new Map<string, IpcHandler>();
    return {
        handle(channel: string, fn: IpcHandler) {
            handlers.set(channel, fn);
        },
        async invoke(channel: string, ...args: unknown[]) {
            const fn = handlers.get(channel);
            if (!fn) throw new Error(`No handler registered for '${channel}'`);
            return fn(null, ...args);
        },
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newTmpVault(): string {
    const dir = path.join(os.tmpdir(), `leaf-fs-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

let tmpVault: string;
let ipc: ReturnType<typeof makeMockIpc>;

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tmpVault = newTmpVault();
    ipc = makeMockIpc();
    const { register } = await import('@/main/services/fs');
    register(ipc as never, () => null);
    // Set the vault root via files:scan
    await ipc.invoke('files:scan', tmpVault);
});

afterEach(() => {
    fs.rmSync(tmpVault, { recursive: true, force: true });
});

// ── getVaultRoot / cleanup exports ────────────────────────────────────────────

describe('getVaultRoot', () => {
    it('returns the vault root after scanning', async () => {
        const { getVaultRoot } = await import('@/main/services/fs');
        expect(getVaultRoot()).toBe(path.resolve(tmpVault));
    });
});

describe('cleanup', () => {
    it('closes the watcher without error when no watcher is active', async () => {
        const { cleanup } = await import('@/main/services/fs');
        expect(() => cleanup()).not.toThrow();
    });
});

// ── file:read ─────────────────────────────────────────────────────────────────

describe('file:read', () => {
    it('reads a text file successfully', async () => {
        const filePath = path.join(tmpVault, 'hello.md');
        fs.writeFileSync(filePath, '# Hello');
        const result = (await ipc.invoke('file:read', filePath)) as { success: boolean; content: string };
        expect(result.success).toBe(true);
        expect(result.content).toBe('# Hello');
    });

    it('returns failure for a non-string path', async () => {
        const result = (await ipc.invoke('file:read', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when file does not exist', async () => {
        const result = (await ipc.invoke('file:read', path.join(tmpVault, 'missing.md'))) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('file:read', '/etc/passwd')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
    });
});

// ── file:write ────────────────────────────────────────────────────────────────

describe('file:write', () => {
    it('writes content to a file', async () => {
        const filePath = path.join(tmpVault, 'note.md');
        const result = (await ipc.invoke('file:write', filePath, 'content')) as { success: boolean };
        expect(result.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('content');
    });

    it('overwrites existing file', async () => {
        const filePath = path.join(tmpVault, 'note.md');
        fs.writeFileSync(filePath, 'old');
        await ipc.invoke('file:write', filePath, 'new content');
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:write', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('file:write', '/tmp/outside.md', 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:create ───────────────────────────────────────────────────────────────

describe('file:create', () => {
    it('creates a new empty file', async () => {
        const result = (await ipc.invoke('file:create', tmpVault, 'new-note.md')) as {
            success: boolean;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.path)).toBe(true);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:create', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when folder is outside vault', async () => {
        const result = (await ipc.invoke('file:create', '/tmp', 'x.md')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path traversal in fileName', async () => {
        const result = (await ipc.invoke('file:create', tmpVault, '../../etc/passwd')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── folder:create ─────────────────────────────────────────────────────────────

describe('folder:create', () => {
    it('creates a new folder', async () => {
        const result = (await ipc.invoke('folder:create', tmpVault, 'projects')) as {
            success: boolean;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(fs.statSync(result.path).isDirectory()).toBe(true);
    });

    it('returns failure when folder already exists', async () => {
        fs.mkdirSync(path.join(tmpVault, 'existing'));
        const result = (await ipc.invoke('folder:create', tmpVault, 'existing')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already exists/i);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('folder:create', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('folder:create', '/tmp', 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:rename ───────────────────────────────────────────────────────────────

describe('file:rename', () => {
    it('renames a file', async () => {
        const oldPath = path.join(tmpVault, 'old.md');
        fs.writeFileSync(oldPath, 'content');
        const result = (await ipc.invoke('file:rename', oldPath, 'new.md')) as { success: boolean; newPath: string };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.newPath)).toBe(true);
        expect(fs.existsSync(oldPath)).toBe(false);
    });

    it('returns failure if target name already exists', async () => {
        fs.writeFileSync(path.join(tmpVault, 'a.md'), '');
        fs.writeFileSync(path.join(tmpVault, 'b.md'), '');
        const result = (await ipc.invoke('file:rename', path.join(tmpVault, 'a.md'), 'b.md')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already exists/i);
    });

    it('allows same-case rename (rename to same name)', async () => {
        const filePath = path.join(tmpVault, 'note.md');
        fs.writeFileSync(filePath, '');
        const result = (await ipc.invoke('file:rename', filePath, 'NOTE.md')) as { success: boolean };
        // Case-insensitive check: same path → allowed
        expect(result.success).toBe(true);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:rename', 42, 'x.md')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('file:rename', '/etc/passwd', 'x.md')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── folder:rename ─────────────────────────────────────────────────────────────

describe('folder:rename', () => {
    it('renames a folder', async () => {
        const oldPath = path.join(tmpVault, 'old-folder');
        fs.mkdirSync(oldPath);
        const result = (await ipc.invoke('folder:rename', oldPath, 'new-folder')) as {
            success: boolean;
            newPath: string;
        };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.newPath)).toBe(true);
    });

    it('returns failure if target folder name already exists', async () => {
        fs.mkdirSync(path.join(tmpVault, 'folderA'));
        fs.mkdirSync(path.join(tmpVault, 'folderB'));
        const result = (await ipc.invoke('folder:rename', path.join(tmpVault, 'folderA'), 'folderB')) as {
            success: boolean;
        };
        expect(result.success).toBe(false);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('folder:rename', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:delete ───────────────────────────────────────────────────────────────

describe('file:delete', () => {
    it('trashes a file via shell.trashItem', async () => {
        const filePath = path.join(tmpVault, 'to-delete.md');
        fs.writeFileSync(filePath, '');
        const result = (await ipc.invoke('file:delete', filePath)) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockTrashItem).toHaveBeenCalledWith(filePath);
    });

    it('returns failure for non-string path', async () => {
        const result = (await ipc.invoke('file:delete', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('file:delete', '/etc/passwd')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when trashItem throws', async () => {
        mockTrashItem.mockRejectedValueOnce(new Error('trash failed'));
        const filePath = path.join(tmpVault, 'file.md');
        fs.writeFileSync(filePath, '');
        const result = (await ipc.invoke('file:delete', filePath)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/trash failed/);
    });
});

// ── folder:delete ─────────────────────────────────────────────────────────────

describe('folder:delete', () => {
    it('trashes a folder via shell.trashItem', async () => {
        const folderPath = path.join(tmpVault, 'to-trash');
        fs.mkdirSync(folderPath);
        const result = (await ipc.invoke('folder:delete', folderPath)) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockTrashItem).toHaveBeenCalledWith(folderPath);
    });

    it('returns failure for non-string path', async () => {
        const result = (await ipc.invoke('folder:delete', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('folder:delete', '/tmp')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:move ─────────────────────────────────────────────────────────────────

describe('file:move', () => {
    it('moves a file to a new folder', async () => {
        const srcFile = path.join(tmpVault, 'note.md');
        const targetDir = path.join(tmpVault, 'sub');
        fs.writeFileSync(srcFile, 'content');
        fs.mkdirSync(targetDir);

        const result = (await ipc.invoke('file:move', srcFile, targetDir)) as { success: boolean; newPath: string };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.newPath)).toBe(true);
        expect(fs.existsSync(srcFile)).toBe(false);
    });

    it('returns success when file is already in the target folder', async () => {
        const srcFile = path.join(tmpVault, 'note.md');
        fs.writeFileSync(srcFile, '');
        const result = (await ipc.invoke('file:move', srcFile, tmpVault)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('returns failure when a file with the same name exists in target', async () => {
        const src = path.join(tmpVault, 'note.md');
        const targetDir = path.join(tmpVault, 'sub');
        fs.writeFileSync(src, '');
        fs.mkdirSync(targetDir);
        fs.writeFileSync(path.join(targetDir, 'note.md'), 'existing');

        const result = (await ipc.invoke('file:move', src, targetDir)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already exists/i);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:move', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when target folder is outside vault', async () => {
        const src = path.join(tmpVault, 'note.md');
        fs.writeFileSync(src, '');
        const result = (await ipc.invoke('file:move', src, '/tmp')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── folder:move ───────────────────────────────────────────────────────────────

describe('folder:move', () => {
    it('moves a folder into another folder', async () => {
        const srcDir = path.join(tmpVault, 'source');
        const targetDir = path.join(tmpVault, 'target');
        fs.mkdirSync(srcDir);
        fs.mkdirSync(targetDir);

        const result = (await ipc.invoke('folder:move', srcDir, targetDir)) as { success: boolean; newPath: string };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.newPath)).toBe(true);
    });

    it('returns success when folder is already in target', async () => {
        const srcDir = path.join(tmpVault, 'folder');
        fs.mkdirSync(srcDir);
        const result = (await ipc.invoke('folder:move', srcDir, tmpVault)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('returns failure when moving a folder into itself', async () => {
        const srcDir = path.join(tmpVault, 'outer');
        const innerDir = path.join(srcDir, 'inner');
        fs.mkdirSync(innerDir, { recursive: true });
        const result = (await ipc.invoke('folder:move', srcDir, innerDir)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/into itself/i);
    });

    it('returns failure when destination folder name already exists', async () => {
        const srcDir = path.join(tmpVault, 'mydir');
        const targetParent = path.join(tmpVault, 'target');
        fs.mkdirSync(srcDir);
        fs.mkdirSync(targetParent);
        fs.mkdirSync(path.join(targetParent, 'mydir'));

        const result = (await ipc.invoke('folder:move', srcDir, targetParent)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('folder:move', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:copyToVault ──────────────────────────────────────────────────────────

describe('file:copyToVault', () => {
    it('copies an external file into the vault', async () => {
        const srcFile = path.join(os.tmpdir(), `leaf-copy-src-${Date.now()}.png`);
        fs.writeFileSync(srcFile, 'imgdata');
        const targetDir = path.join(tmpVault, 'attachments');
        fs.mkdirSync(targetDir);

        const result = (await ipc.invoke('file:copyToVault', srcFile, targetDir)) as {
            success: boolean;
            fileName: string;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.path)).toBe(true);
        fs.unlinkSync(srcFile);
    });

    it('avoids collision by appending a counter', async () => {
        const srcFile = path.join(os.tmpdir(), `leaf-copy-src2-${Date.now()}.png`);
        fs.writeFileSync(srcFile, 'imgdata');
        const targetDir = tmpVault;
        const baseName = path.basename(srcFile);
        // Pre-create the file to cause a collision
        fs.writeFileSync(path.join(targetDir, baseName), 'existing');

        const result = (await ipc.invoke('file:copyToVault', srcFile, targetDir)) as {
            success: boolean;
            fileName: string;
        };
        expect(result.success).toBe(true);
        expect(result.fileName).toContain('(1)');
        fs.unlinkSync(srcFile);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:copyToVault', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when target dir is outside vault', async () => {
        const srcFile = path.join(os.tmpdir(), 'src.png');
        fs.writeFileSync(srcFile, 'x');
        const result = (await ipc.invoke('file:copyToVault', srcFile, '/tmp')) as { success: boolean };
        expect(result.success).toBe(false);
        fs.unlinkSync(srcFile);
    });
});

// ── file:readImage ────────────────────────────────────────────────────────────

describe('file:readImage', () => {
    it('returns a base64 data URL for a png', async () => {
        const imgPath = path.join(tmpVault, 'photo.png');
        fs.writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header bytes
        const result = (await ipc.invoke('file:readImage', imgPath)) as { success: boolean; dataUrl: string };
        expect(result.success).toBe(true);
        expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('returns failure for non-string path', async () => {
        const result = (await ipc.invoke('file:readImage', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path outside vault', async () => {
        const result = (await ipc.invoke('file:readImage', '/etc/passwd')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when file does not exist', async () => {
        const result = (await ipc.invoke('file:readImage', path.join(tmpVault, 'no.png'))) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('uses a fallback mime type for unknown extensions', async () => {
        const imgPath = path.join(tmpVault, 'photo.xyz');
        fs.writeFileSync(imgPath, 'data');
        const result = (await ipc.invoke('file:readImage', imgPath)) as { success: boolean; dataUrl: string };
        expect(result.success).toBe(true);
        expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    });
});

// ── file:readAudio ────────────────────────────────────────────────────────────

describe('file:readAudio', () => {
    it('returns a base64 data URL for an mp3', async () => {
        const audioPath = path.join(tmpVault, 'clip.mp3');
        fs.writeFileSync(audioPath, Buffer.from([0xff, 0xfb]));
        const result = (await ipc.invoke('file:readAudio', audioPath)) as { success: boolean; dataUrl: string };
        expect(result.success).toBe(true);
        expect(result.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    });

    it('returns failure for non-string path', async () => {
        const result = (await ipc.invoke('file:readAudio', null)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when file does not exist', async () => {
        const result = (await ipc.invoke('file:readAudio', path.join(tmpVault, 'missing.mp3'))) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('uses fallback mime type for unknown audio extensions', async () => {
        const audioPath = path.join(tmpVault, 'sound.xyz');
        fs.writeFileSync(audioPath, 'data');
        const result = (await ipc.invoke('file:readAudio', audioPath)) as { success: boolean; dataUrl: string };
        expect(result.success).toBe(true);
        expect(result.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    });
});

// ── file:writeBuffer ──────────────────────────────────────────────────────────

describe('file:writeBuffer', () => {
    it('writes a base64-encoded binary file', async () => {
        const filePath = path.join(tmpVault, 'export.png');
        const base64 = Buffer.from('hello binary').toString('base64');
        const result = (await ipc.invoke('file:writeBuffer', filePath, base64)) as { success: boolean };
        expect(result.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello binary');
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:writeBuffer', 42, 'notbase64')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when path is not writable', async () => {
        const result = (await ipc.invoke(
            'file:writeBuffer',
            path.join(tmpVault, 'a', 'b', 'c.png'),
            Buffer.from('x').toString('base64'),
        )) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── bookmarks:load / bookmarks:save ───────────────────────────────────────────

describe('bookmarks:load', () => {
    it('returns empty bookmarks when no bookmarks file exists', async () => {
        const result = (await ipc.invoke('bookmarks:load')) as { success: boolean; bookmarks: string[] };
        expect(result.success).toBe(true);
        expect(result.bookmarks).toEqual([]);
    });

    it('loads previously saved bookmarks', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir, { recursive: true });
        const bookmarks = [path.join(tmpVault, 'note.md')];
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), JSON.stringify(bookmarks));

        const result = (await ipc.invoke('bookmarks:load')) as { success: boolean; bookmarks: string[] };
        expect(result.success).toBe(true);
        expect(result.bookmarks).toContain(path.join(tmpVault, 'note.md'));
    });

    it('filters out bookmarks outside the vault', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir, { recursive: true });
        const bookmarks = [path.join(tmpVault, 'note.md'), '/etc/passwd'];
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), JSON.stringify(bookmarks));

        const result = (await ipc.invoke('bookmarks:load')) as { success: boolean; bookmarks: string[] };
        expect(result.success).toBe(true);
        expect(result.bookmarks).not.toContain('/etc/passwd');
    });

    it('returns empty list when bookmarks.json contains non-array', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir, { recursive: true });
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), '"not an array"');

        const result = (await ipc.invoke('bookmarks:load')) as { success: boolean; bookmarks: string[] };
        expect(result.success).toBe(true);
        expect(result.bookmarks).toEqual([]);
    });

    it('returns empty list when bookmarks.json is invalid JSON', async () => {
        const leafDir = path.join(tmpVault, '.leaf');
        fs.mkdirSync(leafDir, { recursive: true });
        fs.writeFileSync(path.join(leafDir, 'bookmarks.json'), 'not-json');

        const result = (await ipc.invoke('bookmarks:load')) as { success: boolean; bookmarks: string[] };
        expect(result.success).toBe(true);
        expect(result.bookmarks).toEqual([]);
    });
});

describe('bookmarks:save', () => {
    it('saves bookmarks inside the vault', async () => {
        const bookmarks = [path.join(tmpVault, 'note.md')];
        const result = (await ipc.invoke('bookmarks:save', bookmarks)) as { success: boolean };
        expect(result.success).toBe(true);

        const saved = JSON.parse(fs.readFileSync(path.join(tmpVault, '.leaf', 'bookmarks.json'), 'utf-8')) as string[];
        expect(saved).toEqual(bookmarks);
    });

    it('returns failure for non-array bookmarks', async () => {
        const result = (await ipc.invoke('bookmarks:save', 'not-array')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when a bookmark is outside the vault', async () => {
        const result = (await ipc.invoke('bookmarks:save', ['/etc/passwd'])) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('saves an empty bookmarks array', async () => {
        const result = (await ipc.invoke('bookmarks:save', [])) as { success: boolean };
        expect(result.success).toBe(true);
    });
});

// ── file:resolveEmbedPath ─────────────────────────────────────────────────────

describe('file:resolveEmbedPath', () => {
    it('resolves embed relative to note directory', async () => {
        const imgPath = path.join(tmpVault, 'image.png');
        fs.writeFileSync(imgPath, '');
        const result = (await ipc.invoke('file:resolveEmbedPath', 'image.png', tmpVault, tmpVault)) as {
            success: boolean;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(result.path).toBe(imgPath);
    });

    it('resolves embed via recursive search when not in note dir', async () => {
        const subDir = path.join(tmpVault, 'assets');
        fs.mkdirSync(subDir);
        const imgPath = path.join(subDir, 'photo.png');
        fs.writeFileSync(imgPath, '');
        const result = (await ipc.invoke('file:resolveEmbedPath', 'photo.png', tmpVault, tmpVault)) as {
            success: boolean;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(result.path).toBe(imgPath);
    });

    it('returns failure when file is not found anywhere', async () => {
        const result = (await ipc.invoke('file:resolveEmbedPath', 'missing.png', tmpVault, tmpVault)) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:resolveEmbedPath', 42, tmpVault, tmpVault)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when noteDir is outside vault', async () => {
        const result = (await ipc.invoke('file:resolveEmbedPath', 'img.png', '/tmp', '/tmp')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── file:updateEmbedRefs ──────────────────────────────────────────────────────

describe('file:updateEmbedRefs', () => {
    it('updates embed references across markdown files', async () => {
        const noteA = path.join(tmpVault, 'a.md');
        const noteB = path.join(tmpVault, 'b.md');
        fs.writeFileSync(noteA, 'See ![[old-image.png]] for details');
        fs.writeFileSync(noteB, 'No embed here');

        const result = (await ipc.invoke('file:updateEmbedRefs', 'old-image.png', 'new-image.png')) as {
            success: boolean;
            updatedCount: number;
        };
        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(1);
        expect(fs.readFileSync(noteA, 'utf-8')).toContain('![[new-image.png]]');
        expect(fs.readFileSync(noteB, 'utf-8')).toBe('No embed here');
    });

    it('handles embed with pipe alias', async () => {
        const note = path.join(tmpVault, 'note.md');
        fs.writeFileSync(note, '![[image.png|500x300]]');
        await ipc.invoke('file:updateEmbedRefs', 'image.png', 'renamed.png');
        expect(fs.readFileSync(note, 'utf-8')).toContain('![[renamed.png|500x300]]');
    });

    it('handles embed with heading suffix', async () => {
        const note = path.join(tmpVault, 'note.md');
        fs.writeFileSync(note, '![[doc.md#section]]');
        await ipc.invoke('file:updateEmbedRefs', 'doc.md', 'new-doc.md');
        expect(fs.readFileSync(note, 'utf-8')).toContain('![[new-doc.md#section]]');
    });

    it('returns failure when vault root is not set', async () => {
        vi.resetModules();
        const freshIpc = makeMockIpc();
        const { register } = await import('@/main/services/fs');
        register(freshIpc as never, () => null);
        // No files:scan, so no vault root
        const result = (await freshIpc.invoke('file:updateEmbedRefs', 'a.png', 'b.png')) as {
            success: boolean;
        };
        expect(result.success).toBe(false);
    });

    it('returns failure for invalid arguments', async () => {
        const result = (await ipc.invoke('file:updateEmbedRefs', 42, 'x')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

// ── fs:watchFolder / fs:unwatchFolder ─────────────────────────────────────────

describe('fs:watchFolder', () => {
    it('returns success and sets up a watcher', async () => {
        const result = (await ipc.invoke('fs:watchFolder', tmpVault)) as { success: boolean };
        expect(result.success).toBe(true);
        // Clean up by unwatching
        await ipc.invoke('fs:unwatchFolder');
    });

    it('returns failure for non-string path', async () => {
        const result = (await ipc.invoke('fs:watchFolder', 42)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for a non-existent folder', async () => {
        const result = (await ipc.invoke('fs:watchFolder', path.join(tmpVault, 'no-such'))) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('replaces the previous watcher on second call', async () => {
        await ipc.invoke('fs:watchFolder', tmpVault);
        const result = (await ipc.invoke('fs:watchFolder', tmpVault)) as { success: boolean };
        expect(result.success).toBe(true);
        await ipc.invoke('fs:unwatchFolder');
    });
});

describe('fs:unwatchFolder', () => {
    it('returns success even when no watcher is active', async () => {
        const result = (await ipc.invoke('fs:unwatchFolder')) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('closes an active watcher and returns success', async () => {
        await ipc.invoke('fs:watchFolder', tmpVault);
        const result = (await ipc.invoke('fs:unwatchFolder')) as { success: boolean };
        expect(result.success).toBe(true);
    });
});

// ── cleanup ───────────────────────────────────────────────────────────────────

describe('cleanup (with active watcher)', () => {
    it('closes active watcher during cleanup', async () => {
        const { cleanup } = await import('@/main/services/fs');
        await ipc.invoke('fs:watchFolder', tmpVault);
        expect(() => cleanup()).not.toThrow();
    });
});
