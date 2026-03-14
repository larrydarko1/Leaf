import { ref } from 'vue';
import type { FileInfo } from '../../types/electron';

/**
 * Manages note content state, file loading/saving, and auto-save scheduling.
 *
 * @param getFile        - getter for the current FileInfo prop
 * @param isMarkdownFile - getter returning true when the file is markdown
 * @param resolveEmbeds  - call to re-resolve ![[embed]] links after content changes
 * @param onSave         - called after a successful write (emit wrapper)
 * @param onContentChanged - called when unsaved-changes state changes (emit wrapper)
 */
export function useNotePersistence(
    getFile: () => FileInfo | null,
    isMarkdownFile: () => boolean,
    resolveEmbeds: (content: string) => void,
    onSave: (content: string) => void,
    onContentChanged: (hasChanges: boolean) => void
) {
    const content = ref('');
    const originalContent = ref('');
    const hasUnsavedChanges = ref(false);
    const isSaving = ref(false);

    // Exposed as refs so the component's file-watcher can read/write them directly.
    const lastLoadedPath = ref<string | null>(null);
    const justSaved = ref(false);

    let autoSaveTimeout: number | null = null;

    async function loadFile(file: FileInfo) {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
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

        if (isMarkdownFile() && content.value.includes('![[')) {
            resolveEmbeds(content.value);
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
