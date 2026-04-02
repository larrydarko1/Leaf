import { onUnmounted, watch, type Ref, shallowRef, nextTick } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

/**
 * Custom syntax highlight style that uses the app's accent color for links
 * instead of the browser-default blue/purple. Also ensures raw markdown
 * tokens (visible on the active line) look consistent with the theme.
 */
const leafHighlightStyle = HighlightStyle.define([
    { tag: tags.link, color: 'var(--accent-color, #3eb489)' },
    { tag: tags.url, color: 'var(--accent-color, #3eb489)' },
    { tag: tags.heading, fontWeight: '600' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: '600' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.monospace, fontFamily: "'SF Mono', Monaco, Menlo, Consolas, monospace", fontSize: '0.9em' },
    { tag: tags.meta, color: 'var(--text2)' },
    { tag: tags.processingInstruction, color: 'var(--text2)' },
]);

/**
 * Core CodeMirror 6 composable. Creates and manages an EditorView,
 * keeping a Vue `content` ref in sync with the document.
 *
 * @param containerRef - ref to the DOM element that will host the editor
 * @param content      - reactive content ref (shared with persistence layer)
 * @param onContentChange - callback after any user edit (triggers auto-save, etc.)
 * @param extraExtensions - additional extensions (live-preview, embeds, etc.)
 * @param placeholderText - placeholder when document is empty
 * @param fileId - reactive ref whose value changes when a different file is loaded (triggers full state reset)
 */
export function useCodemirror(
    containerRef: Ref<HTMLElement | null>,
    content: Ref<string>,
    onContentChange: () => void,
    extraExtensions: Extension[] = [],
    placeholderText = 'Start writing...',
    fileId?: Ref<string | null>,
) {
    const view = shallowRef<EditorView | null>(null);

    // Flag to avoid infinite loops when we push content → editor
    let updatingFromExternal = false;

    /** Build the full extension set */
    function buildExtensions(): Extension[] {
        return [
            // Markdown language support
            markdown({ base: markdownLanguage }),
            syntaxHighlighting(leafHighlightStyle),
            indentOnInput(),

            // Editing helpers
            history(),
            closeBrackets(),
            drawSelection(),
            highlightSelectionMatches(),
            cmPlaceholder(placeholderText),

            // Keymaps
            keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),

            // Listen for document changes and sync back to the Vue ref
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !updatingFromExternal) {
                    content.value = update.state.doc.toString();
                    onContentChange();
                }
            }),

            // Line wrapping
            EditorView.lineWrapping,

            // Caller-provided extensions (live-preview, widgets, theme, etc.)
            ...extraExtensions,
        ];
    }

    // Watch the container ref — create the editor when it appears in the DOM
    // (v-if="isMarkdownFile" toggles it), destroy when it disappears.
    watch(
        containerRef,
        async (container, _oldContainer) => {
            // Destroy previous instance if container changed or disappeared
            if (view.value) {
                view.value.destroy();
                view.value = null;
            }
            if (!container) return;

            // Wait for Vue to finish flushing DOM updates
            await nextTick();

            const state = EditorState.create({
                doc: content.value,
                extensions: buildExtensions(),
            });

            view.value = new EditorView({
                state,
                parent: container,
            });
        },
        { flush: 'post' },
    );

    onUnmounted(() => {
        view.value?.destroy();
        view.value = null;
    });

    // When a different file is loaded, recreate the EditorState so the undo
    // history, cursor position, and scroll are all reset cleanly.
    if (fileId) {
        watch(fileId, () => {
            const v = view.value;
            if (!v) return;

            updatingFromExternal = true;
            v.setState(
                EditorState.create({
                    doc: content.value,
                    extensions: buildExtensions(),
                }),
            );
            updatingFromExternal = false;
        });
    }

    // When content ref changes externally (file load, dictation, etc.)
    // push the new content into the editor without firing our own listener.
    watch(content, (newVal) => {
        const v = view.value;
        if (!v) return;

        const current = v.state.doc.toString();
        if (current === newVal) return;

        updatingFromExternal = true;
        v.dispatch({
            changes: { from: 0, to: current.length, insert: newVal },
        });
        updatingFromExternal = false;
    });

    return { view };
}
