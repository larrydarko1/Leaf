<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import FileExplorer from './components/FileExplorer.vue';
import NoteEditor from './components/NoteEditor.vue';
import TabBar from './components/TabBar.vue';
import SearchPanel from './components/SearchPanel.vue';
import BookmarksPanel from './components/BookmarksPanel.vue';
import AudioRecorder from './components/AudioRecorder.vue';
import AiPanel from './components/AiPanel.vue';
import type { FileInfo } from './types/electron';
import { useVault } from './composables/vault/useVault';
import { useFileSelection } from './composables/vault/useFileSelection';
import { useBookmarks } from './composables/vault/useBookmarks';
import { useEditorTabs } from './composables/editor/useEditorTabs';

const noteEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null);

// --- Composables ---
const vault = useVault();
const selection = useFileSelection();
const bookmarks = useBookmarks(() => vault.currentFolder.value);
const editorTabs = useEditorTabs();

// Destructure reactive state for template bindings
const { currentFolder, files, folders } = vault;
const { selectedFiles, selectedFolder } = selection;
const activeFile = editorTabs.activeFile;
const { bookmarkedFiles, toggleBookmark, removeBookmark } = bookmarks;

// --- UI state ---
const currentTheme = ref('dark');
const renamingFile = ref<FileInfo | null>(null);
const renamingFolder = ref<string | null>(null);
const showSearchPanel = ref(false);
const showBookmarksPanel = ref(false);
const showAiPanel = ref(false);

// --- Theme ---
function applyTheme(theme: string) {
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
    localStorage.setItem('leaf-theme', currentTheme.value);
    applyTheme(currentTheme.value);
}

// --- External link interception ---
function handleExternalLinkClick(e: MouseEvent) {
    const target = (e.target as HTMLElement)?.closest('a') as HTMLAnchorElement | null;
    if (!target) return;
    const href = target.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault();
        e.stopPropagation();
        window.electronAPI.openExternal(href);
    }
}

// --- File-list refresh (vault + selection sync) ---
async function refreshFiles() {
    await vault.refreshFiles();
    selection.syncAfterRefresh(vault.files.value);
    editorTabs.syncTabFiles(vault.files.value);
}

// --- Folder lifecycle ---
async function selectFolder() {
    const folderPath = await vault.openFolderDialog();
    if (folderPath) {
        editorTabs.clearTabs();
        const restored = editorTabs.restoreTabs(folderPath, vault.files.value);
        if (!restored) {
            selection.restoreFromStorage(vault.files.value);
            const restoredFile = selection.activeFile.value;
            if (restoredFile) editorTabs.openTab(restoredFile);
        } else {
            // Sync file selection with the restored active tab
            const activeTabFile = editorTabs.activeFile.value;
            if (activeTabFile) selection.openFile(activeTabFile);
        }
        bookmarks.loadBookmarks();
    }
}

async function loadFolderPath(folderPath: string) {
    await vault.loadFolder(folderPath);
    const restored = editorTabs.restoreTabs(folderPath, vault.files.value);
    if (!restored) {
        selection.restoreFromStorage(vault.files.value);
        const restoredFile = selection.activeFile.value;
        if (restoredFile) editorTabs.openTab(restoredFile);
    } else {
        // Sync file selection with the restored active tab
        const activeTabFile = editorTabs.activeFile.value;
        if (activeTabFile) selection.openFile(activeTabFile);
    }
    bookmarks.loadBookmarks();
}

function changeFolder() {
    vault.closeVault();
    selection.clearSelection();
    editorTabs.clearTabs();
    editorTabs.setFolderPath(null);
}

// --- Lifecycle ---
onMounted(() => {
    const savedTheme = localStorage.getItem('leaf-theme');
    if (savedTheme) currentTheme.value = savedTheme;
    applyTheme(currentTheme.value);

    const savedFolder = localStorage.getItem('leaf-folder-path');
    if (savedFolder) loadFolderPath(savedFolder);

    vault.setExternalChangeCallback(() => refreshFiles());
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleExternalLinkClick, true);
});

onBeforeUnmount(() => {
    vault.closeVault();
    window.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleExternalLinkClick, true);
});

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'F2') {
        e.preventDefault();
        if (activeFile.value && !renamingFile.value) {
            startRenameFile(activeFile.value);
        } else if (selectedFolder.value && !renamingFolder.value) {
            startRenameFolder(selectedFolder.value);
        }
    }
}

