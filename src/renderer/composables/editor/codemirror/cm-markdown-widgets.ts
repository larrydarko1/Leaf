/**
 * cm-markdown-widgets — CodeMirror 6 ViewPlugin entry point for markdown live-preview.
 * Assembles the interactive extension and decoration plugin from cm-widgets and cm-deco-builders.
 */

import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type EditorState, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { Ref } from 'vue';
import {
    activeLinesSet,
    buildEmbedDecos,
    buildHighlightDecos,
    buildSyntaxDecos,
    buildTaskDecos,
    mergeVisibleRanges,
} from '@/renderer/composables/editor/codemirror/cm-deco-builders';

// ── Interactive extension (links + media controls) ───────────────────────────

/**
 * Handles mousedown on markdown links and media progress bars.
 * Runs as domEventHandlers — fires BEFORE CM6's internal handlers,
 * so returning true prevents CM6 from moving the cursor / rebuilding widgets.
 */
export const interactiveExtension = EditorView.domEventHandlers({
    mousedown(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement;

        // ── Block CM6 from processing clicks inside embed media controls ────
        if (target.closest('.cm-embed-controls') != null) {
            return true;
        }

        // ── Block CM6 for clicks on the video element itself ────────────────
        if (target.closest('.cm-embed-video') != null) {
            return true;
        }

        // ── Link click via syntax tree ──────────────────────────────────────
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) {
            const tree = syntaxTree(view.state);
            let node = tree.resolveInner(pos, 1);
            for (let depth = 0; depth < 10 && node != null; depth++) {
                if (node.name === 'Link') {
                    const text = view.state.doc.sliceString(node.from, node.to);
                    const m = text.match(/\]\(([^)]+)\)$/);
                    if (m != null && (m[1].startsWith('http://') || m[1].startsWith('https://'))) {
                        event.preventDefault();
                        void window.electronAPI.openExternal(m[1]);
                        return true;
                    }
                    break;
                }
                if (node.name === 'URL') {
                    const url = view.state.doc.sliceString(node.from, node.to);
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        event.preventDefault();
                        void window.electronAPI.openExternal(url);
                        return true;
                    }
                    break;
                }
                if (node.parent == null) break;
                node = node.parent;
            }
        }
        return false;
    },
});

// ── Combined plugin ───────────────────────────────────────────────────────────

/**
 * Single unified ViewPlugin for ALL markdown live-preview decorations:
 * syntax-tree (headings, bold, italic, links, code, etc.) and regex
 * (highlights, embeds, tasks). One plugin eliminates overlapping-replace
 * conflicts that occurred with two independent plugins.
 */
export function createMarkdownWidgetsPlugin(
    embedCache: Ref<Map<string, string>>,
    embedCacheVersion: Ref<number>,
    getEmbedMediaType: (fileName: string) => string,
) {
    let lastCacheVersion = embedCacheVersion.value;

    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.build(view.state, view.visibleRanges);
            }

            build(state: EditorState, visibleRanges: readonly { from: number; to: number }[]): DecorationSet {
                try {
                    const activeLines = activeLinesSet(state);

                    // Merge visible ranges so regex scanners don't produce duplicates
                    const merged = mergeVisibleRanges(state, visibleRanges);

                    // 1. Embeds first — they return covered ranges for the syntax walker to skip
                    const { decos: embedDecos, coveredRanges: embedRanges } = buildEmbedDecos(
                        state,
                        merged,
                        activeLines,
                        embedCache.value,
                        getEmbedMediaType,
                    );

                    // 2. Regex-based: highlights and tasks (merged visible ranges)
                    const highlightDecos = buildHighlightDecos(state, merged, activeLines);
                    const taskDecos = buildTaskDecos(state, merged, activeLines);

                    // 3. Syntax-tree: headings, bold, italic, links, etc.
                    const syntaxDecos = buildSyntaxDecos(state, visibleRanges, activeLines, embedRanges);

                    // 4. Merge all, deduplicate, and create DecorationSet
                    const allDecos = [...embedDecos, ...highlightDecos, ...taskDecos, ...syntaxDecos];

                    // Deduplicate: same from+to with same decoration type can crash RangeSetBuilder
                    const seen = new Set<string>();
                    const uniqueDecos: Range<Decoration>[] = [];
                    for (const d of allDecos) {
                        const key = `${d.from}:${d.to}:${d.value.startSide}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniqueDecos.push(d);
                        }
                    }

                    return Decoration.set(uniqueDecos, true);
                } catch (e) {
                    window.electronAPI.log.error('[Leaf] Widget plugin build error:', e);
                    return Decoration.none;
                }
            }

            update(update: ViewUpdate) {
                const cacheChanged = embedCacheVersion.value !== lastCacheVersion;
                if (update.docChanged || update.selectionSet || update.viewportChanged || cacheChanged) {
                    lastCacheVersion = embedCacheVersion.value;
                    this.decorations = this.build(update.state, update.view.visibleRanges);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
            eventHandlers: {
                mousedown(event: MouseEvent, view: EditorView) {
                    const target = event.target as HTMLElement;

                    // ── Task checkbox toggle ──
                    const label = target.closest('.cm-task-label');
                    if (label == null || !(label instanceof HTMLElement)) return;

                    const posStr = label.dataset.taskPos;
                    if (posStr == null) return;

                    event.preventDefault();
                    event.stopPropagation();

                    const taskPos = parseInt(posStr, 10);
                    if (isNaN(taskPos) || taskPos < 0 || taskPos >= view.state.doc.length) return;

                    const line = view.state.doc.lineAt(taskPos);
                    const lineText = line.text;

                    let newLine: string;
                    if (/- \[ \]/.test(lineText)) {
                        newLine = lineText.replace('- [ ]', '- [/]');
                    } else if (/- \[\/\]/.test(lineText)) {
                        newLine = lineText.replace('- [/]', '- [x]');
                    } else if (/- \[x\]/i.test(lineText)) {
                        newLine = lineText.replace(/- \[x\]/i, '- [ ]');
                    } else {
                        return;
                    }

                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: newLine },
                    });
                },
            },
        },
    );
}
