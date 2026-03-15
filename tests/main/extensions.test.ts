import { describe, it, expect } from 'vitest';
import {
    TEXT_EXTENSIONS,
    CODE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    PDF_EXTENSIONS,
    DRAWING_EXTENSIONS,
    ALLOWED_EXTENSIONS,
} from '../../src/main/lib/extensions';

describe('extensions', () => {
    describe('individual arrays', () => {
        it('TEXT_EXTENSIONS includes .txt and .md', () => {
            expect(TEXT_EXTENSIONS).toContain('.txt');
            expect(TEXT_EXTENSIONS).toContain('.md');
        });

        it('CODE_EXTENSIONS includes common languages', () => {
            expect(CODE_EXTENSIONS).toContain('.py');
            expect(CODE_EXTENSIONS).toContain('.js');
            expect(CODE_EXTENSIONS).toContain('.ts');
            expect(CODE_EXTENSIONS).toContain('.go');
            expect(CODE_EXTENSIONS).toContain('.rs');
        });

        it('IMAGE_EXTENSIONS includes common image formats', () => {
            expect(IMAGE_EXTENSIONS).toContain('.png');
            expect(IMAGE_EXTENSIONS).toContain('.jpg');
            expect(IMAGE_EXTENSIONS).toContain('.svg');
        });

        it('PDF_EXTENSIONS contains only .pdf', () => {
            expect(PDF_EXTENSIONS).toEqual(['.pdf']);
        });

        it('DRAWING_EXTENSIONS contains only .drawing', () => {
            expect(DRAWING_EXTENSIONS).toEqual(['.drawing']);
        });
    });

    describe('ALLOWED_EXTENSIONS', () => {
        it('is a Set', () => {
            expect(ALLOWED_EXTENSIONS).toBeInstanceOf(Set);
        });

        it('contains every text extension', () => {
            for (const ext of TEXT_EXTENSIONS) {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            }
        });

        it('contains every code extension', () => {
            for (const ext of CODE_EXTENSIONS) {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            }
        });

        it('contains every image extension', () => {
            for (const ext of IMAGE_EXTENSIONS) {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            }
        });

        it('contains every video extension', () => {
            for (const ext of VIDEO_EXTENSIONS) {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            }
        });

        it('contains every audio extension', () => {
            for (const ext of AUDIO_EXTENSIONS) {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            }
        });

        it('contains .pdf and .drawing', () => {
            expect(ALLOWED_EXTENSIONS.has('.pdf')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.drawing')).toBe(true);
        });

        it('deduplicates .ogg (in both video and audio)', () => {
            expect(VIDEO_EXTENSIONS).toContain('.ogg');
            expect(AUDIO_EXTENSIONS).toContain('.ogg');
            // Count how many times .ogg appears across all arrays
            const allArrays = [
                ...TEXT_EXTENSIONS,
                ...CODE_EXTENSIONS,
                ...IMAGE_EXTENSIONS,
                ...VIDEO_EXTENSIONS,
                ...AUDIO_EXTENSIONS,
                ...PDF_EXTENSIONS,
                ...DRAWING_EXTENSIONS,
            ];
            const totalRaw = allArrays.length;
            expect(ALLOWED_EXTENSIONS.size).toBeLessThan(totalRaw);
        });

        it('does not contain disallowed extensions', () => {
            expect(ALLOWED_EXTENSIONS.has('.exe')).toBe(false);
            expect(ALLOWED_EXTENSIONS.has('.dll')).toBe(false);
            expect(ALLOWED_EXTENSIONS.has('.zip')).toBe(false);
            expect(ALLOWED_EXTENSIONS.has('.dmg')).toBe(false);
            expect(ALLOWED_EXTENSIONS.has('.iso')).toBe(false);
        });
    });
});