// --- File selection ---
function handleFileSelect(file: FileInfo, event?: MouseEvent, visibleFiles?: FileInfo[]) {
    selection.selectFile(file, event, visibleFiles);
    // Open/activate a tab for the single active file (ignore multi-select)
    if (!event?.shiftKey) {
        editorTabs.openTab(file);
    }
}

function handleFolderSelect(folderPath: string) {
    selection.selectFolder(folderPath);
}

// --- Editor events ---
function handleFileSave() {
    // Mark the active tab as saved
    if (activeFile.value) {
        const tab = editorTabs.tabs.value.find((t) => t.file.path === activeFile.value!.path);
        if (tab && tab.content !== null) {
            editorTabs.markTabSaved(activeFile.value.path, tab.content);
        }
    }
    refreshFiles();
}

function handleContentChanged(hasChanges: boolean) {
    if (activeFile.value) {
        const tab = editorTabs.tabs.value.find((t) => t.file.path === activeFile.value!.path);
        if (tab) tab.hasUnsavedChanges = hasChanges;
    }
}

function handleAiFileChanged(changedPath: string) {
    if (activeFile.value?.path === changedPath) {
        noteEditorRef.value?.reloadContent();
    }
    refreshFiles();
}

async function handleRecordingSaved(filePath: string) {
    await refreshFiles();
    const recordingFile = vault.files.value.find((f: FileInfo) => f.path === filePath);
    if (recordingFile) {
        selection.openFile(recordingFile);
        editorTabs.openTab(recordingFile);
    }
}

// --- Create ---
async function createNewFile() {
    const newFile = await vault.createFile();
    if (newFile) {
        selection.openFile(newFile);
        editorTabs.openTab(newFile);
    }
}

async function createNewDrawing() {
    const newFile = await vault.createDrawing();
    if (newFile) {
        selection.openFile(newFile);
        editorTabs.openTab(newFile);
    }
}

async function createNewFolder() {
    await vault.createFolder();
}

// --- Rename ---
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
    if (renamed) {
        editorTabs.renameTabFile(file.path, renamed);
        selection.openFile(renamed);
    }
}

