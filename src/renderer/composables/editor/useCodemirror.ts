import { onUnmounted, watch, type Ref, shallowRef, nextTick } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';

/**
 * Custom syntax highlight style that uses the app's accent color for links
 * instead of the browser-default blue/purple. Also ensures raw markdown
 * tokens (visible on the active line) look consistent with the theme.
 */
export const leafHighlightStyle = HighlightStyle.define([
    // Markdown
    { tag: tags.link, color: 'var(--accent-color, #3eb489)' },
    { tag: tags.url, color: 'var(--accent-color, #3eb489)' },
    { tag: tags.heading, fontWeight: '600' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: '600' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.monospace, fontFamily: "'SF Mono', Monaco, Menlo, Consolas, monospace", fontSize: '0.9em' },
    { tag: tags.meta, color: 'var(--text2)' },
    { tag: tags.processingInstruction, color: 'var(--text2)' },

    // Code syntax highlighting
    { tag: tags.keyword, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.controlKeyword, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.operatorKeyword, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.definitionKeyword, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.moduleKeyword, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.operator, color: 'var(--code-operator, #56b6c2)' },
    { tag: tags.string, color: 'var(--code-string, #98c379)' },
    { tag: tags.special(tags.string), color: 'var(--code-string, #98c379)' },
    { tag: tags.number, color: 'var(--code-number, #d19a66)' },
    { tag: tags.integer, color: 'var(--code-number, #d19a66)' },
    { tag: tags.float, color: 'var(--code-number, #d19a66)' },
    { tag: tags.bool, color: 'var(--code-number, #d19a66)' },
    { tag: tags.null, color: 'var(--code-number, #d19a66)' },
    { tag: tags.comment, color: 'var(--code-comment, #5c6370)', fontStyle: 'italic' },
    { tag: tags.lineComment, color: 'var(--code-comment, #5c6370)', fontStyle: 'italic' },
    { tag: tags.blockComment, color: 'var(--code-comment, #5c6370)', fontStyle: 'italic' },
    { tag: tags.docComment, color: 'var(--code-comment, #5c6370)', fontStyle: 'italic' },
    { tag: tags.function(tags.variableName), color: 'var(--code-function, #61afef)' },
    { tag: tags.function(tags.definition(tags.variableName)), color: 'var(--code-function, #61afef)' },
    { tag: tags.definition(tags.variableName), color: 'var(--code-variable, #e06c75)' },
    { tag: tags.variableName, color: 'var(--code-variable, #e06c75)' },
    { tag: tags.definition(tags.propertyName), color: 'var(--code-property, #e06c75)' },
    { tag: tags.propertyName, color: 'var(--code-property, #e06c75)' },
    { tag: tags.typeName, color: 'var(--code-type, #e5c07b)' },
    { tag: tags.className, color: 'var(--code-type, #e5c07b)' },
    { tag: tags.namespace, color: 'var(--code-type, #e5c07b)' },
    { tag: tags.labelName, color: 'var(--code-variable, #e06c75)' },
    { tag: tags.attributeName, color: 'var(--code-attribute, #d19a66)' },
    { tag: tags.attributeValue, color: 'var(--code-string, #98c379)' },
    { tag: tags.tagName, color: 'var(--code-tag, #e06c75)' },
    { tag: tags.angleBracket, color: 'var(--code-bracket, #abb2bf)' },
    { tag: tags.bracket, color: 'var(--code-bracket, #abb2bf)' },
    { tag: tags.paren, color: 'var(--code-bracket, #abb2bf)' },
    { tag: tags.squareBracket, color: 'var(--code-bracket, #abb2bf)' },
    { tag: tags.brace, color: 'var(--code-bracket, #abb2bf)' },
    { tag: tags.regexp, color: 'var(--code-string, #98c379)' },
    { tag: tags.escape, color: 'var(--code-operator, #56b6c2)' },
    { tag: tags.self, color: 'var(--code-keyword, #c678dd)' },
    { tag: tags.atom, color: 'var(--code-number, #d19a66)' },
    { tag: tags.punctuation, color: 'var(--code-punctuation, #abb2bf)' },
    { tag: tags.separator, color: 'var(--code-punctuation, #abb2bf)' },
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
            // Markdown language support (with code block language highlighting)
            markdown({ base: markdownLanguage, codeLanguages: languages }),
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
