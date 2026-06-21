import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import AiHfPanel from '@/renderer/components/ai/AiHfPanel.vue';
import type { HfRepoFile, HfSearchResult, HfModelInfo } from '@/schemas/hf';

function makeFile(overrides: Partial<HfRepoFile> = {}): HfRepoFile {
    return {
        name: 'model-q4.gguf',
        path: 'model-q4.gguf',
        size: 4_000_000_000,
        sizeFormatted: '4 GB',
        downloadUrl: 'https://example.com/model-q4.gguf',
        quantType: 'Q4_K_M',
        estimatedRam: 6_000_000_000,
        estimatedRamFormatted: '6 GB',
        tier: { label: 'Medium', color: 'blue', description: 'Medium tier' },
        isSharded: false,
        shardCount: null,
        architecture: null,
        contextLength: null,
        ...overrides,
    };
}

function makeSearchResult(overrides: Partial<HfSearchResult> = {}): HfSearchResult {
    return {
        id: 'author/model-name',
        author: 'author',
        name: 'model-name',
        downloads: 1000,
        likes: 50,
        tags: [],
        lastModified: '2024-01-01',
        architecture: 'llama',
        parameterCount: '7B',
        ...overrides,
    };
}

const baseProps = {
    hfSearchQuery: '',
    hfSearchResults: [] as HfSearchResult[],
    hfIsSearching: false,
    hfSelectedRepo: null as string | null,
    hfRepoFiles: [] as HfRepoFile[],
    hfModelInfo: null as HfModelInfo | null,
    hfIsLoadingFiles: false,
    hfDownloadProgress: null,
    hfActiveDownloads: new Set<string>(),
    hfDownloadError: null as string | null,
    hfSortBy: 'downloads' as const,
    hfHasMore: false,
    hfIsLoadingMore: false,
};

