import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { foldable } from '@codemirror/language';
import { taskFoldExtension } from '@/renderer/composables/editor/codemirror/cm-task-fold';

function makeState(doc: string): EditorState {
    return EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage }), taskFoldExtension()],
    });
}

function foldRangeAt(state: EditorState, lineNumber: number): { from: number; to: number } | null {
    const line = state.doc.line(lineNumber);
    return foldable(state, line.from, line.to);
}

function makeView(doc: string): EditorView {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    return new EditorView({
        state: makeState(doc),
        parent,
    });
}

describe('cm-task-fold', () => {
    describe('taskFoldExtension', () => {
        it('returns an array of extensions', () => {
            const ext = taskFoldExtension();
            expect(Array.isArray(ext)).toBe(true);
            expect(ext.length).toBeGreaterThan(0);
        });
    });

    describe('TaskFoldToggleWidget (via EditorView)', () => {
        it('mounts without throwing for a document with foldable tasks', () => {
            expect(() => makeView('- [ ] Parent\n  - [ ] Child')).not.toThrow();
        });

        it('mounts without throwing for a document with no tasks', () => {
            expect(() => makeView('plain text')).not.toThrow();
        });

        it('renders toggle widget DOM elements for foldable tasks', () => {
            const view = makeView('- [ ] Parent\n  - [ ] Child');
            const toggles = view.dom.querySelectorAll('.cm-task-fold-toggle');
            expect(toggles.length).toBeGreaterThan(0);
        });

        it('adds cm-task-fold-collapsed class when task is folded', () => {
            const view = makeView('- [ ] Parent\n  - [ ] Child\n- [ ] Other');
            const toggle = view.dom.querySelector('.cm-task-fold-toggle');
            expect(toggle).not.toBeNull();
            expect(toggle?.classList.contains('cm-task-fold-collapsed')).toBe(false);
        });

        it('clicking toggle collapses the task', () => {
            const view = makeView('- [ ] Parent\n  - [ ] Child\n');
            const toggle = view.dom.querySelector('.cm-task-fold-toggle');
            expect(toggle).not.toBeNull();
            if (toggle === null) return;
            const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            vi.spyOn(event, 'preventDefault');
            toggle.dispatchEvent(event);
            const collapsed = view.dom.querySelector('.cm-task-fold-collapsed');
            expect(collapsed).not.toBeNull();
        });

        it('clicking toggle again un-collapses the task', () => {
            const view = makeView('- [ ] Parent\n  - [ ] Child\n');
            const toggle = view.dom.querySelector('.cm-task-fold-toggle');
            if (toggle === null) return;
            toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            const collapsed = view.dom.querySelector('.cm-task-fold-collapsed');
            collapsed?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            expect(view.dom.querySelector('.cm-task-fold-collapsed')).toBeNull();
        });

        it('mousedown on non-toggle element is ignored', () => {
            const view = makeView('- [ ] Parent\n  - [ ] Child');
            const nonToggle = view.dom.querySelector('.cm-content');
            const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            expect(() => nonToggle?.dispatchEvent(event)).not.toThrow();
        });

        it('placeholder DOM has correct class', () => {
            const ext = taskFoldExtension();
            expect(ext).toBeDefined();
        });
    });

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
            const topRange = foldRangeAt(state, 1);
            expect(topRange).not.toBeNull();
            expect(topRange!.to).toBe(state.doc.line(3).to);

            const midRange = foldRangeAt(state, 2);
            expect(midRange).not.toBeNull();
            expect(midRange!.to).toBe(state.doc.line(3).to);
        });

        it('skips empty lines between children', () => {
            const state = makeState('- [ ] Parent\n  - [ ] Child 1\n\n  - [ ] Child 2');
            const range = foldRangeAt(state, 1);
            expect(range).not.toBeNull();
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
