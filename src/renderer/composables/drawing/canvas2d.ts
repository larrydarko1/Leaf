// The drawing code's only contact with the canvas API; everything else takes a Canvas2D.

type DrawingMembers =
    | 'save'
    | 'restore'
    | 'scale'
    | 'translate'
    | 'setTransform'
    | 'beginPath'
    | 'closePath'
    | 'moveTo'
    | 'lineTo'
    | 'arc'
    | 'ellipse'
    | 'quadraticCurveTo'
    | 'roundRect'
    | 'fill'
    | 'stroke'
    | 'fillRect'
    | 'strokeRect'
    | 'clearRect'
    | 'fillText'
    | 'setLineDash'
    | 'strokeStyle'
    | 'fillStyle'
    | 'lineWidth'
    | 'lineCap'
    | 'lineJoin'
    | 'globalAlpha'
    | 'font'
    | 'textBaseline'
    | 'textAlign';

export type Canvas2D = Pick<CanvasRenderingContext2D, DrawingMembers> & {
    measureText(text: string): Pick<TextMetrics, 'width'>;
};

export function findContext2D(canvas: HTMLCanvasElement): Canvas2D | null {
    return canvas.getContext('2d');
}

export function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve): void => {
        canvas.toBlob((blob): void => resolve(blob), 'image/png');
    });
}
