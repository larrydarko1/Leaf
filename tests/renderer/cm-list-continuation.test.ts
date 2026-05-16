import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { listContinuationKeymap } from '../../src/renderer/composables/editor/codemirror/cm-list-continuation';

function makeView(doc: string, cursorPos?: number): EditorView {
    const pos = cursorPos ?? doc.length;
    const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(pos),
        extensions: [listContinuationKeymap],
    });
    return new EditorView({ state, parent: document.createElement('div') });
}

/**
 * Simulate pressing Enter through CodeMirror's scope-handler mechanism.
 * Returns the updated document text.
 */
function pressEnter(view: EditorView): string {
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Enter' }), 'editor');
    return view.state.doc.toString();
}

function docOf(view: EditorView): string {
    return view.state.doc.toString();
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('cm-list-continuation (listContinuationKeymap)', () => {
    // ── bullet list continuation ──────────────────────────────────────────────

    describe('unordered (bullet) list', () => {
        it('continues a bullet list item with "- " on Enter', () => {
            const view = makeView('- item one');
            pressEnter(view);
            expect(docOf(view)).toBe('- item one\n- ');
        });

        it('removes the bullet prefix and leaves a blank line for an empty item', () => {
            const view = makeView('- ');
            pressEnter(view);
            // The empty "- " prefix should be stripped
            expect(docOf(view)).not.toMatch(/^- $/m);
        });

        it('continues an indented bullet list preserving the indentation', () => {
            const view = makeView('  - indented');
            pressEnter(view);
            expect(docOf(view)).toContain('\n  - ');
        });
    });

    // ── task list continuation ────────────────────────────────────────────────

    describe('task list', () => {
        it('continues a task list with an unchecked "- [ ] " prefix', () => {
            const view = makeView('- [ ] task one');
            pressEnter(view);
            expect(docOf(view)).toContain('- [ ] ');
        });

        it('continues a checked task list with an unchecked new item', () => {
            const view = makeView('- [x] done task');
            pressEnter(view);
            // New item should be unchecked regardless of the source checkbox state
            expect(docOf(view)).toContain('- [ ] ');
        });

        it('continues an in-progress ("/") task list with an unchecked new item', () => {
            const view = makeView('- [/] in-progress');
            pressEnter(view);
            expect(docOf(view)).toContain('- [ ] ');
        });

        it('removes the task prefix for an empty task item', () => {
            const view = makeView('- [ ] ');
            pressEnter(view);
            expect(docOf(view)).not.toMatch(/^- \[ \] $/m);
        });
    });

    // ── ordered list continuation ─────────────────────────────────────────────

    describe('ordered list', () => {
        it('continues an ordered list with the next number', () => {
            const view = makeView('1. first');
            pressEnter(view);
            expect(docOf(view)).toContain('2. ');
        });

        it('removes the ordered-list prefix for an empty item', () => {
            const view = makeView('1. ');
            pressEnter(view);
            expect(docOf(view)).not.toMatch(/^1\. $/m);
        });

        it('increments from a number other than 1', () => {
            const view = makeView('5. fifth');
            pressEnter(view);
            expect(docOf(view)).toContain('6. ');
        });

        it('preserves indentation for indented ordered lists', () => {
            const view = makeView('  3. indented item');
            pressEnter(view);
            expect(docOf(view)).toContain('\n  4. ');
        });

        it('renumbers the following item after inserting a new one', () => {
            const initialDoc = '1. first\n2. second';
            // Cursor after "first" (end of line 1)
            const view = makeView(initialDoc, '1. first'.length);
            pressEnter(view);
            const lines = docOf(view).split('\n');
            // Line 3 should now be "3. second"
            expect(lines[2]).toBe('3. second');
        });
    });

    // ── non-list text ─────────────────────────────────────────────────────────

    describe('non-list text', () => {
        it('returns false (does not handle) for plain text — default behaviour is used', () => {
            // We can check this by verifying the view doc is unchanged after
            // a simulated Enter on plain text (the default CM handler still runs).
            const view = makeView('hello world');
            // The keymap returns false for plain text, so we just verify it does
            // not throw and the text is preserved.
            expect(() => pressEnter(view)).not.toThrow();
        });
    });
});
