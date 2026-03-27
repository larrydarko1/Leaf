import { ref, onMounted, onUnmounted } from 'vue';
import type { HfSearchResult, HfRepoFile, HfModelInfo, HfDownloadProgress, HfSortOption } from '../../types/hf';

export function useHfDownload(onModelsRefresh: () => Promise<void>) {
    const showHfPanel = ref(false);
    const hfSearchQuery = ref('');
    const hfSearchResults = ref<HfSearchResult[]>([]);
    const hfIsSearching = ref(false);
    const hfSelectedRepo = ref<string | null>(null);
    const hfRepoFiles = ref<HfRepoFile[]>([]);
    const hfModelInfo = ref<HfModelInfo | null>(null);
    const hfIsLoadingFiles = ref(false);
    const hfDownloadProgress = ref<HfDownloadProgress | null>(null);
    const hfActiveDownloads = ref<Set<string>>(new Set());
    const hfDownloadError = ref<string | null>(null);
    const hfSortBy = ref<HfSortOption>('downloads');
    const hfHasMore = ref(false);
    const hfIsLoadingMore = ref(false);

    function handleHfProgress(progress: HfDownloadProgress) {
        hfDownloadProgress.value = progress;
    }

    function toggleHfPanel() {
        showHfPanel.value = !showHfPanel.value;
        if (showHfPanel.value && hfSearchResults.value.length === 0) {
            searchHfModels();
        }
    }

    async function searchHfModels() {
        hfIsSearching.value = true;
        hfSelectedRepo.value = null;
        hfRepoFiles.value = [];
        hfHasMore.value = false;
        try {
            const result = await window.electronAPI.hfSearch(hfSearchQuery.value, hfSortBy.value, 0);
            hfSearchResults.value = result.success && result.results ? result.results : [];
            hfHasMore.value = result.hasMore ?? false;
        } catch (error) {
            console.error('Failed to search HF:', error);
            hfSearchResults.value = [];
        } finally {
            hfIsSearching.value = false;
        }
    }

    async function loadMoreResults() {
        if (hfIsLoadingMore.value || !hfHasMore.value) return;
        hfIsLoadingMore.value = true;
        try {
            const offset = hfSearchResults.value.length;
            const result = await window.electronAPI.hfSearch(hfSearchQuery.value, hfSortBy.value, offset);
            if (result.success && result.results) {
                hfSearchResults.value = [...hfSearchResults.value, ...result.results];
                hfHasMore.value = result.hasMore ?? false;
            }
        } catch (error) {
            console.error('Failed to load more HF results:', error);
        } finally {
            hfIsLoadingMore.value = false;
        }
    }

    function changeSortBy(sort: HfSortOption) {
        if (hfSortBy.value === sort) return;
        hfSortBy.value = sort;
        searchHfModels();
    }

    async function selectHfRepo(repoId: string) {
        hfSelectedRepo.value = repoId;
        hfIsLoadingFiles.value = true;
        hfRepoFiles.value = [];
        hfModelInfo.value = null;
        try {
            const result = await window.electronAPI.hfListFiles(repoId);
            if (result.success && result.files) {
                hfRepoFiles.value = result.files;
                hfModelInfo.value = result.modelInfo || null;
            }
        } catch (error) {
            console.error('Failed to list HF repo files:', error);
        } finally {
            hfIsLoadingFiles.value = false;
        }
    }

    async function downloadHfModel(file: HfRepoFile) {
        if (hfActiveDownloads.value.has(file.name)) return;
        hfActiveDownloads.value.add(file.name);
        hfDownloadError.value = null;
        try {
            const result = await window.electronAPI.hfDownload(file.downloadUrl, file.name);
            if (result.success) {
                await onModelsRefresh();
            } else {
                hfDownloadError.value = result.error || 'Download failed.';
                console.error('Download failed:', result.error);
            }
        } catch (error) {
            hfDownloadError.value = 'Failed to download model. Check your connection.';
            console.error('Failed to download model:', error);
        } finally {
            hfActiveDownloads.value.delete(file.name);
            hfDownloadProgress.value = null;
        }
    }

    async function cancelHfDownload(fileName: string) {
        try {
            await window.electronAPI.hfCancelDownload(fileName);
            hfActiveDownloads.value.delete(fileName);
            hfDownloadProgress.value = null;
        } catch (error) {
            console.error('Failed to cancel download:', error);
        }
    }

    function formatNumber(n: number): string {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    onMounted(() => {
        window.electronAPI.onHfDownloadProgress(handleHfProgress);
    });

    onUnmounted(() => {
        window.electronAPI.removeHfDownloadProgressListener();
    });

    return {
        showHfPanel,
        hfSearchQuery,
        hfSearchResults,
        hfIsSearching,
        hfSelectedRepo,
        hfRepoFiles,
        hfModelInfo,
        hfIsLoadingFiles,
        hfDownloadProgress,
        hfActiveDownloads,
        hfDownloadError,
        hfSortBy,
        hfHasMore,
        hfIsLoadingMore,
        toggleHfPanel,
        searchHfModels,
        loadMoreResults,
        changeSortBy,
        selectHfRepo,
        downloadHfModel,
        cancelHfDownload,
        formatNumber,
    };
}
