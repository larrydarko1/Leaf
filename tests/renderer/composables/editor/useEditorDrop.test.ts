import { EditorView } from '@codemirror/view';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useEditorDrop } from '@/renderer/composables/editor/useEditorDrop';
import { createDragEvent, FakeDataTransfer } from '@test-utils';

const mockElectronAPI = {
    log: { error: vi.fn() },
};

function makeComposable(
    opts: {
        isMarkdown?: boolean;
        filePath?: string;
        initialContent?: string;
    } = {},
) {
    const isMarkdownFile = ref(opts.isMarkdown ?? true);
    const textareaRef = ref<HTMLTextAreaElement | null>(document.createElement('textarea'));
    const showPreview = ref(false);
    const content = ref(opts.initialContent ?? '');
    const onContentChange = vi.fn();
    const file = opts.filePath != null ? { path: opts.filePath } : null;

    const composable = useEditorDrop({
        isMarkdownFile,
        findFile: () => file,
        textareaRef,
        showPreview,
        content,
        onContentChange,
    });

    return { ...composable, content, onContentChange };
}

function makeDragEvent(opts: { textPlain?: string; types?: string[] } = {}): DragEvent {
    const dt = new FakeDataTransfer();
    const types = opts.types ?? (opts.textPlain != null ? ['text/plain'] : []);
    for (const type of types) dt.setData(type, type === 'text/plain' ? (opts.textPlain ?? '') : '');
    return createDragEvent('drop', dt);
}

beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>)['electronAPI'] = mockElectronAPI;
});

describe('isDragOverEditor', () => {
    it('starts as false', () => {
        const { isDragOverEditor } = makeComposable();
        expect(isDragOverEditor.value).toBe(false);
    });
});

describe('onEditorDragEnter', () => {
    it('sets isDragOverEditor to true for embeddable data on a markdown file', () => {
        const { isDragOverEditor, onEditorDragEnter } = makeComposable({ isMarkdown: true });
        onEditorDragEnter(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(isDragOverEditor.value).toBe(true);
    });

    it('does nothing on a non-markdown file', () => {
        const { isDragOverEditor, onEditorDragEnter } = makeComposable({ isMarkdown: false });
        onEditorDragEnter(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(isDragOverEditor.value).toBe(false);
    });

    it('does nothing when the dataTransfer has no embeddable data', () => {
        const { isDragOverEditor, onEditorDragEnter } = makeComposable({ isMarkdown: true });
        onEditorDragEnter(makeDragEvent({ types: [] }));
        expect(isDragOverEditor.value).toBe(false);
    });

    it('shows no drop affordance for a native OS file drag', () => {
        const { isDragOverEditor, onEditorDragEnter } = makeComposable({ isMarkdown: true });
        onEditorDragEnter(makeDragEvent({ types: ['Files'] }));
        expect(isDragOverEditor.value).toBe(false);
    });
});

describe('onEditorDragLeave', () => {
    it('sets isDragOverEditor back to false after all drag-enters are balanced', () => {
        const { isDragOverEditor, onEditorDragEnter, onEditorDragLeave } = makeComposable({ isMarkdown: true });
        const event = makeDragEvent({ types: ['text/plain'], textPlain: 'file:/vault/photo.jpg' });
        onEditorDragEnter(event);
        onEditorDragEnter(event);
        onEditorDragLeave(makeDragEvent());
        expect(isDragOverEditor.value).toBe(true);
        onEditorDragLeave(makeDragEvent());
        expect(isDragOverEditor.value).toBe(false);
    });

    it('does not go negative (clamps counter to 0)', () => {
        const { isDragOverEditor, onEditorDragLeave } = makeComposable({ isMarkdown: true });
        onEditorDragLeave(makeDragEvent());
        onEditorDragLeave(makeDragEvent());
        expect(isDragOverEditor.value).toBe(false);
    });
});

describe('onFileDrop', () => {
    it('resets isDragOverEditor to false on drop', async () => {
        const { isDragOverEditor, onEditorDragEnter, onFileDrop } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        onEditorDragEnter(makeDragEvent({ types: ['text/plain'], textPlain: 'file:/vault/image.png' }));
        expect(isDragOverEditor.value).toBe(true);
        await onFileDrop(makeDragEvent({ types: [] }));
        expect(isDragOverEditor.value).toBe(false);
    });

    it('does nothing when the file is not a markdown file', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({ isMarkdown: false });
        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('does nothing when no file is open', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({ isMarkdown: true });
        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('inserts ![[filename]] for an internal file drag with an embeddable extension', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(content.value).toContain('![[image.png]]');
        expect(onContentChange).toHaveBeenCalled();
    });

    it('ignores internal drag when the filename has a non-embeddable extension', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/archive.zip', types: ['text/plain'] }));
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('ignores internal drag when the text/plain value has no "file:" prefix', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        await onFileDrop(makeDragEvent({ textPlain: 'plain text here', types: ['text/plain'] }));
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('ignores a native OS file drop of an embeddable file inside the vault', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        const event = makeDragEvent({
            types: ['Files'],
        });
        await onFileDrop(event);
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('ignores a native OS file drop of a file outside the vault', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
        });
        const event = makeDragEvent({
            types: ['Files'],
        });
        await onFileDrop(event);
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('adds a newline before the embed when content does not end with one', async () => {
        makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            initialContent: 'existing text',
        });
        const textareaRef = ref<HTMLTextAreaElement | null>(null);
        const isMarkdownFile = ref(true);
        const showPreview = ref(false);
        const c = ref('existing text');
        const { onFileDrop: drop } = useEditorDrop({
            isMarkdownFile,
            findFile: () => ({ path: '/vault/note.md' }),
            textareaRef,
            showPreview,
            content: c,
            onContentChange: vi.fn(),
        });
        await drop(makeDragEvent({ textPlain: 'file:/vault/photo.png', types: ['text/plain'] }));
        expect(c.value).toMatch(/existing text\n!\[\[photo\.png\]\]/);
    });

    it('uses CodeMirror dispatch when cmViewRef is provided', async () => {
        const isMarkdownFile = ref(true);
        const showPreview = ref(false);
        const content = ref('');
        const onContentChange = vi.fn();
        const cmView = new EditorView({ doc: '', parent: document.createElement('div') });
        const cmViewRef = shallowRef<EditorView | null>(cmView);

        const { onFileDrop } = useEditorDrop({
            isMarkdownFile,
            findFile: () => ({ path: '/vault/note.md' }),
            textareaRef: ref(null),
            showPreview,
            content,
            onContentChange,
            cmViewRef,
        });

        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(cmView.state.doc.toString()).toContain('![[image.png]]');
        expect(onContentChange).toHaveBeenCalled();
        cmView.destroy();
    });
});
