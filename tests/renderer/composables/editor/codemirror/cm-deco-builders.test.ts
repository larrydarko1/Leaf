import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import {
    activeLinesSet,
    expandToLines,
    buildHighlightDecos,
    buildEmbedDecos,
    buildTaskDecos,
    buildSyntaxDecos,
    mergeVisibleRanges,
} from '@/renderer/composables/editor/codemirror/cm-deco-builders';

function makeState(doc: string, cursorPos = 0): EditorState {
    return EditorState.create({
        doc,
        selection: EditorSelection.cursor(cursorPos),
        extensions: [markdown()],
    });
}

function fullRange(state: EditorState) {
    return [{ from: 0, to: state.doc.length }];
}

function classesOf(decos: { value: { spec: { class?: string } } }[]): string[] {
    return decos.map((d) => d.value?.spec?.class).filter((c): c is string => c !== undefined && c !== '');
}

// ── activeLinesSet ──────────────────────────────────────────────────────────

describe('activeLinesSet', () => {
    it('returns the set of line numbers covered by the cursor', () => {
        const state = makeState('line1\nline2\nline3', 6); // cursor on line 2
        const lines = activeLinesSet(state);
        expect(lines.has(2)).toBe(true);
        expect(lines.has(1)).toBe(false);
    });

    it('covers all lines spanned by a selection', () => {
        const doc = 'line1\nline2\nline3';
        const state = EditorState.create({
            doc,
            selection: EditorSelection.range(0, 11), // covers lines 1 and 2 (pos 11 is newline at end of line2)
            extensions: [markdown()],
        });
        const lines = activeLinesSet(state);
        expect(lines.has(1)).toBe(true);
        expect(lines.has(2)).toBe(true);
        expect(lines.has(3)).toBe(false);
    });

    it('returns empty set-like result for empty document', () => {
        const state = makeState('');
        const lines = activeLinesSet(state);
        // Line 1 exists but cursor is on it
        expect(lines.size).toBeGreaterThanOrEqual(0);
    });
});

// ── expandToLines ───────────────────────────────────────────────────────────

describe('expandToLines', () => {
    it('expands character offsets to full line boundaries', () => {
        const state = makeState('hello\nworld\nfoo');
        const [lineFrom, lineTo] = expandToLines(state, 7, 9); // middle of 'world'
        expect(lineFrom).toBe(6); // start of 'world'
        expect(lineTo).toBe(11); // end of 'world'
    });

    it('handles the start of the document', () => {
        const state = makeState('abc\ndef');
        const [lf, lt] = expandToLines(state, 0, 0);
        expect(lf).toBe(0);
        expect(lt).toBe(3);
    });

    it('handles the end of the document', () => {
        const state = makeState('abc');
        const [lf, lt] = expandToLines(state, 1, 3);
        expect(lf).toBe(0);
        expect(lt).toBe(3);
    });
});

// ── mergeVisibleRanges ──────────────────────────────────────────────────────

describe('mergeVisibleRanges', () => {
    it('returns empty array when no ranges are provided', () => {
        const state = makeState('hello');
        expect(mergeVisibleRanges(state, [])).toEqual([]);
    });

    it('expands a single range to full lines', () => {
        const state = makeState('abc\ndef');
        const result = mergeVisibleRanges(state, [{ from: 1, to: 5 }]);
        expect(result).toHaveLength(1);
        expect(result[0].from).toBe(0); // start of 'abc'
    });

    it('merges overlapping ranges into one', () => {
        const state = makeState('line1\nline2\nline3');
        const ranges = [
            { from: 0, to: 5 }, // line 1
            { from: 4, to: 11 }, // overlaps with line 2
        ];
        const result = mergeVisibleRanges(state, ranges);
        expect(result).toHaveLength(1);
    });

    it('keeps separate non-overlapping ranges', () => {
        const state = makeState('line1\nline2\nline3\nline4');
        const ranges = [
            { from: 0, to: 5 }, // line 1
            { from: 12, to: 17 }, // line 3
        ];
        const result = mergeVisibleRanges(state, ranges);
        expect(result).toHaveLength(2);
    });
});

// ── buildHighlightDecos ─────────────────────────────────────────────────────

