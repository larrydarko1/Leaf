/**
 * useDrawingInteraction — handles pointer, wheel, and keyboard events
 * for drawing, selection, dragging, and resizing canvas elements.
 */

import { ref, computed } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import type { Ref, ComputedRef } from 'vue';
import type { ToolType, ElementType, DragAction, CanvasElement, StrokeStyle } from '../../types/drawing';

const MIN_ELEMENT_SIZE = 3;

type DefaultStyle = {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    borderRadius: number;
    fontSize: number;
};

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
    selectedIds: Ref<Set<string>>,
    creatingElement: Ref<CanvasElement | null>,
    selectedElement: ComputedRef<CanvasElement | null>,
    selectedElements: ComputedRef<CanvasElement[]>,
    // Element helpers
    isShapeElement: (el: CanvasElement) => boolean,
    isShapeTool: (tool: string) => boolean,
    hitTestElement: (wx: number, wy: number, zoom: number) => CanvasElement | null,
    hitTestHandle: (wx: number, wy: number, zoom: number) => { elementId: string; handle: string } | null,
    getElementBounds: (el: CanvasElement) => { x: number; y: number; width: number; height: number },
    genId: () => string,
    // Tool & style state
    currentTool: Ref<ToolType>,
    defaultStyle: Ref<DefaultStyle>,
    // Shared marquee state
    marqueeRect: Ref<{ x: number; y: number; width: number; height: number } | null>,
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
    const dragOriginal = ref<{ x: number; y: number; width: number; height: number; fontSize?: number } | null>(null);
    const erasedIds = ref<string[]>([]);

    // Multi-move: stores original positions for all selected elements
    const dragOriginals = ref<Map<string, { x: number; y: number }>>(new Map());

    // Keyboard modifier state
    const spaceHeld = ref(false);
    const shiftHeld = ref(false);
    const effectiveTool = computed<ToolType>(() => (spaceHeld.value ? 'hand' : currentTool.value));

    // Pointer events

    function onPointerDown(e: PointerEvent) {
        if (textEditing.value) {
            finalizeText();
            return;
        }
        const container = containerEl.value;
        if (container !== null) {
            container.focus();
        }

        const screenPt = getScreenPoint(e);
        const worldPt = screenToWorld(screenPt.x, screenPt.y);
        const tool = effectiveTool.value;

        // Text tool — don't capture pointer (textarea needs focus)
        if (tool === 'text') {
            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit !== null && hit.type === 'text') {
                startEditText(hit);
            } else if (hit !== null && isShapeElement(hit) && hit.text !== undefined && hit.text.length > 0) {
                startEditShapeText(hit);
            } else {
                startNewText(worldPt.x, worldPt.y);
            }
            isDragging.value = false;
            return;
        }

        // Non-text tools: capture pointer for drag
        const canvasEl = canvas.value;
        if (canvasEl !== null) {
            canvasEl.setPointerCapture(e.pointerId);
        }
        isDragging.value = true;
        dragStartWorld.value = { ...worldPt };
        dragStartScreen.value = { ...screenPt };

        if (tool === 'hand') {
            dragAction.value = 'pan';
            return;
        }

        if (tool === 'select') {
            // Resize handle only when single selection
            const handleHit = hitTestHandle(worldPt.x, worldPt.y, zoom.value);
            if (handleHit !== null) {
                const el = elements.value.find((e) => e.id === handleHit.elementId);
                if (el !== undefined) {
                    dragAction.value = 'resize';
                    dragHandle.value = handleHit.handle;
                    dragOriginal.value = {
                        x: el.x,
                        y: el.y,
                        width: el.width,
                        height: el.height,
                        fontSize: el.fontSize,
                    };
                    return;
                }
            }

            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit !== null) {
                if (shiftHeld.value) {
                    // Shift-click: toggle element in selection
                    const newSet = new Set(selectedIds.value);
                    if (newSet.has(hit.id)) {
                        newSet.delete(hit.id);
                    } else {
                        newSet.add(hit.id);
                    }
                    selectedIds.value = newSet;
                } else if (!selectedIds.value.has(hit.id)) {
                    // Click on unselected element: select only it
                    selectedIds.value = new Set([hit.id]);
                }
                // Start multi-move for all selected elements
                dragAction.value = 'move';
                dragOriginals.value = new Map();
                for (const sel of selectedElements.value) {
                    dragOriginals.value.set(sel.id, { x: sel.x, y: sel.y });
                }
                renderScene();
                return;
            }

            // Click on empty space: start marquee or clear selection
            if (!shiftHeld.value) {
                selectedIds.value = new Set();
            }
            dragAction.value = 'marquee';
            marqueeRect.value = { x: worldPt.x, y: worldPt.y, width: 0, height: 0 };
            renderScene();
            return;
        }

        if (tool === 'eraser') {
            dragAction.value = 'erase';
            erasedIds.value = [];
            const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
            if (hit !== null) {
                erasedIds.value.push(hit.id);
                elements.value = elements.value.filter((el) => el.id !== hit.id);
                if (selectedId.value === hit.id) {
                    selectedId.value = null;
                }
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
                const creating = creatingElement.value;
                if (creating === null) break;
                let w = worldPt.x - creating.x;
                let h = worldPt.y - creating.y;
                if (shiftHeld.value) {
                    const constrained = constrainDimensions(creating.type, w, h);
                    w = constrained.w;
                    h = constrained.h;
                }
                creating.width = w;
                creating.height = h;
                renderScene();
                break;
            }

            case 'move': {
                if (dragOriginals.value.size === 0) break;
                const dx = worldPt.x - dragStartWorld.value.x;
                const dy = worldPt.y - dragStartWorld.value.y;
                for (const el of selectedElements.value) {
                    const orig = dragOriginals.value.get(el.id);
                    if (orig !== undefined) {
                        el.x = orig.x + dx;
                        el.y = orig.y + dy;
                    }
                }
                renderScene();
                break;
            }

            case 'resize': {
                const el = selectedElement.value;
                if (el === null || dragOriginal.value === null || dragHandle.value === null) break;
                applyResize(el, dragHandle.value, worldPt.x, worldPt.y, dragOriginal.value);
                renderScene();
                break;
            }

            case 'freedraw': {
                const creating = creatingElement.value;
                if (creating === null || creating.points === undefined) break;
                const relX = worldPt.x - creating.x;
                const relY = worldPt.y - creating.y;
                creating.points.push({ x: relX, y: relY });
                renderScene();
                break;
            }

            case 'erase': {
                const hit = hitTestElement(worldPt.x, worldPt.y, zoom.value);
                if (hit !== null && !erasedIds.value.includes(hit.id)) {
                    erasedIds.value.push(hit.id);
                    elements.value = elements.value.filter((el) => el.id !== hit.id);
                    if (selectedIds.value.has(hit.id)) {
                        const newSet = new Set(selectedIds.value);
                        newSet.delete(hit.id);
                        selectedIds.value = newSet;
                    }
                    renderScene();
                }
                break;
            }

            case 'marquee': {
                const marquee = marqueeRect.value;
                if (marquee === null) break;
                marquee.width = worldPt.x - marquee.x;
                marquee.height = worldPt.y - marquee.y;
                // Find elements inside marquee
                const mx = Math.min(marquee.x, marquee.x + marquee.width);
                const my = Math.min(marquee.y, marquee.y + marquee.height);
                const mw = Math.abs(marquee.width);
                const mh = Math.abs(marquee.height);
                const newSet = shiftHeld.value ? new Set(selectedIds.value) : new Set<string>();
                for (const el of elements.value) {
                    const b = getElementBounds(el);
                    if (b.x >= mx && b.y >= my && b.x + b.width <= mx + mw && b.y + b.height <= my + mh) {
                        newSet.add(el.id);
                    }
                }
                selectedIds.value = newSet;
                renderScene();
                break;
            }
        }
    }

    function onPointerUp(e: PointerEvent) {
        if (!isDragging.value) return;
        const canvasEl = canvas.value;
        if (canvasEl !== null) {
            canvasEl.releasePointerCapture(e.pointerId);
        }

        const action = dragAction.value;
        isDragging.value = false;
        dragAction.value = 'none';

        switch (action) {
            case 'create': {
                const creating = creatingElement.value;
                if (creating === null) break;
                const el = creating;
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
                const creating = creatingElement.value;
                if (creating === null || creating.points === undefined || creating.points.length < 2) {
                    creatingElement.value = null;
                    break;
                }
                const pts = creating.points;
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                for (const p of pts) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
                creating.width = maxX - minX;
                creating.height = maxY - minY;
                elements.value.push(creating);
                selectedId.value = creating.id;
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

            case 'marquee': {
                marqueeRect.value = null;
                renderScene();
                break;
            }
        }

        dragOriginal.value = null;
        dragHandle.value = null;
        dragOriginals.value = new Map();
    }

    // Resize helpers

    function applyResize(
        el: CanvasElement,
        handle: string,
        wx: number,
        wy: number,
        orig: { x: number; y: number; width: number; height: number; fontSize?: number },
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

        const ox = orig.x;
        const oy = orig.y;
        const ow = orig.width;
        const oh = orig.height;
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

        // Scale font size proportionally for text elements
        const origFontSize = orig.fontSize;
        if ((el.type === 'text' || el.text !== undefined) && origFontSize !== undefined) {
            const scaleW = ow !== 0 ? Math.abs(el.width) / Math.abs(ow) : 1;
            const scaleH = oh !== 0 ? Math.abs(el.height) / Math.abs(oh) : 1;
            const scale = Math.max(scaleW, scaleH);
            const newFs = Math.max(8, Math.round(origFontSize * scale));
            el.fontSize = newFs;

            // Recalculate text bounds to match the new font size
            if (el.type === 'text' && el.text !== undefined && el.text.length > 0) {
                const canvasEl = canvas.value;
                if (canvasEl !== null) {
                    const ctx = canvasEl.getContext('2d');
                    if (ctx !== null) {
                        ctx.save();
                        ctx.font = `${newFs}px "Helvetica", "Segoe UI", sans-serif`;
                        const lines = el.text.split('\n');
                        const lh = newFs * 1.3;
                        let maxW = 0;
                        for (const line of lines) {
                            maxW = Math.max(maxW, ctx.measureText(line).width);
                        }
                        ctx.restore();
                        el.width = maxW;
                        el.height = lines.length * lh;
                    }
                }
            }
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

    // Wheel and zoom

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

    // Keyboard events

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
            selectedIds.value = new Set(elements.value.map((el) => el.id));
            renderScene();
            return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.value.size > 0) {
            e.preventDefault();
            deleteSelected();
            return;
        }

        if (e.key === 'Enter' && selectedElement.value !== null) {
            e.preventDefault();
            const sel = selectedElement.value;
            if (sel.type === 'text') {
                startEditText(sel);
            } else if (isShapeElement(sel)) {
                startEditShapeText(sel);
            }
            return;
        }

        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            const toolMap: Record<string, ToolType> = {
                'v': 'select',
                '1': 'select',
                'h': 'hand',
                '2': 'hand',
                'r': 'rectangle',
                '3': 'rectangle',
                'd': 'diamond',
                '4': 'diamond',
                'o': 'ellipse',
                '5': 'ellipse',
                't': 'triangle',
                'a': 'arrow',
                '6': 'arrow',
                'l': 'line',
                '7': 'line',
                'p': 'freedraw',
                '8': 'freedraw',
                'x': 'text',
                '9': 'text',
                'e': 'eraser',
                '0': 'eraser',
            };
            const tool = toolMap[e.key.toLowerCase()];
            if (tool !== undefined) {
                e.preventDefault();
                selectTool(tool);
                return;
            }
        }

        if (e.key === 'Escape') {
            if (selectedIds.value.size > 0) {
                selectedIds.value = new Set();
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

    // Create and store throttled onPointerMove so it can be properly cancelled on cleanup
    type ThrottledPointerMoveFn = ((e: PointerEvent) => void) & { cancel?: () => void };
    const throttledPointerMove = useThrottleFn(onPointerMove, 16) as unknown as ThrottledPointerMoveFn;

    // Throttle wheel event — fires at most every 16ms to prevent excessive zoom/scroll updates
    type ThrottledWheelFn = ((e: WheelEvent) => void) & { cancel?: () => void };
    const throttledOnWheel = useThrottleFn(onWheel, 16) as unknown as ThrottledWheelFn;

    return {
        isDragging,
        dragAction,
        spaceHeld,
        shiftHeld,
        effectiveTool,
        onPointerDown,
        onPointerMove: throttledPointerMove,
        onPointerUp,
        onWheel: throttledOnWheel,
        zoomAtPoint,
        zoomToCenter,
        handleKeydown,
        handleKeyup,
    };
}
