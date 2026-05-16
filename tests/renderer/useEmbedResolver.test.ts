import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEmbedResolver } from '../../src/renderer/composables/editor/useEmbedResolver';

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    resolveEmbedPath: vi.fn(),
    log: { error: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useEmbedResolver', () => {
    const file = { path: '/vault/notes/note.md' };
    const workspace = '/vault';

    let resolver: ReturnType<typeof useEmbedResolver>;

    beforeEach(() => {
        vi.clearAllMocks();
        resolver = useEmbedResolver(
            () => file,
            () => workspace,
        );
    });

    // ── getEmbedMediaType ─────────────────────────────────────────────────────

    describe('getEmbedMediaType', () => {
        it('identifies PNG as image', () => {
            expect(resolver.getEmbedMediaType('photo.png')).toBe('image');
        });

        it('identifies JPG as image', () => {
            expect(resolver.getEmbedMediaType('photo.jpg')).toBe('image');
        });

        it('identifies JPEG as image', () => {
            expect(resolver.getEmbedMediaType('photo.jpeg')).toBe('image');
        });

        it('identifies GIF as image', () => {
            expect(resolver.getEmbedMediaType('anim.gif')).toBe('image');
        });

        it('identifies MP3 as audio', () => {
            expect(resolver.getEmbedMediaType('sound.mp3')).toBe('audio');
        });

        it('identifies WAV as audio', () => {
            expect(resolver.getEmbedMediaType('sound.wav')).toBe('audio');
        });

        it('identifies MP4 as video', () => {
            expect(resolver.getEmbedMediaType('clip.mp4')).toBe('video');
        });

        it('identifies PDF', () => {
            expect(resolver.getEmbedMediaType('document.pdf')).toBe('pdf');
        });

        it('identifies Markdown as note', () => {
            expect(resolver.getEmbedMediaType('note.md')).toBe('note');
        });

        it('identifies plain text as note', () => {
            expect(resolver.getEmbedMediaType('readme.txt')).toBe('note');
        });

        it('returns unknown for unrecognised extensions', () => {
            expect(resolver.getEmbedMediaType('archive.xyz')).toBe('unknown');
        });

        it('is case-insensitive for the extension', () => {
            expect(resolver.getEmbedMediaType('Photo.PNG')).toBe('image');
        });
    });

    // ── resolveEmbeds – no-ops ────────────────────────────────────────────────

    describe('resolveEmbeds (no-ops)', () => {
        it('does nothing when there are no embeds in the text', async () => {
            await resolver.resolveEmbeds('No embeds here.');
            expect(mockAPI.resolveEmbedPath).not.toHaveBeenCalled();
        });

        it('does nothing when the file getter returns null', async () => {
            const r = useEmbedResolver(
                () => null,
                () => workspace,
            );
            await r.resolveEmbeds('![[image.png]]');
            expect(mockAPI.resolveEmbedPath).not.toHaveBeenCalled();
        });

        it('does nothing when the workspace getter returns null', async () => {
            const r = useEmbedResolver(
                () => file,
                () => null,
            );
            await r.resolveEmbeds('![[image.png]]');
            expect(mockAPI.resolveEmbedPath).not.toHaveBeenCalled();
        });
    });

    // ── resolveEmbeds – successful resolution ─────────────────────────────────

    describe('resolveEmbeds (success)', () => {
        it('resolves an embed and stores the result in the cache', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            expect(resolver.embedCache.value.get('image.png')).toBe('/vault/image.png');
        });

        it('bumps embedCacheVersion when new entries are added', async () => {
            const before = resolver.embedCacheVersion.value;
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            expect(resolver.embedCacheVersion.value).toBeGreaterThan(before);
        });

        it('resolves multiple unique embeds in a single call', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/x' });
            await resolver.resolveEmbeds('![[a.png]] and ![[b.png]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledTimes(2);
        });

        it('deduplicates repeated embed filenames within the same text', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/x.png' });
            await resolver.resolveEmbeds('![[x.png]] ![[x.png]] ![[x.png]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledTimes(1);
        });

        it('strips the alias portion (text after |) before resolving', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/img.png' });
            await resolver.resolveEmbeds('![[img.png|My caption]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledWith('img.png', expect.any(String), workspace);
        });

        it('strips the fragment portion (text after #) before resolving', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/note.md' });
            await resolver.resolveEmbeds('![[note.md#Section]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledWith('note.md', expect.any(String), workspace);
        });
    });

    // ── resolveEmbeds – failure and caching ───────────────────────────────────

    describe('resolveEmbeds (failure/caching)', () => {
        it('caches a negative result (empty string) for files that cannot be resolved', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: false });
            await resolver.resolveEmbeds('![[missing.png]]');
            expect(resolver.embedCache.value.get('missing.png')).toBe('');
        });

        it('does not call resolveEmbedPath for filenames already in the cache', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            await resolver.resolveEmbeds('![[image.png]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledTimes(1);
        });

        it('does not bump embedCacheVersion when nothing changes', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            const versionAfterFirst = resolver.embedCacheVersion.value;
            // Second call — image.png is already cached, so no change
            await resolver.resolveEmbeds('![[image.png]]');
            expect(resolver.embedCacheVersion.value).toBe(versionAfterFirst);
        });
    });

    // ── clearCache ────────────────────────────────────────────────────────────

    describe('clearCache', () => {
        it('empties the embed cache', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            resolver.clearCache();
            expect(resolver.embedCache.value.size).toBe(0);
        });

        it('bumps embedCacheVersion after clearing', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            const before = resolver.embedCacheVersion.value;
            resolver.clearCache();
            expect(resolver.embedCacheVersion.value).toBeGreaterThan(before);
        });

        it('allows a previously-cached file to be resolved again after clear', async () => {
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            resolver.clearCache();
            vi.clearAllMocks();
            mockAPI.resolveEmbedPath.mockResolvedValue({ success: true, path: '/vault/image.png' });
            await resolver.resolveEmbeds('![[image.png]]');
            expect(mockAPI.resolveEmbedPath).toHaveBeenCalledTimes(1);
        });
    });
});
