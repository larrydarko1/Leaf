import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type { CanvasElement } from '../../src/renderer/types/drawing';
import { useCanvasRenderer } from '../../src/renderer/composables/drawing/useCanvasRenderer';

// ─── Helpers ───────────────────────────────────────────────────────────

function makeElement(overrides: Partial<CanvasElement> & { id: string; type: CanvasElement['type'] }): CanvasElement {
    return {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        strokeColor: '#000000',
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

/**
 * Set up useCanvasRenderer with a mock canvas and container,
 * wiring in the needed refs and helpers.
 */
function setupRenderer(elementList: CanvasElement[] = []) {
    // jsdom doesn't fully support canvas. We create a real element and
    // monkey-patch getContext so the composable has something to work with.
    const canvasEl = document.createElement('canvas');

    // Build a minimal mock 2D context covering methods used by drawElement / export
    const mockCtx: Record<string, unknown> = {};
    const noop = () => {};
    for (const m of [
        'save',
        'restore',
        'scale',
        'translate',
        'setTransform',
        'beginPath',
        'closePath',
        'moveTo',
        'lineTo',
        'arc',
        'ellipse',
        'quadraticCurveTo',
        'fill',
        'stroke',
        'fillRect',
        'strokeRect',
        'fillText',
        'setLineDash',
        'clearRect',
        'roundRect',
    ] as const) {
        mockCtx[m] = vi.fn(noop);
    }
    mockCtx.measureText = vi.fn(() => ({ width: 50 }));
    // Writable style properties
    mockCtx.strokeStyle = '';
    mockCtx.fillStyle = '';
    mockCtx.lineWidth = 1;
    mockCtx.globalAlpha = 1;
    mockCtx.lineCap = 'round';
    mockCtx.lineJoin = 'round';
    mockCtx.font = '';
    mockCtx.textBaseline = 'top';
    mockCtx.textAlign = 'start';

    canvasEl.getContext = vi.fn(() => mockCtx) as unknown as typeof canvasEl.getContext;

    // Mock toBlob to return a fake Blob synchronously
    canvasEl.toBlob = vi.fn((cb: BlobCallback, type?: string) => {
        cb(new Blob(['fake-png-data'], { type: type ?? 'image/png' }));
    });

    // Mock container
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0 }),
    });

    const canvasRef = ref(canvasEl) as ReturnType<typeof ref<HTMLCanvasElement | null>>;
    const containerRef = ref(container) as ReturnType<typeof ref<HTMLDivElement | null>>;
    const scrollX = ref(0);
    const scrollY = ref(0);
    const zoom = ref(1);
    const isDark = ref(false);
    const elements = ref<CanvasElement[]>(elementList);
    const creatingElement = ref<CanvasElement | null>(null);
    const selectedIds = ref<Set<string>>(new Set());
    const selectedElement = computed(() => null);
    const marqueeRect = ref<{ x: number; y: number; width: number; height: number } | null>(null);

    const renderer = useCanvasRenderer(
        canvasRef,
        containerRef,
        scrollX,
        scrollY,
        zoom,
        isDark,
        elements,
        creatingElement,
        selectedIds,
        selectedElement,
        marqueeRect,
        getElementBounds,
        getHandlePositions,
    );

    // Need to call setupCanvas to initialise the internal ctx
    renderer.setupCanvas();

    return { renderer, canvasEl, mockCtx, elements, isDark };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('exportToBlob', () => {
    describe('empty elements', () => {
        it('returns null when elements array is empty', async () => {
            const { renderer } = setupRenderer();
            const blob = await renderer.exportToBlob({
                elements: [],
                withBackground: true,
                scale: 1,
                darkMode: false,
            });
            expect(blob).toBeNull();
        });
    });

    describe('canvas sizing', () => {
        it('creates a canvas with correct dimensions at 1x scale', async () => {
            const el = makeElement({ id: 'a', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 });
            const { renderer } = setupRenderer([el]);

            // Spy on document.createElement to capture the offscreen canvas
            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    // Also mock toBlob on the offscreen canvas
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            const blob = await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
                padding: 20,
            });

            expect(blob).not.toBeNull();
            // Bounds: x=10, y=20, w=100, h=50 → canvas = ceil((100 + 40) * 1) x ceil((50 + 40) * 1) = 140 x 90
            expect(offscreen!.width).toBe(140);
            expect(offscreen!.height).toBe(90);

            vi.restoreAllMocks();
        });

        it('scales canvas dimensions correctly at 2x', async () => {
            const el = makeElement({ id: 'b', type: 'ellipse', x: 0, y: 0, width: 200, height: 100 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 2,
                darkMode: false,
                padding: 20,
            });

            // (200 + 40) * 2 = 480, (100 + 40) * 2 = 280
            expect(offscreen!.width).toBe(480);
            expect(offscreen!.height).toBe(280);

            vi.restoreAllMocks();
        });

        it('scales canvas dimensions correctly at 3x', async () => {
            const el = makeElement({ id: 'c', type: 'rectangle', x: 50, y: 50, width: 60, height: 40 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: false,
                scale: 3,
                darkMode: false,
                padding: 20,
            });

            // (60 + 40) * 3 = 300, (40 + 40) * 3 = 240
            expect(offscreen!.width).toBe(300);
            expect(offscreen!.height).toBe(240);

            vi.restoreAllMocks();
        });
    });

    describe('background', () => {
        it('fills background with white in light mode', async () => {
            const el = makeElement({ id: 'd', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            const fillRectCalls: unknown[][] = [];
            const fillStyleLog: string[] = [];
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    elem.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    const proxyCtx: Record<string, unknown> = {};
                    for (const m of [
                        'save',
                        'restore',
                        'scale',
                        'translate',
                        'setTransform',
                        'beginPath',
                        'closePath',
                        'moveTo',
                        'lineTo',
                        'arc',
                        'ellipse',
                        'quadraticCurveTo',
                        'fill',
                        'stroke',
                        'strokeRect',
                        'fillText',
                        'setLineDash',
                        'clearRect',
                        'roundRect',
                    ]) {
                        proxyCtx[m] = vi.fn();
                    }
                    proxyCtx.measureText = vi.fn(() => ({ width: 50 }));
                    proxyCtx.fillRect = vi.fn((...args: unknown[]) => fillRectCalls.push(args));
                    proxyCtx.strokeStyle = '';
                    let _fillStyle = '';
                    Object.defineProperty(proxyCtx, 'fillStyle', {
                        get: () => _fillStyle,
                        set: (v: string) => {
                            _fillStyle = v;
                            fillStyleLog.push(v);
                        },
                    });
                    proxyCtx.lineWidth = 1;
                    proxyCtx.globalAlpha = 1;
                    proxyCtx.lineCap = 'round';
                    proxyCtx.lineJoin = 'round';
                    proxyCtx.font = '';
                    proxyCtx.textBaseline = 'top';
                    proxyCtx.textAlign = 'start';
                    (elem as HTMLCanvasElement).getContext = vi.fn(() => proxyCtx) as unknown as typeof elem.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
            });

            // First fillStyle set should be the background color
            expect(fillStyleLog[0]).toBe('#ffffff');
            // First fillRect call is the background fill
            expect(fillRectCalls[0]).toEqual([0, 0, 90, 90]); // (50+40)*1

            vi.restoreAllMocks();
        });

        it('fills background with dark color in dark mode', async () => {
            const el = makeElement({ id: 'e', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            const fillStyleLog: string[] = [];
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    elem.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    const proxyCtx: Record<string, unknown> = {};
                    for (const m of [
                        'save',
                        'restore',
                        'scale',
                        'translate',
                        'setTransform',
                        'beginPath',
                        'closePath',
                        'moveTo',
                        'lineTo',
                        'arc',
                        'ellipse',
                        'quadraticCurveTo',
                        'fill',
                        'stroke',
                        'fillRect',
                        'strokeRect',
                        'fillText',
                        'setLineDash',
                        'clearRect',
                        'roundRect',
                    ]) {
                        proxyCtx[m] = vi.fn();
                    }
                    proxyCtx.measureText = vi.fn(() => ({ width: 50 }));
                    proxyCtx.strokeStyle = '';
                    let _fillStyle = '';
                    Object.defineProperty(proxyCtx, 'fillStyle', {
                        get: () => _fillStyle,
                        set: (v: string) => {
                            _fillStyle = v;
                            fillStyleLog.push(v);
                        },
                    });
                    proxyCtx.lineWidth = 1;
                    proxyCtx.globalAlpha = 1;
                    proxyCtx.lineCap = 'round';
                    proxyCtx.lineJoin = 'round';
                    proxyCtx.font = '';
                    proxyCtx.textBaseline = 'top';
                    proxyCtx.textAlign = 'start';
                    (elem as HTMLCanvasElement).getContext = vi.fn(() => proxyCtx) as unknown as typeof elem.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: true,
            });

            expect(fillStyleLog[0]).toBe('#1e1e1e');

            vi.restoreAllMocks();
        });

        it('does not fill background when withBackground is false', async () => {
            const el = makeElement({ id: 'f', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let bgFillRectCalled = false;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    elem.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    const proxyCtx: Record<string, unknown> = {};
                    let scaleCallCount = 0;
                    for (const m of [
                        'save',
                        'restore',
                        'translate',
                        'setTransform',
                        'beginPath',
                        'closePath',
                        'moveTo',
                        'lineTo',
                        'arc',
                        'ellipse',
                        'quadraticCurveTo',
                        'fill',
                        'stroke',
                        'strokeRect',
                        'fillText',
                        'setLineDash',
                        'clearRect',
                        'roundRect',
                    ]) {
                        proxyCtx[m] = vi.fn();
                    }
                    proxyCtx.measureText = vi.fn(() => ({ width: 50 }));
                    proxyCtx.scale = vi.fn(() => {
                        scaleCallCount++;
                    });
                    // fillRect should only be called after scale (for element drawing), not before
                    proxyCtx.fillRect = vi.fn(() => {
                        if (scaleCallCount === 0) bgFillRectCalled = true;
                    });
                    proxyCtx.strokeStyle = '';
                    proxyCtx.fillStyle = '';
                    proxyCtx.lineWidth = 1;
                    proxyCtx.globalAlpha = 1;
                    proxyCtx.lineCap = 'round';
                    proxyCtx.lineJoin = 'round';
                    proxyCtx.font = '';
                    proxyCtx.textBaseline = 'top';
                    proxyCtx.textAlign = 'start';
                    (elem as HTMLCanvasElement).getContext = vi.fn(() => proxyCtx) as unknown as typeof elem.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: false,
                scale: 1,
                darkMode: false,
            });

            expect(bgFillRectCalled).toBe(false);

            vi.restoreAllMocks();
        });
    });

    describe('multiple elements', () => {
        it('calculates bounding box spanning all elements', async () => {
            const el1 = makeElement({ id: 'g', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const el2 = makeElement({ id: 'h', type: 'ellipse', x: 200, y: 150, width: 100, height: 80 });
            const { renderer } = setupRenderer([el1, el2]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el1, el2],
                withBackground: true,
                scale: 1,
                darkMode: false,
                padding: 20,
            });

            // BBox: x=0..300, y=0..230 → (300 + 40) x (230 + 40) = 340 x 270
            expect(offscreen!.width).toBe(340);
            expect(offscreen!.height).toBe(270);

            vi.restoreAllMocks();
        });
    });

    describe('custom padding', () => {
        it('applies custom padding value', async () => {
            const el = makeElement({ id: 'i', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
                padding: 50,
            });

            // (100 + 100) * 1 = 200
            expect(offscreen!.width).toBe(200);
            expect(offscreen!.height).toBe(200);

            vi.restoreAllMocks();
        });

        it('uses default padding of 20 when not specified', async () => {
            const el = makeElement({ id: 'j', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
                // no padding → defaults to 20
            });

            // (100 + 40) * 1 = 140
            expect(offscreen!.width).toBe(140);
            expect(offscreen!.height).toBe(140);

            vi.restoreAllMocks();
        });
    });

    describe('return value', () => {
        it('returns a Blob with image/png type', async () => {
            const el = makeElement({ id: 'k', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    elem.toBlob = vi.fn((cb: BlobCallback, type?: string) => {
                        cb(new Blob(['png-content'], { type: type ?? 'image/png' }));
                    });
                    elem.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof elem.getContext;
                }
                return elem;
            });

            const blob = await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
            });

            expect(blob).toBeInstanceOf(Blob);
            expect(blob!.type).toBe('image/png');

            vi.restoreAllMocks();
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

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
                padding: 20,
            });

            // Freedraw bounds: x=10..110, y=10..90 → w=100, h=80 → canvas = (100+40)x(80+40) = 140x120
            expect(offscreen!.width).toBe(140);
            expect(offscreen!.height).toBe(120);

            vi.restoreAllMocks();
        });
    });

    describe('negative dimensions', () => {
        it('handles elements with negative width/height', async () => {
            // Elements created by dragging right-to-left have negative width
            const el = makeElement({ id: 'm', type: 'rectangle', x: 100, y: 100, width: -80, height: -60 });
            const { renderer } = setupRenderer([el]);

            const origCreate = document.createElement.bind(document);
            let offscreen: HTMLCanvasElement | null = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const elem = origCreate(tag);
                if (tag === 'canvas') {
                    offscreen = elem as HTMLCanvasElement;
                    offscreen.toBlob = vi.fn((cb: BlobCallback) => {
                        cb(new Blob(['data'], { type: 'image/png' }));
                    });
                    offscreen.getContext = vi.fn(() => {
                        const ctx: Record<string, unknown> = {};
                        for (const m of [
                            'save',
                            'restore',
                            'scale',
                            'translate',
                            'setTransform',
                            'beginPath',
                            'closePath',
                            'moveTo',
                            'lineTo',
                            'arc',
                            'ellipse',
                            'quadraticCurveTo',
                            'fill',
                            'stroke',
                            'fillRect',
                            'strokeRect',
                            'fillText',
                            'setLineDash',
                            'clearRect',
                            'roundRect',
                        ]) {
                            ctx[m] = vi.fn();
                        }
                        ctx.measureText = vi.fn(() => ({ width: 50 }));
                        ctx.strokeStyle = '';
                        ctx.fillStyle = '';
                        ctx.lineWidth = 1;
                        ctx.globalAlpha = 1;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.font = '';
                        ctx.textBaseline = 'top';
                        ctx.textAlign = 'start';
                        return ctx;
                    }) as unknown as typeof offscreen.getContext;
                }
                return elem;
            });

            await renderer.exportToBlob({
                elements: [el],
                withBackground: true,
                scale: 1,
                darkMode: false,
                padding: 20,
            });

            // getElementBounds normalizes: x=20, y=40, w=80, h=60 → (80+40)x(60+40) = 120x100
            expect(offscreen!.width).toBe(120);
            expect(offscreen!.height).toBe(100);

            vi.restoreAllMocks();
        });
    });
});