async function handleFolderRename(folderPath: string, newName: string) {
    const newRelativePath = await vault.renameFolder(folderPath, newName);
    renamingFolder.value = null;
    if (newRelativePath) selectedFolder.value = newRelativePath;
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

// --- Panel toggles ---
function toggleSearch() {
    showSearchPanel.value = !showSearchPanel.value;
    if (showSearchPanel.value) showBookmarksPanel.value = false;
}

function closeSearch() {
    showSearchPanel.value = false;
}

function handleSearchFileSelect(file: FileInfo, event?: MouseEvent) {
    selection.selectFile(file, event);
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
    if (file) {
        selection.openFile(file);
    }
}

function toggleBookmarks() {
    showBookmarksPanel.value = !showBookmarksPanel.value;
    if (showBookmarksPanel.value) showSearchPanel.value = false;
}

function toggleAiPanel() {
    showAiPanel.value = !showAiPanel.value;
}
</script>

<template>
    <div id="app">
        <div class="leaf-app">
            <!-- Welcome screen when no folder is selected -->
            <div v-if="!currentFolder" class="welcome-screen">
                <div class="welcome-content">
                    <div class="welcome-logo">
                        <img draggable="false" src="./assets/icons/icon.png" alt="Leaf" class="welcome-logo-icon" />
                        <span class="welcome-logo-text">leaf.</span>
                    </div>

                    <button class="btn-primary" @click="selectFolder">Select Folder</button>
                </div>
            </div>

            <!-- Main app interface -->
            <div v-else class="app-layout">
                <div class="left-column">
                    <div class="sidebar-menu">
                        <!-- Workspace pill -->
                        <div class="menu-pill">
                            <button class="btn-menu-icon" title="Change folder" @click="changeFolder">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        clip-rule="evenodd"
                                        d="M9.70725 2.4087C9 3.03569 9 4.18259 9 6.4764V17.5236C9 19.8174 9 20.9643 9.70725 21.5913C10.4145 22.2183 11.4955 22.0297 13.6576 21.6526L15.9864 21.2465C18.3809 20.8288 19.5781 20.62 20.2891 19.7417C21 18.8635 21 17.5933 21 15.0529V8.94711C21 6.40671 21 5.13652 20.2891 4.25826C19.5781 3.37999 18.3809 3.17118 15.9864 2.75354L13.6576 2.34736C11.4955 1.97026 10.4145 1.78171 9.70725 2.4087ZM12 10.1686C12.4142 10.1686 12.75 10.52 12.75 10.9535V13.0465C12.75 13.48 12.4142 13.8314 12 13.8314C11.5858 13.8314 11.25 13.48 11.25 13.0465V10.9535C11.25 10.52 11.5858 10.1686 12 10.1686Z"
                                    ></path>
                                    <path
                                        d="M7.54717 4.5C5.48889 4.503 4.41599 4.54826 3.73223 5.23202C3 5.96425 3 7.14276 3 9.49979V14.4998C3 16.8568 3 18.0353 3.73223 18.7676C4.41599 19.4513 5.48889 19.4966 7.54717 19.4996C7.49985 18.8763 7.49992 18.1557 7.50001 17.3768V6.6227C7.49992 5.84388 7.49985 5.1233 7.54717 4.5Z"
                                    ></path>
                                </svg>
                            </button>
                        </div>

                        <!-- Create actions pill -->
                        <div class="menu-pill">
                            <button class="btn-menu-icon" title="Create new note" @click="createNewFile">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M12 2C13.4992 2 14.7004 2 15.6773 2.07361C15.5629 2.3601 15.5 2.6727 15.5 3V3.5H15C13.6193 3.5 12.5 4.61929 12.5 6C12.5 7.38071 13.6193 8.5 15 8.5H15.5V9C15.5 10.3807 16.6193 11.5 18 11.5C18.8178 11.5 19.5439 11.1073 20 10.5002V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V10C4 6.22876 4 4.34315 5.17157 3.17157C6.34315 2 8.22876 2 12 2ZM8 11C7.44772 11 7 11.4477 7 12C7 12.5523 7.44772 13 8 13H12C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11H8ZM8 14C7.44772 14 7 14.4477 7 15C7 15.5523 7.44772 16 8 16H14C14.5523 16 15 15.5523 15 15C15 14.4477 14.5523 14 14 14H8ZM8 17C7.44772 17 7 17.4477 7 18C7 18.5523 7.44772 19 8 19H12C12.5523 19 13 18.5523 13 18C13 17.4477 12.5523 17 12 17H8Z"
                                            fill="currentColor"
                                        ></path>
                                        <path
                                            d="M18 3L18 9"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                        ></path>
                                        <path
                                            d="M21 6L15 6"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                        ></path>
                                    </g>
                                </svg>
                            </button>
                            <button class="btn-menu-icon" title="Create new folder" @click="createNewFolder">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <defs>
                                        <mask id="folderMask">
                                            <rect width="24" height="24" fill="white" />
                                            <path
                                                d="M10 14H12M12 14H14M12 14V16M12 14V12"
                                                stroke="black"
                                                stroke-width="1.5"
                                                stroke-linecap="round"
                                            />
                                        </mask>
                                    </defs>
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            mask="url(#folderMask)"
                                            d="M2 6.94975C2 6.06722 2 5.62595 2.06935 5.25839C2.37464 3.64031 3.64031 2.37464 5.25839 2.06935C5.62595 2 6.06722 2 6.94975 2C7.33642 2 7.52976 2 7.71557 2.01738C8.51665 2.09229 9.27652 2.40704 9.89594 2.92051C10.0396 3.03961 10.1763 3.17633 10.4497 3.44975L11 4C11.8158 4.81578 12.2237 5.22367 12.7121 5.49543C12.9804 5.64471 13.2651 5.7626 13.5604 5.84678C14.0979 6 14.6747 6 15.8284 6H16.2021C18.8345 6 20.1506 6 21.0062 6.76946C21.0849 6.84024 21.1598 6.91514 21.2305 6.99383C22 7.84935 22 9.16554 22 11.7979V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V6.94975Z"
                                            fill="currentColor"
                                            stroke="currentColor"
                                            stroke-width="1.5"
                                        />
                                    </g>
                                </svg>
                            </button>
                        </div>

                        <!-- Tools pill -->
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showSearchPanel }"
                                title="Search files"
                                @click="toggleSearch"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <g id="SVGRepo_iconCarrier">
                                        <rect width="24" height="24" fill="transparent"></rect>
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M7.25007 2.38782C8.54878 2.0992 10.1243 2 12 2C13.8757 2 15.4512 2.0992 16.7499 2.38782C18.06 2.67897 19.1488 3.176 19.9864 4.01358C20.824 4.85116 21.321 5.94002 21.6122 7.25007C21.9008 8.54878 22 10.1243 22 12C22 13.8757 21.9008 15.4512 21.6122 16.7499C21.321 18.06 20.824 19.1488 19.9864 19.9864C19.1488 20.824 18.06 21.321 16.7499 21.6122C15.4512 21.9008 13.8757 22 12 22C10.1243 22 8.54878 21.9008 7.25007 21.6122C5.94002 21.321 4.85116 20.824 4.01358 19.9864C3.176 19.1488 2.67897 18.06 2.38782 16.7499C2.0992 15.4512 2 13.8757 2 12C2 10.1243 2.0992 8.54878 2.38782 7.25007C2.67897 5.94002 3.176 4.85116 4.01358 4.01358C4.85116 3.176 5.94002 2.67897 7.25007 2.38782ZM9 11.5C9 10.1193 10.1193 9 11.5 9C12.8807 9 14 10.1193 14 11.5C14 12.8807 12.8807 14 11.5 14C10.1193 14 9 12.8807 9 11.5ZM11.5 7C9.01472 7 7 9.01472 7 11.5C7 13.9853 9.01472 16 11.5 16C12.3805 16 13.202 15.7471 13.8957 15.31L15.2929 16.7071C15.6834 17.0976 16.3166 17.0976 16.7071 16.7071C17.0976 16.3166 17.0976 15.6834 16.7071 15.2929L15.31 13.8957C15.7471 13.202 16 12.3805 16 11.5C16 9.01472 13.9853 7 11.5 7Z"
                                            fill="currentColor"
                                        ></path>
                                    </g>
                                </svg>
                            </button>
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showBookmarksPanel }"
                                title="Bookmarks"
                                @click="toggleBookmarks"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        fill="currentColor"
                                    />
                                </svg>
                            </button>
                            <button class="btn-menu-icon" title="Create new drawing" @click="createNewDrawing">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M12 19l7-7 3 3-7 7-3-3z" fill="currentColor" />
                                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" fill="currentColor" />
                                    <circle cx="11" cy="11" r="2" fill="var(--base1)" />
                                </svg>
                            </button>
                            <AudioRecorder :current-folder="currentFolder" @recording-saved="handleRecordingSaved" />
                        </div>

                        <!-- Bottom pill: AI + Theme -->
                        <div class="menu-spacer"></div>
                        <div class="menu-pill">
                            <button
                                class="btn-menu-icon"
                                :class="{ active: showAiPanel }"
                                title="AI Assistant"
                                @click="toggleAiPanel"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"
                                    />
                                    <line x1="9" y1="21" x2="15" y2="21" />
                                </svg>
                            </button>
                            <button class="btn-menu-icon" title="Toggle theme" @click="toggleTheme">
                                <svg
                                    v-if="currentTheme === 'dark'"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"
                                            fill="currentColor"
                                        ></path>
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V4C12.75 4.41421 12.4142 4.75 12 4.75C11.5858 4.75 11.25 4.41421 11.25 4V2C11.25 1.58579 11.5858 1.25 12 1.25ZM3.66865 3.71609C3.94815 3.41039 4.42255 3.38915 4.72825 3.66865L6.95026 5.70024C7.25596 5.97974 7.2772 6.45413 6.9977 6.75983C6.7182 7.06553 6.2438 7.08677 5.9381 6.80727L3.71609 4.77569C3.41039 4.49619 3.38915 4.02179 3.66865 3.71609ZM20.3314 3.71609C20.6109 4.02179 20.5896 4.49619 20.2839 4.77569L18.0619 6.80727C17.7562 7.08677 17.2818 7.06553 17.0023 6.75983C16.7228 6.45413 16.744 5.97974 17.0497 5.70024L19.2718 3.66865C19.5775 3.38915 20.0518 3.41039 20.3314 3.71609ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H4C4.41421 11.25 4.75 11.5858 4.75 12C4.75 12.4142 4.41421 12.75 4 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM19.25 12C19.25 11.5858 19.5858 11.25 20 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H20C19.5858 12.75 19.25 12.4142 19.25 12ZM17.0255 17.0252C17.3184 16.7323 17.7933 16.7323 18.0862 17.0252L20.3082 19.2475C20.6011 19.5404 20.601 20.0153 20.3081 20.3082C20.0152 20.6011 19.5403 20.601 19.2475 20.3081L17.0255 18.0858C16.7326 17.7929 16.7326 17.3181 17.0255 17.0252ZM6.97467 17.0253C7.26756 17.3182 7.26756 17.7931 6.97467 18.086L4.75244 20.3082C4.45955 20.6011 3.98468 20.6011 3.69178 20.3082C3.39889 20.0153 3.39889 19.5404 3.69178 19.2476L5.91401 17.0253C6.2069 16.7324 6.68177 16.7324 6.97467 17.0253ZM12 19.25C12.4142 19.25 12.75 19.5858 12.75 20V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V20C11.25 19.5858 11.5858 19.25 12 19.25Z"
                                            fill="currentColor"
                                        ></path>
                                    </g>
                                </svg>
                                <svg
                                    v-else
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <g id="SVGRepo_iconCarrier">
                                        <path
                                            d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                            fill="currentColor"
                                        ></path>
                                    </g>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <aside class="sidebar">
                    <FileExplorer
                        v-if="!showSearchPanel && !showBookmarksPanel"
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
                        @toggle-bookmark="toggleBookmark"
                    />
                    <SearchPanel
                        v-else-if="showSearchPanel"
                        :files="files"
                        :selected-files="selectedFiles"
                        :active-file="activeFile"
                        @select-file="handleSearchFileSelect"
                        @open-file="handleSearchFileOpen"
                        @close="closeSearch"
                    />
                    <BookmarksPanel
                        v-else-if="showBookmarksPanel"
                        :files="files"
                        :bookmarked-paths="bookmarkedFiles"
                        :selected-files="selectedFiles"
                        :active-file="activeFile"
                        @select-file="handleSearchFileSelect"
                        @open-file="handleSearchFileOpen"
                        @remove-bookmark="removeBookmark"
                    />
                </aside>
                <main class="main-content">
                    <TabBar
                        :tabs="editorTabs.tabs.value"
                        :active-index="editorTabs.activeIndex.value"
                        @switch="handleTabSwitch"
                        @close="editorTabs.closeTab"
                    />
                    <NoteEditor
                        ref="noteEditorRef"
                        :file="activeFile"
                        :workspace-path="currentFolder"
                        @save="handleFileSave"
                        @content-changed="handleContentChanged"
                    />
                </main>
                <AiPanel
                    v-if="showAiPanel"
                    :active-file="activeFile"
                    :workspace-path="currentFolder"
                    @close="showAiPanel = false"
                    @file-changed="handleAiFileChanged"
                />
            </div>
        </div>
    </div>
