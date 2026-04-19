/**
 * cm-toolbar — CodeMirror-based markdown toolbar commands and keyboard shortcuts.
 */

import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { Ref } from 'vue';

export function useCodemirrorToolbar(view: Ref<EditorView | null>) {
    /** Wrap selection with markers, or insert placeholder text with markers. */
    function wrapSelection(openMarker: string, closeMarker: string, placeholder: string) {
        const v = view.value;
        if (!v) return;
        const { state } = v;
        const { from, to } = state.selection.main;
        const selected = state.sliceDoc(from, to);

        if (selected) {
            const replacement = openMarker + selected + closeMarker;
            v.dispatch({
                changes: { from, to, insert: replacement },
                selection: EditorSelection.range(from, from + replacement.length),
            });
        } else {
            const replacement = openMarker + placeholder + closeMarker;
            v.dispatch({
                changes: { from, to, insert: replacement },
                selection: EditorSelection.range(
                    from + openMarker.length,
                    from + openMarker.length + placeholder.length,
                ),
            });
        }
        v.focus();
    }

    /** Prefix each line in the selection with a string. */
    function prefixLines(prefix: string | ((i: number) => string)) {
        const v = view.value;
        if (!v) return;
        const { state } = v;
        const { from, to } = state.selection.main;

        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);

        const changes: { from: number; to: number; insert: string }[] = [];
        let idx = 0;
        for (let ln = startLine.number; ln <= endLine.number; ln++) {
            const line = state.doc.line(ln);
            const p = typeof prefix === 'function' ? prefix(idx) : prefix;
            changes.push({ from: line.from, to: line.from, insert: p });
            idx++;
        }

        v.dispatch({ changes });
        v.focus();
    }

    function mdFormatText(format: string) {
        const v = view.value;
        if (!v) return;

        switch (format) {
            case 'bold':
                wrapSelection('**', '**', 'bold text');
                break;
            case 'italic':
                wrapSelection('*', '*', 'italic text');
                break;
            case 'strikethrough':
                wrapSelection('~~', '~~', 'strikethrough text');
                break;
            case 'highlight':
                wrapSelection('==', '==', 'highlighted text');
                break;
            case 'code': {
                const { from, to } = v.state.selection.main;
                const selected = v.state.sliceDoc(from, to);
                if (selected.includes('\n')) {
                    const replacement = '```\n' + selected + '\n```';
                    v.dispatch({
                        changes: { from, to, insert: replacement },
                        selection: EditorSelection.range(from, from + replacement.length),
                    });
                } else {
                    wrapSelection('`', '`', 'code');
                }
                v.focus();
                break;
            }
            case 'ul':
                prefixLines('- ');
                break;
            case 'ol':
                prefixLines((i) => `${i + 1}. `);
                break;
            case 'checkbox':
                prefixLines('- [ ] ');
                break;
            case 'quote':
                prefixLines('> ');
                break;
            case 'link': {
                const { from, to } = v.state.selection.main;
                const selected = v.state.sliceDoc(from, to);
                if (selected) {
                    const replacement = `[${selected}](url)`;
                    v.dispatch({
                        changes: { from, to, insert: replacement },
                        // Select "url" for easy replacement
                        selection: EditorSelection.range(from + selected.length + 3, from + selected.length + 6),
                    });
                } else {
                    const replacement = '[link text](url)';
                    v.dispatch({
                        changes: { from, to, insert: replacement },
                        // Select "link text" for easy replacement
                        selection: EditorSelection.range(from + 1, from + 10),
                    });
                }
                v.focus();
                break;
            }
            case 'hr': {
                const { from } = v.state.selection.main;
                v.dispatch({
                    changes: { from, to: from, insert: '\n---\n' },
                });
                v.focus();
                break;
            }
        }
    }

    function mdInsertHeading(event: Event) {
        const v = view.value;
        if (!v) return;

        const select = event.target as HTMLSelectElement;
        const level = parseInt(select.value);
        if (isNaN(level)) return;

        const { from } = v.state.selection.main;
        const line = v.state.doc.lineAt(from);
        const lineText = line.text;

        const stripped = lineText.replace(/^#{1,6}\s*/, '');
        const prefix = '#'.repeat(level) + ' ';
        const newLine = prefix + stripped;

        v.dispatch({
            changes: { from: line.from, to: line.to, insert: newLine },
            selection: EditorSelection.cursor(line.from + newLine.length),
        });

        select.value = '';
        v.focus();
    }

    return { mdFormatText, mdInsertHeading };
}

/**
 * CodeMirror keybindings for markdown formatting shortcuts.
 */
export function markdownKeymap(viewRef: Ref<EditorView | null>) {
    const { mdFormatText } = useCodemirrorToolbar(viewRef);

    return [
        {
            key: 'Mod-b',
            run: () => {
                mdFormatText('bold');
                return true;
            },
        },
        {
            key: 'Mod-i',
            run: () => {
                mdFormatText('italic');
                return true;
            },
        },
        {
            key: 'Mod-k',
            run: () => {
                mdFormatText('link');
                return true;
            },
        },
        {
            key: 'Mod-Shift-h',
            run: () => {
                mdFormatText('highlight');
                return true;
            },
        },
    ];
}
