/**
 * useDrawingPersistence — auto-saves drawing state to disk, loads from file,
 * and migrates legacy v1 stroke format to v2 elements.
 */

import { ref, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { CanvasElement, DrawingDataV2, ElementType } from '@/schemas/drawing';

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
        if (autoSaveTimeout !== null) {
            clearTimeout(autoSaveTimeout);
        }
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
        const ctx = getCtx();
        const canvasEl = canvas.value;

        if (content === undefined || content.length === 0 || ctx === null || canvasEl === null) {
            elements.value = [];
            scrollX.value = 0;
            scrollY.value = 0;
            zoom.value = 1;
            history.value = [JSON.stringify([])];
            historyIndex.value = 0;
            hasUnsavedChanges.value = false;
            void nextTick(renderScene);
            return;
        }

        try {
            const parsedData = JSON.parse(content) as unknown;

            if (!isDrawingDataV2(parsedData) && !isV1Data(parsedData)) {
                throw new Error('Invalid drawing data format');
            }

            if (isDrawingDataV2(parsedData)) {
                elements.value = parsedData.elements ?? [];
                scrollX.value = parsedData.viewState?.scrollX ?? 0;
                scrollY.value = parsedData.viewState?.scrollY ?? 0;
                zoom.value = parsedData.viewState?.zoom ?? 1;
            } else if (isV1Data(parsedData)) {
                elements.value = migrateV1(parsedData);
            }

            history.value = [JSON.stringify(elements.value)];
            historyIndex.value = 0;
            hasUnsavedChanges.value = false;
            renderScene();
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            window.electronAPI.log.error('Failed to load drawing:', errorMessage);
            elements.value = [];
            history.value = [JSON.stringify([])];
            historyIndex.value = 0;
            renderScene();
        }
    }

    // Type guards

    function isDrawingDataV2(data: unknown): data is DrawingDataV2 {
        if (typeof data !== 'object' || data === null) return false;
        const obj = data as Record<string, unknown>;
        return (
            typeof obj.version === 'number' &&
            obj.version === 2 &&
            Array.isArray(obj.elements) &&
            typeof obj.viewState === 'object'
        );
    }

    function isV1Data(data: unknown): data is V1Data {
        if (typeof data !== 'object' || data === null) return false;
        const obj = data as Record<string, unknown>;
        return Array.isArray(obj.strokes) || Object.keys(obj).length === 0;
    }

    // Migration

    type V1Stroke = {
        tool: string;
        color: string;
        size: number;
        shape?: { type: string; x1: number; y1: number; x2: number; y2: number; fill?: boolean };
        points?: { x: number; y: number }[];
    };

    type V1Data = {
        strokes?: V1Stroke[];
    };

    function migrateV1(data: V1Data): CanvasElement[] {
        const result: CanvasElement[] = [];
        const strokes = data.strokes;

        if (strokes === undefined || strokes === null) {
            return result;
        }

        for (const stroke of strokes) {
            if (stroke.tool === 'eraser') continue;

            const shape = stroke.shape;

            if (shape !== undefined && shape !== null) {
                const s = shape;
                const isLine = s.type === 'line' || s.type === 'arrow';
                const el: CanvasElement = {
                    id: genId(),
                    type: s.type as ElementType,
                    x: isLine ? s.x1 : Math.min(s.x1, s.x2),
                    y: isLine ? s.y1 : Math.min(s.y1, s.y2),
                    width: isLine ? s.x2 - s.x1 : Math.abs(s.x2 - s.x1),
                    height: isLine ? s.y2 - s.y1 : Math.abs(s.y2 - s.y1),
                    strokeColor: stroke.color,
                    fillColor: shape.fill === true ? stroke.color : 'transparent',
                    strokeWidth: stroke.size,
                    strokeStyle: 'solid',
                    opacity: 1,
                };
                result.push(el);
            }

            const points = stroke.points;
            if (points !== undefined && points !== null && points.length > 1) {
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;

                for (const p of points) {
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
                    points: points.map((p: { x: number; y: number }) => ({
                        x: p.x - minX,
                        y: p.y - minY,
                    })),
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
            if (autoSaveTimeout !== null) {
                clearTimeout(autoSaveTimeout);
            }
        },
    };
}
