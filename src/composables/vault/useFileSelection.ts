import { ref } from 'vue';
import type { FileInfo } from '../types/electron';

export function useFileSelection() {
    const selectedFiles = ref<FileInfo[]>([]);
    const activeFile = ref<FileInfo | null>(null);
    const selectedFolder = ref<string | null>(null);
    const lastSelectedIndex = ref<number>(-1);

    function selectFile(file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]) {
        selectedFolder.value = null;

        const fileList = visibleFiles ?? [];
        const fileIndex = fileList.findIndex(f => f.path === file.path);

        if (event?.metaKey || event?.ctrlKey) {
            const index = selectedFiles.value.findIndex(f => f.path === file.path);
            if (index >= 0) {
                selectedFiles.value.splice(index, 1);
                if (activeFile.value?.path === file.path) {
                    activeFile.value = selectedFiles.value[0] ?? null;
                }
            } else {
                selectedFiles.value.push(file);
                activeFile.value = file;
            }
            lastSelectedIndex.value = fileIndex;
        } else if (event?.shiftKey && lastSelectedIndex.value >= 0 && fileList.length > 0) {
            const start = Math.min(lastSelectedIndex.value, fileIndex);
            const end = Math.max(lastSelectedIndex.value, fileIndex);
            selectedFiles.value = fileList.slice(start, end + 1);
            activeFile.value = file;
        } else {
            selectedFiles.value = [file];
            activeFile.value = file;
            lastSelectedIndex.value = fileIndex;
        }

        if (activeFile.value) {
            localStorage.setItem('leaf-last-selected-file', activeFile.value.path);
        }
    }

    function selectFolder(folderPath: string) {
        selectedFolder.value = folderPath;
        selectedFiles.value = [];
        activeFile.value = null;
    }

    function openFile(file: FileInfo) {
        selectedFiles.value = [file];
        activeFile.value = file;
        selectedFolder.value = null;
        localStorage.setItem('leaf-last-selected-file', file.path);
    }

    function clearSelection() {
        selectedFiles.value = [];
        activeFile.value = null;
        lastSelectedIndex.value = -1;
    }

    /**
     * After a vault refresh, try to restore previously selected files.
     * Returns the updated active file (which the caller can use to re-sync the editor).
     */
    function syncAfterRefresh(availableFiles: FileInfo[]): FileInfo | null {
        if (selectedFiles.value.length === 0) return null;
        const previousPaths = selectedFiles.value.map(f => f.path);
        const previousActivePath = activeFile.value?.path;

        const stillExist = availableFiles.filter(f => previousPaths.includes(f.path));
        if (stillExist.length > 0) {
            selectedFiles.value = stillExist;
            if (previousActivePath) {
                activeFile.value = stillExist.find(f => f.path === previousActivePath) ?? stillExist[0];
            } else {
                activeFile.value = stillExist[0];
            }
        } else {
            clearSelection();
        }
        return activeFile.value;
    }

    /**
     * Restore last selected file from localStorage after vault load.
     * If not found, selects first file.
     */
    function restoreFromStorage(availableFiles: FileInfo[]) {
        const lastPath = localStorage.getItem('leaf-last-selected-file');
        if (lastPath) {
            const lastFile = availableFiles.find(f => f.path === lastPath);
            if (lastFile) {
                selectedFiles.value = [lastFile];
                activeFile.value = lastFile;
                return;
            }
        }
        if (availableFiles.length > 0) {
            selectedFiles.value = [availableFiles[0]];
            activeFile.value = availableFiles[0];
            localStorage.setItem('leaf-last-selected-file', availableFiles[0].path);
        }
    }

    return {
        selectedFiles,
        activeFile,
        selectedFolder,
        selectFile,
        selectFolder,
        openFile,
        clearSelection,
        syncAfterRefresh,
        restoreFromStorage,
    };
}
