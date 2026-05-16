import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTreeNodeDrag } from '../../src/renderer/composables/vault/useTreeNodeDrag';
import type { TreeNode } from '../../src/renderer/components/FolderNode.vue';
import type { FileInfo } from '../../src/renderer/types/electron';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFakeDragEvent(dataToReturn = ''): DragEvent {
    const store: Record<string, string> = {};
    const dt = {
        effectAllowed: '',
        dropEffect: '',
        setData(type: string, val: string) {
            store[type] = val;
        },
        getData(type: string) {
            return store[type] ?? dataToReturn;
        },
    };
    return {
        dataTransfer: dt as unknown as DataTransfer,
        preventDefault: vi.fn(),
    } as unknown as DragEvent;
}

function makeFileNode(filePath = '/vault/note.md', folder = '.'): TreeNode {
    const file: FileInfo = {
        name: filePath.split('/').pop()!,
        path: filePath,
        relativePath: filePath.split('/').pop()!,
        extension: '.md',
        size: 0,
        modified: '',
        folder,
    };
    return { type: 'file', path: filePath, name: file.name, file };
}

function makeFolderNode(relativePath: string): TreeNode {
    return { type: 'folder', path: relativePath, name: relativePath.split('/').pop()!, children: [] };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useTreeNodeDrag', () => {
    let onMoveFile: ReturnType<typeof vi.fn>;
    let onMoveFolder: ReturnType<typeof vi.fn>;
    let activeFile: FileInfo | null;

    beforeEach(() => {
        onMoveFile = vi.fn();
        onMoveFolder = vi.fn();
        activeFile = null;
    });

    function makeDrag(node: TreeNode) {
        return useTreeNodeDrag(
            () => node,
            () => activeFile,
            onMoveFile as unknown as (filePath: string, targetFolderPath: string) => void,
            onMoveFolder as unknown as (folderPath: string, targetFolderPath: string) => void,
        );
    }

    // ── handleDragStart ───────────────────────────────────────────────────────

    describe('handleDragStart', () => {
        it('sets isDragging to true', () => {
            const { isDragging, handleDragStart } = makeDrag(makeFileNode());
            handleDragStart(makeFakeDragEvent());
            expect(isDragging.value).toBe(true);
        });

        it('encodes a file path into dataTransfer', () => {
            const { handleDragStart } = makeDrag(makeFileNode('/vault/note.md'));
            const event = makeFakeDragEvent();
            handleDragStart(event);
            expect(event.dataTransfer!.getData('text/plain')).toBe('file:/vault/note.md');
        });

        it('encodes a folder path into dataTransfer', () => {
            const { handleDragStart } = makeDrag(makeFolderNode('projects'));
            const event = makeFakeDragEvent();
            handleDragStart(event);
            expect(event.dataTransfer!.getData('text/plain')).toBe('folder:projects');
        });
    });

    // ── handleDragEnd ─────────────────────────────────────────────────────────

    describe('handleDragEnd', () => {
        it('clears isDragging', () => {
            const { isDragging, handleDragStart, handleDragEnd } = makeDrag(makeFileNode());
            handleDragStart(makeFakeDragEvent());
            handleDragEnd();
            expect(isDragging.value).toBe(false);
        });
    });

    // ── handleDragOver ────────────────────────────────────────────────────────

    describe('handleDragOver', () => {
        it('sets isDragOver to true when the node is a folder', () => {
            const { isDragOver, handleDragOver } = makeDrag(makeFolderNode('docs'));
            handleDragOver(makeFakeDragEvent());
            expect(isDragOver.value).toBe(true);
        });

        it('calls event.preventDefault on a folder target', () => {
            const { handleDragOver } = makeDrag(makeFolderNode('docs'));
            const event = makeFakeDragEvent();
            handleDragOver(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('does not set isDragOver when the node is a file', () => {
            const { isDragOver, handleDragOver } = makeDrag(makeFileNode());
            handleDragOver(makeFakeDragEvent());
            expect(isDragOver.value).toBe(false);
        });
    });

    // ── handleDragLeave ───────────────────────────────────────────────────────

    describe('handleDragLeave', () => {
        it('clears isDragOver', () => {
            const { isDragOver, handleDragOver, handleDragLeave } = makeDrag(makeFolderNode('docs'));
            handleDragOver(makeFakeDragEvent());
            handleDragLeave();
            expect(isDragOver.value).toBe(false);
        });
    });

    // ── handleDrop – file moves ───────────────────────────────────────────────

    describe('handleDrop (file moves)', () => {
        it('calls onMoveFile with the dragged file path and target folder path', () => {
            const { handleDrop } = makeDrag(makeFolderNode('docs'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'file:/vault/note.md');
            handleDrop(event);
            expect(onMoveFile).toHaveBeenCalledWith('/vault/note.md', 'docs');
        });

        it('does not move a file that is already in the target folder', () => {
            const existingFile: FileInfo = {
                name: 'note.md',
                path: '/vault/docs/note.md',
                relativePath: 'docs/note.md',
                extension: '.md',
                size: 0,
                modified: '',
                folder: 'docs',
            };
            activeFile = existingFile;
            const { handleDrop } = makeDrag(makeFolderNode('docs'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'file:/vault/docs/note.md');
            handleDrop(event);
            expect(onMoveFile).not.toHaveBeenCalled();
        });

        it('clears isDragOver after a drop', () => {
            const { isDragOver, handleDragOver, handleDrop } = makeDrag(makeFolderNode('docs'));
            handleDragOver(makeFakeDragEvent());
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'file:/vault/note.md');
            handleDrop(event);
            expect(isDragOver.value).toBe(false);
        });
    });

    // ── handleDrop – folder moves ─────────────────────────────────────────────

    describe('handleDrop (folder moves)', () => {
        it('calls onMoveFolder with the dragged folder path and target folder path', () => {
            const { handleDrop } = makeDrag(makeFolderNode('docs'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'folder:projects');
            handleDrop(event);
            expect(onMoveFolder).toHaveBeenCalledWith('projects', 'docs');
        });

        it('does not move a folder into itself', () => {
            const { handleDrop } = makeDrag(makeFolderNode('docs'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'folder:docs');
            handleDrop(event);
            expect(onMoveFolder).not.toHaveBeenCalled();
        });

        it('does not move a folder into one of its own subdirectories', () => {
            const { handleDrop } = makeDrag(makeFolderNode('docs/sub'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'folder:docs');
            handleDrop(event);
            expect(onMoveFolder).not.toHaveBeenCalled();
        });

        it('allows moving a folder that has a similar prefix but is not a sub-path', () => {
            // 'documentation' is NOT a subdirectory of 'docs', despite sharing a prefix
            const { handleDrop } = makeDrag(makeFolderNode('documentation'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'folder:docs');
            handleDrop(event);
            expect(onMoveFolder).toHaveBeenCalled();
        });
    });

    // ── handleDrop – no-op on non-folder targets ──────────────────────────────

    describe('handleDrop on a file node', () => {
        it('is a no-op — files cannot be drop targets', () => {
            const { handleDrop } = makeDrag(makeFileNode('/vault/note.md'));
            const event = makeFakeDragEvent();
            event.dataTransfer!.setData('text/plain', 'file:/vault/other.md');
            handleDrop(event);
            expect(onMoveFile).not.toHaveBeenCalled();
            expect(onMoveFolder).not.toHaveBeenCalled();
        });
    });
});