</template>

<style lang="scss">
#app {
    width: 100%;
    height: 100vh;
    overflow: hidden;
}

.leaf-app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: $base1;
    color: $text1;
}

// Welcome Screen
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
    padding: 2rem;
}

.welcome-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
}

.welcome-logo-icon {
    width: 128px;
    height: 128px;
    object-fit: contain;
}

.welcome-logo-text {
    font-family: $font-family;
    font-size: 5rem;
    font-weight: 600;
    color: $text1;
    letter-spacing: -0.02em;
    cursor: default;
}

.app-title {
    font-size: 3rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: $text1;
}

.app-subtitle {
    font-size: 1.2rem;
    color: $text2;
    margin: 0 0 2rem 0;
}

.btn-primary {
    padding: 0.65rem 1.5rem;
    background: $bg-primary;
    color: $text1;
    border: 1px solid $text3;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);

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
    margin-top: 1rem;
    font-size: 0.82rem;
    color: $text2;
}

// Main App Layout
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

.sidebar-menu {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.35rem;
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

.menu-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    background: $bg-selected;
    border: 1px solid $text3;
    border-radius: 10px;
    padding: 0.15rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.menu-spacer {
    flex: 1;
}

.menu-divider {
    height: 1px;
    width: 14px;
    background: $text2;
    margin: 0.3rem 0;
    opacity: 0.25;
    border-radius: 1px;
}

.btn-menu-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 7px;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
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

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
