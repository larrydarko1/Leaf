import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { type EditorState, type Range, RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ── Widget classes for inline replacements ────────────────────────────────────

class HorizontalRuleWidget extends WidgetType {
    toDOM(): HTMLElement {
        const hr = document.createElement('hr');
        hr.className = 'cm-hr';
        return hr;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return true if the cursor is anywhere inside [from, to]. */
function cursorInRange(state: EditorState, from: number, to: number): boolean {
    const { selection } = state;
    for (const range of selection.ranges) {
        // If any selection overlaps this range, consider it "active"
        if (range.from <= to && range.to >= from) return true;
    }
    return false;
}

/** Get the line numbers that contain any cursor / selection. */
function activeLinesSet(state: EditorState): Set<number> {
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
        const startLine = state.doc.lineAt(range.from).number;
        const endLine = state.doc.lineAt(range.to).number;
        for (let n = startLine; n <= endLine; n++) lines.add(n);
    }
    return lines;
}

// ── Decoration builder ────────────────────────────────────────────────────────

/**
 * Walk the Lezer syntax tree within the given ranges, emitting Decoration
 * items for markdown syntax that's NOT on the currently-focused line.
 * Scoping to viewport ranges keeps large files performant.
 */
function buildDecorations(state: EditorState, visibleRanges: readonly { from: number; to: number }[]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const activeLines = activeLinesSet(state);

    const decos: Range<Decoration>[] = [];

    for (const { from: rangeFrom, to: rangeTo } of visibleRanges) {
        syntaxTree(state).iterate({
            from: rangeFrom,
            to: rangeTo,
            enter(node) {
                const { from, to } = node;
                const name = node.name;

                // Skip nodes that are on the active (focused) line
                const lineFrom = state.doc.lineAt(from).number;
                const lineTo = state.doc.lineAt(to).number;

                // Check if ANY line of this node is active
                let isActive = false;
                for (let ln = lineFrom; ln <= lineTo; ln++) {
                    if (activeLines.has(ln)) {
                        isActive = true;
                        break;
                    }
                }

                // ── Headings ──────────────────────────────────────────────
                if (/^(ATXHeading[1-6])$/.test(name) && !isActive) {
                    const level = parseInt(name.replace('ATXHeading', ''));
                    decos.push(
                        Decoration.line({ class: `cm-heading cm-heading-${level}` }).range(state.doc.lineAt(from).from),
                    );
                    // Hide the # markers
                    const text = state.doc.sliceString(from, to);
                    const markerMatch = text.match(/^(#{1,6})\s/);
                    if (markerMatch) {
                        decos.push(Decoration.replace({}).range(from, from + markerMatch[0].length));
                    }
                }

                // ── Emphasis (italic) ─────────────────────────────────────
                if (name === 'Emphasis' && !isActive) {
                    decos.push(Decoration.mark({ class: 'cm-emphasis' }).range(from, to));
                    // Hide opening marker
                    decos.push(Decoration.replace({}).range(from, from + 1));
                    // Hide closing marker
                    decos.push(Decoration.replace({}).range(to - 1, to));
                }

                // ── Strong (bold) ─────────────────────────────────────────
                if (name === 'StrongEmphasis' && !isActive) {
                    decos.push(Decoration.mark({ class: 'cm-strong' }).range(from, to));
                    // Hide ** markers
                    decos.push(Decoration.replace({}).range(from, from + 2));
                    decos.push(Decoration.replace({}).range(to - 2, to));
                }

                // ── Strikethrough ─────────────────────────────────────────
                if (name === 'Strikethrough' && !isActive) {
                    decos.push(Decoration.mark({ class: 'cm-strikethrough' }).range(from, to));
                    // Hide ~~ markers
                    decos.push(Decoration.replace({}).range(from, from + 2));
                    decos.push(Decoration.replace({}).range(to - 2, to));
                }

                // ── Inline code ───────────────────────────────────────────
                if (name === 'InlineCode' && !isActive) {
                    decos.push(Decoration.mark({ class: 'cm-inline-code' }).range(from, to));
                    // Hide backtick markers
                    decos.push(Decoration.replace({}).range(from, from + 1));
                    decos.push(Decoration.replace({}).range(to - 1, to));
                }

                // ── Code blocks ───────────────────────────────────────────
                if (name === 'FencedCode' && !isActive) {
                    // Style the whole block
                    for (let ln = lineFrom; ln <= lineTo; ln++) {
                        const line = state.doc.line(ln);
                        decos.push(Decoration.line({ class: 'cm-code-block' }).range(line.from));
                    }
                    // Hide the opening ``` line
                    const firstLine = state.doc.line(lineFrom);
                    decos.push(Decoration.replace({}).range(firstLine.from, firstLine.to + 1));
                    // Hide the closing ``` line
                    if (lineTo > lineFrom) {
                        const lastLine = state.doc.line(lineTo);
                        const lastText = lastLine.text.trim();
                        if (lastText === '```' || lastText === '~~~') {
                            decos.push(Decoration.replace({}).range(lastLine.from - 1, lastLine.to));
                        }
                    }
                }

                // ── Blockquote ────────────────────────────────────────────
                if (name === 'Blockquote' && !isActive) {
                    for (let ln = lineFrom; ln <= lineTo; ln++) {
                        if (!activeLines.has(ln)) {
                            const line = state.doc.line(ln);
                            decos.push(Decoration.line({ class: 'cm-blockquote' }).range(line.from));
                            // Hide the > marker
                            const lineText = line.text;
                            const markerMatch = lineText.match(/^(\s*>\s?)/);
                            if (markerMatch) {
                                decos.push(Decoration.replace({}).range(line.from, line.from + markerMatch[0].length));
                            }
                        }
                    }
                }

                // ── Links ─────────────────────────────────────────────────
                if (name === 'Link' && !isActive) {
                    // Get the full text of the link
                    const text = state.doc.sliceString(from, to);
                    const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
                    if (linkMatch) {
                        decos.push(
                            Decoration.mark({
                                class: 'cm-link',
                                attributes: { title: linkMatch[2] },
                            }).range(from, to),
                        );
                        // Hide [
                        decos.push(Decoration.replace({}).range(from, from + 1));
                        // Hide ](url)
                        const closeBracket = from + 1 + linkMatch[1].length;
                        decos.push(Decoration.replace({}).range(closeBracket, to));
                    }
                }

                // ── Images ────────────────────────────────────────────────
                if (name === 'Image' && !isActive) {
                    const text = state.doc.sliceString(from, to);
                    const imgMatch = text.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
                    if (imgMatch) {
                        decos.push(Decoration.mark({ class: 'cm-image-link' }).range(from, to));
                    }
                }

                // ── Horizontal rule ───────────────────────────────────────
                if (name === 'HorizontalRule' && !isActive) {
                    decos.push(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(from, to));
                }

                // ── Bullet list markers ───────────────────────────────────
                if (name === 'ListMark' && !isActive) {
                    const text = state.doc.sliceString(from, to);
                    if (text === '-' || text === '*' || text === '+') {
                        decos.push(Decoration.mark({ class: 'cm-list-bullet' }).range(from, to));
                    }
                }
            },
        });
    } // end for visibleRanges

    // Sort decorations by from position (required by RangeSetBuilder)
    decos.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
    for (const d of decos) {
        builder.add(d.from, d.to, d.value);
    }

    return builder.finish();
}

// ── ViewPlugin export ─────────────────────────────────────────────────────────

export const livePreviewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = buildDecorations(view.state, view.visibleRanges);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged) {
                this.decorations = buildDecorations(update.state, update.view.visibleRanges);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    },
);
