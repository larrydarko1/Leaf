export type ToolType =
    | 'select'
    | 'hand'
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'line'
    | 'arrow'
    | 'freedraw'
    | 'text'
    | 'eraser'
    | 'database'
    | 'server'
    | 'user'
    | 'cloud'
    | 'document'
    | 'hexagon'
    | 'parallelogram'
    | 'star';

export type ElementType =
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'line'
    | 'arrow'
    | 'freedraw'
    | 'text'
    | 'database'
    | 'server'
    | 'user'
    | 'cloud'
    | 'document'
    | 'hexagon'
    | 'parallelogram'
    | 'star';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type DragAction = 'none' | 'create' | 'move' | 'resize' | 'pan' | 'freedraw' | 'erase' | 'marquee';

export interface CanvasElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    opacity: number;
    points?: { x: number; y: number }[];
    text?: string;
    fontSize?: number;
    borderRadius?: number;
}

export interface DrawingDataV2 {
    version: number;
    elements: CanvasElement[];
    viewState: { scrollX: number; scrollY: number; zoom: number };
}
