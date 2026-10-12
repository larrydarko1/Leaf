import { mount } from '@vue/test-utils';
import { vi } from 'vitest';

import type { Canvas2D } from '@/renderer/composables/drawing/canvas2d';

class EmptyFileList implements FileList {
    [index: number]: File;
    readonly length = 0;
    item(): File | null {
        return null;
    }
    [Symbol.iterator](): ArrayIterator<File> {
        return new Array<File>()[Symbol.iterator]();
    }
}

class EmptyItemList implements DataTransferItemList {
    [index: number]: DataTransferItem;
    readonly length = 0;
    add(data: string, type: string): DataTransferItem | null;
    add(data: File): DataTransferItem | null;
    add(): DataTransferItem | null {
        return null;
    }
    clear(): void {
        // Nothing is ever added.
    }
    remove(): void {
        // Nothing is ever added.
    }
    [Symbol.iterator](): ArrayIterator<DataTransferItem> {
        return new Array<DataTransferItem>()[Symbol.iterator]();
    }
}

/** jsdom has no DataTransfer. This one keeps what a drag sets on it; its types are the formats set so far. */
export class FakeDataTransfer implements DataTransfer {
    dropEffect: DataTransfer['dropEffect'] = 'none';
    effectAllowed: DataTransfer['effectAllowed'] = 'uninitialized';
    readonly files: FileList = new EmptyFileList();
    readonly items: DataTransferItemList = new EmptyItemList();
    readonly setDragImage = vi.fn<(image: Element, x: number, y: number) => void>();
    private readonly data = new Map<string, string>();

    constructor(data: Record<string, string> = {}) {
        for (const [format, value] of Object.entries(data)) this.data.set(format, value);
    }

    get types(): readonly string[] {
        return [...this.data.keys()];
    }

    clearData(format?: string): void {
        if (format === undefined) this.data.clear();
        else this.data.delete(format);
    }

    getData(format: string): string {
        return this.data.get(format) ?? '';
    }

    setData(format: string, data: string): void {
        this.data.set(format, data);
    }
}

/** vitest.setup.ts installs i18n on every mount, so this is `mount` under the name the suites know. */
export const mountWithI18n = mount;

/** A 2D context that records every call: jsdom has none, and the drawing code needs only these members. */
export function createFakeContext2D(): Canvas2D {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        setTransform: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        measureText: vi.fn(() => ({ width: 50 })),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        lineCap: 'round',
        lineJoin: 'round',
        globalAlpha: 1,
        font: '',
        textBaseline: 'top',
        textAlign: 'start',
    };
}

/** The element `selector` matches under `root`, checked to be a `type` — a missing or different one fails the test. */
export function findElement<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
    const found = root.querySelector(selector);
    if (!(found instanceof type)) throw new Error(`expected ${selector} to be a ${type.name}`);
    return found;
}

/** A cancelable drag event carrying `dataTransfer`: jsdom has no DragEvent constructor. */
export function createDragEvent(
    type: string,
    dataTransfer: DataTransfer | null = new FakeDataTransfer(),
    init: MouseEventInit = {},
): DragEvent {
    return Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }), { dataTransfer });
}

/** `value`, checked to be a `type`: a wrong one fails the test here rather than on a later property read. */
export function instanceOf<T>(value: unknown, type: abstract new (...args: never[]) => T): T {
    if (!(value instanceof type)) throw new Error(`expected a ${type.name}`);
    return value;
}

export default mountWithI18n;
