import { ref, computed } from 'vue';

export function useBookmarks(getCurrentFolder: () => string | null) {
    const bookmarkedFiles = ref<string[]>([]);

    const storageKey = computed(() => {
        const folder = getCurrentFolder();
        return folder ? `leaf-bookmarks-${folder}` : null;
    });

    function load() {
        if (!storageKey.value) {
            bookmarkedFiles.value = [];
            return;
        }
        try {
            const saved = localStorage.getItem(storageKey.value);
            bookmarkedFiles.value = saved ? JSON.parse(saved) : [];
        } catch {
            bookmarkedFiles.value = [];
        }
    }

    function save() {
        if (storageKey.value) {
            localStorage.setItem(storageKey.value, JSON.stringify(bookmarkedFiles.value));
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
