<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import FileExplorer from '@/renderer/components/FileExplorer.vue';
import NoteEditor from '@/renderer/components/NoteEditor.vue';
import TabBar from '@/renderer/components/TabBar.vue';
import SearchPanel from '@/renderer/components/SearchPanel.vue';
import BookmarksPanel from '@/renderer/components/BookmarksPanel.vue';
import AudioRecorder from '@/renderer/components/AudioRecorder.vue';
import AiPanel from '@/renderer/components/AiPanel.vue';
import ThemePicker from '@/renderer/components/ThemePicker.vue';
import LanguagePicker from '@/renderer/components/LanguagePicker.vue';
import type { FileInfo } from '@/schemas/vault';
import { useVault } from '@/renderer/composables/vault/useVault';
import { useFileSelection } from '@/renderer/composables/vault/useFileSelection';
import { useBookmarks } from '@/renderer/composables/vault/useBookmarks';
import { useEditorTabs } from '@/renderer/composables/editor/useEditorTabs';
import { useTheme } from '@/renderer/composables/ui/useTheme';
import { useLanguage } from '@/renderer/composables/ui/useLanguage';

const { t } = useI18n();

const noteEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null);
const vault = useVault();
const selection = useFileSelection();
const bookmarks = useBookmarks(() => vault.currentFolder.value);
const editorTabs = useEditorTabs();
const theme = useTheme();
const language = useLanguage();
const { currentFolder, files, folders } = vault;
const { selectedFiles, selectedFolder } = selection;
const activeFile = editorTabs.activeFile;
const { bookmarkedFiles, toggleBookmark, removeBookmark } = bookmarks;
const renamingFile = ref<FileInfo | null>(null);
const renamingFolder = ref<string | null>(null);
const showSearchPanel = ref(false);
const showBookmarksPanel = ref(false);
const showAiPanel = ref(false);
const showThemePanel = ref(false);
const showLanguagePanel = ref(false);

onMounted(() => {
    void theme.refresh();
    void language.refresh();

    const savedFolder = localStorage.getItem('leaf-folder-path');
    if (savedFolder !== null && savedFolder !== '') void loadFolderPath(savedFolder);

    vault.setExternalChangeCallback(() => {
        void refreshFiles();
    });
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleExternalLinkClick, true);
});

onBeforeUnmount(() => {
    vault.closeVault();
    window.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleExternalLinkClick, true);
});

function handleExternalLinkClick(e: MouseEvent) {
    const closest = (e.target as HTMLElement)?.closest('a');
    const target = closest instanceof HTMLAnchorElement ? closest : null;
    if (target === null) return;
    const href = target.getAttribute('href');
    if (href !== null && href !== '' && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault();
        e.stopPropagation();
        void window.electronAPI.openExternal(href);
    }
}

async function refreshFiles() {
    await vault.refreshFiles();
    selection.syncAfterRefresh(vault.files.value);
    editorTabs.syncTabFiles(vault.files.value);
}

async function selectFolder() {
    const folderPath = await vault.openFolderDialog();
    if (folderPath !== null && folderPath !== '') {
        editorTabs.clearTabs();
        const restored = editorTabs.restoreTabs(folderPath, vault.files.value);
        if (!restored) {
            selection.restoreFromStorage(vault.files.value);
            const restoredFile = selection.activeFile.value;
            if (restoredFile !== null) editorTabs.openTab(restoredFile);
        } else {
            // Sync file selection with the restored active tab
            const activeTabFile = editorTabs.activeFile.value;
            if (activeTabFile !== null) selection.openFile(activeTabFile);
        }
        await bookmarks.loadBookmarks();
    }
}

async function loadFolderPath(folderPath: string) {
    await vault.loadFolder(folderPath);
    const restored = editorTabs.restoreTabs(folderPath, vault.files.value);
    if (!restored) {
        selection.restoreFromStorage(vault.files.value);
        const restoredFile = selection.activeFile.value;
        if (restoredFile !== null) editorTabs.openTab(restoredFile);
    } else {
        // Sync file selection with the restored active tab
        const activeTabFile = editorTabs.activeFile.value;
        if (activeTabFile !== null) selection.openFile(activeTabFile);
    }
    await bookmarks.loadBookmarks();
}

