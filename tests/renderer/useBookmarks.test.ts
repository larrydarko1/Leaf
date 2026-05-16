import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isReactive } from 'vue';
import { useBookmarks } from '../../src/renderer/composables/vault/useBookmarks';

const mockAPI = {
    bookmarksLoad: vi.fn(),
    bookmarksSave: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

describe('useBookmarks', () => {
    let bm: ReturnType<typeof useBookmarks>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAPI.bookmarksSave.mockResolvedValue({ success: true });
        bm = useBookmarks(() => '/vault');
    });

    // ── loadBookmarks ────────────────────────────────────────────────────────

    describe('loadBookmarks', () => {
        it('populates bookmarkedFiles on success', async () => {
            mockAPI.bookmarksLoad.mockResolvedValue({
                success: true,
                bookmarks: ['/vault/a.md', '/vault/b.md'],
            });
            await bm.loadBookmarks();
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/a.md', '/vault/b.md']);
        });

        it('sets empty array when success response carries no bookmarks field', async () => {
            mockAPI.bookmarksLoad.mockResolvedValue({ success: true });
            await bm.loadBookmarks();
            expect(bm.bookmarkedFiles.value).toEqual([]);
        });

        it('sets empty array on IPC failure', async () => {
            mockAPI.bookmarksLoad.mockResolvedValue({ success: false, error: 'No vault open' });
            await bm.loadBookmarks();
            expect(bm.bookmarkedFiles.value).toEqual([]);
        });

        it('sets empty array when IPC throws', async () => {
            mockAPI.bookmarksLoad.mockRejectedValue(new Error('IPC error'));
            await bm.loadBookmarks();
            expect(bm.bookmarkedFiles.value).toEqual([]);
        });

        it('replaces a previous list on successive loads', async () => {
            mockAPI.bookmarksLoad.mockResolvedValueOnce({ success: true, bookmarks: ['/vault/a.md'] });
            await bm.loadBookmarks();
            mockAPI.bookmarksLoad.mockResolvedValueOnce({ success: true, bookmarks: ['/vault/b.md'] });
            await bm.loadBookmarks();
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/b.md']);
        });
    });

    // ── toggleBookmark ───────────────────────────────────────────────────────

    describe('toggleBookmark', () => {
        it('adds a file not yet in the list', () => {
            bm.toggleBookmark('/vault/a.md');
            expect(bm.bookmarkedFiles.value).toContain('/vault/a.md');
        });

        it('removes a file that is already bookmarked', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md'];
            bm.toggleBookmark('/vault/a.md');
            expect(bm.bookmarkedFiles.value).not.toContain('/vault/a.md');
        });

        it('calls bookmarksSave with the new list after adding', () => {
            bm.toggleBookmark('/vault/a.md');
            expect(mockAPI.bookmarksSave).toHaveBeenCalledWith(['/vault/a.md']);
        });

        it('calls bookmarksSave with the new list after removing', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md', '/vault/b.md'];
            bm.toggleBookmark('/vault/a.md');
            expect(mockAPI.bookmarksSave).toHaveBeenCalledWith(['/vault/b.md']);
        });

        it('preserves other bookmarks when toggling one off', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md', '/vault/b.md', '/vault/c.md'];
            bm.toggleBookmark('/vault/b.md');
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/a.md', '/vault/c.md']);
        });

        it('appends at the end of the list when adding', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md'];
            bm.toggleBookmark('/vault/b.md');
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/a.md', '/vault/b.md']);
        });

        it('passes a plain non-reactive array to bookmarksSave (IPC structured-clone safe)', () => {
            bm.toggleBookmark('/vault/a.md');
            const arg = mockAPI.bookmarksSave.mock.calls[0][0];
            expect(isReactive(arg)).toBe(false);
            expect(Array.isArray(arg)).toBe(true);
        });
    });

    // ── removeBookmark ───────────────────────────────────────────────────────

    describe('removeBookmark', () => {
        it('removes a bookmarked file', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md', '/vault/b.md'];
            bm.removeBookmark('/vault/a.md');
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/b.md']);
        });

        it('is a no-op for a path not in the list', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md'];
            bm.removeBookmark('/vault/z.md');
            expect(bm.bookmarkedFiles.value).toEqual(['/vault/a.md']);
        });

        it('does not call bookmarksSave for a no-op removal', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md'];
            bm.removeBookmark('/vault/z.md');
            expect(mockAPI.bookmarksSave).not.toHaveBeenCalled();
        });

        it('calls bookmarksSave with the reduced list after removing', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md', '/vault/b.md'];
            bm.removeBookmark('/vault/a.md');
            expect(mockAPI.bookmarksSave).toHaveBeenCalledWith(['/vault/b.md']);
        });

        it('results in an empty list after removing the last bookmark', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md'];
            bm.removeBookmark('/vault/a.md');
            expect(bm.bookmarkedFiles.value).toEqual([]);
        });

        it('passes a plain non-reactive array to bookmarksSave (IPC structured-clone safe)', () => {
            bm.bookmarkedFiles.value = ['/vault/a.md', '/vault/b.md'];
            bm.removeBookmark('/vault/a.md');
            const arg = mockAPI.bookmarksSave.mock.calls[0][0];
            expect(isReactive(arg)).toBe(false);
            expect(Array.isArray(arg)).toBe(true);
        });
    });
});
