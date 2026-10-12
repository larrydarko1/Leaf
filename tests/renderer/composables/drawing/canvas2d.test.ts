import { describe, it, expect, vi } from 'vitest';

import { encodePng, findContext2D } from '@/renderer/composables/drawing/canvas2d';

describe('findContext2D', () => {
    it('asks the canvas for its 2D context and hands back what it gets, null included', () => {
        const canvas = document.createElement('canvas');
        const getContext = vi.spyOn(canvas, 'getContext').mockReturnValue(null);
        expect(findContext2D(canvas)).toBeNull();
        expect(getContext).toHaveBeenCalledWith('2d');
    });
});

describe('encodePng', () => {
    it('resolves with the PNG blob the canvas encodes', async () => {
        const canvas = document.createElement('canvas');
        const toBlob = vi.spyOn(canvas, 'toBlob').mockImplementation((done, type) => {
            done(new Blob(['png'], { type: type ?? '' }));
        });
        const blob = await encodePng(canvas);
        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
        expect(blob?.type).toBe('image/png');
    });

    it('resolves with null when the canvas cannot be encoded', async () => {
        const canvas = document.createElement('canvas');
        vi.spyOn(canvas, 'toBlob').mockImplementation((done) => {
            done(null);
        });
        await expect(encodePng(canvas)).resolves.toBeNull();
    });
});
