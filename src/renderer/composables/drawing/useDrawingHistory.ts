import type { Ref, ComputedRef } from 'vue';
import type { CanvasElement } from '../../types/drawing';

export function useDrawingHistory(
    elements: Ref<CanvasElement[]>,
    selectedId: Ref<string | null>,
    selectedElement: ComputedRef<CanvasElement | null>,
    clipboard: Ref<CanvasElement | null>,
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
        selectedId.value = null;
        scheduleAutoSave();
        renderScene();
    }

    function redo() {
        if (historyIndex.value >= history.value.length - 1) return;
        historyIndex.value++;
        elements.value = JSON.parse(history.value[historyIndex.value]);
        selectedId.value = null;
        scheduleAutoSave();
        renderScene();
    }

    function clearAll() {
        elements.value = [];
        selectedId.value = null;
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    // ================= Clipboard =================

    function copySelected() {
        if (!selectedElement.value) return;
        clipboard.value = JSON.parse(JSON.stringify(selectedElement.value));
    }

    function pasteClipboard() {
        if (!clipboard.value) return;
        const newEl: CanvasElement = {
            ...JSON.parse(JSON.stringify(clipboard.value)),
            id: crypto.randomUUID(),
            x: clipboard.value.x + 20,
            y: clipboard.value.y + 20,
        };
        elements.value.push(newEl);
        selectedId.value = newEl.id;
        clipboard.value = {
            ...JSON.parse(JSON.stringify(clipboard.value)),
            x: clipboard.value.x + 20,
            y: clipboard.value.y + 20,
        };
        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }

    function duplicateSelected() {
        if (!selectedElement.value) return;
        copySelected();
        pasteClipboard();
    }

    function deleteSelected() {
        if (!selectedId.value) return;
        elements.value = elements.value.filter((el) => el.id !== selectedId.value);
        selectedId.value = null;
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
