import type { Ref, ComputedRef } from 'vue';
import type { CanvasElement } from '../../types/drawing';

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
    // ================= History =================

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
        elements.value = JSON.parse(history.value[historyIndex.value]);
        selectedIds.value = new Set();
        scheduleAutoSave();
        renderScene();
    }

    function redo() {
        if (historyIndex.value >= history.value.length - 1) return;
        historyIndex.value++;
        elements.value = JSON.parse(history.value[historyIndex.value]);
        selectedIds.value = new Set();
        scheduleAutoSave();
        renderScene();
    }

    function clearAll() {
        elements.value = [];
        selectedIds.value = new Set();
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    // ================= Clipboard =================

    function copySelected() {
        if (selectedElements.value.length === 0) return;
        clipboard.value = JSON.parse(JSON.stringify(selectedElements.value));
    }

    function pasteClipboard() {
        if (clipboard.value.length === 0) return;
        const newIds = new Set<string>();
        for (const src of clipboard.value) {
            const newEl: CanvasElement = {
                ...JSON.parse(JSON.stringify(src)),
                id: crypto.randomUUID(),
                x: src.x + 20,
                y: src.y + 20,
            };
            elements.value.push(newEl);
            newIds.add(newEl.id);
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