function changeFolder() {
    vault.closeVault();
    selection.clearSelection();
    editorTabs.clearTabs();
    editorTabs.setFolderPath(null);
}

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'F2') {
        e.preventDefault();
        if (activeFile.value !== null && renamingFile.value === null) {
            startRenameFile(activeFile.value);
        } else if (
            selectedFolder.value !== null &&
            selectedFolder.value !== '' &&
            (renamingFolder.value === null || renamingFolder.value === '')
        ) {
            startRenameFolder(selectedFolder.value);
        }
    }
}

function handleFileSelect(file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]) {
    selection.selectFile(file, event, visibleFiles);
    // Open/activate a tab for the single active file (ignore multi-select)
    if (event?.shiftKey !== true) {
        editorTabs.openTab(file);
    }
}

function handleFolderSelect(folderPath: string) {
    selection.selectFolder(folderPath);
}

function handleFileSave() {
    // Mark the active tab as saved
    if (activeFile.value !== null) {
        const tab = editorTabs.tabs.value.find((t) => t.file.path === activeFile.value?.path);
        if (tab !== null && tab !== undefined && tab.content !== null) {
            editorTabs.markTabSaved(activeFile.value.path, tab.content);
        }
    }
    void refreshFiles();
}

function handleContentChanged(hasChanges: boolean) {
    if (activeFile.value !== null) {
        const tab = editorTabs.tabs.value.find((t) => t.file.path === activeFile.value?.path);
        if (tab !== null && tab !== undefined) tab.hasUnsavedChanges = hasChanges;
    }
}

function handleAiFileChanged(changedPath: string) {
    if (activeFile.value?.path === changedPath) {
        noteEditorRef.value?.reloadContent();
    }
    void refreshFiles();
}

async function handleRecordingSaved(filePath: string) {
    await refreshFiles();
    const recordingFile = vault.files.value.find((f: FileInfo) => f.path === filePath);
    if (recordingFile !== undefined) {
        selection.openFile(recordingFile);
        editorTabs.openTab(recordingFile);
    }
}

async function createNewFile() {
    const newFile = await vault.createFile();
    if (newFile !== null) {
        selection.openFile(newFile);
        editorTabs.openTab(newFile);
    }
}

async function createNewDrawing() {
    const newFile = await vault.createDrawing();
    if (newFile !== null) {
        selection.openFile(newFile);
        editorTabs.openTab(newFile);
    }
}

async function createNewFolder() {
    await vault.createFolder();
}

function startRenameFile(file: FileInfo) {
    selection.openFile(file);
    editorTabs.openTab(file);
    renamingFile.value = file;
}

function startRenameFolder(folderPath: string) {
    selection.selectFolder(folderPath);
    renamingFolder.value = folderPath;
}

function cancelRename() {
    renamingFile.value = null;
    renamingFolder.value = null;
}

async function handleFileRename(file: FileInfo, newName: string) {
    const renamed = await vault.renameFile(file, newName);
    renamingFile.value = null;
    if (renamed !== null) {
        editorTabs.renameTabFile(file.path, renamed);
        selection.openFile(renamed);
    }
}

async function handleFolderRename(folderPath: string, newName: string) {
    const newRelativePath = await vault.renameFolder(folderPath, newName);
    renamingFolder.value = null;
    if (newRelativePath !== null && newRelativePath !== '') selectedFolder.value = newRelativePath;
}

async function handleFolderDelete(folderPath: string) {
    const deleted = await vault.deleteFolder(folderPath);
    if (deleted) selectedFolder.value = null;
}

async function handleFileDelete(file: FileInfo) {
    const filesToDelete = selectedFiles.value.length > 1 ? selectedFiles.value : [file];
    const deletedPaths = filesToDelete.map((f) => f.path);
    await vault.deleteFile(filesToDelete);
    // Close deleted tabs (iterate in reverse so indices stay valid)
    const indicesToClose = deletedPaths
        .map((p) => editorTabs.tabs.value.findIndex((t) => t.file.path === p))
        .filter((i) => i !== -1)
        .sort((a, b) => b - a);
    indicesToClose.forEach((idx) => editorTabs.closeTab(idx));
    selection.clearSelection();
    if (vault.files.value.length > 0) {
        const next = vault.files.value[0];
        selection.openFile(next);
        editorTabs.openTab(next);
    }
}

