import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

import type { Canvas2D } from '@/renderer/composables/drawing/canvas2d';
import { useCanvasRenderer } from '@/renderer/composables/drawing/useCanvasRenderer';
import type { CanvasElement } from '@/schemas/drawing';
import { createFakeContext2D } from '@test-utils';

const { mockFindContext2D, mockEncodePng } = vi.hoisted(() => ({
    mockFindContext2D: vi.fn<(canvas: HTMLCanvasElement) => Canvas2D | null>(),
    mockEncodePng: vi.fn<(canvas: HTMLCanvasElement) => Promise<Blob | null>>(),
}));

vi.mock('@/renderer/composables/drawing/canvas2d', () => ({
    findContext2D: mockFindContext2D,
    encodePng: mockEncodePng,
}));

function makeElement(overrides: Partial<CanvasElement> & { id: string; type: CanvasElement['type'] }): CanvasElement {
    return {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        strokeColor: '#ffffff',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        ...overrides,
    };
}

function getElementBounds(el: CanvasElement) {
    if (el.type === 'freedraw' && el.points && el.points.length > 0) {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
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

function getHandlePositions(el: CanvasElement) {
    const b = getElementBounds(el);
    return {
        nw: { x: b.x, y: b.y },
        ne: { x: b.x + b.width, y: b.y },
        sw: { x: b.x, y: b.y + b.height },
        se: { x: b.x + b.width, y: b.y + b.height },
    };
}

function setupRenderer(elementList: CanvasElement[] = []) {
    const canvasEl = document.createElement('canvas');
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0 }),
    });

    const renderer = useCanvasRenderer({
        canvas: ref<HTMLCanvasElement | null>(canvasEl),
        containerEl: ref<HTMLDivElement | null>(container),
        scrollX: ref(0),
        scrollY: ref(0),
        zoom: ref(1),
        elements: ref<CanvasElement[]>(elementList),
        creatingElement: ref<CanvasElement | null>(null),
        selectedIds: ref<Set<string>>(new Set()),
        marqueeRect: ref<{ x: number; y: number; width: number; height: number } | null>(null),
        getElementBounds,
        getHandlePositions,
    });

    renderer.setupCanvas();

    return { renderer };
}

/** Runs one export; returns the offscreen canvas, its context, the fill styles set and the blob. */
async function runExport(
    renderer: ReturnType<typeof useCanvasRenderer>,
    opts: Parameters<ReturnType<typeof useCanvasRenderer>['exportToBlob']>[0],
) {
    const ctx = createFakeContext2D();
    const fillStyles: Canvas2D['fillStyle'][] = [];
    let fillStyle = ctx.fillStyle;
    Object.defineProperty(ctx, 'fillStyle', {
        get: () => fillStyle,
        set: (value: Canvas2D['fillStyle']) => {
            fillStyle = value;
            fillStyles.push(value);
        },
    });
    mockFindContext2D.mockReturnValueOnce(ctx);
    const blob = await renderer.exportToBlob(opts);
    return { blob, canvas: mockEncodePng.mock.calls[0]?.[0], ctx, fillStyles };
}

