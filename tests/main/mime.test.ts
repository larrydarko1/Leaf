import { describe, it, expect } from 'vitest';

import { IMAGE_MIMETYPES, AUDIO_MIMETYPES } from '@/main/lib/mime';

describe('mime', () => {
    describe('IMAGE_MIMETYPES', () => {
        it.each([
            ['.png', 'image/png'],
            ['.jpg', 'image/jpeg'],
            ['.jpeg', 'image/jpeg'],
            ['.gif', 'image/gif'],
            ['.webp', 'image/webp'],
            ['.svg', 'image/svg+xml'],
            ['.bmp', 'image/bmp'],
            ['.ico', 'image/x-icon'],
        ])('maps %s to %s', (ext, mime) => {
            expect(IMAGE_MIMETYPES[ext]).toBe(mime);
        });

        it('has exactly 8 entries', () => {
            expect(Object.keys(IMAGE_MIMETYPES)).toHaveLength(8);
        });
    });

    describe('AUDIO_MIMETYPES', () => {
        it.each([
            ['.mp3', 'audio/mpeg'],
            ['.wav', 'audio/wav'],
            ['.flac', 'audio/flac'],
            ['.aac', 'audio/aac'],
            ['.m4a', 'audio/mp4'],
            ['.ogg', 'audio/ogg'],
            ['.wma', 'audio/x-ms-wma'],
            ['.aiff', 'audio/aiff'],
        ])('maps %s to %s', (ext, mime) => {
            expect(AUDIO_MIMETYPES[ext]).toBe(mime);
        });

        it('has exactly 8 entries', () => {
            expect(Object.keys(AUDIO_MIMETYPES)).toHaveLength(8);
        });
    });
});