async function handleFileMove(filePath: string, targetFolderPath: string) {
    const filePaths = selectedFiles.value.length > 1 ? selectedFiles.value.map((f: FileInfo) => f.path) : [filePath];
    const movedPaths = await vault.moveFiles(filePaths, targetFolderPath);
    const movedFiles = vault.files.value.filter((f: FileInfo) => movedPaths.includes(f.path));
    if (movedFiles.length > 0) {
        selectedFiles.value = movedFiles;
        selection.openFile(movedFiles[0]);
        editorTabs.openTab(movedFiles[0]);
    }
}

async function handleFolderMove(folderPath: string, targetFolderPath: string) {
    const moved = await vault.moveFolder(folderPath, targetFolderPath);
    if (moved) selectedFolder.value = null;
}

function toggleSearch() {
    showSearchPanel.value = !showSearchPanel.value;
    if (showSearchPanel.value) showBookmarksPanel.value = false;
}

function closeSearch() {
    showSearchPanel.value = false;
}

function handleSearchFileSelect(file: FileInfo, event?: MouseEvent | KeyboardEvent) {
    selection.selectFile(file, event instanceof MouseEvent ? event : undefined);
    editorTabs.openTab(file);
}

function handleSearchFileOpen(file: FileInfo) {
    selection.openFile(file);
    editorTabs.openTab(file);
    showSearchPanel.value = false;
}

function handleTabSwitch(index: number) {
    editorTabs.switchTab(index);
    const file = editorTabs.activeFile.value;
    if (file !== null) {
        selection.openFile(file);
    }
}

function toggleBookmarks() {
    showBookmarksPanel.value = !showBookmarksPanel.value;
    if (showBookmarksPanel.value) showSearchPanel.value = false;
}

function toggleAiPanel() {
    showAiPanel.value = !showAiPanel.value;
    if (showAiPanel.value) {
        showThemePanel.value = false;
        showLanguagePanel.value = false;
    }
}

function toggleThemePanel() {
    showThemePanel.value = !showThemePanel.value;
    if (showThemePanel.value) {
        showAiPanel.value = false;
        showLanguagePanel.value = false;
    }
}

function toggleLanguagePanel() {
    showLanguagePanel.value = !showLanguagePanel.value;
    if (showLanguagePanel.value) {
        showAiPanel.value = false;
        showThemePanel.value = false;
    }
}
</script>