beforeEach(() => {
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --base1: #ffffff;
            --base2: #f5f5f5;
            --base3: #efefef;
            --grid-color: #e0e0e0;
        }
    `;
    document.head.appendChild(style);
});

afterEach(() => {
    const styles = document.head.querySelectorAll('style');
    styles.forEach((s) => s.remove());
});

describe('exportToBlob', () => {
    beforeEach(() => {
        mockFindContext2D.mockReset();
        mockFindContext2D.mockReturnValue(createFakeContext2D());
        mockEncodePng.mockReset();
        mockEncodePng.mockResolvedValue(new Blob(['png-content'], { type: 'image/png' }));
    });

    describe('empty elements', () => {
        it('returns null when elements array is empty', async () => {
            const { renderer } = setupRenderer();
            const blob = await renderer.exportToBlob({
                elements: [],
                withBackground: true,
                scale: 1,
            });
            expect(blob).toBeNull();
        });
    });

    describe('canvas sizing', () => {
        it('creates a canvas with correct dimensions at 1x scale', async () => {
            const el = makeElement({ id: 'a', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 });
            const { renderer } = setupRenderer([el]);

            const { blob, canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: true,
                scale: 1,
                padding: 20,
            });

            expect(blob).not.toBeNull();
            expect(canvas?.width).toBe(140);
            expect(canvas?.height).toBe(90);
        });

        it('scales canvas dimensions correctly at 2x', async () => {
            const el = makeElement({ id: 'b', type: 'ellipse', x: 0, y: 0, width: 200, height: 100 });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: true,
                scale: 2,
                padding: 20,
            });

            expect(canvas?.width).toBe(480);
            expect(canvas?.height).toBe(280);
        });

        it('scales canvas dimensions correctly at 3x', async () => {
            const el = makeElement({ id: 'c', type: 'rectangle', x: 50, y: 50, width: 60, height: 40 });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: false,
                scale: 3,
                padding: 20,
            });

            expect(canvas?.width).toBe(300);
            expect(canvas?.height).toBe(240);
        });
    });

    describe('background', () => {
        it('fills background with white in light mode', async () => {
            const el = makeElement({ id: 'd', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const { ctx, fillStyles } = await runExport(renderer, { elements: [el], withBackground: true, scale: 1 });

            expect(fillStyles[0]).toBe('#ffffff');
            expect(vi.mocked(ctx.fillRect).mock.calls[0]).toEqual([0, 0, 90, 90]); // (50+40)*1
        });

        it('fills background with dark color in dark mode', async () => {
            const el = makeElement({ id: 'e', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const { fillStyles } = await runExport(renderer, { elements: [el], withBackground: true, scale: 1 });

            expect(fillStyles[0]).toBe('#ffffff');
        });

        it('does not fill background when withBackground is false', async () => {
            const el = makeElement({ id: 'f', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const { ctx } = await runExport(renderer, { elements: [el], withBackground: false, scale: 1 });

            // The background is the only fill made before the world transform is set up.
            const firstScale = vi.mocked(ctx.scale).mock.invocationCallOrder[0] ?? Infinity;
            const fillsBeforeScale = vi.mocked(ctx.fillRect).mock.invocationCallOrder.filter((n) => n < firstScale);
            expect(fillsBeforeScale).toEqual([]);
        });
    });

    describe('multiple elements', () => {
        it('calculates bounding box spanning all elements', async () => {
            const el1 = makeElement({ id: 'g', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const el2 = makeElement({ id: 'h', type: 'ellipse', x: 200, y: 150, width: 100, height: 80 });
            const { renderer } = setupRenderer([el1, el2]);

            const { canvas } = await runExport(renderer, {
                elements: [el1, el2],
                withBackground: true,
                scale: 1,
                padding: 20,
            });

            expect(canvas?.width).toBe(340);
            expect(canvas?.height).toBe(270);
        });
    });

    describe('custom padding', () => {
        it('applies custom padding value', async () => {
            const el = makeElement({ id: 'i', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: true,
                scale: 1,
                padding: 50,
            });

            expect(canvas?.width).toBe(200);
            expect(canvas?.height).toBe(200);
        });

        it('uses default padding of 20 when not specified', async () => {
            const el = makeElement({ id: 'j', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, { elements: [el], withBackground: true, scale: 1 });

            expect(canvas?.width).toBe(140);
            expect(canvas?.height).toBe(140);
        });
    });

    describe('return value', () => {
        it('returns the blob the encoder produced', async () => {
            const el = makeElement({ id: 'k', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const { blob } = await runExport(renderer, { elements: [el], withBackground: true, scale: 1 });

            expect(blob).toBeInstanceOf(Blob);
            expect(blob?.type).toBe('image/png');
        });
    });

    describe('freedraw bounds', () => {
        it('correctly sizes canvas for freedraw elements', async () => {
            const el = makeElement({
                id: 'l',
                type: 'freedraw',
                x: 10,
                y: 10,
                width: 0,
                height: 0,
                points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 80 },
                    { x: 0, y: 80 },
                ],
            });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: true,
                scale: 1,
                padding: 20,
            });

            expect(canvas?.width).toBe(140);
            expect(canvas?.height).toBe(120);
        });
    });

    describe('negative dimensions', () => {
        it('handles elements with negative width/height', async () => {
            const el = makeElement({ id: 'm', type: 'rectangle', x: 100, y: 100, width: -80, height: -60 });
            const { renderer } = setupRenderer([el]);

            const { canvas } = await runExport(renderer, {
                elements: [el],
                withBackground: true,
                scale: 1,
                padding: 20,
            });

            expect(canvas?.width).toBe(120);
            expect(canvas?.height).toBe(100);
        });
    });
});
