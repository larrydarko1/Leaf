import { describe, it, expect } from 'vitest';
import {
    TreeNodeSchema,
    PersistedTabSchema,
    PersistedTabStateSchema,
    SaveDialogOptionsSchema,
    FileWriteBufferArgsSchema,
    ResolveEmbedArgsSchema,
    FileCopyToVaultArgsSchema,
    FileWriteArgsSchema,
    FileCreateArgsSchema,
    FolderCreateArgsSchema,
    FileRenameArgsSchema,
    UpdateEmbedRefsArgsSchema,
    FolderRenameArgsSchema,
    FileMoveArgsSchema,
    FolderMoveArgsSchema,
} from '@/schemas/vault';

describe('TreeNodeSchema', () => {
    it('parses a file leaf node', () => {
        const result = TreeNodeSchema.parse({
            path: '/vault/note.md',
            name: 'note.md',
            type: 'file',
        });
        expect(result.type).toBe('file');
    });

    it('parses a folder with nested children', () => {
        const result = TreeNodeSchema.parse({
            path: '/vault/docs',
            name: 'docs',
            type: 'folder',
            children: [{ path: '/vault/docs/note.md', name: 'note.md', type: 'file' }],
        });
        expect(result.children).toHaveLength(1);
        expect(result.children?.[0]?.name).toBe('note.md');
    });

    it('parses deeply nested tree', () => {
        const result = TreeNodeSchema.parse({
            path: '/vault',
            name: 'vault',
            type: 'folder',
            children: [
                {
                    path: '/vault/a',
                    name: 'a',
                    type: 'folder',
                    children: [{ path: '/vault/a/b.md', name: 'b.md', type: 'file' }],
                },
            ],
        });
        expect(result.children?.[0]?.children?.[0]?.name).toBe('b.md');
    });

    it('rejects invalid node type', () => {
        expect(TreeNodeSchema.safeParse({ path: '/p', name: 'n', type: 'symlink' }).success).toBe(false);
    });

    it('rejects missing name', () => {
        expect(TreeNodeSchema.safeParse({ path: '/p', type: 'file' }).success).toBe(false);
    });
});

describe('PersistedTabSchema', () => {
    it('parses valid tab', () => {
        const result = PersistedTabSchema.parse({ path: '/vault/note.md', scrollTop: 120 });
        expect(result.scrollTop).toBe(120);
    });

    it('rejects missing scrollTop', () => {
        expect(PersistedTabSchema.safeParse({ path: '/p' }).success).toBe(false);
    });
});

describe('PersistedTabStateSchema', () => {
    it('parses empty tabs', () => {
        const result = PersistedTabStateSchema.parse({ tabs: [], activeIndex: 0 });
        expect(result.tabs).toHaveLength(0);
    });

    it('parses multiple tabs', () => {
        const result = PersistedTabStateSchema.parse({
            tabs: [
                { path: '/a.md', scrollTop: 0 },
                { path: '/b.md', scrollTop: 50 },
            ],
            activeIndex: 1,
        });
        expect(result.activeIndex).toBe(1);
        expect(result.tabs).toHaveLength(2);
    });

    it('rejects non-number activeIndex', () => {
        expect(PersistedTabStateSchema.safeParse({ tabs: [], activeIndex: '0' }).success).toBe(false);
    });
});

describe('SaveDialogOptionsSchema', () => {
    it('parses empty options', () => {
        expect(() => SaveDialogOptionsSchema.parse({})).not.toThrow();
    });

    it('parses with filters', () => {
        const result = SaveDialogOptionsSchema.parse({
            defaultPath: '/vault',
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        expect(result.filters).toHaveLength(1);
    });
});

describe('FileWriteBufferArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileWriteBufferArgsSchema.parse({ filePath: '/f.png', base64Data: 'abc==' });
        expect(result.base64Data).toBe('abc==');
    });

    it('rejects missing base64Data', () => {
        expect(FileWriteBufferArgsSchema.safeParse({ filePath: '/f.png' }).success).toBe(false);
    });
});

describe('ResolveEmbedArgsSchema', () => {
    it('parses valid args', () => {
        const result = ResolveEmbedArgsSchema.parse({
            fileName: 'image.png',
            noteDir: '/vault/notes',
            embedVaultRoot: '/vault',
        });
        expect(result.fileName).toBe('image.png');
    });

    it('rejects missing noteDir', () => {
        expect(ResolveEmbedArgsSchema.safeParse({ fileName: 'f', embedVaultRoot: '/v' }).success).toBe(false);
    });
});

describe('FileCopyToVaultArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileCopyToVaultArgsSchema.parse({
            sourcePath: '/downloads/image.png',
            targetDir: '/vault/assets',
        });
        expect(result.targetDir).toBe('/vault/assets');
    });
});

describe('FileWriteArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileWriteArgsSchema.parse({ filePath: '/vault/note.md', content: '# Hello' });
        expect(result.content).toBe('# Hello');
    });
});

describe('FileCreateArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileCreateArgsSchema.parse({ folderPath: '/vault', fileName: 'new.md' });
        expect(result.fileName).toBe('new.md');
    });
});

describe('FolderCreateArgsSchema', () => {
    it('parses valid args', () => {
        const result = FolderCreateArgsSchema.parse({ parentPath: '/vault', folderName: 'docs' });
        expect(result.folderName).toBe('docs');
    });
});

describe('FileRenameArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileRenameArgsSchema.parse({ oldPath: '/vault/old.md', newFileName: 'new.md' });
        expect(result.newFileName).toBe('new.md');
    });
});

describe('UpdateEmbedRefsArgsSchema', () => {
    it('parses valid args', () => {
        const result = UpdateEmbedRefsArgsSchema.parse({ oldFileName: 'old.md', newFileName: 'new.md' });
        expect(result.oldFileName).toBe('old.md');
    });
});

describe('FolderRenameArgsSchema', () => {
    it('parses valid args', () => {
        const result = FolderRenameArgsSchema.parse({ oldPath: '/vault/docs', newFolderName: 'notes' });
        expect(result.newFolderName).toBe('notes');
    });
});

describe('FileMoveArgsSchema', () => {
    it('parses valid args', () => {
        const result = FileMoveArgsSchema.parse({ filePath: '/vault/a.md', targetFolderPath: '/vault/docs' });
        expect(result.targetFolderPath).toBe('/vault/docs');
    });
});

describe('FolderMoveArgsSchema', () => {
    it('parses valid args', () => {
        const result = FolderMoveArgsSchema.parse({
            folderPath: '/vault/docs',
            targetFolderPath: '/vault/archive',
        });
        expect(result.folderPath).toBe('/vault/docs');
    });
});
