/**
 * useNotePersistence — manages note content state, file loading/saving,
 * and auto-save scheduling.
 */

import { ref } from 'vue';
import type { FileInfo } from '../../types/electron';

export function useNotePersistence(
    getFile: () => FileInfo | null,
    isMarkdownFile: () => boolean,
    resolveEmbeds: (content: string) => void,
    onSave: (content: string) => void,
    onContentChanged: (hasChanges: boolean) => void,
) {
    const content = ref('');
    const originalContent = ref('');
    const hasUnsavedChanges = ref(false);
    const isSaving = ref(false);

    // Exposed as refs so the component's file-watcher can read/write them directly.
    const lastLoadedPath = ref<string | null>(null);
    const justSaved = ref(false);

    let autoSaveTimeout: number | null = null;
    let embedResolveTimeout: number | null = null;

    async function loadFile(file: FileInfo) {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
        }
        if (embedResolveTimeout) {
            clearTimeout(embedResolveTimeout);
            embedResolveTimeout = null;
        }
        try {
            const result = await window.electronAPI.readFile(file.path);
            if (result.success && result.content !== undefined) {
                content.value = result.content;
                originalContent.value = result.content;
                hasUnsavedChanges.value = false;
                if (file.extension.toLowerCase() === '.md') {
                    resolveEmbeds(result.content);
                }
            } else {
                console.error('Failed to read file:', result.error);
            }
        } catch (error) {
            console.error('Error loading file:', error);
        }
    }

    function onContentChange() {
        hasUnsavedChanges.value = content.value !== originalContent.value;
        onContentChanged(hasUnsavedChanges.value);

        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

        // Debounce embed resolution — avoid IPC storms on every keystroke
        if (isMarkdownFile() && content.value.includes('![[')) {
            if (embedResolveTimeout) clearTimeout(embedResolveTimeout);
            embedResolveTimeout = window.setTimeout(() => {
                resolveEmbeds(content.value);
            }, 500);
        }

        if (hasUnsavedChanges.value) {
            autoSaveTimeout = window.setTimeout(() => {
                saveFile();
            }, 3000);
        }
    }

    async function saveFile() {
        const file = getFile();
        if (!file || !hasUnsavedChanges.value || isSaving.value) return;

        isSaving.value = true;
        try {
            const result = await window.electronAPI.writeFile(file.path, content.value);
            if (result.success) {
                originalContent.value = content.value;
                hasUnsavedChanges.value = false;
                justSaved.value = true;
                onContentChanged(false);
                onSave(content.value);
            } else {
                console.error('Failed to save file:', result.error);
                alert('Failed to save file: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file');
        } finally {
            isSaving.value = false;
        }
    }

    async function handleDrawingSave(drawingContent: string) {
        const file = getFile();
        if (!file) return;
        try {
            const result = await window.electronAPI.writeFile(file.path, drawingContent);
            if (result.success) {
                content.value = drawingContent;
                originalContent.value = drawingContent;
                hasUnsavedChanges.value = false;
                onContentChanged(false);
                onSave(drawingContent);
            } else {
                console.error('Failed to save drawing:', result.error);
            }
        } catch (error) {
            console.error('Error saving drawing:', error);
        }
    }

    function clearAutoSaveTimeout() {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
        }
        if (embedResolveTimeout) {
            clearTimeout(embedResolveTimeout);
            embedResolveTimeout = null;
        }
    }

    return {
        content,
        originalContent,
        hasUnsavedChanges,
        isSaving,
        lastLoadedPath,
        justSaved,
        onContentChange,
        saveFile,
        loadFile,
        handleDrawingSave,
        clearAutoSaveTimeout,
    };
}
