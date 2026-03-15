import { describe, it, expect } from 'vitest';
import {
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    PDF_EXTENSIONS,
    DRAWING_EXTENSIONS,
    CODE_EXTENSIONS,
    isImageFile,
    isVideoFile,
    isAudioFile,
    isPdfFile,
    isDrawingFile,
    isCodeFile,
    isMarkdownFile,
} from '../../src/renderer/utils/fileTypes';

describe('fileTypes', () => {
    describe('extension arrays', () => {
        it('IMAGE_EXTENSIONS contains common image formats', () => {
            expect(IMAGE_EXTENSIONS).toContain('.png');
            expect(IMAGE_EXTENSIONS).toContain('.jpg');
            expect(IMAGE_EXTENSIONS).toContain('.jpeg');
            expect(IMAGE_EXTENSIONS).toContain('.gif');
            expect(IMAGE_EXTENSIONS).toContain('.webp');
            expect(IMAGE_EXTENSIONS).toContain('.svg');
        });

        it('VIDEO_EXTENSIONS contains common video formats', () => {
            expect(VIDEO_EXTENSIONS).toContain('.mp4');
            expect(VIDEO_EXTENSIONS).toContain('.webm');
            expect(VIDEO_EXTENSIONS).toContain('.mov');
        });

        it('AUDIO_EXTENSIONS contains common audio formats', () => {
            expect(AUDIO_EXTENSIONS).toContain('.mp3');
            expect(AUDIO_EXTENSIONS).toContain('.wav');
            expect(AUDIO_EXTENSIONS).toContain('.flac');
        });

        it('.ogg appears in both VIDEO and AUDIO extensions', () => {
            expect(VIDEO_EXTENSIONS).toContain('.ogg');
            expect(AUDIO_EXTENSIONS).toContain('.ogg');
        });
    });

    describe('isImageFile', () => {
        it.each(IMAGE_EXTENSIONS)('returns true for %s', (ext) => {
            expect(isImageFile(ext)).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isImageFile('.PNG')).toBe(true);
            expect(isImageFile('.JpG')).toBe(true);
            expect(isImageFile('.Svg')).toBe(true);
        });

        it('returns false for non-image extensions', () => {
            expect(isImageFile('.mp4')).toBe(false);
            expect(isImageFile('.txt')).toBe(false);
            expect(isImageFile('.pdf')).toBe(false);
            expect(isImageFile('')).toBe(false);
        });
    });

    describe('isVideoFile', () => {
        it.each(VIDEO_EXTENSIONS)('returns true for %s', (ext) => {
            expect(isVideoFile(ext)).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isVideoFile('.MP4')).toBe(true);
            expect(isVideoFile('.WebM')).toBe(true);
        });

        it('returns false for non-video extensions', () => {
            expect(isVideoFile('.png')).toBe(false);
            expect(isVideoFile('.mp3')).toBe(false);
            expect(isVideoFile('')).toBe(false);
        });
    });

    describe('isAudioFile', () => {
        it.each(AUDIO_EXTENSIONS)('returns true for %s', (ext) => {
            expect(isAudioFile(ext)).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isAudioFile('.MP3')).toBe(true);
            expect(isAudioFile('.FLAC')).toBe(true);
        });

        it('returns false for non-audio extensions', () => {
            expect(isAudioFile('.png')).toBe(false);
            expect(isAudioFile('.pdf')).toBe(false);
            expect(isAudioFile('')).toBe(false);
        });
    });

    describe('isPdfFile', () => {
        it('returns true for .pdf', () => {
            expect(isPdfFile('.pdf')).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isPdfFile('.PDF')).toBe(true);
            expect(isPdfFile('.Pdf')).toBe(true);
        });

        it('returns false for non-PDF extensions', () => {
            expect(isPdfFile('.doc')).toBe(false);
            expect(isPdfFile('.png')).toBe(false);
        });
    });

    describe('isDrawingFile', () => {
        it('returns true for .drawing', () => {
            expect(isDrawingFile('.drawing')).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isDrawingFile('.DRAWING')).toBe(true);
        });

        it('returns false for non-drawing extensions', () => {
            expect(isDrawingFile('.svg')).toBe(false);
            expect(isDrawingFile('.png')).toBe(false);
        });
    });

    describe('isCodeFile', () => {
        it.each(['.py', '.js', '.ts', '.tsx', '.html', '.css', '.json', '.go', '.rs', '.java'])(
            'returns true for %s',
            (ext) => {
                expect(isCodeFile(ext)).toBe(true);
            }
        );

        it('is case-insensitive', () => {
            expect(isCodeFile('.PY')).toBe(true);
            expect(isCodeFile('.JS')).toBe(true);
        });

        it('returns false for non-code extensions', () => {
            expect(isCodeFile('.png')).toBe(false);
            expect(isCodeFile('.md')).toBe(false);
            expect(isCodeFile('.txt')).toBe(false);
        });

        it('includes config file extensions', () => {
            expect(isCodeFile('.dockerfile')).toBe(true);
            expect(isCodeFile('.env')).toBe(true);
            expect(isCodeFile('.gitignore')).toBe(true);
            expect(isCodeFile('.eslintrc')).toBe(true);
        });
    });

    describe('isMarkdownFile', () => {
        it('returns true for .md', () => {
            expect(isMarkdownFile('.md')).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isMarkdownFile('.MD')).toBe(true);
            expect(isMarkdownFile('.Md')).toBe(true);
        });

        it('returns false for non-markdown extensions', () => {
            expect(isMarkdownFile('.txt')).toBe(false);
            expect(isMarkdownFile('.mdx')).toBe(false);
            expect(isMarkdownFile('.markdown')).toBe(false);
            expect(isMarkdownFile('')).toBe(false);
        });
    });

    describe('no cross-contamination between categories', () => {
        it('PDF is not classified as image, video, audio, code, or drawing', () => {
            expect(isImageFile('.pdf')).toBe(false);
            expect(isVideoFile('.pdf')).toBe(false);
            expect(isAudioFile('.pdf')).toBe(false);
            expect(isCodeFile('.pdf')).toBe(false);
            expect(isDrawingFile('.pdf')).toBe(false);
        });

        it('markdown is not classified as code', () => {
            expect(isCodeFile('.md')).toBe(false);
        });

        it('.drawing is only classified as drawing', () => {
            expect(isImageFile('.drawing')).toBe(false);
            expect(isCodeFile('.drawing')).toBe(false);
        });

        it('CODE_EXTENSIONS has no duplicates', () => {
            const unique = new Set(CODE_EXTENSIONS);
            expect(unique.size).toBe(CODE_EXTENSIONS.length);
        });

        it('PDF_EXTENSIONS has exactly one entry', () => {
            expect(PDF_EXTENSIONS).toHaveLength(1);
        });

        it('DRAWING_EXTENSIONS has exactly one entry', () => {
            expect(DRAWING_EXTENSIONS).toHaveLength(1);
        });
    });
});
