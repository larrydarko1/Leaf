/**
 * useEditorDrop — handles drag-and-drop of vault files onto the editor,
 * inserting markdown embed syntax for images, audio, video, and PDFs.
 */

import { ref } from 'vue';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, PDF_EXTENSIONS } from '@/renderer/utils/fileTypes';
import type { Ref, ShallowRef } from 'vue';
import type { EditorView } from '@codemirror/view';

export type UseEditorDropReturn = {
    isDragOverEditor: Ref<boolean>;
    onEditorDragEnter: (event: DragEvent) => void;
    onEditorDragOver: (event: DragEvent) => void;
    onEditorDragLeave: (_event: DragEvent) => void;
    onFileDrop: (event: DragEvent) => Promise<void>;
};

const embeddableExtensions = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PDF_EXTENSIONS];

export function useEditorDrop({
    isMarkdownFile,
    findFile,
    textareaRef,
    showPreview,
    content,
    onContentChange,
    cmViewRef,
}: {
    isMarkdownFile: Ref<boolean>;
    findFile: () => { path: string } | null;
    textareaRef: Ref<HTMLTextAreaElement | null>;
    showPreview: Ref<boolean>;
    content: Ref<string>;
    onContentChange: () => void;
    cmViewRef?: ShallowRef<EditorView | null>;
}): UseEditorDropReturn {
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
        if (dataTransfer !== null) dataTransfer.dropEffect = 'move';
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

        const file = findFile();
        if (!isMarkdownFile.value || file === null) return;

        const embedTexts: string[] = [];

        // Internal drag from FileExplorer (text/plain with "file:" prefix).
        // Native OS file drops carry no usable path and are ignored.
        const plainData = event.dataTransfer?.getData('text/plain');
        if (plainData !== null && plainData !== undefined && plainData.length > 0 && plainData.startsWith('file:')) {
            const filePath = plainData.substring(5);
            const fileName = filePath.split('/').pop();
            if (fileName !== null && fileName !== undefined && fileName.length > 0 && isEmbeddableFile(fileName)) {
                embedTexts.push(`![[${fileName}]]`);
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
    return dt.types.includes('text/plain');
}
