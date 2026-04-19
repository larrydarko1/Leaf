/**
 * cm-task-fold — CodeMirror 6 extension that folds completed task items
 * in markdown documents.
 */

import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { type EditorState, type Range } from '@codemirror/state';
import { codeFolding, foldEffect, unfoldEffect, foldedRanges, foldService } from '@codemirror/language';

// ── Fold range detection ──────────────────────────────────────────────────────

const taskLineRegex = /^(\s*)- \[[ x/]\] /i;

/**
 * Determine the fold range for a task item at `lineStart`.
 * A parent task can be folded when the lines immediately following it
 * are indented more deeply (nested children — tasks or plain text).
 * Empty lines between children are included in the fold.
 *
 * Returns `{ from, to }` where `from` is the end of the parent line
 * and `to` is the end of the last nested child line, or `null` if
 * there are no nested children.
 */
function taskFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
    const line = state.doc.lineAt(lineStart);
    const match = line.text.match(taskLineRegex);
    if (!match) return null;

    const parentIndent = match[1].length;
    let lastNonEmptyChildLine = line.number;

    for (let n = line.number + 1; n <= state.doc.lines; n++) {
        const nextLine = state.doc.line(n);
        const trimmed = nextLine.text.trim();

        if (trimmed === '') {
            // Empty line — tentatively include it (might be between children)
            continue;
        }

        const nextIndent = nextLine.text.match(/^(\s*)/)?.[1].length ?? 0;
        if (nextIndent > parentIndent) {
            lastNonEmptyChildLine = n;
        } else {
            break;
        }
    }

    // No actual nested content found
    if (lastNonEmptyChildLine === line.number) return null;

    // Don't include trailing empty lines — fold up to the last real child
    return { from: line.to, to: state.doc.line(lastNonEmptyChildLine).to };
}

// ── Fold service ──────────────────────────────────────────────────────────────

const taskFold = foldService.of((state, lineStart, _lineEnd) => {
    return taskFoldRange(state, lineStart);
});

// ── Fold toggle widget ────────────────────────────────────────────────────────

class TaskFoldToggleWidget extends WidgetType {
    folded: boolean;

    constructor(folded: boolean) {
        super();
        this.folded = folded;
    }

    eq(other: TaskFoldToggleWidget): boolean {
        return this.folded === other.folded;
    }

    toDOM(): HTMLElement {
        const span = document.createElement('span');
        span.className = `cm-task-fold-toggle${this.folded ? ' cm-task-fold-collapsed' : ''}`;
        span.setAttribute('aria-label', this.folded ? 'Expand nested items' : 'Collapse nested items');
        return span;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

// ── Fold toggle ViewPlugin ────────────────────────────────────────────────────

const taskFoldTogglePlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.build(view);
        }

        build(view: EditorView): DecorationSet {
            const decos: Range<Decoration>[] = [];
            const { state } = view;
            const folded = foldedRanges(state);

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = state.doc.lineAt(pos);
                    const range = taskFoldRange(state, line.from);

                    if (range) {
                        let isFolded = false;
                        folded.between(range.from, range.from + 1, () => {
                            isFolded = true;
                        });

                        decos.push(
                            Decoration.widget({
                                widget: new TaskFoldToggleWidget(isFolded),
                                side: -1,
                            }).range(line.from),
                        );
                    }

                    pos = line.to + 1;
                }
            }

            return Decoration.set(decos, true);
        }

        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet ||
                update.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)))
            ) {
                this.decorations = this.build(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
        eventHandlers: {
            mousedown(event: MouseEvent, view: EditorView) {
                const target = event.target as HTMLElement;
                if (!target.classList.contains('cm-task-fold-toggle')) return false;

                event.preventDefault();
                event.stopPropagation();

                const pos = view.posAtDOM(target);
                const line = view.state.doc.lineAt(pos);
                const range = taskFoldRange(view.state, line.from);
                if (!range) return false;

                const folded = foldedRanges(view.state);
                let isFolded = false;
                folded.between(range.from, range.from + 1, () => {
                    isFolded = true;
                });

                if (isFolded) {
                    // Unfold: find the exact fold effect to reverse
                    const effects: ReturnType<typeof unfoldEffect.of>[] = [];
                    folded.between(range.from, range.from + 1, (from, to) => {
                        effects.push(unfoldEffect.of({ from, to }));
                    });
                    if (effects.length) view.dispatch({ effects });
                } else {
                    view.dispatch({
                        effects: [foldEffect.of({ from: range.from, to: range.to })],
                    });
                }

                return true;
            },
        },
    },
);

// ── Combined extension ────────────────────────────────────────────────────────

/**
 * Extension that adds Obsidian-style collapsible nested task lists.
 * Parent task items that have nested children get a fold toggle (▶/▼).
 * Clicking the toggle collapses/expands all nested content.
 */
export function taskFoldExtension() {
    return [
        taskFold,
        codeFolding({
            placeholderDOM(_view, onclick) {
                const span = document.createElement('span');
                span.className = 'cm-task-fold-placeholder';
                span.textContent = '⋯';
                span.title = 'Click to expand';
                span.onclick = onclick;
                return span;
            },
        }),
        taskFoldTogglePlugin,
    ];
}
