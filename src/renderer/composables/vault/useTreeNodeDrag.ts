/**
 * useTreeNodeDrag — handles drag-and-drop reordering of files and folders
 * within the vault tree.
 */

import { ref } from 'vue';
import type { TreeNode } from '../../components/FolderNode.vue';
import type { FileInfo } from '../../types/electron';

export function useTreeNodeDrag(
    getNode: () => TreeNode,
    getActiveFile: () => FileInfo | null,
    onMoveFile: (filePath: string, targetFolderPath: string) => void,
    onMoveFolder: (folderPath: string, targetFolderPath: string) => void,
) {
    const isDragging = ref(false);
    const isDragOver = ref(false);

    function handleDragStart(event: DragEvent) {
        const node = getNode();
        isDragging.value = true;
        event.dataTransfer!.effectAllowed = 'move';

        if (node.type === 'file' && node.file) {
            event.dataTransfer!.setData('text/plain', 'file:' + node.file.path);
        } else if (node.type === 'folder') {
            event.dataTransfer!.setData('text/plain', 'folder:' + node.path);
        }

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDragEnd() {
        isDragging.value = false;
    }

    function handleDragOver(event: DragEvent) {
        if (getNode().type === 'folder') {
            event.preventDefault();
            isDragOver.value = true;
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }
        }
    }

    function handleDragLeave() {
        isDragOver.value = false;
    }

    function handleDrop(event: DragEvent) {
        isDragOver.value = false;
        const node = getNode();

        if (node.type === 'folder') {
            const data = event.dataTransfer?.getData('text/plain');
            if (data) {
                if (data.startsWith('file:')) {
                    const filePath = data.substring(5);
                    const activeFile = getActiveFile();
                    if (activeFile && activeFile.path === filePath && activeFile.folder === node.path) {
                        return;
                    }
                    onMoveFile(filePath, node.path);
                } else if (data.startsWith('folder:')) {
                    const folderPath = data.substring(7);
                    if (folderPath === node.path || node.path.startsWith(folderPath + '/')) {
                        return;
                    }
                    onMoveFolder(folderPath, node.path);
                }
            }
        }
    }

    return { isDragging, isDragOver, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop };
}
