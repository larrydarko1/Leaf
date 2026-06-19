/**
 * useDrawingHistory — undo/redo stack and clipboard operations for the drawing canvas.
 */

import type { Ref, ComputedRef } from 'vue';
import type { CanvasElement } from '@/schemas/drawing';

export function useDrawingHistory(
    elements: Ref<CanvasElement[]>,
    selectedId: Ref<string | null>,
    selectedIds: Ref<Set<string>>,
    selectedElement: ComputedRef<CanvasElement | null>,
    selectedElements: ComputedRef<CanvasElement[]>,
    clipboard: Ref<CanvasElement[]>,
    history: Ref<string[]>,
    historyIndex: Ref<number>,
    scheduleAutoSave: () => void,
    renderScene: () => void,
) {
    // Type guard to validate parsed elements
    function isCanvasElementArray(data: unknown): data is CanvasElement[] {
        if (!Array.isArray(data)) return false;
        return data.every((item) => {
            if (typeof item !== 'object' || item === null) return false;
            const obj = item as Record<string, unknown>;
            return (
                typeof obj.id === 'string' &&
                typeof obj.type === 'string' &&
                typeof obj.x === 'number' &&
                typeof obj.y === 'number' &&
                typeof obj.width === 'number' &&
                typeof obj.height === 'number'
            );
        });
    }

    // History

    function saveToHistory() {
        const snapshot = JSON.stringify(elements.value);
        if (historyIndex.value < history.value.length - 1) {
            history.value = history.value.slice(0, historyIndex.value + 1);
        }
        history.value.push(snapshot);
        historyIndex.value = history.value.length - 1;
        if (history.value.length > 60) {
            history.value.shift();
            historyIndex.value--;
        }
    }

    function undo() {
        if (historyIndex.value <= 0) return;
        historyIndex.value--;
        const historyEntry = history.value[historyIndex.value];
        if (historyEntry === undefined) {
            historyIndex.value = 0;
            return;
        }
        try {
            const parsed = JSON.parse(historyEntry) as unknown;
            if (isCanvasElementArray(parsed)) {
                elements.value = parsed;
                selectedIds.value = new Set();
                scheduleAutoSave();
                renderScene();
            }
        } catch {
            historyIndex.value = 0;
        }
    }

    function redo() {
        if (historyIndex.value >= history.value.length - 1) return;
        historyIndex.value++;
        const historyEntry = history.value[historyIndex.value];
        if (historyEntry === undefined) {
            historyIndex.value = history.value.length - 1;
            return;
        }
        try {
            const parsed = JSON.parse(historyEntry) as unknown;
            if (isCanvasElementArray(parsed)) {
                elements.value = parsed;
                selectedIds.value = new Set();
                scheduleAutoSave();
                renderScene();
            }
        } catch {
            historyIndex.value = history.value.length - 1;
        }
    }

    function clearAll() {
        elements.value = [];
        selectedIds.value = new Set();
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    // Clipboard

    function copySelected() {
        if (selectedElements.value.length === 0) return;
        const serialized = JSON.stringify(selectedElements.value);
        const parsed = JSON.parse(serialized) as unknown;
        if (isCanvasElementArray(parsed)) {
            clipboard.value = parsed;
        }
    }

    function pasteClipboard() {
        if (clipboard.value.length === 0) return;
        const newIds = new Set<string>();
        for (const src of clipboard.value) {
            const serialized = JSON.stringify(src);
            const parsed = JSON.parse(serialized) as unknown;
            if (typeof parsed === 'object' && parsed !== null) {
                const cloned = parsed as Record<string, unknown>;
                const newEl: CanvasElement = {
                    ...(cloned as CanvasElement),
                    id: crypto.randomUUID(),
                    x: typeof src.x === 'number' ? src.x + 20 : 0,
                    y: typeof src.y === 'number' ? src.y + 20 : 0,
                };
                elements.value.push(newEl);
                newIds.add(newEl.id);
            }
        }
        selectedIds.value = newIds;
        // Offset clipboard for subsequent pastes
        clipboard.value = clipboard.value.map((el) => ({
            ...el,
            x: el.x + 20,
            y: el.y + 20,
        }));
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    function duplicateSelected() {
        if (selectedElements.value.length === 0) return;
        copySelected();
        pasteClipboard();
    }

    function deleteSelected() {
        if (selectedIds.value.size === 0) return;
        const idsToDelete = selectedIds.value;
        elements.value = elements.value.filter((el) => !idsToDelete.has(el.id));
        selectedIds.value = new Set();
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    return {
        saveToHistory,
        undo,
        redo,
        clearAll,
        copySelected,
        pasteClipboard,
        duplicateSelected,
        deleteSelected,
    };
}
