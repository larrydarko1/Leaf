import { ref, computed } from 'vue';
import type { CanvasElement, ElementType } from '../../types/drawing';

const HANDLE_SIZE = 8;

let idCounter = 0;
export function genId(): string {
    return `el_${Date.now()}_${idCounter++}`;
}

export function useDrawingElements() {
    const elements = ref<CanvasElement[]>([]);
    const selectedId = ref<string | null>(null);
    const creatingElement = ref<CanvasElement | null>(null);
    const clipboard = ref<CanvasElement | null>(null);

    const selectedElement = computed(() =>
        selectedId.value ? elements.value.find(el => el.id === selectedId.value) ?? null : null
    );

    // ================= Helpers =================

    function isShapeElement(el: CanvasElement): boolean {
        return ['rectangle', 'ellipse', 'diamond', 'triangle',
            'database', 'server', 'user', 'cloud', 'document', 'hexagon', 'parallelogram', 'star'].includes(el.type);
    }

    // ================= Bounds =================

    function getElementBounds(el: CanvasElement) {
        if (el.type === 'freedraw' && el.points && el.points.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of el.points) {
                minX = Math.min(minX, el.x + p.x);
                minY = Math.min(minY, el.y + p.y);
                maxX = Math.max(maxX, el.x + p.x);
                maxY = Math.max(maxY, el.y + p.y);
            }
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return {
            x: Math.min(el.x, el.x + el.width),
            y: Math.min(el.y, el.y + el.height),
            width: Math.abs(el.width),
            height: Math.abs(el.height),
        };
    }

    function getHandlePositions(el: CanvasElement): Record<string, { x: number; y: number }> {
        if (el.type === 'line' || el.type === 'arrow') {
            return {
                start: { x: el.x, y: el.y },
                end: { x: el.x + el.width, y: el.y + el.height },
            };
        }
        const b = getElementBounds(el);
        return {
            nw: { x: b.x, y: b.y },
            ne: { x: b.x + b.width, y: b.y },
            sw: { x: b.x, y: b.y + b.height },
            se: { x: b.x + b.width, y: b.y + b.height },
        };
    }

    // ================= Hit Testing =================

    function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const nx = x1 + t * dx, ny = y1 + t * dy;
        return Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
    }

    function isPointInElement(wx: number, wy: number, el: CanvasElement, threshold: number): boolean {
        const b = getElementBounds(el);
        const t = threshold;
        if (el.type === 'line' || el.type === 'arrow') {
            return distanceToSegment(wx, wy, el.x, el.y, el.x + el.width, el.y + el.height) <= t + el.strokeWidth / 2;
        }
        if (el.type === 'freedraw' && el.points) {
            for (let i = 1; i < el.points.length; i++) {
                const p1 = el.points[i - 1];
                const p2 = el.points[i];
                if (distanceToSegment(wx, wy, el.x + p1.x, el.y + p1.y, el.x + p2.x, el.y + p2.y) <= t + el.strokeWidth / 2) {
                    return true;
                }
            }
            return false;
        }
        return wx >= b.x - t && wx <= b.x + b.width + t && wy >= b.y - t && wy <= b.y + b.height + t;
    }

    function hitTestElement(wx: number, wy: number, zoom: number): CanvasElement | null {
        const threshold = 8 / zoom;
        for (let i = elements.value.length - 1; i >= 0; i--) {
            const el = elements.value[i];
            if (isPointInElement(wx, wy, el, threshold)) return el;
        }
        return null;
    }

    function hitTestHandle(wx: number, wy: number, zoom: number): { elementId: string; handle: string } | null {
        if (!selectedElement.value) return null;
        const handles = getHandlePositions(selectedElement.value);
        const hs = (HANDLE_SIZE + 4) / zoom;
        for (const [name, pos] of Object.entries(handles)) {
            if (Math.abs(wx - pos.x) <= hs / 2 && Math.abs(wy - pos.y) <= hs / 2) {
                return { elementId: selectedElement.value.id, handle: name };
            }
        }
        return null;
    }

    // ================= Element Type Checks =================

    const shapeTools: Array<CanvasElement['type'] | 'select' | 'hand' | 'eraser' | 'freedraw' | 'text'> = [
        'rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow',
        'database', 'server', 'user', 'cloud', 'document', 'hexagon', 'parallelogram', 'star',
    ];

    function isShapeTool(tool: string): tool is ElementType {
        return shapeTools.includes(tool as any);
    }

    return {
        elements,
        selectedId,
        creatingElement,
        clipboard,
        selectedElement,
        isShapeElement,
        getElementBounds,
        getHandlePositions,
        hitTestElement,
        hitTestHandle,
        distanceToSegment,
        isShapeTool,
    };
}