<template>
    <div id="app">
        <div class="leaf-app">
            <!-- Welcome screen when no folder is selected -->
            <div
                v-if="!currentFolder"
                class="welcome-screen">
                <div class="welcome-content">
                    <div class="welcome-logo">
                        <img
                            draggable="false"
                            src="./assets/icons/icon.png"
                            alt="Leaf logo"
                            class="welcome-logo-icon" />
                        <span class="welcome-logo-text">leaf.</span>
                    </div>

                    <button
                        class="btn-primary"
                        :aria-label="t('app.select_folder_description')"
                        @click="selectFolder">
                        {{ t('app.select_folder') }}
                    </button>
                </div>
            </div>

            <!-- Main app interface -->
            <div
                v-else
                class="app-layout">
                <div class="left-column">
                    <nav
                        class="sidebar-menu"
                        :aria-label="t('app.main_navigation')">
                        <!-- Workspace pill -->
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :aria-label="t('app.change_folder')"
                                @click="changeFolder">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <path
                                        fill-rule="evenodd"
                                        clip-rule="evenodd"
                                        d="M9.70725 2.4087C9 3.03569 9 4.18259 9 6.4764V17.5236C9 19.8174 9 20.9643 9.70725 21.5913C10.4145 22.2183 11.4955 22.0297 13.6576 21.6526L15.9864 21.2465C18.3809 20.8288 19.5781 20.62 20.2891 19.7417C21 18.8635 21 17.5933 21 15.0529V8.94711C21 6.40671 21 5.13652 20.2891 4.25826C19.5781 3.37999 18.3809 3.17118 15.9864 2.75354L13.6576 2.34736C11.4955 1.97026 10.4145 1.78171 9.70725 2.4087ZM12 10.1686C12.4142 10.1686 12.75 10.52 12.75 10.9535V13.0465C12.75 13.48 12.4142 13.8314 12 13.8314C11.5858 13.8314 11.25 13.48 11.25 13.0465V10.9535C11.25 10.52 11.5858 10.1686 12 10.1686Z"></path>
                                    <path
                                        d="M7.54717 4.5C5.48889 4.503 4.41599 4.54826 3.73223 5.23202C3 5.96425 3 7.14276 3 9.49979V14.4998C3 16.8568 3 18.0353 3.73223 18.7676C4.41599 19.4513 5.48889 19.4966 7.54717 19.4996C7.49985 18.8763 7.49992 18.1557 7.50001 17.3768V6.6227C7.49992 5.84388 7.49985 5.1233 7.54717 4.5Z"></path>
                                </svg>
                            </button>
                        </div>

                        <!-- Create actions pill -->
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :aria-label="t('app.create_new_note')"
                                @click="createNewFile">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M12 2C13.4992 2 14.7004 2 15.6773 2.07361C15.5629 2.3601 15.5 2.6727 15.5 3V3.5H15C13.6193 3.5 12.5 4.61929 12.5 6C12.5 7.38071 13.6193 8.5 15 8.5H15.5V9C15.5 10.3807 16.6193 11.5 18 11.5C18.8178 11.5 19.5439 11.1073 20 10.5002V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V10C4 6.22876 4 4.34315 5.17157 3.17157C6.34315 2 8.22876 2 12 2ZM8 11C7.44772 11 7 11.4477 7 12C7 12.5523 7.44772 13 8 13H12C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11H8ZM8 14C7.44772 14 7 14.4477 7 15C7 15.5523 7.44772 16 8 16H14C14.5523 16 15 15.5523 15 15C15 14.4477 14.5523 14 14 14H8ZM8 17C7.44772 17 7 17.4477 7 18C7 18.5523 7.44772 19 8 19H12C12.5523 19 13 18.5523 13 18C13 17.4477 12.5523 17 12 17H8Z"
                                            fill="currentColor"></path>
                                        <path
                                            d="M18 3L18 9"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"></path>
                                        <path
                                            d="M21 6L15 6"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"></path>
                                    </g>
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :aria-label="t('app.create_new_folder')"
                                @click="createNewFolder">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <defs>
                                        <mask id="folderMask">
                                            <rect
                                                width="24"
                                                height="24"
                                                fill="white" />
                                            <path
                                                d="M10 14H12M12 14H14M12 14V16M12 14V12"
                                                stroke="black"
                                                stroke-width="1.5"
                                                stroke-linecap="round" />
                                        </mask>
                                    </defs>
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            mask="url(#folderMask)"
                                            d="M2 6.94975C2 6.06722 2 5.62595 2.06935 5.25839C2.37464 3.64031 3.64031 2.37464 5.25839 2.06935C5.62595 2 6.06722 2 6.94975 2C7.33642 2 7.52976 2 7.71557 2.01738C8.51665 2.09229 9.27652 2.40704 9.89594 2.92051C10.0396 3.03961 10.1763 3.17633 10.4497 3.44975L11 4C11.8158 4.81578 12.2237 5.22367 12.7121 5.49543C12.9804 5.64471 13.2651 5.7626 13.5604 5.84678C14.0979 6 14.6747 6 15.8284 6H16.2021C18.8345 6 20.1506 6 21.0062 6.76946C21.0849 6.84024 21.1598 6.91514 21.2305 6.99383C22 7.84935 22 9.16554 22 11.7979V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V6.94975Z"
                                            fill="currentColor"
                                            stroke="currentColor"
                                            stroke-width="1.5" />
                                    </g>
                                </svg>
                            </button>
                        </div>

                        <!-- Tools pill -->
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showSearchPanel }"
                                :aria-label="t('app.search_files')"
                                :aria-pressed="showSearchPanel"
                                @click="toggleSearch">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <g id="SVGRepo_iconCarrier">
                                        <rect
                                            width="24"
                                            height="24"
                                            fill="transparent"></rect>
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M7.25007 2.38782C8.54878 2.0992 10.1243 2 12 2C13.8757 2 15.4512 2.0992 16.7499 2.38782C18.06 2.67897 19.1488 3.176 19.9864 4.01358C20.824 4.85116 21.321 5.94002 21.6122 7.25007C21.9008 8.54878 22 10.1243 22 12C22 13.8757 21.9008 15.4512 21.6122 16.7499C21.321 18.06 20.824 19.1488 19.9864 19.9864C19.1488 20.824 18.06 21.321 16.7499 21.6122C15.4512 21.9008 13.8757 22 12 22C10.1243 22 8.54878 21.9008 7.25007 21.6122C5.94002 21.321 4.85116 20.824 4.01358 19.9864C3.176 19.1488 2.67897 18.06 2.38782 16.7499C2.0992 15.4512 2 13.8757 2 12C2 10.1243 2.0992 8.54878 2.38782 7.25007C2.67897 5.94002 3.176 4.85116 4.01358 4.01358C4.85116 3.176 5.94002 2.67897 7.25007 2.38782ZM9 11.5C9 10.1193 10.1193 9 11.5 9C12.8807 9 14 10.1193 14 11.5C14 12.8807 12.8807 14 11.5 14C10.1193 14 9 12.8807 9 11.5ZM11.5 7C9.01472 7 7 9.01472 7 11.5C7 13.9853 9.01472 16 11.5 16C12.3805 16 13.202 15.7471 13.8957 15.31L15.2929 16.7071C15.6834 17.0976 16.3166 17.0976 16.7071 16.7071C17.0976 16.3166 17.0976 15.6834 16.7071 15.2929L15.31 13.8957C15.7471 13.202 16 12.3805 16 11.5C16 9.01472 13.9853 7 11.5 7Z"
                                            fill="currentColor"></path>
                                    </g>
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showBookmarksPanel }"
                                :aria-label="t('app.view_bookmarks')"
                                :aria-pressed="showBookmarksPanel"
                                @click="toggleBookmarks">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <path
                                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        fill="currentColor" />
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :aria-label="t('app.create_new_drawing')"
                                @click="createNewDrawing">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <path
                                        d="M12 19l7-7 3 3-7 7-3-3z"
                                        fill="currentColor" />
                                    <path
                                        d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
                                        fill="currentColor" />
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="2"
                                        fill="var(--base1)" />
                                </svg>
                            </button>
                            <AudioRecorder
                                :current-folder="currentFolder"
                                :aria-label="t('app.audio_recorder')"
                                @recording-saved="handleRecordingSaved" />
                        </div>

                        <!-- Bottom pill: AI + Theme -->
                        <div class="menu-spacer"></div>
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showAiPanel }"
                                :aria-label="t('app.ai_assistant')"
                                :aria-pressed="showAiPanel"
                                @click="toggleAiPanel">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    aria-hidden="true">
                                    <path
                                        d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                                    <line
                                        x1="9"
                                        y1="21"
                                        x2="15"
                                        y2="21" />
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showThemePanel }"
                                :aria-label="t('app.theme_selector')"
                                :aria-pressed="showThemePanel"
                                @click="toggleThemePanel">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <path
                                        d="M3.83904058,5.85749561 C6.78004581,1.94188971 12.8686707,0.802505202 17.2029394,3.497377 C21.4827525,6.15839057 23.0567972,11.2744655 21.303866,16.0747407 C19.648689,20.6073231 15.2875295,22.403209 12.1442101,20.1231428 C10.9667425,19.2690444 10.5102901,18.1984035 10.2896576,16.4593132 L10.1842745,15.4713913 L10.1388589,15.073954 C10.0162342,14.1399065 9.82780748,13.7214296 9.43453605,13.5022264 C8.89894535,13.2036966 8.54231757,13.1967226 7.83905282,13.4692784 L7.48794193,13.6148779 L7.30920754,13.6928218 C6.29543196,14.1331038 5.62104161,14.2877923 4.76804588,14.1090543 L4.56779442,14.0618665 L4.40426138,14.0152691 C1.61529547,13.1510586 1.20220653,9.36813303 3.83904058,5.85749561 Z M16.7670717,10.5795744 C16.9457489,11.2464071 17.6311701,11.6421352 18.2980028,11.4634579 C18.9648354,11.2847806 19.3605635,10.5993594 19.1818862,9.93252681 C19.003209,9.26569418 18.3177878,8.86996607 17.6509552,9.04864333 C16.9841225,9.2273206 16.5883944,9.91274179 16.7670717,10.5795744 Z M17.2616616,14.0682389 C17.4403389,14.7350716 18.1257601,15.1307997 18.7925927,14.9521224 C19.4594253,14.7734451 19.8551535,14.0880239 19.6764762,13.4211913 C19.4977989,12.7543587 18.8123777,12.3586306 18.1455451,12.5373078 C17.4787125,12.7159851 17.0829844,13.4014063 17.2616616,14.0682389 Z M14.7885641,7.57689062 C14.9672413,8.24372325 15.6526625,8.63945136 16.3194952,8.4607741 C16.9863278,8.28209683 17.3820559,7.59667564 17.2033786,6.92984301 C17.0247014,6.26301038 16.3392802,5.86728227 15.6724475,6.04595953 C15.0056149,6.2246368 14.6098868,6.91005799 14.7885641,7.57689062 Z M14.7600823,16.5752747 C14.9387596,17.2421074 15.6241808,17.6378355 16.2910134,17.4591582 C16.9578461,17.280481 17.3535742,16.5950598 17.1748969,15.9282271 C16.9962196,15.2613945 16.3107985,14.8656664 15.6439658,15.0443437 C14.9771332,15.2230209 14.5814051,15.9084421 14.7600823,16.5752747 Z M11.2631594,6.60529725 C11.4418366,7.27212988 12.1272578,7.66785799 12.7940904,7.48918073 C13.4609231,7.31050346 13.8566512,6.62508227 13.6779739,5.95824964 C13.4992967,5.29141701 12.8138755,4.8956889 12.1470428,5.07436616 C11.4802102,5.25304343 11.0844821,5.93846462 11.2631594,6.60529725 Z"
                                        fill="currentColor"
                                        fill-rule="nonzero" />
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showLanguagePanel }"
                                :aria-label="t('app.language_selector')"
                                :aria-pressed="showLanguagePanel"
                                @click="toggleLanguagePanel">
                                <svg
                                    viewBox="0 0 16 16"
                                    width="14"
                                    height="14"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <g
                                        id="SVGRepo_bgCarrier"
                                        stroke-width="0"></g>
                                    <g
                                        id="SVGRepo_tracerCarrier"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"></g>
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M4 0H6V2H10V4H8.86807C8.57073 5.66996 7.78574 7.17117 6.6656 8.35112C7.46567 8.73941 8.35737 8.96842 9.29948 8.99697L10.2735 6H12.7265L15.9765 16H13.8735L13.2235 14H9.77647L9.12647 16H7.0235L8.66176 10.9592C7.32639 10.8285 6.08165 10.3888 4.99999 9.71246C3.69496 10.5284 2.15255 11 0.5 11H0V9H0.5C1.5161 9 2.47775 8.76685 3.33437 8.35112C2.68381 7.66582 2.14629 6.87215 1.75171 6H4.02179C4.30023 6.43491 4.62904 6.83446 4.99999 7.19044C5.88743 6.33881 6.53369 5.23777 6.82607 4H0V2H4V0ZM12.5735 12L11.5 8.69688L10.4265 12H12.5735Z"
                                            fill="currentColor"></path>
                                    </g>
                                </svg>
                            </button>
                        </div>
                    </nav>
                </div>
                <aside
                    class="sidebar"
                    :aria-label="t('app.file_explorer_and_panels')">
                    <FileExplorer
                        v-if="!showSearchPanel && !showBookmarksPanel"
                        :aria-label="t('app.file_explorer')"
                        :files="files"
                        :folders="folders"
                        :current-folder="currentFolder"
                        :selected-files="selectedFiles"
                        :active-file="activeFile"
                        :renaming-file="renamingFile"
                        :selected-folder="selectedFolder"
                        :renaming-folder="renamingFolder"
                        :bookmarked-files="bookmarkedFiles"
                        @select-file="handleFileSelect"
                        @select-folder="handleFolderSelect"
                        @start-rename-file="startRenameFile"
                        @start-rename-folder="startRenameFolder"
                        @rename-file="handleFileRename"
                        @rename-folder="handleFolderRename"
                        @delete-file="handleFileDelete"
                        @delete-folder="handleFolderDelete"
                        @cancel-rename="cancelRename"
                        @move-file="handleFileMove"
                        @move-folder="handleFolderMove"
                        @toggle-bookmark="toggleBookmark" />
                    <SearchPanel
                        v-else-if="showSearchPanel"
                        :files="files"
                        :selected-files="selectedFiles"
                        :active-file="activeFile"
                        :aria-label="t('app.search_results')"
                        @select-file="handleSearchFileSelect"
                        @open-file="handleSearchFileOpen"
                        @close="closeSearch" />
                    <BookmarksPanel
                        v-else-if="showBookmarksPanel"
                        :files="files"
                        :bookmarked-paths="bookmarkedFiles"
                        :selected-files="selectedFiles"
                        :active-file="activeFile"
                        :aria-label="t('app.bookmarked_files')"
                        @select-file="handleSearchFileSelect"
                        @open-file="handleSearchFileOpen"
                        @remove-bookmark="removeBookmark" />
                </aside>
                <main
                    class="main-content"
                    :aria-label="t('app.editor')">
                    <TabBar
                        :tabs="editorTabs.tabs.value"
                        :active-index="editorTabs.activeIndex.value"
                        :aria-label="t('app.open_files')"
                        @switch="handleTabSwitch"
                        @close="editorTabs.closeTab"
                        @reorder="editorTabs.reorderTab" />
                    <NoteEditor
                        ref="noteEditorRef"
                        :file="activeFile"
                        :workspace-path="currentFolder"
                        :aria-label="t('app.note_editor')"
                        @save="handleFileSave"
                        @content-changed="handleContentChanged" />
                </main>
                <AiPanel
                    v-if="showAiPanel"
                    :active-file="activeFile"
                    :workspace-path="currentFolder"
                    :files="files"
                    :aria-label="t('app.ai_assistant_panel')"
                    @close="showAiPanel = false"
                    @file-changed="handleAiFileChanged" />
                <ThemePicker
                    v-if="showThemePanel"
                    :aria-label="t('app.theme_picker')"
                    @close="showThemePanel = false" />
                <LanguagePicker
                    v-if="showLanguagePanel"
                    :aria-label="t('app.language_picker')"
                    @close="showLanguagePanel = false" />
            </div>
        </div>
    </div>
