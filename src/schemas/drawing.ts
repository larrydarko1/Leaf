import { z } from 'zod';

export const ToolTypeSchema = z.enum([
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
]);

export type ToolType = z.infer<typeof ToolTypeSchema>;

export const ElementTypeSchema = z.enum([
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

export const StrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export type StrokeStyle = z.infer<typeof StrokeStyleSchema>;

export const StyleKeySchema = z.enum([
    'strokeColor',
    'fillColor',
    'strokeWidth',
    'strokeStyle',
    'borderRadius',
    'fontSize',
]);

export type StyleKey = z.infer<typeof StyleKeySchema>;

export const DragActionSchema = z.enum(['none', 'create', 'move', 'resize', 'pan', 'freedraw', 'erase', 'marquee']);

export type DragAction = z.infer<typeof DragActionSchema>;

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

export const DefaultStyleSchema = z.object({
    strokeColor: z.string(),
    fillColor: z.string(),
    strokeWidth: z.number(),
    strokeStyle: StrokeStyleSchema,
    borderRadius: z.number(),
    fontSize: z.number(),
});

export type DefaultStyle = z.infer<typeof DefaultStyleSchema>;
