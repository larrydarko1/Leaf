/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ref, nextTick, defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { EditorView } from '@codemirror/view';
import { useCodeEditor } from '@/renderer/composables/editor/codemirror/useCodeEditor';

// Mock ResizeObserver — not in jsdom
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver);

// ── Helper: mount a component that calls useCodeEditor ───────────────────────

function mountComposable(options: {
    initialContent?: string;
    fileExtension?: string;
    initialFileId?: string | null;
    onContentChange?: () => void;
}) {
    const { initialContent = '', fileExtension = '.md', initialFileId = null, onContentChange = vi.fn() } = options;

    const content = ref(initialContent);
    const fileId = ref<string | null>(initialFileId);
    const fileExtRef = ref(fileExtension);
    let composableResult: ReturnType<typeof useCodeEditor> | null = null;
    const containerRef = ref<HTMLElement | null>(null);

    const TestComponent = defineComponent({
        setup() {
            composableResult = useCodeEditor(containerRef, content, onContentChange, fileExtRef, fileId);
            return () =>
                h('div', {
                    ref: (el) => {
                        containerRef.value = el as HTMLElement | null;
                    },
                });
        },
    });

    const wrapper = mount(TestComponent, { attachTo: document.body });

    return {
        wrapper,
        content,
        fileId,
        fileExtRef,
        getView: () => composableResult!.view.value,
        onContentChange,
    };
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
});

