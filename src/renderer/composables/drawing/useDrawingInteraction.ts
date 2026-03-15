import { ref, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { ToolType, ElementType, DragAction, CanvasElement, StrokeStyle } from '../../types/drawing';

const MIN_ELEMENT_SIZE = 3;

interface DefaultStyle {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    borderRadius: number;
}

export function useDrawingInteraction(
    // DOM refs
    canvas: Ref<HTMLCanvasElement | null>,
    containerEl: Ref<HTMLDivElement | null>,
    // View state
    scrollX: Ref<number>,
    scrollY: Ref<number>,
    zoom: Ref<number>,
    // Element state
    elements: Ref<CanvasElement[]>,
    selectedId: Ref<string | null>,
    creatingElement: Ref<CanvasElement | null>,
    selectedElement: ComputedRef<CanvasElement | null>,
    // Element helpers
    isShapeElement: (el: CanvasElement) => boolean,
    isShapeTool: (tool: string) => boolean,
    hitTestElement: (wx: number, wy: number, zoom: number) => CanvasElement | null,
    hitTestHandle: (wx: number, wy: number, zoom: number) => { elementId: string; handle: string } | null,
    genId: () => string,
    // Tool & style state
    currentTool: Ref<ToolType>,
    defaultStyle: Ref<DefaultStyle>,
    // Renderer helpers
    screenToWorld: (sx: number, sy: number) => { x: number; y: number },
    getScreenPoint: (e: PointerEvent | Touch) => { x: number; y: number },
    cssWidth: () => number,
    cssHeight: () => number,
    renderScene: () => void,
    // Text editing callbacks
    textEditing: Ref<boolean>,
    finalizeText: () => void,
    startNewText: (wx: number, wy: number) => void,
    startEditText: (el: CanvasElement) => void,
    startEditShapeText: (el: CanvasElement) => void,
    // History / persistence callbacks
    saveToHistory: () => void,
    scheduleAutoSave: () => void,
    // Action callbacks
    selectTool: (tool: ToolType) => void,
    undo: () => void,
    redo: () => void,
    copySelected: () => void,
    pasteClipboard: () => void,
    duplicateSelected: () => void,
    deleteSelected: () => void,
) {
    // Drag state
    const isDragging = ref(false);
    const dragAction = ref<DragAction>('none');
    const dragStartWorld = ref({ x: 0, y: 0 });
    const dragStartScreen = ref({ x: 0, y: 0 });
    const dragHandle = ref<string | null>(null);
    const dragOriginal = ref<{ x: number; y: number; width: number; height: number } | null>(null);
    const erasedIds = ref<string[]>([]);

    // Keyboard modifier state
    const spaceHeld = ref(false);
    const shiftHeld = ref(false);
    const effectiveTool = computed<ToolType>(() => (spaceHeld.value ? 'hand' : currentTool.value));

    // ================= Pointer Events =================

    function onPointerDown(e: PointerEvent) {
        if (textEditing.value) {
            finalizeText();
            return;
        }
        containerEl.value?.focus();

        const screenPt = getScreenPoint(e);
        const worldPt = screenToWorld(screenPt.x, screenPt.y);
        const tool = effectiveTool.value;

        // Text tool — don't capture pointer (textarea needs focus)
        if (tool === 'text') {
            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit && hit.type === 'text') {
                startEditText(hit);
            } else if (hit && isShapeElement(hit) && hit.text) {
                startEditShapeText(hit);
            } else {
                startNewText(worldPt.x, worldPt.y);
            }
            isDragging.value = false;
            return;
        }

        // Non-text tools: capture pointer for drag
        canvas.value?.setPointerCapture(e.pointerId);
        isDragging.value = true;
        dragStartWorld.value = { ...worldPt };
        dragStartScreen.value = { ...screenPt };

        if (tool === 'hand') {
            dragAction.value = 'pan';
            return;
        }

        if (tool === 'select') {
            const handleHit = hitTestHandle(worldPt.x, worldPt.y, zoom.value);
            if (handleHit) {
                const el = elements.value.find((e) => e.id === handleHit.elementId)!;
                dragAction.value = 'resize';
                dragHandle.value = handleHit.handle;
                dragOriginal.value = { x: el.x, y: el.y, width: el.width, height: el.height };
                return;
            }

            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit) {
                selectedId.value = hit.id;
                dragAction.value = 'move';
                dragOriginal.value = { x: hit.x, y: hit.y, width: hit.width, height: hit.height };
                renderScene();
                return;
            }

            selectedId.value = null;
            dragAction.value = 'none';
            renderScene();
            return;
        }

        if (tool === 'eraser') {
            dragAction.value = 'erase';
            erasedIds.value = [];
            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit) {
                erasedIds.value.push(hit.id);
                elements.value = elements.value.filter((el) => el.id !== hit.id);
                if (selectedId.value === hit.id) selectedId.value = null;
                renderScene();
            }
            return;
        }

        if (tool === 'freedraw') {
            dragAction.value = 'freedraw';
            selectedId.value = null;
            creatingElement.value = {
                id: genId(),
                type: 'freedraw',
                x: worldPt.x,
                y: worldPt.y,
                width: 0,
                height: 0,
                strokeColor: defaultStyle.value.strokeColor,
                fillColor: 'transparent',
                strokeWidth: defaultStyle.value.strokeWidth,
                strokeStyle: defaultStyle.value.strokeStyle,
                opacity: 1,
                points: [{ x: 0, y: 0 }],
            };
            return;
        }

        if (isShapeTool(tool)) {
            dragAction.value = 'create';
            selectedId.value = null;
            creatingElement.value = {
                id: genId(),
                type: tool as ElementType,
                x: worldPt.x,
                y: worldPt.y,
                width: 0,
                height: 0,
                strokeColor: defaultStyle.value.strokeColor,
                fillColor: defaultStyle.value.fillColor,
                strokeWidth: defaultStyle.value.strokeWidth,
                strokeStyle: defaultStyle.value.strokeStyle,
                opacity: 1,
                borderRadius: ['rectangle', 'diamond', 'triangle', 'hexagon', 'parallelogram'].includes(tool)
                    ? defaultStyle.value.borderRadius
                    : undefined,
            };
        }
    }

    function onPointerMove(e: PointerEvent) {
        if (!isDragging.value) return;

        const screenPt = getScreenPoint(e);
        const worldPt = screenToWorld(screenPt.x, screenPt.y);

        switch (dragAction.value) {
            case 'pan': {
                const dx = screenPt.x - dragStartScreen.value.x;
                const dy = screenPt.y - dragStartScreen.value.y;
                scrollX.value += dx;
                scrollY.value += dy;
                dragStartScreen.value = { ...screenPt };
                renderScene();
                break;
            }

            case 'create': {
                if (!creatingElement.value) break;
                let w = worldPt.x - creatingElement.value.x;
                let h = worldPt.y - creatingElement.value.y;
                if (shiftHeld.value) {
                    const constrained = constrainDimensions(creatingElement.value.type, w, h);
                    w = constrained.w;
                    h = constrained.h;
                }
                creatingElement.value.width = w;
                creatingElement.value.height = h;
                renderScene();
                break;
            }

            case 'move': {
                const el = selectedElement.value;
                if (!el || !dragOriginal.value) break;
                const dx = worldPt.x - dragStartWorld.value.x;
                const dy = worldPt.y - dragStartWorld.value.y;
                el.x = dragOriginal.value.x + dx;
                el.y = dragOriginal.value.y + dy;
                renderScene();
                break;
            }

            case 'resize': {
                const el = selectedElement.value;
                if (!el || !dragOriginal.value || !dragHandle.value) break;
                applyResize(el, dragHandle.value, worldPt.x, worldPt.y, dragOriginal.value);
                renderScene();
                break;
            }

            case 'freedraw': {
                if (!creatingElement.value?.points) break;
                const relX = worldPt.x - creatingElement.value.x;
                const relY = worldPt.y - creatingElement.value.y;
                creatingElement.value.points.push({ x: relX, y: relY });
                renderScene();
                break;
            }

            case 'erase': {
                const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
                if (hit && !erasedIds.value.includes(hit.id)) {
                    erasedIds.value.push(hit.id);
                    elements.value = elements.value.filter((el) => el.id !== hit.id);
                    if (selectedId.value === hit.id) selectedId.value = null;
                    renderScene();
                }
                break;
            }
        }
    }

    function onPointerUp(e: PointerEvent) {
        if (!isDragging.value) return;
        canvas.value?.releasePointerCapture(e.pointerId);

        const action = dragAction.value;
        isDragging.value = false;
        dragAction.value = 'none';

        switch (action) {
            case 'create': {
                if (!creatingElement.value) break;
                const el = creatingElement.value;
                if (!['line', 'arrow'].includes(el.type)) {
                    if (el.width < 0) {
                        el.x += el.width;
                        el.width = -el.width;
                    }
                    if (el.height < 0) {
                        el.y += el.height;
                        el.height = -el.height;
                    }
                }
                if (Math.abs(el.width) > MIN_ELEMENT_SIZE || Math.abs(el.height) > MIN_ELEMENT_SIZE) {
                    elements.value.push(el);
                    selectedId.value = el.id;
                    saveToHistory();
                    scheduleAutoSave();
                }
                creatingElement.value = null;
                renderScene();
                break;
            }

            case 'move':
            case 'resize': {
                saveToHistory();
                scheduleAutoSave();
                renderScene();
                break;
            }

            case 'freedraw': {
                if (!creatingElement.value?.points || creatingElement.value.points.length < 2) {
                    creatingElement.value = null;
                    break;
                }
                const pts = creatingElement.value.points;
                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;
                for (const p of pts) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
                creatingElement.value.width = maxX - minX;
                creatingElement.value.height = maxY - minY;
                elements.value.push(creatingElement.value);
                selectedId.value = creatingElement.value.id;
                creatingElement.value = null;
                saveToHistory();
                scheduleAutoSave();
                renderScene();
                break;
            }

            case 'erase': {
                if (erasedIds.value.length > 0) {
                    saveToHistory();
                    scheduleAutoSave();
                }
                erasedIds.value = [];
                break;
            }
        }

        dragOriginal.value = null;
        dragHandle.value = null;
    }

    // ================= Resize Helpers =================

    function applyResize(
        el: CanvasElement,
        handle: string,
        wx: number,
        wy: number,
        orig: { x: number; y: number; width: number; height: number },
    ) {
        if (el.type === 'line' || el.type === 'arrow') {
            if (handle === 'start') {
                const endX = orig.x + orig.width;
                const endY = orig.y + orig.height;
                el.x = wx;
                el.y = wy;
                el.width = endX - wx;
                el.height = endY - wy;
            } else {
                el.width = wx - el.x;
                el.height = wy - el.y;
            }
            return;
        }

        const ox = orig.x,
            oy = orig.y,
            ow = orig.width,
            oh = orig.height;
        switch (handle) {
            case 'nw':
                el.x = wx;
                el.y = wy;
                el.width = ox + ow - wx;
                el.height = oy + oh - wy;
                break;
            case 'ne':
                el.y = wy;
                el.width = wx - ox;
                el.height = oy + oh - wy;
                break;
            case 'sw':
                el.x = wx;
                el.width = ox + ow - wx;
                el.height = wy - oy;
                break;
            case 'se':
                el.width = wx - ox;
                el.height = wy - oy;
                break;
        }
    }

    function constrainDimensions(type: ElementType, w: number, h: number) {
        const squareTypes = ['rectangle', 'ellipse', 'diamond', 'triangle', 'hexagon', 'star'];
        if (squareTypes.includes(type)) {
            const max = Math.max(Math.abs(w), Math.abs(h));
            return { w: Math.sign(w) * max, h: Math.sign(h) * max };
        }
        if (type === 'line' || type === 'arrow') {
            const angle = Math.atan2(h, w);
            const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
            const dist = Math.sqrt(w * w + h * h);
            return { w: dist * Math.cos(snapped), h: dist * Math.sin(snapped) };
        }
        return { w, h };
    }

    // ================= Wheel / Zoom =================

    function onWheel(e: WheelEvent) {
        const screenPt = getScreenPoint(e as unknown as PointerEvent);
        if (e.ctrlKey || e.metaKey) {
            const delta = -e.deltaY * 0.01;
            zoomAtPoint(zoom.value + delta, screenPt.x, screenPt.y);
        } else {
            scrollX.value -= e.deltaX;
            scrollY.value -= e.deltaY;
        }
        renderScene();
    }

    function zoomAtPoint(newZoom: number, sx: number, sy: number) {
        newZoom = Math.max(0.1, Math.min(5, newZoom));
        const oldZoom = zoom.value;
        scrollX.value = sx - (sx - scrollX.value) * (newZoom / oldZoom);
        scrollY.value = sy - (sy - scrollY.value) * (newZoom / oldZoom);
        zoom.value = newZoom;
    }

    function zoomToCenter(newZoom: number) {
        zoomAtPoint(newZoom, cssWidth() / 2, cssHeight() / 2);
        renderScene();
    }

    // ================= Keyboard Events =================

    function handleKeydown(e: KeyboardEvent) {
        if (textEditing.value) return;

        if (e.code === 'Space' && !isDragging.value) {
            e.preventDefault();
            spaceHeld.value = true;
            return;
        }

        if (e.key === 'Shift') {
            shiftHeld.value = true;
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) redo();
            else undo();
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
            e.preventDefault();
            copySelected();
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
            e.preventDefault();
            pasteClipboard();
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
            e.preventDefault();
            duplicateSelected();
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            e.preventDefault();
            return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.value) {
            e.preventDefault();
            deleteSelected();
            return;
        }

        if (e.key === 'Enter' && selectedElement.value) {
            e.preventDefault();
            if (selectedElement.value.type === 'text') {
                startEditText(selectedElement.value);
            } else if (isShapeElement(selectedElement.value)) {
                startEditShapeText(selectedElement.value);
            }
            return;
        }

        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            const toolMap: Record<string, ToolType> = {
                v: 'select',
                '1': 'select',
                h: 'hand',
                '2': 'hand',
                r: 'rectangle',
                '3': 'rectangle',
                d: 'diamond',
                '4': 'diamond',
                o: 'ellipse',
                '5': 'ellipse',
                t: 'triangle',
                a: 'arrow',
                '6': 'arrow',
                l: 'line',
                '7': 'line',
                p: 'freedraw',
                '8': 'freedraw',
                x: 'text',
                '9': 'text',
                e: 'eraser',
                '0': 'eraser',
            };
            const tool = toolMap[e.key.toLowerCase()];
            if (tool) {
                e.preventDefault();
                selectTool(tool);
                return;
            }
        }

        if (e.key === 'Escape') {
            if (selectedId.value) {
                selectedId.value = null;
                renderScene();
            }
            if (isDragging.value && dragAction.value === 'create') {
                creatingElement.value = null;
                isDragging.value = false;
                dragAction.value = 'none';
                renderScene();
            }
        }

        if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            zoomToCenter(zoom.value + 0.1);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === '-') {
            e.preventDefault();
            zoomToCenter(zoom.value - 0.1);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
            e.preventDefault();
            zoomToCenter(1);
        }
    }

    function handleKeyup(e: KeyboardEvent) {
        if (e.code === 'Space') spaceHeld.value = false;
        if (e.key === 'Shift') shiftHeld.value = false;
    }

    return {
        isDragging,
        dragAction,
        spaceHeld,
        shiftHeld,
        effectiveTool,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onWheel,
        zoomAtPoint,
        zoomToCenter,
        handleKeydown,
        handleKeyup,
    };
}
