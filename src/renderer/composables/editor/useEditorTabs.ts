/**
 * useEditorTabs — manages open file tabs with localStorage persistence.
 */

import { ref, computed } from 'vue';
import type { FileInfo } from '@/types/electron';

export type TabState = {
    file: FileInfo; // Cached text content — only populated for text/markdown/code files
    content: string | null; // The last-saved content snapshot used to detect unsaved changes
    savedContent: string | null;
    hasUnsavedChanges: boolean; // True when content differs from savedContent
    scrollTop: number; // Scroll position to restore on tab switch
};

type PersistedTab = {
    path: string;
    scrollTop: number;
};

type PersistedTabState = {
    tabs: PersistedTab[];
    activeIndex: number;
};

const MAX_TABS = 10;
const STORAGE_KEY_PREFIX = 'leaf-tabs-';

export function useEditorTabs() {
    const tabs = ref<TabState[]>([]);
    const activeIndex = ref<number>(-1);
    let currentFolderPath: string | null = null;

    const activeTab = computed<TabState | null>(() => tabs.value[activeIndex.value] ?? null);
    const activeFile = computed<FileInfo | null>(() => activeTab.value?.file ?? null);

    // --- Persistence helpers ---

    function storageKey(): string | null {
        return currentFolderPath !== null ? `${STORAGE_KEY_PREFIX}${currentFolderPath}` : null;
    }

    function persistTabs(): void {
        const key = storageKey();
        if (key === null) return;
        const data: PersistedTabState = {
            tabs: tabs.value.map((t) => ({ path: t.file.path, scrollTop: t.scrollTop })),
            activeIndex: activeIndex.value,
        };
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch {
            // Storage full or unavailable — silently ignore
        }
    }

    /**
     * Restore tabs from localStorage for the given vault folder.
     * Only restores tabs whose files still exist in availableFiles.
     * Returns true if any tabs were restored.
     */
    function restoreTabs(folderPath: string, availableFiles: FileInfo[]): boolean {
        currentFolderPath = folderPath;
        const key = storageKey();
        if (key === null) return false;

        let data: PersistedTabState;
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return false;
            const parsed = JSON.parse(raw) as unknown;
            if (!isValidPersistedTabState(parsed)) return false;
            data = parsed;
        } catch {
            return false;
        }

        if (data.tabs.length === 0) return false;

        const fileMap = new Map(availableFiles.map((f) => [f.path, f]));
        const restoredTabs: TabState[] = [];

        for (const persisted of data.tabs) {
            const file = fileMap.get(persisted.path);
            if (file !== undefined) {
                restoredTabs.push({
                    file,
                    content: null,
                    savedContent: null,
                    hasUnsavedChanges: false,
                    scrollTop: persisted.scrollTop ?? 0,
                });
            }
        }

        if (restoredTabs.length === 0) return false;

        tabs.value = restoredTabs;
        // Clamp activeIndex to valid range
        const savedIndex = data.activeIndex ?? 0;
        activeIndex.value = Math.max(0, Math.min(savedIndex, restoredTabs.length - 1));

        // Re-persist in case some tabs were pruned
        persistTabs();
        return true;
    }

    /** Set the current folder path for persistence scoping. */
    function setFolderPath(folderPath: string | null): void {
        currentFolderPath = folderPath;
    }

    /**
     * Open a file in a new tab.
     * - If the file is already open, activate that tab.
     * - If at cap (10), replace the least-recently-used (last) tab.
     * Returns the index of the (new or existing) tab.
     */
    function openTab(file: FileInfo): number {
        const existing = tabs.value.findIndex((t) => t.file.path === file.path);
        if (existing !== -1) {
            activeIndex.value = existing;
            persistTabs();
            return existing;
        }

        const newTab: TabState = {
            file,
            content: null,
            savedContent: null,
            hasUnsavedChanges: false,
            scrollTop: 0,
        };

        if (tabs.value.length >= MAX_TABS) {
            // Replace last tab (it's the oldest non-active one due to normal usage patterns)
            const replaceIndex =
                tabs.value.length - 1 === activeIndex.value ? tabs.value.length - 2 : tabs.value.length - 1;
            const safeReplace = replaceIndex < 0 ? 0 : replaceIndex;
            tabs.value.splice(safeReplace, 1, newTab);
            activeIndex.value = safeReplace;
            persistTabs();
            return safeReplace;
        }

        tabs.value.push(newTab);
        activeIndex.value = tabs.value.length - 1;
        persistTabs();
        return activeIndex.value;
    }

    /** Close tab by index. Activates nearest remaining tab. */
    function closeTab(index: number): void {
        if (index < 0 || index >= tabs.value.length) return;
        tabs.value.splice(index, 1);

        if (tabs.value.length === 0) {
            activeIndex.value = -1;
            persistTabs();
            return;
        }

        if (activeIndex.value >= tabs.value.length) {
            activeIndex.value = tabs.value.length - 1;
        } else if (index < activeIndex.value) {
            activeIndex.value = activeIndex.value - 1;
        }
        // If index === activeIndex, we stay at same index (now pointing to the next tab)
        persistTabs();
    }

    /** Activate an existing tab by index. */
    function switchTab(index: number): void {
        if (index >= 0 && index < tabs.value.length) {
            activeIndex.value = index;
            persistTabs();
        }
    }

    /** Update the cached content for the active tab (called by NoteEditor on input). */
    function updateTabContent(filePath: string, content: string, hasUnsavedChanges: boolean): void {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab !== undefined) {
            tab.content = content;
            tab.hasUnsavedChanges = hasUnsavedChanges;
        }
    }

    /** Called after a successful save — clear unsaved flag and update savedContent snapshot. */
    function markTabSaved(filePath: string, content: string): void {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab !== undefined) {
            tab.savedContent = content;
            tab.content = content;
            tab.hasUnsavedChanges = false;
        }
    }

    /** Save scroll position when leaving a tab. */
    function saveScrollPosition(filePath: string, scrollTop: number): void {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab !== undefined) {
            tab.scrollTop = scrollTop;
            persistTabs();
        }
    }

    /** Called after a vault refresh — update FileInfo references for existing tabs. */
    function syncTabFiles(availableFiles: FileInfo[]): void {
        const before = tabs.value.length;
        tabs.value = tabs.value.filter((tab) => {
            const updated = availableFiles.find((f) => f.path === tab.file.path);
            if (updated !== undefined) {
                tab.file = updated;
                return true;
            }
            return false;
        });
        if (activeIndex.value >= tabs.value.length) {
            activeIndex.value = tabs.value.length - 1;
        }
        if (tabs.value.length !== before) {
            persistTabs();
        }
    }

    /** Called when a file is renamed — update the matching tab. */
    function renameTabFile(oldPath: string, newFile: FileInfo): void {
        const tab = tabs.value.find((t) => t.file.path === oldPath);
        if (tab !== undefined) {
            tab.file = newFile;
            persistTabs();
        }
    }

    /** Move a tab from one position to another (drag-and-drop reorder). */
    function reorderTab(from: number, to: number): void {
        if (from === to || from < 0 || to < 0 || from >= tabs.value.length || to >= tabs.value.length) return;
        const newTabs = [...tabs.value];
        const [moved] = newTabs.splice(from, 1);
        newTabs.splice(to, 0, moved);
        tabs.value = newTabs;

        // Keep the active tab pointing to the same tab after reorder
        if (activeIndex.value === from) {
            activeIndex.value = to;
        } else if (from < to) {
            if (activeIndex.value > from && activeIndex.value <= to) activeIndex.value--;
        } else {
            if (activeIndex.value >= to && activeIndex.value < from) activeIndex.value++;
        }
        persistTabs();
    }

    /** Remove all tabs (e.g. on vault close). */
    function clearTabs(): void {
        tabs.value = [];
        activeIndex.value = -1;
        persistTabs();
    }

    return {
        tabs,
        activeIndex,
        activeTab,
        activeFile,
        openTab,
        closeTab,
        switchTab,
        updateTabContent,
        markTabSaved,
        saveScrollPosition,
        syncTabFiles,
        renameTabFile,
        reorderTab,
        clearTabs,
        restoreTabs,
        setFolderPath,
        MAX_TABS,
    };
}

// Type guard for PersistedTabState
function isValidPersistedTabState(data: unknown): data is PersistedTabState {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
        Array.isArray(obj.tabs) &&
        obj.tabs.every(
            (tab: unknown) =>
                typeof tab === 'object' &&
                tab !== null &&
                typeof (tab as Record<string, unknown>).path === 'string' &&
                typeof (tab as Record<string, unknown>).scrollTop === 'number',
        ) &&
        typeof obj.activeIndex === 'number'
    );
}
