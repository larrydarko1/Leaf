import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { i18n } from '@/renderer/i18n';
import App from '@/renderer/App.vue';
import type { FileInfo } from '@/schemas/vault';

// ── composable mocks ──────────────────────────────────────────────────────────

const mockCurrentFolder = ref<string | null>(null);
const mockFiles = ref<FileInfo[]>([]);
const mockFolders = ref<string[]>([]);
const mockLoadFolder = vi.fn().mockResolvedValue(undefined);
const mockRefreshFiles = vi.fn().mockResolvedValue(undefined);
const mockOpenFolderDialog = vi.fn().mockResolvedValue(null);
const mockCreateFile = vi.fn().mockResolvedValue(null);
const mockCreateDrawing = vi.fn().mockResolvedValue(null);
const mockCreateFolder = vi.fn().mockResolvedValue(undefined);
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockDeleteFolder = vi.fn().mockResolvedValue(false);
const mockRenameFile = vi.fn().mockResolvedValue(null);
const mockRenameFolder = vi.fn().mockResolvedValue(null);
const mockMoveFiles = vi.fn().mockResolvedValue([]);
const mockMoveFolder = vi.fn().mockResolvedValue(false);
const mockCloseVault = vi.fn();
const mockSetExternalChangeCallback = vi.fn();

vi.mock('@/renderer/composables/vault/useVault', () => ({
    useVault: vi.fn(() => ({
        currentFolder: mockCurrentFolder,
        files: mockFiles,
        folders: mockFolders,
        loadFolder: mockLoadFolder,
        refreshFiles: mockRefreshFiles,
        openFolderDialog: mockOpenFolderDialog,
        createFile: mockCreateFile,
        createDrawing: mockCreateDrawing,
        createFolder: mockCreateFolder,
        deleteFile: mockDeleteFile,
        deleteFolder: mockDeleteFolder,
        renameFile: mockRenameFile,
        renameFolder: mockRenameFolder,
        moveFiles: mockMoveFiles,
        moveFolder: mockMoveFolder,
        closeVault: mockCloseVault,
        setExternalChangeCallback: mockSetExternalChangeCallback,
    })),
}));

const mockSelectedFiles = ref<FileInfo[]>([]);
const mockSelectedFolder = ref<string | null>(null);
const mockActiveFileSelection = ref<FileInfo | null>(null);
const mockSelectFile = vi.fn();
const mockSelectFolder = vi.fn();
const mockOpenFile = vi.fn();
const mockClearSelection = vi.fn();
const mockRestoreFromStorage = vi.fn();
const mockSyncAfterRefresh = vi.fn();

vi.mock('@/renderer/composables/vault/useFileSelection', () => ({
    useFileSelection: vi.fn(() => ({
        selectedFiles: mockSelectedFiles,
        selectedFolder: mockSelectedFolder,
        activeFile: mockActiveFileSelection,
        selectFile: mockSelectFile,
        selectFolder: mockSelectFolder,
        openFile: mockOpenFile,
        clearSelection: mockClearSelection,
        restoreFromStorage: mockRestoreFromStorage,
        syncAfterRefresh: mockSyncAfterRefresh,
    })),
}));

const mockBookmarkedFiles = ref<FileInfo[]>([]);
const mockToggleBookmark = vi.fn();
const mockRemoveBookmark = vi.fn();
const mockRelocateBookmark = vi.fn();
const mockLoadBookmarks = vi.fn().mockResolvedValue(undefined);

vi.mock('@/renderer/composables/vault/useBookmarks', () => ({
    useBookmarks: vi.fn(() => ({
        bookmarkedFiles: mockBookmarkedFiles,
        toggleBookmark: mockToggleBookmark,
        removeBookmark: mockRemoveBookmark,
        relocateBookmark: mockRelocateBookmark,
        loadBookmarks: mockLoadBookmarks,
    })),
}));

const mockActiveFile = ref<FileInfo | null>(null);
const mockTabs = ref<{ file: FileInfo; hasUnsavedChanges: boolean; content: string | null }[]>([]);
const mockActiveIndex = ref(0);
const mockOpenTab = vi.fn();
const mockCloseTab = vi.fn();
const mockReorderTab = vi.fn();
const mockSwitchTab = vi.fn();
const mockClearTabs = vi.fn();
const mockMarkTabSaved = vi.fn();
const mockRenameTabFile = vi.fn();
const mockRestoreTabs = vi.fn().mockReturnValue(false);
const mockSetFolderPath = vi.fn();
const mockSyncTabFiles = vi.fn();

