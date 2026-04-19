/**
 * useDrawingPersistence — auto-saves drawing state to disk, loads from file,
 * and migrates legacy v1 stroke format to v2 elements.
 */

import { ref, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { CanvasElement, DrawingDataV2, ElementType } from '../../types/drawing';

export function useDrawingPersistence(
    canvas: Ref<HTMLCanvasElement | null>,
    initialContent: () => string | undefined,
    elements: Ref<CanvasElement[]>,
    scrollX: Ref<number>,
    scrollY: Ref<number>,
    zoom: Ref<number>,
    history: Ref<string[]>,
    historyIndex: Ref<number>,
    genId: () => string,
    renderScene: () => void,
    getCtx: () => CanvasRenderingContext2D | null,
    onSave: (content: string) => void,
    onContentChanged: (hasChanges: boolean) => void,
) {
    const hasUnsavedChanges = ref(false);
    const isSaving = ref(false);
    let autoSaveTimeout: number | null = null;

    // Auto-save

    function scheduleAutoSave() {
        hasUnsavedChanges.value = true;
        onContentChanged(true);
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = window.setTimeout(saveDrawing, 1000);
    }

    function saveDrawing() {
        const data: DrawingDataV2 = {
            version: 2,
            elements: elements.value,
            viewState: { scrollX: scrollX.value, scrollY: scrollY.value, zoom: zoom.value },
        };
        isSaving.value = true;
        onSave(JSON.stringify(data, null, 2));
        setTimeout(() => {
            isSaving.value = false;
            hasUnsavedChanges.value = false;
            onContentChanged(false);
        }, 300);
    }

    // Load

    function loadDrawing() {
        const content = initialContent();
        if (!content || !getCtx() || !canvas.value) {
            elements.value = [];
            scrollX.value = 0;
            scrollY.value = 0;
            zoom.value = 1;
            history.value = [JSON.stringify([])];
            historyIndex.value = 0;
            hasUnsavedChanges.value = false;
            nextTick(renderScene);
            return;
        }
        try {
            const data = JSON.parse(content);
            if (data.version === 2) {
                elements.value = data.elements || [];
                scrollX.value = data.viewState?.scrollX ?? 0;
                scrollY.value = data.viewState?.scrollY ?? 0;
                zoom.value = data.viewState?.zoom ?? 1;
            } else {
                elements.value = migrateV1(data);
            }
            history.value = [JSON.stringify(elements.value)];
            historyIndex.value = 0;
            hasUnsavedChanges.value = false;
            renderScene();
        } catch (e) {
            window.electronAPI.log.error('Failed to load drawing:', e);
            elements.value = [];
            history.value = [JSON.stringify([])];
            historyIndex.value = 0;
            renderScene();
        }
    }

    // Migration

    interface V1Stroke {
        tool: string;
        color: string;
        size: number;
        shape?: { type: string; x1: number; y1: number; x2: number; y2: number; fill?: boolean };
        points?: { x: number; y: number }[];
    }
    interface V1Data {
        strokes?: V1Stroke[];
    }

    function migrateV1(data: V1Data): CanvasElement[] {
        const result: CanvasElement[] = [];
        if (!data.strokes) return result;

        for (const stroke of data.strokes) {
            if (stroke.tool === 'eraser') continue;

            if (stroke.shape) {
                const s = stroke.shape;
                const isLine = s.type === 'line' || s.type === 'arrow';
                const el: CanvasElement = {
                    id: genId(),
                    type: s.type as ElementType,
                    x: isLine ? s.x1 : Math.min(s.x1, s.x2),
                    y: isLine ? s.y1 : Math.min(s.y1, s.y2),
                    width: isLine ? s.x2 - s.x1 : Math.abs(s.x2 - s.x1),
                    height: isLine ? s.y2 - s.y1 : Math.abs(s.y2 - s.y1),
                    strokeColor: stroke.color,
                    fillColor: s.fill ? stroke.color : 'transparent',
                    strokeWidth: stroke.size,
                    strokeStyle: 'solid',
                    opacity: 1,
                };
                result.push(el);
            } else if (stroke.points && stroke.points.length > 1) {
                let minX = Infinity,
                    minY = Infinity;
                let maxX = -Infinity,
                    maxY = -Infinity;
                for (const p of stroke.points) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
                const el: CanvasElement = {
                    id: genId(),
                    type: 'freedraw',
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    strokeColor: stroke.color,
                    fillColor: 'transparent',
                    strokeWidth: stroke.size,
                    strokeStyle: 'solid',
                    opacity: 1,
                    points: stroke.points.map((p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY })),
                };
                result.push(el);
            }
        }
        return result;
    }

    return {
        hasUnsavedChanges,
        isSaving,
        scheduleAutoSave,
        saveDrawing,
        loadDrawing,
        cleanup: () => {
            if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        },
    };
}
