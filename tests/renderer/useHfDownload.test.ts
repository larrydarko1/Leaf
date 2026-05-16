import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHfDownload } from '../../src/renderer/composables/ai/useHfDownload';
import type { HfRepoFile, HfSearchResult } from '../../src/renderer/types/hf';
import { defineComponent, createApp } from 'vue';

// ── lifecycle helper ──────────────────────────────────────────────────────────

function withSetup<T>(composable: () => T): [T, () => void] {
    let result!: T;
    const app = createApp(
        defineComponent({
            setup() {
                result = composable();
                return {};
            },
            template: '<div></div>',
        }),
    );
    const el = document.createElement('div');
    document.body.appendChild(el);
    app.mount(el);
    return [
        result,
        () => {
            app.unmount();
            document.body.removeChild(el);
        },
    ];
}

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    hfSearch: vi.fn(),
    hfListFiles: vi.fn(),
    hfDownload: vi.fn(),
    hfCancelDownload: vi.fn(),
    onHfDownloadProgress: vi.fn(),
    removeHfDownloadProgressListener: vi.fn(),
    log: { error: vi.fn(), warn: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// ── sample data ───────────────────────────────────────────────────────────────

const sampleSearchResults: HfSearchResult[] = [
    {
        id: 'org/model-a',
        author: 'org',
        name: 'model-a',
        downloads: 1000,
        likes: 50,
        tags: [],
        lastModified: '2024-01-01',
        architecture: null,
        parameterCount: null,
    },
    {
        id: 'org/model-b',
        author: 'org',
        name: 'model-b',
        downloads: 500,
        likes: 30,
        tags: [],
        lastModified: '2024-01-01',
        architecture: null,
        parameterCount: null,
    },
];

const sampleFile: HfRepoFile = {
    name: 'model.gguf',
    path: 'model.gguf',
    size: 4_000_000_000,
    sizeFormatted: '3.7 GB',
    downloadUrl: 'https://huggingface.co/org/model-a/resolve/main/model.gguf',
    quantType: null,
    estimatedRam: 4_000_000_000,
    estimatedRamFormatted: '3.7 GB',
    tier: { label: 'Large', color: 'orange', description: 'Large model' },
    isSharded: false,
    shardCount: 0,
    shardFiles: null,
    architecture: null,
    contextLength: null,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useHfDownload', () => {
    let onModelsRefresh: () => Promise<void>;
    let hf: ReturnType<typeof useHfDownload>;
    let unmount: () => void;

    beforeEach(() => {
        vi.clearAllMocks();
        onModelsRefresh = vi.fn().mockResolvedValue(undefined) as unknown as () => Promise<void>;
        // Mount in a Vue app so onMounted/onUnmounted work
        [hf, unmount] = withSetup(() => useHfDownload(onModelsRefresh));
    });

    afterEach(() => unmount());

    // ── initial state ─────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('showHfPanel starts as false', () => {
            expect(hf.showHfPanel.value).toBe(false);
        });

        it('hfSearchResults starts empty', () => {
            expect(hf.hfSearchResults.value).toHaveLength(0);
        });

        it('hfIsSearching starts as false', () => {
            expect(hf.hfIsSearching.value).toBe(false);
        });

        it('hfSelectedRepo starts as null', () => {
            expect(hf.hfSelectedRepo.value).toBeNull();
        });

        it('hfDownloadError starts as null', () => {
            expect(hf.hfDownloadError.value).toBeNull();
        });

        it('hfSortBy starts as "downloads"', () => {
            expect(hf.hfSortBy.value).toBe('downloads');
        });
    });

    // ── toggleHfPanel ─────────────────────────────────────────────────────────

    describe('toggleHfPanel', () => {
        it('opens the panel and triggers a search when no results are loaded', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: sampleSearchResults, hasMore: false });
            await hf.toggleHfPanel();
            expect(hf.showHfPanel.value).toBe(true);
            expect(hf.hfSearchResults.value).toHaveLength(2);
        });

        it('closes the panel on the second call', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: [], hasMore: false });
            await hf.toggleHfPanel(); // open
            hf.toggleHfPanel(); // close (sync — no search triggered)
            expect(hf.showHfPanel.value).toBe(false);
        });

        it('does not trigger another search when results are already loaded', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: sampleSearchResults, hasMore: false });
            await hf.toggleHfPanel(); // opens + searches
            vi.clearAllMocks();
            // Close then open — results are already present
            hf.toggleHfPanel(); // close
            await hf.toggleHfPanel(); // open — should not search again
            expect(mockAPI.hfSearch).not.toHaveBeenCalled();
        });
    });

    // ── searchHfModels ────────────────────────────────────────────────────────

    describe('searchHfModels', () => {
        it('populates hfSearchResults on success', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: sampleSearchResults, hasMore: false });
            await hf.searchHfModels();
            expect(hf.hfSearchResults.value).toHaveLength(2);
        });

        it('sets hfHasMore correctly from the response', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: sampleSearchResults, hasMore: true });
            await hf.searchHfModels();
            expect(hf.hfHasMore.value).toBe(true);
        });

        it('clears results and resets selectedRepo before searching', async () => {
            hf.hfSelectedRepo.value = 'org/some-model';
            hf.hfSearchResults.value = [...sampleSearchResults];
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: [], hasMore: false });
            await hf.searchHfModels();
            expect(hf.hfSelectedRepo.value).toBeNull();
        });

        it('sets hfSearchResults to [] when the IPC call fails', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: false });
            await hf.searchHfModels();
            expect(hf.hfSearchResults.value).toHaveLength(0);
        });

        it('handles IPC rejections gracefully', async () => {
            mockAPI.hfSearch.mockRejectedValue(new Error('network error'));
            await expect(hf.searchHfModels()).resolves.not.toThrow();
            expect(hf.hfSearchResults.value).toHaveLength(0);
        });

        it('resets hfIsSearching to false after completion', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: [], hasMore: false });
            await hf.searchHfModels();
            expect(hf.hfIsSearching.value).toBe(false);
        });
    });

    // ── loadMoreResults ───────────────────────────────────────────────────────

    describe('loadMoreResults', () => {
        it('appends new results to the existing list', async () => {
            // Pre-populate with one result
            hf.hfSearchResults.value = [...sampleSearchResults];
            hf.hfHasMore.value = true;
            const extra: HfSearchResult[] = [
                {
                    id: 'org/model-c',
                    author: 'org',
                    name: 'model-c',
                    downloads: 10,
                    likes: 1,
                    tags: [],
                    lastModified: '2024-01-01',
                    architecture: null,
                    parameterCount: null,
                },
            ];
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: extra, hasMore: false });
            await hf.loadMoreResults();
            expect(hf.hfSearchResults.value).toHaveLength(3);
            expect(hf.hfHasMore.value).toBe(false);
        });

        it('is a no-op when hfHasMore is false', async () => {
            hf.hfHasMore.value = false;
            await hf.loadMoreResults();
            expect(mockAPI.hfSearch).not.toHaveBeenCalled();
        });

        it('is a no-op while already loading more', async () => {
            hf.hfHasMore.value = true;
            hf.hfIsLoadingMore.value = true;
            await hf.loadMoreResults();
            expect(mockAPI.hfSearch).not.toHaveBeenCalled();
        });
    });

    // ── changeSortBy ──────────────────────────────────────────────────────────

    describe('changeSortBy', () => {
        it('updates the sort option and triggers a new search', async () => {
            mockAPI.hfSearch.mockResolvedValue({ success: true, results: [], hasMore: false });
            await hf.changeSortBy('trending');
            expect(hf.hfSortBy.value).toBe('trending');
            expect(mockAPI.hfSearch).toHaveBeenCalled();
        });

        it('is a no-op when the sort option is the same', async () => {
            await hf.changeSortBy('downloads'); // default is already 'downloads'
            expect(mockAPI.hfSearch).not.toHaveBeenCalled();
        });
    });

    // ── selectHfRepo ──────────────────────────────────────────────────────────

    describe('selectHfRepo', () => {
        it('sets the selected repo and populates repo files on success', async () => {
            mockAPI.hfListFiles.mockResolvedValue({
                success: true,
                files: [sampleFile],
                modelInfo: { description: 'A model', tags: [] },
            });
            await hf.selectHfRepo('org/model-a');
            expect(hf.hfSelectedRepo.value).toBe('org/model-a');
            expect(hf.hfRepoFiles.value).toHaveLength(1);
        });

        it('sets hfModelInfo from the response', async () => {
            const modelInfo = { description: 'Great model', tags: ['text-generation'] };
            mockAPI.hfListFiles.mockResolvedValue({ success: true, files: [sampleFile], modelInfo });
            await hf.selectHfRepo('org/model-a');
            expect(hf.hfModelInfo.value).toEqual(modelInfo);
        });

        it('leaves repo files empty when the IPC call fails', async () => {
            mockAPI.hfListFiles.mockResolvedValue({ success: false });
            await hf.selectHfRepo('org/model-a');
            expect(hf.hfRepoFiles.value).toHaveLength(0);
        });

        it('resets hfIsLoadingFiles to false after completion', async () => {
            mockAPI.hfListFiles.mockResolvedValue({ success: true, files: [], modelInfo: null });
            await hf.selectHfRepo('org/model-a');
            expect(hf.hfIsLoadingFiles.value).toBe(false);
        });
    });

    // ── downloadHfModel ───────────────────────────────────────────────────────

    describe('downloadHfModel', () => {
        it('calls onModelsRefresh after a successful download', async () => {
            mockAPI.hfDownload.mockResolvedValue({ success: true });
            await hf.downloadHfModel(sampleFile);
            expect(onModelsRefresh).toHaveBeenCalled();
        });

        it('removes the model from activeDownloads after completion', async () => {
            mockAPI.hfDownload.mockResolvedValue({ success: true });
            await hf.downloadHfModel(sampleFile);
            expect(hf.hfActiveDownloads.value.has(sampleFile.name)).toBe(false);
        });

        it('is a no-op when a download for the same file is already in progress', async () => {
            hf.hfActiveDownloads.value.add(sampleFile.name);
            await hf.downloadHfModel(sampleFile);
            expect(mockAPI.hfDownload).not.toHaveBeenCalled();
        });

        it('sets hfDownloadError on failure', async () => {
            mockAPI.hfDownload.mockResolvedValue({ success: false, error: 'timeout' });
            await hf.downloadHfModel(sampleFile);
            expect(hf.hfDownloadError.value).toBe('timeout');
        });

        it('handles IPC rejections gracefully', async () => {
            mockAPI.hfDownload.mockRejectedValue(new Error('network error'));
            await expect(hf.downloadHfModel(sampleFile)).resolves.not.toThrow();
        });
    });
});