describe('AiHfPanel', () => {
    describe('initial state', () => {
        it('renders the panel with header', () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            expect(wrapper.find('.ai-hf-panel').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows empty state when no results and not searching', () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            expect(wrapper.find('.ai-hf-empty').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows sort bar when not in repo view', () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            expect(wrapper.find('.ai-hf-sort-bar').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides sort bar when viewing a repo', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [makeFile()] },
            });
            expect(wrapper.find('.ai-hf-sort-bar').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('search states', () => {
        it('shows loading indicator when searching', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfIsSearching: true },
            });
            expect(wrapper.find('.ai-hf-loading').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows loading indicator when loading files', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfIsLoadingFiles: true },
            });
            expect(wrapper.find('.ai-hf-loading').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows error message when hfDownloadError is set', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfDownloadError: 'Download failed' },
            });
            const err = wrapper.find('.ai-hf-error');
            expect(err.exists()).toBe(true);
            expect(err.text()).toContain('Download failed');
            wrapper.unmount();
        });
    });

    describe('search results list', () => {
        it('renders search results', () => {
            const results = [makeSearchResult({ id: 'a/b' }), makeSearchResult({ id: 'c/d' })];
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: results },
            });
            expect(wrapper.findAll('.ai-hf-result-item')).toHaveLength(2);
            wrapper.unmount();
        });

        it('displays repo id and stats', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSearchResults: [makeSearchResult({ id: 'author/llama', downloads: 5000, likes: 200 })],
                },
            });
            expect(wrapper.find('.ai-hf-result-name').text()).toBe('author/llama');
            wrapper.unmount();
        });

        it('emits "select-repo" on result click', async () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult({ id: 'a/b' })] },
            });
            await wrapper.find('.ai-hf-result-button').trigger('click');
            expect(wrapper.emitted('select-repo')?.[0]).toEqual(['a/b']);
            wrapper.unmount();
        });

        it('shows "load more" button when hfHasMore is true', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult()], hfHasMore: true },
            });
            expect(wrapper.find('.ai-hf-load-more').exists()).toBe(true);
            wrapper.unmount();
        });

        it('does not show "load more" when hfHasMore is false', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult()], hfHasMore: false },
            });
            expect(wrapper.find('.ai-hf-load-more').exists()).toBe(false);
            wrapper.unmount();
        });

        it('emits "load-more" on load more button click', async () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult()], hfHasMore: true },
            });
            await wrapper.find('.ai-hf-load-more').trigger('click');
            expect(wrapper.emitted('load-more')).toBeTruthy();
            wrapper.unmount();
        });

        it('shows architecture tag when present', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSearchResults: [makeSearchResult({ architecture: 'llama', parameterCount: '7B' })],
                },
            });
            const tags = wrapper.findAll('.ai-hf-result-tag');
            expect(tags.length).toBeGreaterThanOrEqual(1);
            expect(tags.map((t) => t.text())).toContain('llama');
            wrapper.unmount();
        });

        it('shows null architecture without tag', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSearchResults: [makeSearchResult({ architecture: null, parameterCount: null })],
                },
            });
            expect(wrapper.findAll('.ai-hf-result-tag')).toHaveLength(0);
            wrapper.unmount();
        });
    });

    describe('repo file listing', () => {
        it('shows back button when a repo is selected', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [makeFile()] },
            });
            expect(wrapper.find('.ai-hf-back-btn').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows "no GGUF files" message when repo is selected but no files', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [], hfIsLoadingFiles: false },
            });
            expect(wrapper.find('.ai-hf-empty').exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders file list when repo has files', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [makeFile(), makeFile({ name: 'model-q8.gguf' })],
                },
            });
            expect(wrapper.findAll('.ai-hf-file-item')).toHaveLength(2);
            wrapper.unmount();
        });

        it('shows download button for non-sharded file', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [makeFile({ isSharded: false })] },
            });
            expect(wrapper.find('.ai-hf-download-btn').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows sharded download button for sharded files', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [makeFile({ isSharded: true, shardCount: [] })],
                },
            });
            expect(wrapper.find('.ai-hf-download-sharded').exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "download" on download button click', async () => {
            const file = makeFile();
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [file] },
            });
            await wrapper.find('.ai-hf-download-btn').trigger('click');
            expect(wrapper.emitted('download')?.[0]).toEqual([file]);
            wrapper.unmount();
        });

        it('shows progress bar when file is downloading', () => {
            const file = makeFile({ name: 'model-q4.gguf' });
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [file],
                    hfActiveDownloads: new Set(['model-q4.gguf']),
                    hfDownloadProgress: {
                        fileName: 'model-q4.gguf',
                        percent: 50,
                        speed: 1000,
                        bytesDownloaded: 0,
                        totalBytes: 0,
                    },
                },
            });
            expect(wrapper.find('.ai-hf-progress').exists()).toBe(true);
            expect(wrapper.find('.ai-hf-progress-text').text()).toContain('50%');
            wrapper.unmount();
        });

        it('shows cancel button when file is downloading', () => {
            const file = makeFile({ name: 'downloading.gguf' });
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [file],
                    hfActiveDownloads: new Set(['downloading.gguf']),
                },
            });
            expect(wrapper.find('.ai-btn-danger').exists()).toBe(true);
            wrapper.unmount();
        });

        it('emits "cancel-download" on cancel button click', async () => {
            const file = makeFile({ name: 'downloading.gguf' });
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [file],
                    hfActiveDownloads: new Set(['downloading.gguf']),
                },
            });
            await wrapper.find('.ai-btn-danger').trigger('click');
            expect(wrapper.emitted('cancel-download')?.[0]).toEqual(['downloading.gguf']);
            wrapper.unmount();
        });

        it('shows model metadata when hfModelInfo is provided', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [makeFile()],
                    hfModelInfo: {
                        architecture: 'llama',
                        contextLength: 4096,
                        totalParamSize: 7e9,
                        totalParamSizeFormatted: '7B',
                    },
                },
            });
            const tags = wrapper.findAll('.ai-hf-meta-tag');
            expect(tags.length).toBeGreaterThanOrEqual(1);
            wrapper.unmount();
        });

        it('shows file tier badge', () => {
            const file = makeFile({ tier: { label: 'Small', color: 'green', description: 'Small model' } });
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [file] },
            });
            expect(wrapper.find('.ai-hf-tier-badge').exists()).toBe(true);
            expect(wrapper.find('.ai-hf-tier-green').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows quantType badge when present', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: {
                    ...baseProps,
                    hfSelectedRepo: 'author/model',
                    hfRepoFiles: [makeFile({ quantType: 'Q4_K_M' })],
                },
            });
            expect(wrapper.find('.ai-hf-quant-badge').exists()).toBe(true);
            expect(wrapper.find('.ai-hf-quant-badge').text()).toBe('Q4_K_M');
            wrapper.unmount();
        });
    });

    describe('event emissions', () => {
        it('emits "close" on close button click', async () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            await wrapper.find('.ai-btn-icon').trigger('click');
            expect(wrapper.emitted('close')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "search" on form submit', async () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            await wrapper.find('.ai-hf-search-bar').trigger('submit');
            expect(wrapper.emitted('search')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "back" on back button click when in repo view', async () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSelectedRepo: 'author/model', hfRepoFiles: [makeFile()] },
            });
            await wrapper.find('.ai-hf-back-btn').trigger('click');
            expect(wrapper.emitted('back')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "change-sort" on sort button click', async () => {
            const wrapper = mountWithI18n(AiHfPanel, { props: baseProps });
            const sortBtns = wrapper.findAll('.ai-hf-sort-btn');
            await sortBtns[1].trigger('click'); // 'likes'
            expect(wrapper.emitted('change-sort')?.[0]).toEqual(['likes']);
            wrapper.unmount();
        });
    });

    describe('formatNumber (via stats display)', () => {
        it('formats millions with "M" suffix', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult({ downloads: 2_500_000 })] },
            });
            expect(wrapper.html()).toContain('2.5M');
            wrapper.unmount();
        });

        it('formats thousands with "k" suffix', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult({ downloads: 3500 })] },
            });
            expect(wrapper.html()).toContain('3.5k');
            wrapper.unmount();
        });

        it('formats small numbers as-is', () => {
            const wrapper = mountWithI18n(AiHfPanel, {
                props: { ...baseProps, hfSearchResults: [makeSearchResult({ downloads: 42 })] },
            });
            expect(wrapper.html()).toContain('42');
            wrapper.unmount();
        });
    });
});