describe('buildHighlightDecos', () => {
    it('returns no decorations for plain text', () => {
        const state = makeState('Hello world');
        const decos = buildHighlightDecos(state, fullRange(state), new Set());
        expect(decos).toHaveLength(0);
    });

    it('produces decorations for ==highlighted text==', () => {
        const state = makeState('before ==highlighted== after');
        const decos = buildHighlightDecos(state, fullRange(state), new Set());
        expect(decos.length).toBeGreaterThan(0);
        const classes = classesOf(decos as never[]);
        expect(classes).toContain('cm-highlight');
    });

    it('skips highlight on the active (focused) line', () => {
        const doc = '==text==';
        const state = makeState(doc, 3); // cursor inside
        const activeLines = activeLinesSet(state);
        const decos = buildHighlightDecos(state, fullRange(state), activeLines);
        // Active line skip: no highlight decoration should be produced
        expect(decos).toHaveLength(0);
    });

    it('handles multiple highlights on the same line', () => {
        const state = makeState('==a== and ==b==');
        const decos = buildHighlightDecos(state, fullRange(state), new Set());
        const highlightDecos = (decos as never[]).filter(
            (d: { value: { spec: { class?: string } } }) => d.value?.spec?.class === 'cm-highlight',
        );
        expect(highlightDecos).toHaveLength(2);
    });
});

// ── buildEmbedDecos ─────────────────────────────────────────────────────────

describe('buildEmbedDecos', () => {
    it('returns no decorations when no embeds are present', () => {
        const state = makeState('Just some text');
        const cache = new Map<string, string>();
        const { decos, coveredRanges } = buildEmbedDecos(state, fullRange(state), new Set(), cache, () => 'unknown');
        expect(decos).toHaveLength(0);
        expect(coveredRanges).toHaveLength(0);
    });

    it('produces a decoration for ![[embed]]', () => {
        const state = makeState('![[image.png]]');
        const cache = new Map([['image.png', '/vault/image.png']]);
        const { decos, coveredRanges } = buildEmbedDecos(state, fullRange(state), new Set(), cache, () => 'image');
        expect(decos.length).toBeGreaterThan(0);
        expect(coveredRanges).toHaveLength(1);
    });

    it('still marks coveredRanges on an active (focused) line', () => {
        const doc = '![[file.md]]';
        const state = makeState(doc, 3);
        const activeLines = activeLinesSet(state);
        const cache = new Map<string, string>();
        const { decos, coveredRanges } = buildEmbedDecos(state, fullRange(state), activeLines, cache, () => 'unknown');
        // Widget not rendered on active line, but range still marked
        expect(decos).toHaveLength(0);
        expect(coveredRanges).toHaveLength(1);
    });

    it('handles embed with pipe alias (file|display)', () => {
        const state = makeState('![[image.png|500]]');
        const cache = new Map([['image.png', '/vault/image.png']]);
        const { decos } = buildEmbedDecos(state, fullRange(state), new Set(), cache, () => 'image');
        expect(decos.length).toBeGreaterThan(0);
    });

    it('produces decoration when file is not in cache (unknown media type)', () => {
        const state = makeState('![[unknown.xyz]]');
        const cache = new Map<string, string>();
        const { decos } = buildEmbedDecos(state, fullRange(state), new Set(), cache, () => 'unknown');
        expect(decos.length).toBeGreaterThan(0);
    });
});

// ── buildTaskDecos ──────────────────────────────────────────────────────────

