/**
 * useEditorDrop — handles file drag-and-drop onto the editor, inserting
 * markdown embed syntax for images, audio, video, and PDFs.
 */

import { ref } from 'vue';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, PDF_EXTENSIONS } from '@/utils/fileTypes';
import type { Ref, ShallowRef } from 'vue';
import type { EditorView } from '@codemirror/view';

const embeddableExtensions = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PDF_EXTENSIONS];

export function useEditorDrop(
    isMarkdownFile: Ref<boolean>,
    getFile: () => { path: string } | null,
    getWorkspacePath: () => string | null,
    textareaRef: Ref<HTMLTextAreaElement | null>,
    showPreview: Ref<boolean>,
    content: Ref<string>,
    onContentChange: () => void,
    cmViewRef?: ShallowRef<EditorView | null>,
) {
    const isDragOverEditor = ref(false);
    let dragCounter = 0;

    function onEditorDragEnter(event: DragEvent): void {
        if (!isMarkdownFile.value) return;
        if (!hasEmbeddableData(event.dataTransfer)) return;
        dragCounter++;
        isDragOverEditor.value = true;
    }

    function onEditorDragOver(event: DragEvent): void {
        if (!isMarkdownFile.value) return;
        if (!hasEmbeddableData(event.dataTransfer)) return;

        const dataTransfer = event.dataTransfer;
        if (dataTransfer !== null) {
            if (dataTransfer.types.includes('Files')) {
                dataTransfer.dropEffect = 'copy';
            } else {
                dataTransfer.dropEffect = 'move';
            }
        }
    }

    function onEditorDragLeave(_event: DragEvent): void {
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            isDragOverEditor.value = false;
        }
    }

    async function onFileDrop(event: DragEvent): Promise<void> {
        dragCounter = 0;
        isDragOverEditor.value = false;

        const file = getFile();
        const workspacePath = getWorkspacePath();
        if (!isMarkdownFile.value || file === null || workspacePath === null) return;

        const embedTexts: string[] = [];

        // 1. Internal drag from FileExplorer (text/plain with "file:" prefix)
        const plainData = event.dataTransfer?.getData('text/plain');
        if (plainData !== null && plainData !== undefined && plainData.length > 0 && plainData.startsWith('file:')) {
            const filePath = plainData.substring(5);
            const fileName = filePath.split('/').pop();
            if (fileName !== null && fileName !== undefined && fileName.length > 0 && isEmbeddableFile(fileName)) {
                embedTexts.push(`![[${fileName}]]`);
            }
        }

        // 2. Native file drop from OS (e.g. Finder)
        const droppedFiles = event.dataTransfer?.files;
        if (embedTexts.length === 0 && droppedFiles !== null && droppedFiles !== undefined && droppedFiles.length > 0) {
            const files = Array.from(droppedFiles);
            const noteDir = file.path.substring(0, file.path.lastIndexOf('/'));

            for (const droppedFile of files) {
                const filePath = (droppedFile as unknown as { path?: string }).path;
                if (filePath === null || filePath === undefined || filePath.length === 0) continue;
                if (!isEmbeddableFile(droppedFile.name)) continue;

                if (filePath.startsWith(workspacePath)) {
                    embedTexts.push(`![[${droppedFile.name}]]`);
                } else {
                    try {
                        const result = await window.electronAPI.copyFileToVault(filePath, noteDir);
                        if (
                            result.success &&
                            result.fileName !== null &&
                            result.fileName !== undefined &&
                            result.fileName.length > 0
                        ) {
                            embedTexts.push(`![[${result.fileName}]]`);
                        } else {
                            window.electronAPI.log.error('Failed to copy file to vault:', result.error);
                        }
                    } catch (err) {
                        window.electronAPI.log.error('Error copying file to vault:', err);
                    }
                }
            }
        }

        if (embedTexts.length === 0) return;

        const embedString = embedTexts.join('\n');

        // Insert via CodeMirror when available (markdown files)
        const cmView = cmViewRef?.value;
        if (cmView !== null && cmView !== undefined) {
            const cursor = cmView.state.selection.main.head;
            const doc = cmView.state.doc;
            const before = cursor > 0 ? doc.sliceString(cursor - 1, cursor) : '\n';
            const after = cursor < doc.length ? doc.sliceString(cursor, cursor + 1) : '\n';

            const needNewlineBefore = before !== '\n';
            const needNewlineAfter = after !== '\n';
            const insertion = (needNewlineBefore ? '\n' : '') + embedString + (needNewlineAfter ? '\n' : '');

            cmView.dispatch({
                changes: { from: cursor, insert: insertion },
            });
            // Move cursor to start of the line AFTER the embed so the widget renders
            // (the embed line must not be "active" for the widget to show)
            const afterInsertPos = cursor + insertion.length;
            const afterLine = cmView.state.doc.lineAt(afterInsertPos);
            cmView.dispatch({
                selection: { anchor: afterLine.from },
            });
            cmView.focus();
        } else {
            const textarea = textareaRef.value;
            if (textarea !== null && (!showPreview.value || !isMarkdownFile.value)) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const before = content.value.substring(0, start);
                const after = content.value.substring(end);

                const needNewlineBefore = before.length > 0 && !before.endsWith('\n');
                const needNewlineAfter = after.length > 0 && !after.startsWith('\n');

                const insertion = (needNewlineBefore ? '\n' : '') + embedString + (needNewlineAfter ? '\n' : '');
                content.value = before + insertion + after;

                await Promise.resolve(); // nextTick equivalent via microtask
                const newPos = start + insertion.length;
                textarea.selectionStart = newPos;
                textarea.selectionEnd = newPos;
                textarea.focus();
            } else {
                const needNewline = content.value.length > 0 && !content.value.endsWith('\n');
                content.value += (needNewline ? '\n' : '') + embedString + '\n';
            }
        }

        onContentChange();
    }

    return { isDragOverEditor, onEditorDragEnter, onEditorDragOver, onEditorDragLeave, onFileDrop };
}

function isEmbeddableFile(fileName: string): boolean {
    const ext = '.' + (fileName.split('.').pop()?.toLowerCase() ?? '');
    return embeddableExtensions.includes(ext);
}

function hasEmbeddableData(dt: DataTransfer | null): boolean {
    if (dt === null) return false;
    if (dt.types.includes('Files')) return true;
    if (dt.types.includes('text/plain')) return true;
    return false;
}
