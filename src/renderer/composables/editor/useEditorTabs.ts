import { ref, computed } from 'vue';
import type { FileInfo } from '../../types/electron';

const MAX_TABS = 10;

export interface TabState {
    file: FileInfo;
    /** Cached text content — only populated for text/markdown/code files */
    content: string | null;
    /** The last-saved content snapshot used to detect unsaved changes */
    savedContent: string | null;
    /** True when content differs from savedContent */
    hasUnsavedChanges: boolean;
    /** Scroll position to restore on tab switch */
    scrollTop: number;
}

export function useEditorTabs() {
    const tabs = ref<TabState[]>([]);
    const activeIndex = ref<number>(-1);

    const activeTab = computed<TabState | null>(() => tabs.value[activeIndex.value] ?? null);
    const activeFile = computed<FileInfo | null>(() => activeTab.value?.file ?? null);

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
            return safeReplace;
        }

        tabs.value.push(newTab);
        activeIndex.value = tabs.value.length - 1;
        return activeIndex.value;
    }

    /** Close tab by index. Activates nearest remaining tab. */
    function closeTab(index: number) {
        if (index < 0 || index >= tabs.value.length) return;
        tabs.value.splice(index, 1);

        if (tabs.value.length === 0) {
            activeIndex.value = -1;
            return;
        }

        if (activeIndex.value >= tabs.value.length) {
            activeIndex.value = tabs.value.length - 1;
        } else if (index < activeIndex.value) {
            activeIndex.value = activeIndex.value - 1;
        }
        // If index === activeIndex, we stay at same index (now pointing to the next tab)
    }

    /** Activate an existing tab by index. */
    function switchTab(index: number) {
        if (index >= 0 && index < tabs.value.length) {
            activeIndex.value = index;
        }
    }

    /** Update the cached content for the active tab (called by NoteEditor on input). */
    function updateTabContent(filePath: string, content: string, hasUnsavedChanges: boolean) {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab) {
            tab.content = content;
            tab.hasUnsavedChanges = hasUnsavedChanges;
        }
    }

    /** Called after a successful save — clear unsaved flag and update savedContent snapshot. */
    function markTabSaved(filePath: string, content: string) {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab) {
            tab.savedContent = content;
            tab.content = content;
            tab.hasUnsavedChanges = false;
        }
    }

    /** Save scroll position when leaving a tab. */
    function saveScrollPosition(filePath: string, scrollTop: number) {
        const tab = tabs.value.find((t) => t.file.path === filePath);
        if (tab) tab.scrollTop = scrollTop;
    }

    /** Called after a vault refresh — update FileInfo references for existing tabs. */
    function syncTabFiles(availableFiles: FileInfo[]) {
        tabs.value = tabs.value.filter((tab) => {
            const updated = availableFiles.find((f) => f.path === tab.file.path);
            if (updated) {
                tab.file = updated;
                return true;
            }
            return false;
        });
        if (activeIndex.value >= tabs.value.length) {
            activeIndex.value = tabs.value.length - 1;
        }
    }

    /** Called when a file is renamed — update the matching tab. */
    function renameTabFile(oldPath: string, newFile: FileInfo) {
        const tab = tabs.value.find((t) => t.file.path === oldPath);
        if (tab) tab.file = newFile;
    }

    /** Remove all tabs (e.g. on vault close). */
    function clearTabs() {
        tabs.value = [];
        activeIndex.value = -1;
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
        clearTabs,
        MAX_TABS,
    };
}
