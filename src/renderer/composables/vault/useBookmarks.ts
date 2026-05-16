/**
 * useBookmarks — persists per-vault file bookmarks in <vault>/.leaf/bookmarks.json.
 */

import { ref } from 'vue';

export function useBookmarks(_getCurrentFolder: () => string | null) {
    const bookmarkedFiles = ref<string[]>([]);

    async function load() {
        try {
            const result = await window.electronAPI.bookmarksLoad();
            bookmarkedFiles.value = result.success && result.bookmarks ? result.bookmarks : [];
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

    function toggle(filePath: string) {
        const index = bookmarkedFiles.value.indexOf(filePath);
        if (index >= 0) {
            bookmarkedFiles.value.splice(index, 1);
        } else {
            bookmarkedFiles.value.push(filePath);
        }
        save();
    }

    function remove(filePath: string) {
        const index = bookmarkedFiles.value.indexOf(filePath);
        if (index >= 0) {
            bookmarkedFiles.value.splice(index, 1);
            save();
        }
    }

    return {
        bookmarkedFiles,
        loadBookmarks: load,
        toggleBookmark: toggle,
        removeBookmark: remove,
    };
}