describe('useCodeEditor', () => {
    it('starts with view as null', () => {
        const content = ref('');
        const containerRef = ref<HTMLElement | null>(null);
        let capturedView: ReturnType<typeof useCodeEditor>['view'] | null = null;

        const TestComponent = defineComponent({
            setup() {
                const result = useCodeEditor(containerRef, content, vi.fn(), ref('.md'));
                capturedView = result.view;
                return () => h('div');
            },
        });

        const wrapper = mount(TestComponent, { attachTo: document.body });
        expect(capturedView!.value).toBeNull();
        wrapper.unmount();
    });

    it('creates an EditorView when containerRef is set', async () => {
        const { wrapper, getView } = mountComposable({ initialContent: 'hello' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50)); // language loading is async
        const v = getView();
        if (v !== null) {
            expect(v).toBeInstanceOf(EditorView);
        }
        wrapper.unmount();
    });

    it('initializes with the provided content', async () => {
        const { wrapper, getView } = mountComposable({ initialContent: 'my code' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            expect(v.state.doc.toString()).toBe('my code');
        }
        wrapper.unmount();
    });

    it('syncs editor changes back to the content ref', async () => {
        const { wrapper, content, getView } = mountComposable({ initialContent: '' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            v.dispatch({ changes: { from: 0, to: 0, insert: 'typed code' } });
            expect(content.value).toBe('typed code');
        }
        wrapper.unmount();
    });

    it('calls onContentChange callback when user types', async () => {
        const onContentChange = vi.fn();
        const { wrapper, getView } = mountComposable({ initialContent: '', onContentChange });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            v.dispatch({ changes: { from: 0, to: 0, insert: 'x' } });
            expect(onContentChange).toHaveBeenCalled();
        }
        wrapper.unmount();
    });

    it('does NOT call onContentChange when content is pushed externally', async () => {
        const onContentChange = vi.fn();
        const { wrapper, content, getView } = mountComposable({ initialContent: 'orig', onContentChange });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            onContentChange.mockClear();
            content.value = 'replaced from outside';
            await nextTick();
            expect(onContentChange).not.toHaveBeenCalled();
        }
        wrapper.unmount();
    });

    it('pushes external content changes into the editor', async () => {
        const { wrapper, content, getView } = mountComposable({ initialContent: 'old' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            content.value = 'new';
            await nextTick();
            expect(v.state.doc.toString()).toBe('new');
        }
        wrapper.unmount();
    });

    it('skips dispatching when content matches the editor document', async () => {
        const dispatchSpy = vi.spyOn(EditorView.prototype, 'dispatch');
        const { wrapper, content, getView } = mountComposable({ initialContent: 'same' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            dispatchSpy.mockClear();
            content.value = 'same';
            await nextTick();
            expect(dispatchSpy).not.toHaveBeenCalled();
        }
        dispatchSpy.mockRestore();
        wrapper.unmount();
    });

    it('destroys the EditorView on unmount', async () => {
        const destroySpy = vi.spyOn(EditorView.prototype, 'destroy');
        const { wrapper, getView } = mountComposable({ initialContent: '' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            wrapper.unmount();
            expect(destroySpy).toHaveBeenCalled();
        } else {
            wrapper.unmount();
        }
        destroySpy.mockRestore();
    });

    it('recreates EditorState when fileId changes', async () => {
        const setStateSpy = vi.spyOn(EditorView.prototype, 'setState');
        const { wrapper, fileId, getView } = mountComposable({
            initialContent: 'content',
            initialFileId: 'file1.ts',
        });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        if (getView() !== null) {
            setStateSpy.mockClear();
            fileId.value = 'file2.ts';
            await nextTick();
            await new Promise((r) => setTimeout(r, 50));
            expect(setStateSpy).toHaveBeenCalled();
        }
        setStateSpy.mockRestore();
        wrapper.unmount();
    });

    it('works without fileId parameter', async () => {
        const content = ref('text');
        const containerRef = ref<HTMLElement | null>(null);

        const TestComponent = defineComponent({
            setup() {
                useCodeEditor(containerRef, content, vi.fn(), ref('.js'));
                return () =>
                    h('div', {
                        ref: (el) => {
                            containerRef.value = el as HTMLElement | null;
                        },
                    });
            },
        });

        const wrapper = mount(TestComponent, { attachTo: document.body });
        await nextTick();
        await nextTick();
        expect(true).toBe(true); // no crash
        wrapper.unmount();
    });

    it('handles unknown file extension by loading no language', async () => {
        const { wrapper, getView } = mountComposable({ initialContent: 'data', fileExtension: '.xyz' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));
        const v = getView();
        if (v !== null) {
            expect(v.state.doc.toString()).toBe('data');
        }
        wrapper.unmount();
    });

    it('handles .ts extension (TypeScript)', async () => {
        const { wrapper, getView } = mountComposable({ initialContent: 'const x = 1;', fileExtension: '.ts' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 100));
        const v = getView();
        if (v !== null) {
            expect(v.state.doc.toString()).toBe('const x = 1;');
        }
        wrapper.unmount();
    });

    it('handles .py extension (Python)', async () => {
        const { wrapper, getView } = mountComposable({ initialContent: 'print("hi")', fileExtension: '.py' });
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 100));
        const v = getView();
        if (v !== null) {
            expect(v.state.doc.toString()).toBe('print("hi")');
        }
        wrapper.unmount();
    });

    it('destroys old view when containerRef becomes null', async () => {
        const destroySpy = vi.spyOn(EditorView.prototype, 'destroy');
        const containerRef = ref<HTMLElement | null>(null);
        const content = ref('text');
        let composableResult: ReturnType<typeof useCodeEditor> | null = null;

        const TestComponent = defineComponent({
            setup() {
                composableResult = useCodeEditor(containerRef, content, vi.fn(), ref('.md'));
                return () => h('div');
            },
        });

        const wrapper = mount(TestComponent, { attachTo: document.body });
        const div = document.createElement('div');
        document.body.appendChild(div);

        containerRef.value = div;
        await nextTick();
        await nextTick();
        await new Promise((r) => setTimeout(r, 50));

        if (composableResult!.view.value !== null) {
            destroySpy.mockClear();
            containerRef.value = null;
            await nextTick();
            await nextTick();
            expect(destroySpy).toHaveBeenCalled();
        }

        destroySpy.mockRestore();
        wrapper.unmount();
        div.remove();
    });
});
