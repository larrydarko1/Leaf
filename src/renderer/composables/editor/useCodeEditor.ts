/**
 * useCodeEditor — creates a read-only CodeMirror 6 instance for code file viewing.
 */

import { onUnmounted, watch, type Ref, shallowRef, nextTick } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import {
    EditorView,
    keymap,
    placeholder as cmPlaceholder,
    drawSelection,
    lineNumbers,
    highlightActiveLineGutter,
    highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, indentOnInput, foldGutter, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';
import { leafHighlightStyle } from './useCodemirror';
import { leafCodeEditorTheme } from './cm-theme';

/**
 * Map file extensions to CodeMirror language names for lookup in @codemirror/language-data.
 * Only needed when the extension doesn't directly match what language-data expects.
 */
const EXT_TO_LANG: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.rb': 'ruby',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.swift': 'swift',
    '.php': 'php',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'sass',
    '.sass': 'sass',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.sql': 'sql',
    '.md': 'markdown',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.lua': 'lua',
    '.r': 'r',
    '.R': 'r',
    '.pl': 'perl',
    '.pm': 'perl',
    '.dockerfile': 'dockerfile',
    '.graphql': 'graphql',
    '.gql': 'graphql',
};

/**
 * Resolve a file extension to a CodeMirror language Extension (async loaded).
 */
async function languageForExtension(ext: string): Promise<Extension | null> {
    const langName = EXT_TO_LANG[ext.toLowerCase()];
    if (!langName) return null;

    const desc =
        languages.find((l) => l.name.toLowerCase() === langName.toLowerCase()) ??
        languages.find((l) => l.alias.some((a) => a.toLowerCase() === langName.toLowerCase()));

    if (!desc) return null;

    const support = await desc.load();
    return support;
}

/**
 * CodeMirror 6 composable for editing code files (non-markdown).
 * Provides syntax highlighting, line numbers, bracket matching, and folding.
 */
export function useCodeEditor(
    containerRef: Ref<HTMLElement | null>,
    content: Ref<string>,
    onContentChange: () => void,
    fileExtension: Ref<string>,
    fileId?: Ref<string | null>,
) {
    const view = shallowRef<EditorView | null>(null);
    let updatingFromExternal = false;

    function buildExtensions(langExtension?: Extension | null): Extension[] {
        return [
            // Language support (loaded asynchronously)
            ...(langExtension ? [langExtension] : []),
            syntaxHighlighting(leafHighlightStyle),
            indentOnInput(),
            bracketMatching(),
            foldGutter(),

            // Line numbers and active line
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(),

            // Editing helpers
            history(),
            closeBrackets(),
            drawSelection(),
            highlightSelectionMatches(),
            cmPlaceholder('Start coding...'),

            // Keymaps
            keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),

            // Sync changes back to Vue ref
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !updatingFromExternal) {
                    content.value = update.state.doc.toString();
                    onContentChange();
                }
            }),

            // Theme
            leafCodeEditorTheme,

            // Save keybinding (provided by caller via NoteEditor)
        ];
    }

    async function createEditor(container: HTMLElement) {
        const langExt = await languageForExtension(fileExtension.value);

        const state = EditorState.create({
            doc: content.value,
            extensions: buildExtensions(langExt),
        });

        view.value = new EditorView({
            state,
            parent: container,
        });
    }

    watch(
        containerRef,
        async (container) => {
            if (view.value) {
                view.value.destroy();
                view.value = null;
            }
            if (!container) return;

            await nextTick();
            await createEditor(container);
        },
        { flush: 'post' },
    );

    onUnmounted(() => {
        view.value?.destroy();
        view.value = null;
    });

    // When a different file is loaded, recreate the editor with the new language
    if (fileId) {
        watch(fileId, async () => {
            const v = view.value;
            if (!v) return;

            const langExt = await languageForExtension(fileExtension.value);

            updatingFromExternal = true;
            v.setState(
                EditorState.create({
                    doc: content.value,
                    extensions: buildExtensions(langExt),
                }),
            );
            updatingFromExternal = false;
        });
    }

    // Push external content changes into the editor
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
