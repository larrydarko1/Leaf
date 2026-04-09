import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { foldable } from '@codemirror/language';
import { taskFoldExtension } from '../../src/renderer/composables/editor/cm-task-fold';

/** Create a minimal EditorState with the task fold extension active. */
function makeState(doc: string): EditorState {
    return EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage }), taskFoldExtension()],
    });
}

/** Get the fold range at a given line number (1-based). */
function foldRangeAt(state: EditorState, lineNumber: number): { from: number; to: number } | null {
    const line = state.doc.line(lineNumber);
    return foldable(state, line.from, line.to);
}

describe('cm-task-fold', () => {
    describe('fold range detection', () => {
        it('identifies a parent task with nested children', () => {
            const state = makeState('- [ ] Parent\n  - [ ] Child 1\n  - [ ] Child 2');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            expect(range!.from).toBe(state.doc.line(1).to); // end of parent line
            expect(range!.to).toBe(state.doc.line(3).to); // end of last child
        });

        it('returns null for a task with no children', () => {
            const state = makeState('- [ ] Solo task\n- [ ] Another task');
            const range = foldRangeAt(state, 1);
            expect(range).toBeNull();
        });

        it('returns null for a non-task line', () => {
            const state = makeState('Just plain text\n  - [ ] Indented task');
            const range = foldRangeAt(state, 1);
            expect(range).toBeNull();
        });

        it('detects deeply nested children', () => {
            const state = makeState('- [ ] Parent\n  - [ ] Child\n    - [ ] Grandchild\n      - [ ] Great-grandchild');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            expect(range!.to).toBe(state.doc.line(4).to);
        });

        it('stops at a sibling task (same indent level)', () => {
            const state = makeState('- [ ] First\n  - [ ] Child\n- [ ] Second\n  - [ ] Other child');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            expect(range!.to).toBe(state.doc.line(2).to); // only "Child", not "Second"
        });

        it('handles checked parent tasks', () => {
            const state = makeState('- [x] Done parent\n  - [x] Done child');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
        });

        it('handles half-checked parent tasks', () => {
            const state = makeState('- [/] Half parent\n  - [ ] Child');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
        });

        it('includes non-task nested content', () => {
            const state = makeState('- [ ] Parent\n  Some indented text\n  More text');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            expect(range!.to).toBe(state.doc.line(3).to);
        });

        it('handles nested child that is also a parent', () => {
            const state = makeState('- [ ] Top\n  - [ ] Middle\n    - [ ] Bottom');
            // Top folds everything
            const topRange = foldRangeAt(state, 1);
            expect(topRange).not.toBeNull();
            expect(topRange!.to).toBe(state.doc.line(3).to);

            // Middle folds only Bottom
            const midRange = foldRangeAt(state, 2);
            expect(midRange).not.toBeNull();
            expect(midRange!.to).toBe(state.doc.line(3).to);
        });

        it('skips empty lines between children', () => {
            const state = makeState('- [ ] Parent\n  - [ ] Child 1\n\n  - [ ] Child 2');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            // Should fold up to Child 2, not stop at empty line
            expect(range!.to).toBe(state.doc.line(4).to);
        });

        it('does not include trailing empty lines', () => {
            const state = makeState('- [ ] Parent\n  - [ ] Child\n\n- [ ] Next');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
            expect(range!.to).toBe(state.doc.line(2).to); // ends at Child, not empty line
        });

        it('handles tab indentation', () => {
            const state = makeState('- [ ] Parent\n\t- [ ] Child');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
        });
    });
});