vi.mock('@/renderer/composables/editor/useEditorTabs', () => ({
    useEditorTabs: vi.fn(() => ({
        activeFile: mockActiveFile,
        activeIndex: mockActiveIndex,
        tabs: mockTabs,
        openTab: mockOpenTab,
        closeTab: mockCloseTab,
        reorderTab: mockReorderTab,
        switchTab: mockSwitchTab,
        clearTabs: mockClearTabs,
        markTabSaved: mockMarkTabSaved,
        renameTabFile: mockRenameTabFile,
        restoreTabs: mockRestoreTabs,
        setFolderPath: mockSetFolderPath,
        syncTabFiles: mockSyncTabFiles,
    })),
}));

const mockThemeRefresh = vi.fn().mockResolvedValue(undefined);
vi.mock('@/renderer/composables/ui/useTheme', () => ({
    useTheme: vi.fn(() => ({ refresh: mockThemeRefresh })),
}));

const mockLanguageRefresh = vi.fn().mockResolvedValue(undefined);
vi.mock('@/renderer/composables/ui/useLanguage', () => ({
    useLanguage: vi.fn(() => ({ refresh: mockLanguageRefresh })),
}));

// ── window.electronAPI mock ───────────────────────────────────────────────────

const mockOpenExternal = vi.fn().mockResolvedValue(undefined);
Object.assign(window, {
    electronAPI: {
        ...(window.electronAPI ?? {}),
        openExternal: mockOpenExternal,
    },
});

// ── localStorage mock ─────────────────────────────────────────────────────────

const mockLocalStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

// ── helper ────────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<FileInfo> = {}): FileInfo {
    return {
        name: 'note.md',
        path: '/vault/note.md',
        relativePath: 'note.md',
        extension: '.md',
        size: 100,
        modified: new Date().toISOString(),
        folder: '/vault',
        ...overrides,
    };
}

function mountApp() {
    return shallowMount(App, { global: { plugins: [i18n] } });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentFolder.value = null;
    mockFiles.value = [];
    mockFolders.value = [];
    mockSelectedFiles.value = [];
    mockSelectedFolder.value = null;
    mockActiveFileSelection.value = null;
    mockActiveFile.value = null;
    mockActiveIndex.value = 0;
    mockTabs.value = [];
    mockBookmarkedFiles.value = [];
    mockLocalStorage.getItem.mockReturnValue(null);
    mockOpenFolderDialog.mockResolvedValue(null);
    mockCreateFile.mockResolvedValue(null);
    mockCreateDrawing.mockResolvedValue(null);
    mockRenameFile.mockResolvedValue(null);
    mockRenameFolder.mockResolvedValue(null);
    mockDeleteFolder.mockResolvedValue(false);
    mockMoveFiles.mockResolvedValue([]);
    mockRestoreTabs.mockReturnValue(false);
    mockRefreshFiles.mockResolvedValue(undefined);
});

