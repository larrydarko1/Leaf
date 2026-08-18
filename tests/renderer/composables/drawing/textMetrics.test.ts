/**
 * Tests for measureTextBox.
 *
 * The 2D context is a stub whose `measureText` reports one unit per character,
 * so a measured width is readable straight from the input string.
 */
import { describe, it, expect, vi } from 'vitest';
import { measureTextBox } from '@/renderer/composables/drawing/textMetrics';

const FONT_FAMILY = '"Helvetica", "Segoe UI", sans-serif';

/**
 * Records every call and font assignment in order, so the tests can assert that
 * the font is set inside the save/restore pair and before anything is measured.
 */
function makeCtx(widthOf: (line: string) => number = (line) => line.length) {
    const calls: string[] = [];
    let font = 'initial-font';
    const ctx = {
        get font() {
            return font;
        },
        set font(value: string) {
            font = value;
            calls.push(`font=${value}`);
        },
        save: vi.fn(() => {
            calls.push('save');
        }),
        restore: vi.fn(() => {
            calls.push('restore');
            font = 'initial-font';
        }),
        measureText: vi.fn((line: string) => {
            calls.push(`measureText(${JSON.stringify(line)})`);
            return { width: widthOf(line) } as TextMetrics;
        }),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx };
}

describe('measureTextBox', () => {
    describe('width', () => {
        it('is the measured width of a single line', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, 'hello', 16).width).toBe(5);
        });

        it('is the widest line, not the first or the last', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, 'ab\nlongest line\nxyz', 16).width).toBe(12);
        });

        it('is zero for an empty string', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, '', 16).width).toBe(0);
        });

        it('measures every line exactly once', () => {
            const { ctx, raw } = makeCtx();

            measureTextBox(ctx, 'one\ntwo\nthree', 16);

            expect(raw.measureText).toHaveBeenCalledTimes(3);
            expect(raw.measureText.mock.calls.map(([line]) => line)).toEqual(['one', 'two', 'three']);
        });

        it('measures the empty segments a trailing newline produces', () => {
            const { ctx, raw } = makeCtx();

            const box = measureTextBox(ctx, 'abc\n', 16);

            expect(raw.measureText.mock.calls.map(([line]) => line)).toEqual(['abc', '']);
            expect(box.width).toBe(3);
        });
    });

    describe('height', () => {
        it('is one line of leading for a single line', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, 'hello', 10).height).toBeCloseTo(13);
        });

        it('scales with the line count', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, 'a\nb\nc', 10).height).toBeCloseTo(39);
        });

        it('scales with the font size', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, 'a\nb', 20).height).toBeCloseTo(52);
        });

        it('counts an empty string as one line rather than none', () => {
            const { ctx } = makeCtx();

            expect(measureTextBox(ctx, '', 10).height).toBeCloseTo(13);
        });

        it('does not depend on the measured width', () => {
            const { ctx } = makeCtx(() => 999);

            expect(measureTextBox(ctx, 'a\nb', 10).height).toBeCloseTo(26);
        });
    });

    describe('context handling', () => {
        it('measures at the requested font size in the app font stack', () => {
            const { ctx, calls } = makeCtx();

            measureTextBox(ctx, 'hello', 24);

            expect(calls).toContain(`font=24px ${FONT_FAMILY}`);
        });

        it('sets the font before measuring, inside a save/restore pair', () => {
            const { ctx, calls } = makeCtx();

            measureTextBox(ctx, 'hello', 16);

            expect(calls).toEqual(['save', `font=16px ${FONT_FAMILY}`, 'measureText("hello")', 'restore']);
        });

        it('leaves the caller font untouched', () => {
            const { ctx } = makeCtx();

            measureTextBox(ctx, 'hello', 16);

            expect(ctx.font).toBe('initial-font');
        });

        it('balances save and restore', () => {
            const { ctx, raw } = makeCtx();

            measureTextBox(ctx, 'a\nb\nc', 16);

            expect(raw.save).toHaveBeenCalledTimes(1);
            expect(raw.restore).toHaveBeenCalledTimes(1);
        });
    });
});
