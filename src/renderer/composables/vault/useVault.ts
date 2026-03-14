import { ref } from 'vue';
import type { FileInfo, FolderInfo } from '../../types/electron';

export function useVault() {
    const currentFolder = ref<string | null>(null);
    const files = ref<FileInfo[]>([]);
    const folders = ref<FolderInfo[]>([]);

    // --- FS watcher ---
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    type RefreshCallback = () => void;
    let onExternalChange: RefreshCallback | null = null;

    function setExternalChangeCallback(cb: RefreshCallback) {
        onExternalChange = cb;
    }

    async function startFolderWatcher(folderPath: string) {
        try {
            window.electronAPI.removeFsChangedListener();
            window.electronAPI.onFsChanged(() => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    onExternalChange?.();
                }, 500);
            });
            await window.electronAPI.watchFolder(folderPath);
        } catch (err) {
            console.error('Failed to start folder watcher:', err);
        }
    }

    function stopFolderWatcher() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        window.electronAPI.removeFsChangedListener();
        window.electronAPI.unwatchFolder();
    }

    // --- Core folder operations ---
    async function scanFolder(folderPath: string): Promise<{ files: FileInfo[]; folders: FolderInfo[] } | null> {
        const result = await window.electronAPI.scanFolder(folderPath);
        if (result.success && result.files) {
            return { files: result.files, folders: result.folders ?? [] };
        }
        console.error('Failed to scan folder:', result.error);
        return null;
    }

    async function loadFolder(folderPath: string): Promise<{ files: FileInfo[]; folders: FolderInfo[] } | null> {
        const scanned = await scanFolder(folderPath);
        if (!scanned) {
            alert('Failed to load folder.');
            return null;
        }
        currentFolder.value = folderPath;
        files.value = scanned.files;
        folders.value = scanned.folders;
        localStorage.setItem('leaf-folder-path', folderPath);
        startFolderWatcher(folderPath);
        return scanned;
    }

    async function refreshFiles(): Promise<void> {
        if (!currentFolder.value) return;
        const scanned = await scanFolder(currentFolder.value);
        if (scanned) {
            files.value = scanned.files;
            folders.value = scanned.folders;
        }
    }

    async function openFolderDialog(): Promise<string | null> {
        try {
            const folderPath = await window.electronAPI.openFolderDialog();
            if (folderPath) {
                await loadFolder(folderPath);
                return folderPath;
            }
            return null;
        } catch (error) {
            console.error('Error selecting folder:', error);
            return null;
        }
    }

    function closeVault() {
        stopFolderWatcher();
        currentFolder.value = null;
        files.value = [];
        folders.value = [];
        localStorage.removeItem('leaf-folder-path');
        localStorage.removeItem('leaf-last-selected-file');
    }

    // --- File CRUD ---
    async function createFile(): Promise<FileInfo | null> {
        if (!currentFolder.value) return null;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `note-${timestamp}.md`;
        try {
            const result = await window.electronAPI.createFile(currentFolder.value, fileName);
            if (result.success && result.path) {
                await refreshFiles();
                return files.value.find(f => f.path === result.path) ?? null;
            }
            alert('Failed to create file: ' + result.error);
            return null;
        } catch (error) {
            console.error('Error creating file:', error);
            alert('Error creating file');
            return null;
        }
    }

    async function createDrawing(): Promise<FileInfo | null> {
        if (!currentFolder.value) return null;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `drawing-${timestamp}.drawing`;
        const emptyDrawing = JSON.stringify({ version: 1, strokes: [], backgroundColor: '#1a1a1a' }, null, 2);
        try {
            const result = await window.electronAPI.createFile(currentFolder.value, fileName);
            if (result.success && result.path) {
                await window.electronAPI.writeFile(result.path, emptyDrawing);
                await refreshFiles();
                return files.value.find(f => f.path === result.path) ?? null;
            }
            alert('Failed to create drawing: ' + result.error);
            return null;
        } catch (error) {
            console.error('Error creating drawing:', error);
            alert('Error creating drawing');
            return null;
        }
    }

    async function createFolder(): Promise<void> {
        if (!currentFolder.value) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const folderName = `folder-${timestamp}`;
        try {
            const result = await window.electronAPI.createFolder(currentFolder.value, folderName);
            if (result.success) {
                await refreshFiles();
            } else {
                console.error('Failed to create folder:', result.error);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
        }
    }

    async function renameFile(file: FileInfo, newBaseName: string): Promise<FileInfo | null> {
        const extension = file.name.substring(file.name.lastIndexOf('.'));
        try {
            const result = await window.electronAPI.renameFile(file.path, newBaseName + extension);
            if (result.success && result.newPath) {
                await refreshFiles();
                return files.value.find(f => f.path === result.newPath) ?? null;
            }
            alert('Failed to rename file: ' + result.error);
            return null;
        } catch (error) {
            console.error('Error renaming file:', error);
            alert('Error renaming file');
            return null;
        }
    }

    async function renameFolder(relativePath: string, newName: string): Promise<string | null> {
        if (!currentFolder.value) return null;
        const absolutePath = currentFolder.value + '/' + relativePath;
        try {
            const result = await window.electronAPI.renameFolder(absolutePath, newName);
            if (result.success && result.newPath) {
                await refreshFiles();
                const parentPath = relativePath.includes('/')
                    ? relativePath.substring(0, relativePath.lastIndexOf('/'))
                    : '';
                return parentPath ? parentPath + '/' + newName : newName;
            }
            alert('Failed to rename folder: ' + result.error);
            return null;
        } catch (error) {
            console.error('Error renaming folder:', error);
            alert('Error renaming folder');
            return null;
        }
    }

    async function deleteFile(filesToDelete: FileInfo[]): Promise<void> {
        for (const f of filesToDelete) {
            try {
                const result = await window.electronAPI.deleteFile(f.path);
                if (!result.success) {
                    alert(`Failed to delete ${f.name}: ${result.error}`);
                }
            } catch (error) {
                console.error('Error deleting file:', error);
                alert('Error deleting file');
            }
        }
        await refreshFiles();
    }

    async function deleteFolder(relativePath: string): Promise<boolean> {
        if (!currentFolder.value) return false;
        const absolutePath = currentFolder.value + '/' + relativePath;
        try {
            const result = await window.electronAPI.deleteFolder(absolutePath);
            if (result.success) {
                await refreshFiles();
                return true;
            }
            alert('Failed to delete folder: ' + result.error);
            return false;
        } catch (error) {
            console.error('Error deleting folder:', error);
            return false;
        }
    }

    async function moveFiles(filePaths: string[], targetRelativePath: string): Promise<string[]> {
        if (!currentFolder.value) return [];
        const absoluteTarget = (targetRelativePath === '.' || targetRelativePath === '')
            ? currentFolder.value
            : currentFolder.value + '/' + targetRelativePath;
        const movedPaths: string[] = [];
        for (const path of filePaths) {
            try {
                const result = await window.electronAPI.moveFile(path, absoluteTarget);
                if (result.success && result.newPath) {
                    movedPaths.push(result.newPath);
                } else if (result.error && !result.error.includes('ENOENT')) {
                    const name = path.split('/').pop() ?? path;
                    alert(`Failed to move ${name}: ${result.error}`);
                }
            } catch (error) {
                console.error('Error moving file:', error);
            }
        }
        if (movedPaths.length > 0) await refreshFiles();
        return movedPaths;
    }

    async function moveFolder(relativePath: string, targetRelativePath: string): Promise<boolean> {
        if (!currentFolder.value) return false;
        const absolutePath = currentFolder.value + '/' + relativePath;
        const absoluteTarget = (targetRelativePath === '.' || targetRelativePath === '')
            ? currentFolder.value
            : currentFolder.value + '/' + targetRelativePath;
        try {
            const result = await window.electronAPI.moveFolder(absolutePath, absoluteTarget);
            if (result.success) {
                await refreshFiles();
                return true;
            }
            alert('Failed to move folder: ' + result.error);
            return false;
        } catch (error) {
            console.error('Error moving folder:', error);
            return false;
        }
    }

    return {
        // State
        currentFolder,
        files,
        folders,
        // Folder lifecycle
        openFolderDialog,
        loadFolder,
        refreshFiles,
        closeVault,
        // FS watcher callback
        setExternalChangeCallback,
        // File CRUD
        createFile,
        createDrawing,
        createFolder,
        renameFile,
        renameFolder,
        deleteFile,
        deleteFolder,
        moveFiles,
        moveFolder,
    };
}
