import { describe, it, expect } from 'vitest';
import { ALLOWED_EXTENSIONS } from '@/main/lib/extensions';

describe('extensions', () => {
    describe('ALLOWED_EXTENSIONS', () => {
        it('is a Set', () => {
            expect(ALLOWED_EXTENSIONS).toBeInstanceOf(Set);
        });

        it.each(['.txt', '.md'])('allows the text extension %s', (ext) => {
            expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
        });

        it.each(['.py', '.js', '.ts', '.go', '.rs', '.java', '.sh', '.sql', '.cjs'])(
            'allows the code extension %s',
            (ext) => {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            },
        );

        it.each(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])(
            'allows the image extension %s',
            (ext) => {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            },
        );

        it.each(['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'])('allows the video extension %s', (ext) => {
            expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
        });

        it.each(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'])(
            'allows the audio extension %s',
            (ext) => {
                expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
            },
        );

        it('allows dotfile-style config extensions', () => {
            expect(ALLOWED_EXTENSIONS.has('.dockerfile')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.env')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.gitignore')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.eslintrc')).toBe(true);
        });

        it('contains .pdf and .drawing', () => {
            expect(ALLOWED_EXTENSIONS.has('.pdf')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.drawing')).toBe(true);
        });

        it('holds 87 extensions — 88 declared, with .ogg deduplicated across video and audio', () => {
            expect(ALLOWED_EXTENSIONS.size).toBe(87);
        });

        it('is case-sensitive: .R and .r are distinct entries', () => {
            expect(ALLOWED_EXTENSIONS.has('.r')).toBe(true);
            expect(ALLOWED_EXTENSIONS.has('.R')).toBe(true);
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
