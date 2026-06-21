import { describe, it, expect } from 'vitest';
import {
    ToolTypeSchema,
    ElementTypeSchema,
    StrokeStyleSchema,
    StyleKeySchema,
    DragActionSchema,
    CanvasElementSchema,
    DrawingDataV2Schema,
    DefaultStyleSchema,
} from '@/schemas/drawing';

const TOOL_TYPES = [
    'select',
    'hand',
    'rectangle',
    'ellipse',
    'diamond',
    'triangle',
    'line',
    'arrow',
    'freedraw',
    'text',
    'eraser',
    'database',
    'server',
    'user',
    'cloud',
    'document',
    'hexagon',
    'parallelogram',
    'star',
] as const;

const ELEMENT_TYPES = [
    'rectangle',
    'ellipse',
    'diamond',
    'triangle',
    'line',
    'arrow',
    'freedraw',
    'text',
    'database',
    'server',
    'user',
    'cloud',
    'document',
    'hexagon',
    'parallelogram',
    'star',
] as const;

const validElement = {
    id: 'el-1',
    type: 'rectangle' as const,
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    strokeColor: '#000000',
    fillColor: '#ffffff',
    strokeWidth: 2,
    strokeStyle: 'solid' as const,
    opacity: 1,
};

describe('ToolTypeSchema', () => {
    it.each(TOOL_TYPES)('accepts tool type "%s"', (value) => {
        expect(ToolTypeSchema.parse(value)).toBe(value);
    });

    it('rejects invalid tool type', () => {
        expect(ToolTypeSchema.safeParse('brush').success).toBe(false);
    });
});

describe('ElementTypeSchema', () => {
    it.each(ELEMENT_TYPES)('accepts element type "%s"', (value) => {
        expect(ElementTypeSchema.parse(value)).toBe(value);
    });

    it('rejects "select" (tool-only, not a drawable element)', () => {
        expect(ElementTypeSchema.safeParse('select').success).toBe(false);
    });

    it('rejects invalid value', () => {
        expect(ElementTypeSchema.safeParse('polygon').success).toBe(false);
    });
});

describe('StrokeStyleSchema', () => {
    it.each(['solid', 'dashed', 'dotted'] as const)('accepts "%s"', (value) => {
        expect(StrokeStyleSchema.parse(value)).toBe(value);
    });

    it('rejects invalid stroke style', () => {
        expect(StrokeStyleSchema.safeParse('double').success).toBe(false);
    });
});

describe('StyleKeySchema', () => {
    it.each(['strokeColor', 'fillColor', 'strokeWidth', 'strokeStyle', 'borderRadius', 'fontSize'] as const)(
        'accepts "%s"',
        (value) => {
            expect(StyleKeySchema.parse(value)).toBe(value);
        },
    );

    it('rejects invalid style key', () => {
        expect(StyleKeySchema.safeParse('opacity').success).toBe(false);
    });
});

describe('DragActionSchema', () => {
    it.each(['none', 'create', 'move', 'resize', 'pan', 'freedraw', 'erase', 'marquee'] as const)(
        'accepts drag action "%s"',
        (value) => {
            expect(DragActionSchema.parse(value)).toBe(value);
        },
    );

    it('rejects invalid drag action', () => {
        expect(DragActionSchema.safeParse('scale').success).toBe(false);
    });
});

describe('CanvasElementSchema', () => {
    it('parses a minimal element', () => {
        const result = CanvasElementSchema.parse(validElement);
        expect(result.id).toBe('el-1');
        expect(result.type).toBe('rectangle');
    });

    it('parses a freedraw element with points', () => {
        const result = CanvasElementSchema.parse({
            ...validElement,
            type: 'freedraw',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
        });
        expect(result.points).toHaveLength(2);
    });

    it('parses a text element with optional text fields', () => {
        const result = CanvasElementSchema.parse({
            ...validElement,
            type: 'text',
            text: 'Hello',
            fontSize: 16,
        });
        expect(result.text).toBe('Hello');
        expect(result.fontSize).toBe(16);
    });

    it('parses element with borderRadius', () => {
        const result = CanvasElementSchema.parse({ ...validElement, borderRadius: 8 });
        expect(result.borderRadius).toBe(8);
    });

    it('rejects invalid element type', () => {
        expect(CanvasElementSchema.safeParse({ ...validElement, type: 'polygon' }).success).toBe(false);
    });

    it('rejects invalid stroke style', () => {
        expect(CanvasElementSchema.safeParse({ ...validElement, strokeStyle: 'wavy' }).success).toBe(false);
    });

    it('rejects non-number coordinates', () => {
        expect(CanvasElementSchema.safeParse({ ...validElement, x: '10' }).success).toBe(false);
    });

    it('rejects missing required fields', () => {
        expect(CanvasElementSchema.safeParse({ id: 'el-1', type: 'rectangle' }).success).toBe(false);
    });
});

describe('DrawingDataV2Schema', () => {
    const validDrawing = {
        version: 2,
        elements: [validElement],
        viewState: { scrollX: 0, scrollY: 0, zoom: 1 },
    };

    it('parses a valid drawing', () => {
        const result = DrawingDataV2Schema.parse(validDrawing);
        expect(result.version).toBe(2);
        expect(result.elements).toHaveLength(1);
    });

    it('parses with empty elements array', () => {
        const result = DrawingDataV2Schema.parse({ ...validDrawing, elements: [] });
        expect(result.elements).toHaveLength(0);
    });

    it('rejects missing viewState', () => {
        expect(DrawingDataV2Schema.safeParse({ version: 2, elements: [] }).success).toBe(false);
    });

    it('rejects non-number zoom', () => {
        expect(
            DrawingDataV2Schema.safeParse({
                ...validDrawing,
                viewState: { scrollX: 0, scrollY: 0, zoom: '1x' },
            }).success,
        ).toBe(false);
    });
});

describe('DefaultStyleSchema', () => {
    const validStyle = {
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2,
        strokeStyle: 'solid' as const,
        borderRadius: 0,
        fontSize: 14,
    };

    it('parses valid default style', () => {
        const result = DefaultStyleSchema.parse(validStyle);
        expect(result.strokeWidth).toBe(2);
    });

    it('rejects invalid strokeStyle', () => {
        expect(DefaultStyleSchema.safeParse({ ...validStyle, strokeStyle: 'wavy' }).success).toBe(false);
    });

    it('rejects missing fontSize', () => {
        const { fontSize: _fs, ...rest } = validStyle;
        expect(DefaultStyleSchema.safeParse(rest).success).toBe(false);
    });
});