</template>

<style lang="scss">
/* ––– Root Container ––– */

#app {
    width: 100%;
    height: 100vh;
    overflow: hidden;
}

/* ––– Main App Layout ––– */

.leaf-app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: $base1;
    color: $text1;
}

/* ––– Welcome Screen ––– */

.welcome-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $base1;
}

.welcome-content {
    text-align: center;
    max-width: 500px;
    padding: $font-size-3xl;
}

.welcome-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: $space-6;
}

.welcome-logo-icon {
    width: 128px;
    height: 128px;
    object-fit: contain;
}

.welcome-logo-text {
    font-family: $font-family;
    font-size: $font-size-5xl;
    font-weight: $font-weight-semibold;
    color: $text1;
    letter-spacing: -0.02em;
    cursor: default;
}

.app-title {
    font-size: $font-size-4xl;
    font-weight: $font-weight-semibold;
    margin: 0 0 $space-2;
    color: $text1;
}

.app-subtitle {
    font-size: $font-size-xl;
    color: $text2;
    margin: 0 0 $space-8;
}

/* ––– Primary Button ––– */

.btn-primary {
    padding: $space-3 $space-6;
    background: $bg-primary;
    color: $text1;
    border: 1px solid $text3;
    border-radius: $border-radius-lg;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    cursor: pointer;
    transition: all $transition-base;
    backdrop-filter: blur(8px);

    &:hover {
        background: $bg-hover;
        border-color: $text2;
        transform: scale(1.03);
    }

    &:active {
        transform: scale(0.98);
    }
}

