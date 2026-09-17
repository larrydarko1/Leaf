import { z } from 'zod';

const ElementTypeSchema = z.enum([
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
]);

export type ElementType = z.infer<typeof ElementTypeSchema>;

/** Every element the canvas can draw, plus the three tools that draw nothing. */
export type ToolType = ElementType | 'select' | 'hand' | 'eraser';

const StrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export type StrokeStyle = z.infer<typeof StrokeStyleSchema>;

export type DragAction = 'none' | 'create' | 'move' | 'resize' | 'pan' | 'freedraw' | 'erase' | 'marquee';

export const CanvasElementSchema = z.object({
    id: z.string(),
    type: ElementTypeSchema,
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    strokeColor: z.string(),
    fillColor: z.string(),
    strokeWidth: z.number(),
    strokeStyle: StrokeStyleSchema,
    opacity: z.number(),
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    borderRadius: z.number().optional(),
});

export type CanvasElement = z.infer<typeof CanvasElementSchema>;

export const DrawingDataV2Schema = z.object({
    version: z.number(),
    elements: z.array(CanvasElementSchema),
    viewState: z.object({
        scrollX: z.number(),
        scrollY: z.number(),
        zoom: z.number(),
    }),
});

export type DrawingDataV2 = z.infer<typeof DrawingDataV2Schema>;

export type DefaultStyle = {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    borderRadius: number;
    fontSize: number;
};

/** The element properties the properties panel can set — exactly the ones DefaultStyle seeds. */
export type StyleKey = keyof DefaultStyle;
