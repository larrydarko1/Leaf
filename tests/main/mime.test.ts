import { describe, it, expect } from 'vitest';
import { IMAGE_MIMETYPES, AUDIO_MIMETYPES, VIDEO_MIMETYPES, MIME_MAP } from '../../src/main/lib/mime';

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

    describe('VIDEO_MIMETYPES', () => {
        it.each([
            ['.mp4', 'video/mp4'],
            ['.webm', 'video/webm'],
            ['.mov', 'video/quicktime'],
            ['.avi', 'video/x-msvideo'],
            ['.mkv', 'video/x-matroska'],
        ])('maps %s to %s', (ext, mime) => {
            expect(VIDEO_MIMETYPES[ext]).toBe(mime);
        });

        it('has exactly 5 entries', () => {
            expect(Object.keys(VIDEO_MIMETYPES)).toHaveLength(5);
        });
    });

    describe('MIME_MAP', () => {
        it('contains all image MIME types', () => {
            for (const [ext, mime] of Object.entries(IMAGE_MIMETYPES)) {
                expect(MIME_MAP[ext]).toBe(mime);
            }
        });

        it('contains all audio MIME types', () => {
            for (const [ext, mime] of Object.entries(AUDIO_MIMETYPES)) {
                expect(MIME_MAP[ext]).toBe(mime);
            }
        });

        it('contains all video MIME types', () => {
            for (const [ext, mime] of Object.entries(VIDEO_MIMETYPES)) {
                expect(MIME_MAP[ext]).toBe(mime);
            }
        });

        it('includes .pdf mapping', () => {
            expect(MIME_MAP['.pdf']).toBe('application/pdf');
        });

        it('has total keys = image + audio + video + pdf', () => {
            const expected =
                Object.keys(IMAGE_MIMETYPES).length +
                Object.keys(AUDIO_MIMETYPES).length +
                Object.keys(VIDEO_MIMETYPES).length +
                1; // .pdf
            expect(Object.keys(MIME_MAP)).toHaveLength(expected);
        });

        it('returns undefined for unknown extensions', () => {
            expect(MIME_MAP['.exe']).toBeUndefined();
            expect(MIME_MAP['.zip']).toBeUndefined();
            expect(MIME_MAP['.txt']).toBeUndefined();
        });
    });
});