.hint {
    margin-top: $space-4;
    font-size: $font-size-sm;
    color: $text2;
}

/* ––– App Layout Structure ––– */

.app-layout {
    display: flex;
    height: 100%;
    overflow: hidden;
}

.left-column {
    display: flex;
    flex-direction: column;
    background: $bg-secondary;
    flex-shrink: 0;
}

/* ––– Sidebar Menu ––– */

.sidebar-menu {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-1;
    background: $bg-secondary;
    flex: 1;
    overflow-y: auto;
}

.sidebar {
    width: 260px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid $text3;
    background: $base3;
    overflow: hidden;
}

/* ––– Menu Pill & Items ––– */

.menu-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-0;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-xl;
    padding: $space-0;
    backdrop-filter: blur(8px);
}

.menu-spacer {
    flex: 1;
}

.menu-divider {
    height: 1px;
    width: 14px;
    background: $text2;
    margin: $space-1 0;
    opacity: 0.25;
    border-radius: $border-radius-xs;
}

.btn-menu-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-2;
    border-radius: $border-radius-lg;
    transition: all $transition-base;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;

        & svg {
            transform: scale(1.1) rotate(-2deg);
        }
    }

    &.active {
        background: $accent-color-alpha;
        color: $accent-color;
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    svg {
        display: block;
    }
}

/* ––– Main Content Area ––– */

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
