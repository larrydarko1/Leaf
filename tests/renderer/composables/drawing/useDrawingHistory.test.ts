import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useDrawingHistory } from '@/renderer/composables/drawing/useDrawingHistory';
import type { CanvasElement } from '@/renderer/types/drawing';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEl(id: string, x = 0, y = 0): CanvasElement {
    return {
        id,
        type: 'rectangle',
        x,
        y,
        width: 100,
        height: 100,
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
    };
}

// ── test factory ──────────────────────────────────────────────────────────────

function makeHistory() {
    const elements = ref<CanvasElement[]>([]);
    const selectedId = ref<string | null>(null);
    const selectedIds = ref<Set<string>>(new Set());
    const clipboard = ref<CanvasElement[]>([]);
    // Seed history with an empty-state snapshot so index starts at 0
    const history = ref<string[]>(['[]']);
    const historyIndex = ref(0);
    const scheduleAutoSave = vi.fn();
    const renderScene = vi.fn();

    const selectedElement = computed(() =>
        selectedId.value ? (elements.value.find((el) => el.id === selectedId.value) ?? null) : null,
    );
    const selectedElements = computed(() => elements.value.filter((el) => selectedIds.value.has(el.id)));

    const hist = useDrawingHistory(
        elements,
        selectedId,
        selectedIds,
        selectedElement,
        selectedElements,
        clipboard,
        history,
        historyIndex,
        scheduleAutoSave,
        renderScene,
    );

    return { elements, selectedId, selectedIds, clipboard, history, historyIndex, scheduleAutoSave, renderScene, hist };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useDrawingHistory', () => {
    let ctx: ReturnType<typeof makeHistory>;

    beforeEach(() => {
        ctx = makeHistory();
    });

    // ── saveToHistory ─────────────────────────────────────────────────────────

    describe('saveToHistory', () => {
        it('appends a snapshot to the history stack', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            expect(ctx.history.value).toHaveLength(2);
        });

        it('serialises the current elements as JSON', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            const snapshot = JSON.parse(ctx.history.value[ctx.historyIndex.value]);
            expect(snapshot[0].id).toBe('a');
        });

        it('truncates any forward history when saving mid-stack', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory(); // index 1
            ctx.elements.value = [makeEl('b')];
            ctx.hist.saveToHistory(); // index 2
            ctx.hist.undo(); // back to index 1
            ctx.elements.value = [makeEl('c')];
            ctx.hist.saveToHistory(); // overwrites forward entry
            expect(ctx.historyIndex.value).toBe(ctx.history.value.length - 1);
            // forward entry 'b' should be gone
            const ids = ctx.history.value.map((s) => JSON.parse(s)[0]?.id ?? null);
            expect(ids).not.toContain('b');
        });

        it('caps the history stack at 60 entries', () => {
            for (let i = 0; i < 70; i++) {
                ctx.elements.value = [makeEl(`el-${i}`)];
                ctx.hist.saveToHistory();
            }
            expect(ctx.history.value.length).toBeLessThanOrEqual(60);
        });

        it('keeps historyIndex in sync after capping', () => {
            for (let i = 0; i < 70; i++) {
                ctx.elements.value = [makeEl(`el-${i}`)];
                ctx.hist.saveToHistory();
            }
            expect(ctx.historyIndex.value).toBe(ctx.history.value.length - 1);
        });
    });

    // ── undo ─────────────────────────────────────────────────────────────────

    describe('undo', () => {
        it('restores the previous snapshot', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            ctx.elements.value = [];
            ctx.hist.saveToHistory();
            ctx.hist.undo();
            expect(ctx.elements.value).toHaveLength(1);
            expect(ctx.elements.value[0].id).toBe('a');
        });

        it('does nothing when already at the first entry', () => {
            const before = ctx.historyIndex.value;
            ctx.hist.undo();
            expect(ctx.historyIndex.value).toBe(before);
        });

        it('clears selectedIds after undo', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.undo();
            expect(ctx.selectedIds.value.size).toBe(0);
        });

        it('calls scheduleAutoSave and renderScene', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            ctx.hist.undo();
            expect(ctx.scheduleAutoSave).toHaveBeenCalled();
            expect(ctx.renderScene).toHaveBeenCalled();
        });
    });

    // ── redo ─────────────────────────────────────────────────────────────────

    describe('redo', () => {
        it('re-applies a snapshot that was undone', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            ctx.hist.undo();
            ctx.hist.redo();
            expect(ctx.elements.value).toHaveLength(1);
            expect(ctx.elements.value[0].id).toBe('a');
        });

        it('does nothing when already at the last entry', () => {
            const before = ctx.historyIndex.value;
            ctx.hist.redo();
            expect(ctx.historyIndex.value).toBe(before);
        });

        it('calls scheduleAutoSave and renderScene', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.saveToHistory();
            ctx.hist.undo();
            vi.clearAllMocks();
            ctx.hist.redo();
            expect(ctx.scheduleAutoSave).toHaveBeenCalled();
            expect(ctx.renderScene).toHaveBeenCalled();
        });
    });

    // ── clearAll ─────────────────────────────────────────────────────────────

    describe('clearAll', () => {
        it('removes every element', () => {
            ctx.elements.value = [makeEl('a'), makeEl('b')];
            ctx.hist.clearAll();
            expect(ctx.elements.value).toHaveLength(0);
        });

        it('clears the selection', () => {
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.clearAll();
            expect(ctx.selectedIds.value.size).toBe(0);
        });

        it('saves a new snapshot to history', () => {
            const before = ctx.history.value.length;
            ctx.hist.clearAll();
            expect(ctx.history.value.length).toBeGreaterThan(before);
        });

        it('calls scheduleAutoSave and renderScene', () => {
            ctx.hist.clearAll();
            expect(ctx.scheduleAutoSave).toHaveBeenCalled();
            expect(ctx.renderScene).toHaveBeenCalled();
        });
    });

    // ── copySelected ─────────────────────────────────────────────────────────

    describe('copySelected', () => {
        it('stores selected elements in the clipboard', () => {
            ctx.elements.value = [makeEl('a'), makeEl('b')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            expect(ctx.clipboard.value).toHaveLength(1);
            expect(ctx.clipboard.value[0].id).toBe('a');
        });

        it('is a no-op when nothing is selected', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.copySelected();
            expect(ctx.clipboard.value).toHaveLength(0);
        });

        it('deep-clones elements rather than referencing them', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            ctx.elements.value[0].x = 999;
            expect(ctx.clipboard.value[0].x).toBe(0); // unchanged
        });
    });

    // ── pasteClipboard ────────────────────────────────────────────────────────

    describe('pasteClipboard', () => {
        it('adds offset copies of the clipboard elements', () => {
            ctx.elements.value = [makeEl('a', 10, 20)];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            ctx.hist.pasteClipboard();
            expect(ctx.elements.value).toHaveLength(2);
            const pasted = ctx.elements.value[1];
            expect(pasted.x).toBe(30); // 10 + 20
            expect(pasted.y).toBe(40); // 20 + 20
        });

        it('assigns a unique id to each pasted element', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            ctx.hist.pasteClipboard();
            expect(ctx.elements.value[1].id).not.toBe('a');
        });

        it('updates the clipboard offset so subsequent pastes are staggered', () => {
            ctx.elements.value = [makeEl('a', 0, 0)];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            ctx.hist.pasteClipboard(); // clipboard now at +20,+20
            ctx.hist.pasteClipboard(); // should be at +40,+40
            const third = ctx.elements.value[2];
            expect(third.x).toBe(40);
            expect(third.y).toBe(40);
        });

        it('is a no-op when the clipboard is empty', () => {
            ctx.hist.pasteClipboard();
            expect(ctx.elements.value).toHaveLength(0);
        });

        it('selects only the newly pasted elements', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.copySelected();
            ctx.hist.pasteClipboard();
            // Original 'a' should not be selected after paste
            expect(ctx.selectedIds.value.has('a')).toBe(false);
            expect(ctx.selectedIds.value.size).toBe(1);
        });
    });

    // ── duplicateSelected ─────────────────────────────────────────────────────

    describe('duplicateSelected', () => {
        it('copies and immediately pastes the selected element', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.duplicateSelected();
            expect(ctx.elements.value).toHaveLength(2);
        });

        it('is a no-op when nothing is selected', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.duplicateSelected();
            expect(ctx.elements.value).toHaveLength(1);
        });
    });

    // ── deleteSelected ────────────────────────────────────────────────────────

    describe('deleteSelected', () => {
        it('removes the selected elements', () => {
            ctx.elements.value = [makeEl('a'), makeEl('b'), makeEl('c')];
            ctx.selectedIds.value = new Set(['a', 'c']);
            ctx.hist.deleteSelected();
            expect(ctx.elements.value.map((e) => e.id)).toEqual(['b']);
        });

        it('is a no-op when nothing is selected', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.hist.deleteSelected();
            expect(ctx.elements.value).toHaveLength(1);
        });

        it('clears selectedIds after deletion', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            ctx.hist.deleteSelected();
            expect(ctx.selectedIds.value.size).toBe(0);
        });

        it('saves a history snapshot and calls side-effect callbacks', () => {
            ctx.elements.value = [makeEl('a')];
            ctx.selectedIds.value = new Set(['a']);
            const histBefore = ctx.history.value.length;
            ctx.hist.deleteSelected();
            expect(ctx.history.value.length).toBeGreaterThan(histBefore);
            expect(ctx.scheduleAutoSave).toHaveBeenCalled();
            expect(ctx.renderScene).toHaveBeenCalled();
        });
    });
});
