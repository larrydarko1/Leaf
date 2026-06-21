import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, shallowRef } from 'vue';
import { useEditorDrop } from '@/renderer/composables/editor/useEditorDrop';

const mockElectronAPI = {
    copyFileToVault: vi.fn(),
    log: { error: vi.fn() },
};

beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.copyFileToVault.mockResolvedValue({ success: true, fileName: 'copied.png' });
    (globalThis as Record<string, unknown>).electronAPI = mockElectronAPI;
});

function makeComposable(
    opts: {
        isMarkdown?: boolean;
        filePath?: string;
        workspacePath?: string;
        initialContent?: string;
    } = {},
) {
    const isMarkdownFile = ref(opts.isMarkdown ?? true);
    const textareaRef = ref<HTMLTextAreaElement | null>(document.createElement('textarea'));
    const showPreview = ref(false);
    const content = ref(opts.initialContent ?? '');
    const onContentChange = vi.fn();
    const file = opts.filePath != null ? { path: opts.filePath } : null;
    const workspacePath = opts.workspacePath ?? '/vault';

    const composable = useEditorDrop(
        isMarkdownFile,
        () => file,
        () => workspacePath,
        textareaRef as never,
        showPreview,
        content,
        onContentChange,
    );

    return { ...composable, content, onContentChange };
}

function makeDragEvent(
    opts: {
        textPlain?: string;
        types?: string[];
        files?: { name: string; path: string }[];
    } = {},
): DragEvent {
    const types = opts.types ?? (opts.textPlain != null ? ['text/plain'] : opts.files != null ? ['Files'] : []);
    const files = opts.files ?? [];
    const dt = {
        types,
        getData: (type: string) => (type === 'text/plain' ? (opts.textPlain ?? '') : ''),
        files: Object.assign([...files], { length: files.length }),
        dropEffect: '',
    };
    return { dataTransfer: dt, preventDefault: vi.fn() } as unknown as DragEvent;
}

// ── initial state ─────────────────────────────────────────────────────────────

describe('isDragOverEditor', () => {
    it('starts as false', () => {
        const { isDragOverEditor } = makeComposable();
        expect(isDragOverEditor.value).toBe(false);
    });
});

// ── onEditorDragEnter ─────────────────────────────────────────────────────────

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
});

// ── onEditorDragLeave ─────────────────────────────────────────────────────────

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

// ── onFileDrop ────────────────────────────────────────────────────────────────

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
        const { content, onFileDrop, onContentChange } = makeComposable({ isMarkdown: true, filePath: undefined });
        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('inserts ![[filename]] for an internal file drag with an embeddable extension', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            workspacePath: '/vault',
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

    it('inserts embed for a native OS drop of an image inside the workspace', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            workspacePath: '/vault',
        });
        const event = makeDragEvent({
            types: ['Files'],
            files: [{ name: 'photo.jpg', path: '/vault/photo.jpg' }],
        });
        await onFileDrop(event);
        expect(content.value).toContain('![[photo.jpg]]');
        expect(onContentChange).toHaveBeenCalled();
    });

    it('calls copyFileToVault for a native drop of a file outside the workspace', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            workspacePath: '/vault',
        });
        const event = makeDragEvent({
            types: ['Files'],
            files: [{ name: 'external.png', path: '/Downloads/external.png' }],
        });
        await onFileDrop(event);
        expect(mockElectronAPI.copyFileToVault).toHaveBeenCalledWith('/Downloads/external.png', '/vault');
        expect(content.value).toContain('![[copied.png]]');
        expect(onContentChange).toHaveBeenCalled();
    });

    it('skips a native-drop file with a non-embeddable extension', async () => {
        const { content, onFileDrop, onContentChange } = makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            workspacePath: '/vault',
        });
        const event = makeDragEvent({
            types: ['Files'],
            files: [{ name: 'report.docx', path: '/vault/report.docx' }],
        });
        await onFileDrop(event);
        expect(content.value).toBe('');
        expect(onContentChange).not.toHaveBeenCalled();
    });

    it('adds a newline before the embed when content does not end with one', async () => {
        makeComposable({
            isMarkdown: true,
            filePath: '/vault/note.md',
            workspacePath: '/vault',
            initialContent: 'existing text',
        });
        const textareaRef = ref<HTMLTextAreaElement | null>(null);
        const isMarkdownFile = ref(true);
        const showPreview = ref(false);
        const c = ref('existing text');
        const { onFileDrop: drop } = useEditorDrop(
            isMarkdownFile,
            () => ({ path: '/vault/note.md' }),
            () => '/vault',
            textareaRef as never,
            showPreview,
            c,
            vi.fn(),
        );
        await drop(makeDragEvent({ textPlain: 'file:/vault/photo.png', types: ['text/plain'] }));
        expect(c.value).toMatch(/existing text\n!\[\[photo\.png\]\]/);
    });

    it('uses CodeMirror dispatch when cmViewRef is provided', async () => {
        const isMarkdownFile = ref(true);
        const showPreview = ref(false);
        const content = ref('');
        const onContentChange = vi.fn();
        const dispatch = vi.fn();
        const cmView = {
            state: {
                selection: { main: { head: 0 } },
                doc: { length: 0, sliceString: () => '\n', lineAt: () => ({ from: 0 }) },
            },
            dispatch,
            focus: vi.fn(),
        };
        const cmViewRef = shallowRef(cmView as never);

        const { onFileDrop } = useEditorDrop(
            isMarkdownFile,
            () => ({ path: '/vault/note.md' }),
            () => '/vault',
            ref(null) as never,
            showPreview,
            content,
            onContentChange,
            cmViewRef,
        );

        await onFileDrop(makeDragEvent({ textPlain: 'file:/vault/image.png', types: ['text/plain'] }));
        expect(dispatch).toHaveBeenCalled();
        expect(onContentChange).toHaveBeenCalled();
    });
});
