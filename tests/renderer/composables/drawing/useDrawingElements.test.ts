import { describe, it, expect, beforeEach } from 'vitest';
import { useDrawingElements } from '@/renderer/composables/drawing/useDrawingElements';
import type { CanvasElement } from '@/renderer/types/drawing';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEl(id: string, overrides: Partial<CanvasElement> = {}): CanvasElement {
    return {
        id,
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        ...overrides,
    };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useDrawingElements', () => {
    let d: ReturnType<typeof useDrawingElements>;

    beforeEach(() => {
        d = useDrawingElements();
    });

    // ── initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('starts with an empty element list', () => {
            expect(d.elements.value).toHaveLength(0);
        });

        it('starts with selectedId null', () => {
            expect(d.selectedId.value).toBeNull();
        });

        it('starts with selectedElement null', () => {
            expect(d.selectedElement.value).toBeNull();
        });

        it('starts with an empty selectedIds set', () => {
            expect(d.selectedIds.value.size).toBe(0);
        });
    });

    // ── selectedId / selectedElement ──────────────────────────────────────────

    describe('selectedId / selectedElement', () => {
        it('resolves selectedElement from selectedId', () => {
            d.elements.value = [makeEl('a')];
            d.selectedId.value = 'a';
            expect(d.selectedElement.value?.id).toBe('a');
        });

        it('selectedElement is null when selectedId is null', () => {
            d.elements.value = [makeEl('a')];
            d.selectedId.value = 'a';
            d.selectedId.value = null;
            expect(d.selectedElement.value).toBeNull();
        });

        it('setting selectedId updates selectedIds (backward compat)', () => {
            d.selectedId.value = 'a';
            expect(d.selectedIds.value.has('a')).toBe(true);
        });

        it('setting selectedId to null clears selectedIds', () => {
            d.selectedId.value = 'a';
            d.selectedId.value = null;
            expect(d.selectedIds.value.size).toBe(0);
        });
    });

    // ── selectedElements ──────────────────────────────────────────────────────

    describe('selectedElements', () => {
        it('returns all elements whose ids are in selectedIds', () => {
            d.elements.value = [makeEl('a'), makeEl('b'), makeEl('c')];
            d.selectedIds.value = new Set(['a', 'c']);
            expect(d.selectedElements.value.map((e) => e.id)).toEqual(['a', 'c']);
        });

        it('returns an empty array when nothing is selected', () => {
            d.elements.value = [makeEl('a')];
            expect(d.selectedElements.value).toHaveLength(0);
        });
    });

    // ── getElementBounds ──────────────────────────────────────────────────────

    describe('getElementBounds', () => {
        it('returns the exact bounds for a normal rectangle', () => {
            const el = makeEl('a', { x: 10, y: 20, width: 50, height: 30 });
            expect(d.getElementBounds(el)).toEqual({ x: 10, y: 20, width: 50, height: 30 });
        });

        it('normalises negative width', () => {
            const el = makeEl('a', { x: 100, y: 50, width: -40, height: 20 });
            const b = d.getElementBounds(el);
            expect(b.x).toBe(60);
            expect(b.width).toBe(40);
        });

        it('normalises negative height', () => {
            const el = makeEl('a', { x: 50, y: 100, width: 30, height: -30 });
            const b = d.getElementBounds(el);
            expect(b.y).toBe(70);
            expect(b.height).toBe(30);
        });

        it('computes bounds from freedraw points', () => {
            const el = makeEl('a', {
                type: 'freedraw',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                points: [
                    { x: 5, y: 10 },
                    { x: 20, y: 30 },
                    { x: 15, y: 5 },
                ],
            });
            const b = d.getElementBounds(el);
            expect(b.x).toBe(5);
            expect(b.y).toBe(5);
            expect(b.width).toBe(15);
            expect(b.height).toBe(25);
        });

        it('applies x/y offset to freedraw points', () => {
            const el = makeEl('a', {
                type: 'freedraw',
                x: 100,
                y: 200,
                width: 0,
                height: 0,
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            });
            const b = d.getElementBounds(el);
            expect(b.x).toBe(100);
            expect(b.y).toBe(200);
        });
    });

    // ── hitTestElement ────────────────────────────────────────────────────────

    describe('hitTestElement', () => {
        it('returns an element when the point is inside it', () => {
            d.elements.value = [makeEl('a', { x: 0, y: 0, width: 100, height: 100 })];
            expect(d.hitTestElement(50, 50, 1)?.id).toBe('a');
        });

        it('returns null when the point is outside all elements', () => {
            d.elements.value = [makeEl('a', { x: 0, y: 0, width: 50, height: 50 })];
            expect(d.hitTestElement(200, 200, 1)).toBeNull();
        });

        it('returns the topmost (last-added) element when two overlap', () => {
            d.elements.value = [
                makeEl('bottom', { x: 0, y: 0, width: 100, height: 100 }),
                makeEl('top', { x: 0, y: 0, width: 100, height: 100 }),
            ];
            expect(d.hitTestElement(50, 50, 1)?.id).toBe('top');
        });

        it('returns null when the element array is empty', () => {
            expect(d.hitTestElement(50, 50, 1)).toBeNull();
        });

        it('accepts a threshold hit at the edge of an element', () => {
            // threshold = 8/zoom. With zoom=1, threshold=8. Point is 4px outside.
            d.elements.value = [makeEl('a', { x: 10, y: 10, width: 100, height: 100 })];
            expect(d.hitTestElement(106, 60, 1)?.id).toBe('a');
        });
    });

    // ── hitTestHandle ─────────────────────────────────────────────────────────

    describe('hitTestHandle', () => {
        it('returns null when no element is selected', () => {
            d.elements.value = [makeEl('a', { x: 0, y: 0, width: 100, height: 100 })];
            expect(d.hitTestHandle(0, 0, 1)).toBeNull();
        });

        it('returns the handle name when the point is on a corner handle', () => {
            const el = makeEl('a', { x: 0, y: 0, width: 100, height: 100 });
            d.elements.value = [el];
            d.selectedId.value = 'a';
            // NW handle is at (0,0)
            const result = d.hitTestHandle(0, 0, 1);
            expect(result?.handle).toBe('nw');
            expect(result?.elementId).toBe('a');
        });

        it('returns null when the point is not near any handle', () => {
            const el = makeEl('a', { x: 0, y: 0, width: 100, height: 100 });
            d.elements.value = [el];
            d.selectedId.value = 'a';
            expect(d.hitTestHandle(50, 50, 1)).toBeNull();
        });
    });

    // ── getHandlePositions ────────────────────────────────────────────────────

    describe('getHandlePositions', () => {
        it('returns four corner handles for a rectangle', () => {
            const el = makeEl('a', { x: 0, y: 0, width: 100, height: 80 });
            const handles = d.getHandlePositions(el);
            expect(Object.keys(handles).sort()).toEqual(['ne', 'nw', 'se', 'sw']);
        });

        it('returns start/end handles for a line element', () => {
            const el = makeEl('a', { type: 'line', x: 0, y: 0, width: 100, height: 50 });
            const handles = d.getHandlePositions(el);
            expect(Object.keys(handles).sort()).toEqual(['end', 'start']);
        });

        it('returns start/end handles for an arrow element', () => {
            const el = makeEl('a', { type: 'arrow', x: 10, y: 20, width: 40, height: 30 });
            const handles = d.getHandlePositions(el);
            expect(handles.start).toEqual({ x: 10, y: 20 });
            expect(handles.end).toEqual({ x: 50, y: 50 });
        });
    });

    // ── isShapeElement ────────────────────────────────────────────────────────

    describe('isShapeElement', () => {
        it('returns true for shape types', () => {
            const shapes: CanvasElement['type'][] = [
                'rectangle',
                'ellipse',
                'diamond',
                'triangle',
                'database',
                'server',
                'user',
                'cloud',
                'document',
                'hexagon',
                'parallelogram',
                'star',
            ];
            shapes.forEach((type) => {
                expect(d.isShapeElement(makeEl('x', { type }))).toBe(true);
            });
        });

        it('returns false for line', () => {
            expect(d.isShapeElement(makeEl('x', { type: 'line' }))).toBe(false);
        });

        it('returns false for arrow', () => {
            expect(d.isShapeElement(makeEl('x', { type: 'arrow' }))).toBe(false);
        });

        it('returns false for freedraw', () => {
            expect(d.isShapeElement(makeEl('x', { type: 'freedraw' }))).toBe(false);
        });

        it('returns false for text', () => {
            expect(d.isShapeElement(makeEl('x', { type: 'text' }))).toBe(false);
        });
    });

    // ── isShapeTool ───────────────────────────────────────────────────────────

    describe('isShapeTool', () => {
        it('returns true for shape tool names', () => {
            expect(d.isShapeTool('rectangle')).toBe(true);
            expect(d.isShapeTool('ellipse')).toBe(true);
            expect(d.isShapeTool('star')).toBe(true);
        });

        it('returns false for non-shape tools', () => {
            expect(d.isShapeTool('select')).toBe(false);
            expect(d.isShapeTool('hand')).toBe(false);
            expect(d.isShapeTool('eraser')).toBe(false);
            expect(d.isShapeTool('freedraw')).toBe(false);
        });
    });

    // ── distanceToSegment ─────────────────────────────────────────────────────

    describe('distanceToSegment', () => {
        it('returns ~0 for a point lying on the segment', () => {
            expect(d.distanceToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0);
        });

        it('returns the perpendicular distance from the midpoint', () => {
            expect(d.distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
        });

        it('returns the distance to the nearest endpoint when the projection is outside', () => {
            // Point (15,0) is past the end (10,0) → distance = 5
            expect(d.distanceToSegment(15, 0, 0, 0, 10, 0)).toBeCloseTo(5);
        });

        it('returns distance to the single point for a zero-length segment', () => {
            // segment (0,0)→(0,0), point (3,4) → distance 5
            expect(d.distanceToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5);
        });
    });
});
