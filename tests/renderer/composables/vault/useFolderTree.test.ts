import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFolderTree } from '@/renderer/composables/vault/useFolderTree';
import type { FileInfo, FolderInfo } from '@/renderer/types/electron';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, folder = '.'): FileInfo {
    const inFolder = folder !== '.';
    return {
        name,
        path: inFolder ? `/${folder}/${name}` : `/${name}`,
        relativePath: inFolder ? `${folder}/${name}` : name,
        extension: name.includes('.') ? '.' + name.split('.').pop()! : '',
        size: 0,
        modified: '',
        folder,
    };
}

function makeFolder(relativePath: string): FolderInfo {
    const parts = relativePath.split('/');
    return {
        name: parts[parts.length - 1],
        path: `/${relativePath}`,
        relativePath,
        type: 'folder',
        folder: parts.length > 1 ? parts.slice(0, -1).join('/') : '.',
    };
}

// ── localStorage stub ────────────────────────────────────────────────────────

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useFolderTree', () => {
    let files: FileInfo[];
    let folders: FolderInfo[];
    let currentFolder: string | null;

    beforeEach(() => {
        files = [];
        folders = [];
        currentFolder = null;
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    function make() {
        return useFolderTree(
            () => files,
            () => folders,
            () => currentFolder,
        );
    }

    // ── getFileNameWithoutExtension ──────────────────────────────────────────

    describe('getFileNameWithoutExtension', () => {
        it('strips the extension', () => {
            const { getFileNameWithoutExtension } = make();
            expect(getFileNameWithoutExtension('note.md')).toBe('note');
        });

        it('handles files with no extension', () => {
            const { getFileNameWithoutExtension } = make();
            expect(getFileNameWithoutExtension('README')).toBe('README');
        });

        it('handles dotfiles (leading dot, no extension)', () => {
            const { getFileNameWithoutExtension } = make();
            expect(getFileNameWithoutExtension('.gitignore')).toBe('.gitignore');
        });

        it('strips only the last extension for compound names', () => {
            const { getFileNameWithoutExtension } = make();
            expect(getFileNameWithoutExtension('archive.tar.gz')).toBe('archive.tar');
        });
    });

    // ── folderTree: empty ────────────────────────────────────────────────────

    describe('folderTree (empty inputs)', () => {
        it('returns an empty array when there are no files or folders', () => {
            const { folderTree } = make();
            expect(folderTree.value).toEqual([]);
        });
    });

    // ── folderTree: root-level files ─────────────────────────────────────────

    describe('folderTree (root-level files)', () => {
        it('places root-level files at the root of the tree', () => {
            files = [makeFile('a.md'), makeFile('b.md')];
            const { folderTree } = make();
            expect(folderTree.value.every((n) => n.type === 'file')).toBe(true);
            expect(folderTree.value).toHaveLength(2);
        });

        it('sorts root-level files alphabetically', () => {
            files = [makeFile('z.md'), makeFile('a.md'), makeFile('m.md')];
            const { folderTree } = make();
            const names = folderTree.value.map((n) => n.name);
            expect(names).toEqual(['a', 'm', 'z']);
        });

        it('names files without their extension', () => {
            files = [makeFile('my-note.md')];
            const { folderTree } = make();
            expect(folderTree.value[0].name).toBe('my-note');
        });
    });

    // ── folderTree: sorting ──────────────────────────────────────────────────

    describe('folderTree (sorting)', () => {
        it('places folders before files at the same level', () => {
            files = [makeFile('z.md'), makeFile('a.md', 'docs')];
            const { folderTree } = make();
            expect(folderTree.value[0].type).toBe('folder');
            expect(folderTree.value[1].type).toBe('file');
        });

        it('sorts multiple folders alphabetically', () => {
            files = [makeFile('f.md', 'zoo'), makeFile('f.md', 'alpha')];
            const { folderTree } = make();
            const folderNames = folderTree.value.filter((n) => n.type === 'folder').map((n) => n.name);
            expect(folderNames).toEqual(['alpha', 'zoo']);
        });
    });

    // ── folderTree: nesting ──────────────────────────────────────────────────

    describe('folderTree (nesting)', () => {
        it('nests files inside their folder', () => {
            files = [makeFile('note.md', 'docs')];
            const { folderTree } = make();
            expect(folderTree.value).toHaveLength(1);
            const docsNode = folderTree.value[0];
            expect(docsNode.type).toBe('folder');
            expect(docsNode.children).toHaveLength(1);
            expect(docsNode.children![0].name).toBe('note');
        });

        it('builds a deep hierarchy from nested folder paths', () => {
            files = [makeFile('deep.md', 'a/b/c')];
            const { folderTree } = make();
            const a = folderTree.value.find((n) => n.name === 'a');
            expect(a).toBeDefined();
            const b = a!.children?.find((n) => n.name === 'b');
            expect(b).toBeDefined();
            const c = b!.children?.find((n) => n.name === 'c');
            expect(c).toBeDefined();
            expect(c!.children?.[0].name).toBe('deep');
        });

        it('does not duplicate a folder node when the explicit folders list also contains it', () => {
            folders = [makeFolder('docs')];
            files = [makeFile('note.md', 'docs')];
            const { folderTree } = make();
            const docNodes = folderTree.value.filter((n) => n.name === 'docs');
            expect(docNodes).toHaveLength(1);
        });

        it('exposes the correct full path on folder nodes', () => {
            files = [makeFile('f.md', 'docs')];
            const { folderTree } = make();
            expect(folderTree.value[0].path).toBe('docs');
        });
    });

    // ── toggleFolder ─────────────────────────────────────────────────────────

    describe('toggleFolder', () => {
        it('marks a folder as expanded', () => {
            const { expandedFolders, toggleFolder } = make();
            toggleFolder('docs');
            expect(expandedFolders.value.has('docs')).toBe(true);
        });

        it('collapses an already-expanded folder on a second call', () => {
            const { expandedFolders, toggleFolder } = make();
            toggleFolder('docs');
            toggleFolder('docs');
            expect(expandedFolders.value.has('docs')).toBe(false);
        });
    });

    // ── visibleFiles ─────────────────────────────────────────────────────────

    describe('visibleFiles', () => {
        it('only shows root-level files when no folder is expanded', () => {
            files = [makeFile('root.md'), makeFile('nested.md', 'docs')];
            const { visibleFiles } = make();
            expect(visibleFiles.value.map((f) => f.name)).toEqual(['root.md']);
        });

        it('shows nested files once their parent folder is expanded', () => {
            files = [makeFile('root.md'), makeFile('nested.md', 'docs')];
            const { visibleFiles, toggleFolder } = make();
            toggleFolder('docs');
            const names = visibleFiles.value.map((f) => f.name);
            expect(names).toContain('nested.md');
            expect(names).toContain('root.md');
        });

        it('hides nested files again when the folder is collapsed', () => {
            files = [makeFile('nested.md', 'docs')];
            const { visibleFiles, toggleFolder } = make();
            toggleFolder('docs');
            toggleFolder('docs'); // collapse
            expect(visibleFiles.value).toHaveLength(0);
        });
    });

    // ── flattenedItems ───────────────────────────────────────────────────────

    describe('flattenedItems', () => {
        it('includes folder entries in the flattened list', () => {
            files = [makeFile('note.md', 'docs')];
            const { flattenedItems } = make();
            const folderItems = flattenedItems.value.filter((i) => i.type === 'folder');
            expect(folderItems).toHaveLength(1);
            expect(folderItems[0].folderPath).toBe('docs');
        });

        it('does not include children of collapsed folders', () => {
            files = [makeFile('note.md', 'docs')];
            const { flattenedItems } = make();
            const fileItems = flattenedItems.value.filter((i) => i.type === 'file');
            expect(fileItems).toHaveLength(0);
        });

        it('includes children of expanded folders', () => {
            files = [makeFile('note.md', 'docs')];
            const { flattenedItems, toggleFolder } = make();
            toggleFolder('docs');
            const fileItems = flattenedItems.value.filter((i) => i.type === 'file');
            expect(fileItems).toHaveLength(1);
        });
    });
});