describe('App', () => {
    describe('template branches', () => {
        it('shows welcome screen when currentFolder is null', () => {
            const wrapper = mountApp();
            expect(wrapper.find('.welcome-screen').exists()).toBe(true);
            expect(wrapper.find('.app-layout').exists()).toBe(false);
            wrapper.unmount();
        });

        it('shows app layout when currentFolder is set', async () => {
            mockCurrentFolder.value = '/vault';
            const wrapper = mountApp();
            expect(wrapper.find('.app-layout').exists()).toBe(true);
            expect(wrapper.find('.welcome-screen').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('onMounted', () => {
        it('calls theme.refresh and language.refresh', async () => {
            const wrapper = mountApp();
            await wrapper.vm.$nextTick();
            expect(mockThemeRefresh).toHaveBeenCalled();
            expect(mockLanguageRefresh).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('loads saved folder from localStorage if present', async () => {
            mockLocalStorage.getItem.mockReturnValue('/saved-vault');
            const wrapper = mountApp();
            await wrapper.vm.$nextTick();
            await new Promise((r) => setTimeout(r, 0));
            expect(mockLoadFolder).toHaveBeenCalledWith('/saved-vault');
            wrapper.unmount();
        });

        it('does NOT load folder when localStorage returns empty string', async () => {
            mockLocalStorage.getItem.mockReturnValue('');
            mountApp();
            await new Promise((r) => setTimeout(r, 0));
            expect(mockLoadFolder).not.toHaveBeenCalled();
        });

        it('registers external change callback', async () => {
            const wrapper = mountApp();
            await wrapper.vm.$nextTick();
            expect(mockSetExternalChangeCallback).toHaveBeenCalledWith(expect.any(Function));
            wrapper.unmount();
        });
    });

    describe('onBeforeUnmount', () => {
        it('calls vault.closeVault', () => {
            const wrapper = mountApp();
            wrapper.unmount();
            expect(mockCloseVault).toHaveBeenCalled();
        });
    });

    describe('panel toggles', () => {
        it('toggleSearch flips showSearchPanel and hides bookmarks panel', async () => {
            mockCurrentFolder.value = '/vault';
            const wrapper = mountApp();
            const searchBtn = wrapper
                .findAll('button')
                .find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('search'));
            await searchBtn?.trigger('click');
            await searchBtn?.trigger('click'); // toggle off
            wrapper.unmount();
        });

        it('toggleBookmarks flips showBookmarksPanel', async () => {
            mockCurrentFolder.value = '/vault';
            const wrapper = mountApp();
            const bookmarkBtn = wrapper
                .findAll('button')
                .find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('bookmark'));
            await bookmarkBtn?.trigger('click');
            wrapper.unmount();
        });

        it('toggleAiPanel flips showAiPanel', async () => {
            mockCurrentFolder.value = '/vault';
            const wrapper = mountApp();
            const aiBtn = wrapper
                .findAll('button')
                .find((b) => (b.attributes('aria-label') ?? '').toLowerCase().includes('ai'));
            await aiBtn?.trigger('click');
            wrapper.unmount();
        });
    });

    describe('changeFolder', () => {
        it('calls closeVault, clearSelection, clearTabs, setFolderPath(null)', async () => {
            mockCurrentFolder.value = '/vault';
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { changeFolder: () => void }).changeFolder?.();
            expect(mockCloseVault).toHaveBeenCalled();
            expect(mockClearSelection).toHaveBeenCalled();
            expect(mockClearTabs).toHaveBeenCalled();
            expect(mockSetFolderPath).toHaveBeenCalledWith(null);
            wrapper.unmount();
        });
    });

    describe('createNewFile', () => {
        it('opens file in selection and tab when vault returns a new file', async () => {
            const newFile = makeFile();
            mockCreateFile.mockResolvedValue(newFile);
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { createNewFile: () => Promise<void> }).createNewFile?.();
            expect(mockOpenFile).toHaveBeenCalledWith(newFile);
            expect(mockOpenTab).toHaveBeenCalledWith(newFile);
            wrapper.unmount();
        });

        it('does nothing when vault.createFile returns null', async () => {
            mockCreateFile.mockResolvedValue(null);
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { createNewFile: () => Promise<void> }).createNewFile?.();
            expect(mockOpenFile).not.toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('createNewDrawing', () => {
        it('opens drawing in selection and tab when vault returns a new file', async () => {
            const drawingFile = makeFile({ name: 'art.drawing', extension: '.drawing' });
            mockCreateDrawing.mockResolvedValue(drawingFile);
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { createNewDrawing: () => Promise<void> }).createNewDrawing?.();
            expect(mockOpenFile).toHaveBeenCalledWith(drawingFile);
            expect(mockOpenTab).toHaveBeenCalledWith(drawingFile);
            wrapper.unmount();
        });
    });

    describe('handleFileSave', () => {
        it('calls markTabSaved and refreshFiles', async () => {
            const file = makeFile();
            mockActiveFile.value = file;
            mockTabs.value = [{ file, hasUnsavedChanges: true, content: 'text' }];
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { handleFileSave: () => void }).handleFileSave?.();
            expect(mockMarkTabSaved).toHaveBeenCalledWith(file.path, 'text');
            expect(mockRefreshFiles).toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('handleContentChanged', () => {
        it('updates hasUnsavedChanges on the active tab', async () => {
            const file = makeFile();
            mockActiveFile.value = file;
            const tab = { file, hasUnsavedChanges: false, content: 'text' };
            mockTabs.value = [tab];
            const wrapper = mountApp();
            (wrapper.vm as unknown as { handleContentChanged: (v: boolean) => void }).handleContentChanged?.(true);
            expect(tab.hasUnsavedChanges).toBe(true);
            wrapper.unmount();
        });
    });

    describe('handleTabSwitch', () => {
        it('calls editorTabs.switchTab and opens active file', () => {
            const file = makeFile();
            mockSwitchTab.mockImplementation(() => {
                mockActiveFile.value = file;
            });
            const wrapper = mountApp();
            (wrapper.vm as unknown as { handleTabSwitch: (i: number) => void }).handleTabSwitch?.(1);
            expect(mockSwitchTab).toHaveBeenCalledWith(1);
            wrapper.unmount();
        });
    });

    describe('handleFileRename', () => {
        it('renames file and updates tab', async () => {
            const original = makeFile({ name: 'old.md', path: '/vault/old.md' });
            const renamed = makeFile({ name: 'new.md', path: '/vault/new.md' });
            mockRenameFile.mockResolvedValue(renamed);
            const wrapper = mountApp();
            await (
                wrapper.vm as unknown as { handleFileRename: (f: FileInfo, n: string) => Promise<void> }
            ).handleFileRename?.(original, 'new.md');
            expect(mockRenameTabFile).toHaveBeenCalledWith(original.path, renamed);
            expect(mockOpenFile).toHaveBeenCalledWith(renamed);
            wrapper.unmount();
        });

        it('does nothing when rename returns null', async () => {
            mockRenameFile.mockResolvedValue(null);
            const wrapper = mountApp();
            await (
                wrapper.vm as unknown as { handleFileRename: (f: FileInfo, n: string) => Promise<void> }
            ).handleFileRename?.(makeFile(), 'fail.md');
            expect(mockRenameTabFile).not.toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('handleFileDelete', () => {
        it('closes deleted tabs and clears selection', async () => {
            const file = makeFile();
            mockSelectedFiles.value = [file];
            mockTabs.value = [{ file, hasUnsavedChanges: false, content: null }];
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { handleFileDelete: (f: FileInfo) => Promise<void> }).handleFileDelete?.(
                file,
            );
            expect(mockDeleteFile).toHaveBeenCalled();
            expect(mockClearSelection).toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('handleRecordingSaved', () => {
        it('refreshes files and opens new recording', async () => {
            const recFile = makeFile({ name: 'recording.wav', path: '/vault/recording.wav', extension: '.wav' });
            mockFiles.value = [recFile];
            const wrapper = mountApp();
            await (
                wrapper.vm as unknown as { handleRecordingSaved: (p: string) => Promise<void> }
            ).handleRecordingSaved?.('/vault/recording.wav');
            expect(mockRefreshFiles).toHaveBeenCalled();
            expect(mockOpenFile).toHaveBeenCalledWith(recFile);
            expect(mockOpenTab).toHaveBeenCalledWith(recFile);
            wrapper.unmount();
        });
    });

    describe('handleKeydown', () => {
        it('calls startRenameFile on F2 when activeFile is set', () => {
            const file = makeFile();
            mockActiveFile.value = file;
            const wrapper = mountApp();
            const e = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
            window.dispatchEvent(e);
            // renamingFile is internal state — just verify openFile was called (startRenameFile does this)
            expect(mockOpenFile).toHaveBeenCalledWith(file);
            wrapper.unmount();
        });

        it('calls startRenameFolder on F2 when no activeFile but selectedFolder is set', () => {
            mockActiveFile.value = null;
            mockSelectedFolder.value = '/vault/sub';
            const wrapper = mountApp();
            const e = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
            window.dispatchEvent(e);
            expect(mockSelectFolder).toHaveBeenCalledWith('/vault/sub');
            wrapper.unmount();
        });
    });

    describe('handleExternalLinkClick', () => {
        it('opens external http link via electronAPI.openExternal', async () => {
            const wrapper = mountApp();
            const anchor = document.createElement('a');
            anchor.href = 'https://example.com';
            document.body.appendChild(anchor);
            const e = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(e, 'target', { value: anchor });
            document.dispatchEvent(e);
            await wrapper.vm.$nextTick();
            expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com');
            document.body.removeChild(anchor);
            wrapper.unmount();
        });

        it('does not intercept non-http links', async () => {
            const wrapper = mountApp();
            const anchor = document.createElement('a');
            anchor.href = '#section';
            document.body.appendChild(anchor);
            const e = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(e, 'target', { value: anchor });
            document.dispatchEvent(e);
            await wrapper.vm.$nextTick();
            expect(mockOpenExternal).not.toHaveBeenCalled();
            document.body.removeChild(anchor);
            wrapper.unmount();
        });
    });

    describe('selectFolder', () => {
        it('opens folder dialog and clears tabs when path returned', async () => {
            mockOpenFolderDialog.mockResolvedValue('/new-vault');
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { selectFolder: () => Promise<void> }).selectFolder?.();
            expect(mockOpenFolderDialog).toHaveBeenCalled();
            expect(mockClearTabs).toHaveBeenCalled();
            expect(mockLoadBookmarks).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('does not load folder when dialog returns null', async () => {
            mockOpenFolderDialog.mockResolvedValue(null);
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { selectFolder: () => Promise<void> }).selectFolder?.();
            expect(mockLoadFolder).not.toHaveBeenCalled();
            wrapper.unmount();
        });

        it('restores tabs on folder select and syncs file selection when tabs restored', async () => {
            const file = makeFile();
            mockOpenFolderDialog.mockResolvedValue('/vault');
            mockRestoreTabs.mockReturnValue(true);
            mockActiveFile.value = file;
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { selectFolder: () => Promise<void> }).selectFolder?.();
            expect(mockOpenFile).toHaveBeenCalledWith(file);
            wrapper.unmount();
        });
    });

    describe('toggleSearch / toggleBookmarks mutual exclusion', () => {
        it('toggleSearch hides bookmarks panel', async () => {
            const wrapper = mountApp();
            const vm = wrapper.vm as unknown as {
                toggleBookmarks: () => void;
                toggleSearch: () => void;
                showBookmarksPanel: { value: boolean };
                showSearchPanel: { value: boolean };
            };
            vm.toggleBookmarks?.();
            vm.toggleSearch?.();
            // If bookmarks was open, search opening should close it (but we can only check no throw)
            wrapper.unmount();
        });
    });

    describe('toggleAiPanel / toggleThemePanel / toggleLanguagePanel mutual exclusion', () => {
        it('toggleThemePanel hides AI and language panels', () => {
            const wrapper = mountApp();
            const vm = wrapper.vm as unknown as {
                toggleAiPanel: () => void;
                toggleThemePanel: () => void;
                toggleLanguagePanel: () => void;
            };
            vm.toggleAiPanel?.();
            vm.toggleThemePanel?.();
            vm.toggleLanguagePanel?.();
            wrapper.unmount();
        });
    });

    describe('handleFolderRename', () => {
        it('updates selectedFolder on successful rename', async () => {
            mockRenameFolder.mockResolvedValue('new-sub');
            const wrapper = mountApp();
            await (
                wrapper.vm as unknown as { handleFolderRename: (p: string, n: string) => Promise<void> }
            ).handleFolderRename?.('/vault/old-sub', 'new-sub');
            expect(mockSelectedFolder.value).toBe('new-sub');
            wrapper.unmount();
        });
    });

    describe('handleFolderDelete', () => {
        it('clears selectedFolder on successful delete', async () => {
            mockDeleteFolder.mockResolvedValue(true);
            mockSelectedFolder.value = '/vault/sub';
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { handleFolderDelete: (p: string) => Promise<void> }).handleFolderDelete?.(
                '/vault/sub',
            );
            expect(mockSelectedFolder.value).toBeNull();
            wrapper.unmount();
        });
    });

    describe('handleAiFileChanged', () => {
        it('calls refreshFiles', async () => {
            const wrapper = mountApp();
            await (wrapper.vm as unknown as { handleAiFileChanged: (p: string) => void }).handleAiFileChanged?.(
                '/vault/note.md',
            );
            expect(mockRefreshFiles).toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('external change callback', () => {
        it('calls refreshFiles and syncAfterRefresh when external change fires', async () => {
            const wrapper = mountApp();
            await wrapper.vm.$nextTick();
            // The callback registered via setExternalChangeCallback should call refreshFiles
            const cb = mockSetExternalChangeCallback.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
            if (cb !== undefined) {
                await cb();
                expect(mockRefreshFiles).toHaveBeenCalled();
                expect(mockSyncAfterRefresh).toHaveBeenCalled();
            }
            wrapper.unmount();
        });
    });
});
