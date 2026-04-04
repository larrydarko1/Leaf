import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Ref, shallowRef } from 'vue';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCodemirrorToolbar } from '../../src/renderer/composables/editor/cm-toolbar';

/**
 * Create a minimal EditorView with the given doc text and cursor/selection.
 * `from` and `to` default to the end of the document (cursor at end).
 */
function createView(doc: string, from?: number, to?: number): EditorView {
    const f = from ?? doc.length;
    const t = to ?? f;
    const state = EditorState.create({
        doc,
        selection: EditorSelection.create([EditorSelection.range(f, t)]),
    });
    const view = new EditorView({ state, parent: document.createElement('div') });
    // stub focus so jsdom doesn't throw
    vi.spyOn(view, 'focus').mockImplementation(() => {});
    return view;
}

function doc(view: EditorView): string {
    return view.state.doc.toString();
}

function sel(view: EditorView): { from: number; to: number } {
    const { from, to } = view.state.selection.main;
    return { from, to };
}

describe('useCodemirrorToolbar', () => {
    let viewRef: Ref<EditorView | null>;
    let toolbar: ReturnType<typeof useCodemirrorToolbar>;

    function setup(docText: string, from?: number, to?: number) {
        const view = createView(docText, from, to);
        viewRef.value = view;
        return view;
    }

    beforeEach(() => {
        viewRef = shallowRef<EditorView | null>(null);
        toolbar = useCodemirrorToolbar(viewRef);
    });

    // ── no-op when view is null ──────────────────────────────────────────────
    describe('when view is null', () => {
        it('mdFormatText does not throw', () => {
            expect(() => toolbar.mdFormatText('bold')).not.toThrow();
        });

        it('mdInsertHeading does not throw', () => {
            const event = { target: { value: '2' } } as unknown as Event;
            expect(() => toolbar.mdInsertHeading(event)).not.toThrow();
        });
    });

    // ── bold ─────────────────────────────────────────────────────────────────
    describe('bold', () => {
        it('wraps selected text with **', () => {
            setup('hello world', 6, 11); // select "world"
            toolbar.mdFormatText('bold');
            expect(doc(viewRef.value!)).toBe('hello **world**');
        });

        it('inserts placeholder when no selection', () => {
            setup('hello ', 6);
            toolbar.mdFormatText('bold');
            expect(doc(viewRef.value!)).toBe('hello **bold text**');
            // placeholder "bold text" should be selected
            expect(sel(viewRef.value!)).toEqual({ from: 8, to: 17 });
        });
    });

    // ── italic ───────────────────────────────────────────────────────────────
    describe('italic', () => {
        it('wraps selected text with *', () => {
            setup('hello world', 6, 11);
            toolbar.mdFormatText('italic');
            expect(doc(viewRef.value!)).toBe('hello *world*');
        });

        it('inserts placeholder when no selection', () => {
            setup('', 0);
            toolbar.mdFormatText('italic');
            expect(doc(viewRef.value!)).toBe('*italic text*');
            expect(sel(viewRef.value!)).toEqual({ from: 1, to: 12 });
        });
    });

    // ── strikethrough ────────────────────────────────────────────────────────
    describe('strikethrough', () => {
        it('wraps selected text with ~~', () => {
            setup('remove this', 7, 11);
            toolbar.mdFormatText('strikethrough');
            expect(doc(viewRef.value!)).toBe('remove ~~this~~');
        });

        it('inserts placeholder when no selection', () => {
            setup('', 0);
            toolbar.mdFormatText('strikethrough');
            expect(doc(viewRef.value!)).toBe('~~strikethrough text~~');
        });
    });

    // ── highlight ────────────────────────────────────────────────────────────
    describe('highlight', () => {
        it('wraps selected text with ==', () => {
            setup('important', 0, 9);
            toolbar.mdFormatText('highlight');
            expect(doc(viewRef.value!)).toBe('==important==');
        });

        it('inserts placeholder when no selection', () => {
            setup('', 0);
            toolbar.mdFormatText('highlight');
            expect(doc(viewRef.value!)).toBe('==highlighted text==');
        });
    });

    // ── inline code ──────────────────────────────────────────────────────────
    describe('code (inline)', () => {
        it('wraps single-line selection with backticks', () => {
            setup('const x = 1', 0, 11);
            toolbar.mdFormatText('code');
            expect(doc(viewRef.value!)).toBe('`const x = 1`');
        });

        it('inserts placeholder when no selection', () => {
            setup('', 0);
            toolbar.mdFormatText('code');
            expect(doc(viewRef.value!)).toBe('`code`');
        });
    });

    // ── code block (multiline) ───────────────────────────────────────────────
    describe('code (block)', () => {
        it('wraps multiline selection with fences', () => {
            const text = 'line one\nline two';
            setup(text, 0, text.length);
            toolbar.mdFormatText('code');
            expect(doc(viewRef.value!)).toBe('```\nline one\nline two\n```');
        });
    });

    // ── unordered list ───────────────────────────────────────────────────────
    describe('ul', () => {
        it('prefixes each line with "- "', () => {
            const text = 'apples\noranges\nbananas';
            setup(text, 0, text.length);
            toolbar.mdFormatText('ul');
            expect(doc(viewRef.value!)).toBe('- apples\n- oranges\n- bananas');
        });

        it('prefixes single line at cursor', () => {
            setup('item', 0, 0);
            toolbar.mdFormatText('ul');
            expect(doc(viewRef.value!)).toBe('- item');
        });
    });

    // ── ordered list ─────────────────────────────────────────────────────────
    describe('ol', () => {
        it('prefixes each line with sequential numbers', () => {
            const text = 'first\nsecond\nthird';
            setup(text, 0, text.length);
            toolbar.mdFormatText('ol');
            expect(doc(viewRef.value!)).toBe('1. first\n2. second\n3. third');
        });
    });

    // ── checkbox ─────────────────────────────────────────────────────────────
    describe('checkbox', () => {
        it('prefixes each line with "- [ ] "', () => {
            const text = 'task one\ntask two';
            setup(text, 0, text.length);
            toolbar.mdFormatText('checkbox');
            expect(doc(viewRef.value!)).toBe('- [ ] task one\n- [ ] task two');
        });
    });

    // ── blockquote ───────────────────────────────────────────────────────────
    describe('quote', () => {
        it('prefixes each line with "> "', () => {
            const text = 'line a\nline b';
            setup(text, 0, text.length);
            toolbar.mdFormatText('quote');
            expect(doc(viewRef.value!)).toBe('> line a\n> line b');
        });
    });

    // ── link ─────────────────────────────────────────────────────────────────
    describe('link', () => {
        it('wraps selected text as link text and selects "url"', () => {
            setup('click here', 0, 10);
            toolbar.mdFormatText('link');
            expect(doc(viewRef.value!)).toBe('[click here](url)');
            // "url" should be selected for easy replacement
            expect(sel(viewRef.value!)).toEqual({ from: 13, to: 16 });
        });

        it('inserts full link placeholder when no selection', () => {
            setup('', 0);
            toolbar.mdFormatText('link');
            expect(doc(viewRef.value!)).toBe('[link text](url)');
            // "link text" should be selected
            expect(sel(viewRef.value!)).toEqual({ from: 1, to: 10 });
        });
    });

    // ── horizontal rule ──────────────────────────────────────────────────────
    describe('hr', () => {
        it('inserts --- on a new line', () => {
            setup('above', 5);
            toolbar.mdFormatText('hr');
            expect(doc(viewRef.value!)).toBe('above\n---\n');
        });
    });

    // ── mdInsertHeading ──────────────────────────────────────────────────────
    describe('mdInsertHeading', () => {
        function headingEvent(level: string): Event {
            return { target: { value: level } } as unknown as Event;
        }

        it('inserts a heading prefix on the current line', () => {
            setup('My Title', 0);
            toolbar.mdInsertHeading(headingEvent('2'));
            expect(doc(viewRef.value!)).toBe('## My Title');
        });

        it('replaces an existing heading level', () => {
            setup('### Old Heading', 0);
            toolbar.mdInsertHeading(headingEvent('1'));
            expect(doc(viewRef.value!)).toBe('# Old Heading');
        });

        it('upgrades from h1 to h4', () => {
            setup('# Title', 0);
            toolbar.mdInsertHeading(headingEvent('4'));
            expect(doc(viewRef.value!)).toBe('#### Title');
        });

        it('resets the select value after dispatching', () => {
            const target = { value: '3' };
            setup('text', 0);
            toolbar.mdInsertHeading({ target } as unknown as Event);
            expect(target.value).toBe('');
        });

        it('does nothing for NaN level', () => {
            setup('text', 0);
            toolbar.mdInsertHeading(headingEvent(''));
            expect(doc(viewRef.value!)).toBe('text');
        });
    });
});