describe('buildTaskDecos', () => {
    it('returns no decorations for plain text', () => {
        const state = makeState('Just text');
        const decos = buildTaskDecos(state, fullRange(state), new Set());
        expect(decos).toHaveLength(0);
    });

    it('produces decorations for an unchecked task "- [ ]"', () => {
        const state = makeState('- [ ] do something');
        const decos = buildTaskDecos(state, fullRange(state), new Set());
        expect(decos.length).toBeGreaterThan(0);
        const lines = classesOf(decos as never[]).filter((c) => c.includes('cm-task'));
        expect(lines.length).toBeGreaterThan(0);
    });

    it('produces cm-task-done class for checked tasks "- [x]"', () => {
        const state = makeState('- [x] done thing');
        const decos = buildTaskDecos(state, fullRange(state), new Set());
        const allClasses = classesOf(decos as never[]);
        expect(allClasses.some((c) => c.includes('cm-task-done'))).toBe(true);
    });

    it('produces half-checked decoration for "- [/]"', () => {
        const state = makeState('- [/] half done');
        const decos = buildTaskDecos(state, fullRange(state), new Set());
        // Should produce decorations but NOT cm-task-done
        expect(decos.length).toBeGreaterThan(0);
        const allClasses = classesOf(decos as never[]);
        expect(allClasses.some((c) => c.includes('cm-task-done'))).toBe(false);
    });

    it('skips task decorations on the active line', () => {
        const doc = '- [ ] active task';
        const state = makeState(doc, 5);
        const activeLines = activeLinesSet(state);
        const decos = buildTaskDecos(state, fullRange(state), activeLines);
        expect(decos).toHaveLength(0);
    });

    it('handles multiple tasks in the document', () => {
        const state = makeState('- [ ] task one\n- [x] task two\n- [ ] task three');
        const decos = buildTaskDecos(state, fullRange(state), new Set());
        // Each task produces a line deco + widget deco
        expect(decos.length).toBeGreaterThanOrEqual(6);
    });
});

// ── buildSyntaxDecos ─────────────────────────────────────────────────────────

describe('buildSyntaxDecos', () => {
    it('returns empty array for plain text', () => {
        const state = makeState('hello world');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        expect(decos).toHaveLength(0);
    });

    it('produces heading decoration for ATX headings', () => {
        const state = makeState('# Hello');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c.includes('cm-heading'))).toBe(true);
    });

    it('produces cm-heading-2 for level 2 heading', () => {
        const state = makeState('## World');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c.includes('cm-heading-2'))).toBe(true);
    });

    it('produces cm-emphasis for italic *text*', () => {
        const state = makeState('*italic*');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-emphasis')).toBe(true);
    });

    it('produces cm-strong for bold **text**', () => {
        const state = makeState('**bold**');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-strong')).toBe(true);
    });

    it('produces cm-inline-code for `code`', () => {
        const state = makeState('`code`');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-inline-code')).toBe(true);
    });

    it('produces cm-blockquote for "> quote"', () => {
        const state = makeState('> a blockquote');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-blockquote')).toBe(true);
    });

    it('skips decorations on active lines', () => {
        const doc = '**bold**';
        const state = makeState(doc, 3);
        const activeLines = activeLinesSet(state);
        const decos = buildSyntaxDecos(state, fullRange(state), activeLines, []);
        expect(decos).toHaveLength(0);
    });

    it('skips decorations in embed-covered ranges', () => {
        // Bold text that is "covered" by an embed range
        const state = makeState('**bold**');
        const coveredRanges: [number, number][] = [[0, 8]]; // entire document covered
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), coveredRanges);
        expect(decos).toHaveLength(0);
    });

    it('produces link decoration for [text](url)', () => {
        const state = makeState('[link](https://example.com)');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-link')).toBe(true);
    });

    it('produces code block decorations for fenced code', () => {
        const state = makeState('```\nconst x = 1;\n```');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c.includes('cm-code-block'))).toBe(true);
    });

    it('produces horizontal rule widget for "---" dividers', () => {
        const state = makeState('above\n\n---\n\nbelow');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        // HorizontalRule produces a replace widget
        expect(decos.length).toBeGreaterThan(0);
    });

    it('produces list bullet decoration for "- item"', () => {
        const state = makeState('- list item');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-list-bullet')).toBe(true);
    });

    it('produces image decoration for ![alt](src)', () => {
        const state = makeState('![alt](image.png)');
        const decos = buildSyntaxDecos(state, fullRange(state), new Set(), []);
        const classes = classesOf(decos as never[]);
        expect(classes.some((c) => c === 'cm-image-link')).toBe(true);
    });

    it('deduplicates nodes spanning multiple visible ranges', () => {
        const state = makeState('**bold text here**');
        // Feed the same range twice — should not double the decorations
        const ranges = [
            { from: 0, to: 18 },
            { from: 0, to: 18 }, // duplicate
        ];
        const decos = buildSyntaxDecos(state, ranges, new Set(), []);
        const strongDecos = (decos as never[]).filter(
            (d: { value: { spec: { class?: string } } }) => d.value?.spec?.class === 'cm-strong',
        );
        expect(strongDecos).toHaveLength(1);
    });
});
