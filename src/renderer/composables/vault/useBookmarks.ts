/**
 * useBookmarks — persists per-vault file bookmarks in <vault>/.leaf/bookmarks.json.
 */

import { ref } from 'vue';

export function useBookmarks(_getCurrentFolder: () => string | null) {
    const bookmarkedFiles = ref<string[]>([]);

    async function load() {
        try {
            const result = await window.electronAPI.bookmarksLoad();
            bookmarkedFiles.value = result.success === true && result.bookmarks !== undefined ? result.bookmarks : [];
        } catch {
            bookmarkedFiles.value = [];
        }
    }

    async function save() {
        try {
            await window.electronAPI.bookmarksSave([...bookmarkedFiles.value]);
        } catch {
            // Best-effort — don't surface save errors to the user
        }
    }

    function toggle(filePath: string): void {
        const index = bookmarkedFiles.value.indexOf(filePath);
        if (index >= 0) {
            bookmarkedFiles.value.splice(index, 1);
        } else {
            bookmarkedFiles.value.push(filePath);
        }
        void save();
    }

    function remove(filePath: string): void {
        const index = bookmarkedFiles.value.indexOf(filePath);
        if (index >= 0) {
            bookmarkedFiles.value.splice(index, 1);
            void save();
        }
    }

    /**
     * Follows a file or folder to its new location: rewrites the bookmark for
     * `oldPath` itself and for anything beneath it (so moving/renaming a folder
     * carries the bookmarks of the files it contains).
     */
    function relocate(oldPath: string, newPath: string): void {
        const normalize = (p: string): string => p.replace(/\\/g, '/');
        const oldNormalized = normalize(oldPath);
        const descendantPrefix = oldNormalized + '/';

        let changed = false;
        const updated: string[] = [];
        for (const bookmark of bookmarkedFiles.value) {
            const normalized = normalize(bookmark);
            let next = bookmark;
            if (normalized === oldNormalized) {
                next = newPath;
            } else if (normalized.startsWith(descendantPrefix)) {
                const separator = bookmark.includes('\\') ? '\\' : '/';
                const tail = normalized.slice(oldNormalized.length);
                next = (normalize(newPath) + tail).replace(/\//g, separator);
            }
            if (next !== bookmark) changed = true;
            if (!updated.includes(next)) updated.push(next);
        }

        if (changed) {
            bookmarkedFiles.value = updated;
            void save();
        }
    }

    return {
        bookmarkedFiles,
        loadBookmarks: load,
        toggleBookmark: toggle,
        removeBookmark: remove,
        relocateBookmark: relocate,
    };
}
