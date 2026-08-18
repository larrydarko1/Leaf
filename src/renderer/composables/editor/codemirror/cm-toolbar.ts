/**
 * cm-toolbar — CodeMirror-based markdown toolbar commands and keyboard shortcuts.
 */

import { type EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { Ref } from 'vue';

export function useCodemirrorToolbar(view: Ref<EditorView | null>): {
    mdFormatText: (format: string) => void;
    mdInsertHeading: (event: Event) => void;
} {
    /** Wrap selection with markers, or insert placeholder text with markers. */
    function wrapSelection(openMarker: string, closeMarker: string, placeholder: string): void {
        const editorView = view.value;
        if (editorView === null) return;
        const { state } = editorView;
        const { from, to } = state.selection.main;
        const selected = state.sliceDoc(from, to);

        if (selected !== '') {
            const replacement = openMarker + selected + closeMarker;
            editorView.dispatch({
                changes: { from, to, insert: replacement },
                selection: EditorSelection.range(from, from + replacement.length),
            });
        } else {
            const replacement = openMarker + placeholder + closeMarker;
            editorView.dispatch({
                changes: { from, to, insert: replacement },
                selection: EditorSelection.range(
                    from + openMarker.length,
                    from + openMarker.length + placeholder.length,
                ),
            });
        }
        editorView.focus();
    }

    /** Prefix each line in the selection with a string. */
    function prefixLines(prefix: string | ((i: number) => string)): void {
        const editorView = view.value;
        if (editorView === null) return;
        const { state } = editorView;
        const { from, to } = state.selection.main;

        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);

        const changes: { from: number; to: number; insert: string }[] = [];
        let idx = 0;
        for (let ln = startLine.number; ln <= endLine.number; ln++) {
            const line = state.doc.line(ln);
            const linePrefix = typeof prefix === 'function' ? prefix(idx) : prefix;
            changes.push({ from: line.from, to: line.from, insert: linePrefix });
            idx++;
        }

        editorView.dispatch({ changes });
        editorView.focus();
    }

    function mdFormatText(format: string): void {
        const editorView = view.value;
        if (editorView === null) return;

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
                const { from, to } = editorView.state.selection.main;
                const selected = editorView.state.sliceDoc(from, to);
                if (selected.includes('\n')) {
                    const replacement = '```\n' + selected + '\n```';
                    editorView.dispatch({
                        changes: { from, to, insert: replacement },
                        selection: EditorSelection.range(from, from + replacement.length),
                    });
                } else {
                    wrapSelection('`', '`', 'code');
                }
                editorView.focus();
                break;
            }
            case 'ul':
                prefixLines('- ');
                break;
            case 'ol':
                prefixLines((i): string => `${i + 1}. `);
                break;
            case 'checkbox':
                prefixLines('- [ ] ');
                break;
            case 'quote':
                prefixLines('> ');
                break;
            case 'link': {
                const { from, to } = editorView.state.selection.main;
                const selected = editorView.state.sliceDoc(from, to);
                if (selected !== '') {
                    const replacement = `[${selected}](url)`;
                    editorView.dispatch({
                        changes: { from, to, insert: replacement },
                        // Select "url" for easy replacement
                        selection: EditorSelection.range(from + selected.length + 3, from + selected.length + 6),
                    });
                } else {
                    const replacement = '[link text](url)';
                    editorView.dispatch({
                        changes: { from, to, insert: replacement },
                        // Select "link text" for easy replacement
                        selection: EditorSelection.range(from + 1, from + 10),
                    });
                }
                editorView.focus();
                break;
            }
            case 'hr': {
                const { from } = editorView.state.selection.main;
                editorView.dispatch({
                    changes: { from, to: from, insert: '\n---\n' },
                });
                editorView.focus();
                break;
            }
            case 'table': {
                const { from } = editorView.state.selection.main;
                const line = editorView.state.doc.lineAt(from);
                // Insert after the current line
                const insertAt = line.to;
                const template =
                    '\n\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell     | Cell     | Cell     |\n';
                editorView.dispatch({
                    changes: { from: insertAt, to: insertAt, insert: template },
                    selection: EditorSelection.cursor(insertAt + template.length),
                });
                editorView.focus();
                break;
            }
        }
    }

    function mdInsertHeading(event: Event): void {
        const editorView = view.value;
        if (editorView === null) return;

        const select = event.target as HTMLSelectElement;
        const level = parseInt(select.value);
        if (isNaN(level)) return;

        const { from } = editorView.state.selection.main;
        const line = editorView.state.doc.lineAt(from);
        const lineText = line.text;

        const stripped = lineText.replace(/^#{1,6}\s*/, '');
        const prefix = '#'.repeat(level) + ' ';
        const newLine = prefix + stripped;

        editorView.dispatch({
            changes: { from: line.from, to: line.to, insert: newLine },
            selection: EditorSelection.cursor(line.from + newLine.length),
        });

        select.value = '';
        editorView.focus();
    }

    return { mdFormatText, mdInsertHeading };
}

/**
 * CodeMirror keybindings for markdown formatting shortcuts.
 */
export function markdownKeymap(viewRef: Ref<EditorView | null>): { key: string; run: () => boolean }[] {
    const { mdFormatText } = useCodemirrorToolbar(viewRef);

    return [
        {
            key: 'Mod-b',
            run: (): true => {
                mdFormatText('bold');
                return true;
            },
        },
        {
            key: 'Mod-i',
            run: (): true => {
                mdFormatText('italic');
                return true;
            },
        },
        {
            key: 'Mod-k',
            run: (): true => {
                mdFormatText('link');
                return true;
            },
        },
        {
            key: 'Mod-Shift-h',
            run: (): true => {
                mdFormatText('highlight');
                return true;
            },
        },
    ];
}
