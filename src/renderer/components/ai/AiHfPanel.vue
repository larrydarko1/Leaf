<script setup lang="ts">
import type { HfRepoFile, HfModelInfo, HfSearchResult, HfDownloadProgress, HfSortOption } from '@/schemas/hf';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    hfSearchQuery: string;
    hfSearchResults: HfSearchResult[];
    hfIsSearching: boolean;
    hfSelectedRepo: string | null;
    hfRepoFiles: HfRepoFile[];
    hfModelInfo: HfModelInfo | null;
    hfIsLoadingFiles: boolean;
    hfDownloadProgress: HfDownloadProgress | null;
    hfActiveDownloads: Set<string>;
    hfDownloadError: string | null;
    hfSortBy: HfSortOption;
    hfHasMore: boolean;
    hfIsLoadingMore: boolean;
};

const props = defineProps<Props>();
void props;

defineEmits<{
    'update:hfSearchQuery': [value: string];
    'select-repo': [value: string];
    'cancel-download': [value: string];
    'search': [];
    'load-more': [];
    'back': [];
    'close': [];
    'download': [file: HfRepoFile];
    'change-sort': [sort: HfSortOption];
}>();

const sortOptions: { value: HfSortOption; label: string }[] = [
    { value: 'downloads', label: t('ai.downloads') },
    { value: 'likes', label: t('ai.likes') },
    { value: 'lastModified', label: t('ai.recent') },
    { value: 'trending', label: t('ai.trending') },
];

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}
</script>

<template>
    <aside
        class="ai-hf-panel"
        :aria-label="t('ai.hf_panel')">
        <!-- Header -->
        <header class="ai-hf-header">
            <h2 class="ai-hf-title">{{ t('ai.download_models') }}</h2>
            <button
                class="ai-btn-icon ai-btn-tiny"
                type="button"
                :title="t('ai.close_panel')"
                :aria-label="t('ai.close_panel')"
                @click="$emit('close')">
                <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18" />
                    <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18" />
                </svg>
            </button>
        </header>

        <!-- Search bar -->
        <form
            class="ai-hf-search-bar"
            @submit.prevent="$emit('search')">
            <input
                :value="hfSearchQuery"
                type="text"
                :placeholder="t('ai.search_models')"
                class="ai-hf-search-input"
                :aria-label="t('ai.search_models')"
                @input="$emit('update:hfSearchQuery', ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="$emit('search')" />
            <button
                class="ai-btn-icon"
                type="submit"
                :disabled="hfIsSearching"
                :title="t('ai.search_models')"
                :aria-label="t('ai.search_models')">
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <circle
                        cx="11"
                        cy="11"
                        r="8" />
                    <line
                        x1="21"
                        y1="21"
                        x2="16.65"
                        y2="16.65" />
                </svg>
            </button>
        </form>

        <!-- Sort options bar -->
        <fieldset
            v-if="!hfSelectedRepo"
            class="ai-hf-sort-bar"
            :aria-label="t('ai.sort_search_results_by')">
            <button
                v-for="opt in sortOptions"
                :key="opt.value"
                type="button"
                class="ai-hf-sort-btn"
                :class="{ active: hfSortBy === opt.value }"
                :aria-pressed="hfSortBy === opt.value"
                @click="$emit('change-sort', opt.value)">
                {{ opt.label }}
            </button>
        </fieldset>

        <!-- Back button when viewing repo files -->
        <button
            v-if="hfSelectedRepo"
            type="button"
            class="ai-hf-back-btn"
            :aria-label="t('ai.back_to_results')"
            @click="$emit('back')">
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <line
                    x1="19"
                    y1="12"
                    x2="5"
                    y2="12" />
                <polyline points="12 19 5 12 12 5" />
            </svg>
            {{ t('ai.back_to_results') }}
        </button>

        <!-- Results area -->
        <section
            class="ai-hf-results"
            aria-live="polite"
            :aria-label="t('ai.search_results')">
            <!-- Download error message -->
            <div
                v-if="hfDownloadError"
                class="ai-hf-error"
                role="alert"
                >{{ hfDownloadError }}</div
            >

            <!-- Loading state -->
            <div
                v-if="hfIsSearching || hfIsLoadingFiles"
                class="ai-hf-loading"
                role="status">
                {{ t('ai.searching') }}
            </div>

            <!-- Repo file listing -->
            <template v-else-if="hfSelectedRepo && hfRepoFiles.length > 0">
                <div class="ai-hf-repo-header">
                    <h3 class="ai-hf-repo-title">{{ hfSelectedRepo }}</h3>
                    <div
                        v-if="hfModelInfo"
                        class="ai-hf-model-meta">
                        <span
                            v-if="hfModelInfo.architecture"
                            class="ai-hf-meta-tag"
                            :title="t('ai.model_architecture')">
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                <path d="M16 14a4 4 0 0 0-8 0v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4z" />
                            </svg>
                            {{ hfModelInfo.architecture }}
                        </span>
                        <span
                            v-if="hfModelInfo.contextLength"
                            class="ai-hf-meta-tag"
                            :title="t('ai.context_window')">
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <polyline points="4 7 4 4 20 4 20 7" />
                                <line
                                    x1="9"
                                    y1="20"
                                    x2="15"
                                    y2="20" />
                                <line
                                    x1="12"
                                    y1="4"
                                    x2="12"
                                    y2="20" />
                            </svg>
                            {{ t('ai.context_length_tokens', { count: formatNumber(hfModelInfo.contextLength) }) }}
                        </span>
                        <span
                            v-if="hfModelInfo.totalParamSize"
                            class="ai-hf-meta-tag"
                            :title="t('ai.total_param_size')">
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <path
                                    d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                            {{ t('ai.total_param_size_value', { size: hfModelInfo.totalParamSizeFormatted }) }}
                        </span>
                    </div>
                </div>
                <ul class="ai-hf-files-list">
                    <li
                        v-for="file in hfRepoFiles"
                        :key="file.name"
                        class="ai-hf-file-item">
                        <div class="ai-hf-file-info">
                            <div class="ai-hf-file-top-row">
                                <span class="ai-hf-file-name">{{ file.name }}</span>
                                <span
                                    v-if="file.tier"
                                    class="ai-hf-tier-badge"
                                    :class="'ai-hf-tier-' + file.tier.color"
                                    :title="file.tier.description">
                                    {{ file.tier.label }}
                                </span>
                            </div>
                            <div class="ai-hf-file-details">
                                <span
                                    class="ai-hf-file-size"
                                    :title="t('ai.download_size')"
                                    >{{ file.sizeFormatted }}</span
                                >
                                <span
                                    v-if="file.quantType"
                                    class="ai-hf-quant-badge"
                                    :title="t('ai.quantization_type')"
                                    >{{ file.quantType }}</span
                                >
                                <span
                                    v-if="file.estimatedRamFormatted"
                                    class="ai-hf-ram-estimate"
                                    :title="t('ai.estimated_ram')">
                                    {{ t('ai.estimated_ram_value', { size: file.estimatedRamFormatted }) }}
                                </span>
                                <span
                                    v-if="file.isSharded"
                                    class="ai-hf-shard-info"
                                    :title="t('ai.model_sharded')">
                                    {{ t('ai.shard_parts_count', { count: file.shardCount }) }}
                                </span>
                            </div>
                        </div>
                        <div
                            class="ai-hf-file-actions"
                            role="group"
                            :aria-label="t('ai.download_options')">
                            <template v-if="hfActiveDownloads.has(file.name)">
                                <div
                                    v-if="hfDownloadProgress && hfDownloadProgress.fileName === file.name"
                                    class="ai-hf-progress"
                                    role="progressbar"
                                    :aria-valuenow="hfDownloadProgress.percent"
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    :aria-label="t('ai.download_progress', { percent: hfDownloadProgress.percent })">
                                    <div class="ai-hf-progress-bar">
                                        <div
                                            class="ai-hf-progress-fill"
                                            :style="{ width: hfDownloadProgress.percent + '%' }"></div>
                                    </div>
                                    <span class="ai-hf-progress-text">{{ hfDownloadProgress.percent }}%</span>
                                </div>
                                <button
                                    class="ai-btn-icon ai-btn-tiny ai-btn-danger"
                                    type="button"
                                    :title="t('ai.cancel_download')"
                                    :aria-label="t('ai.cancel_download')"
                                    @click="$emit('cancel-download', file.name)">
                                    <svg
                                        width="9"
                                        height="9"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        aria-hidden="true">
                                        <line
                                            x1="18"
                                            y1="6"
                                            x2="6"
                                            y2="18" />
                                        <line
                                            x1="6"
                                            y1="6"
                                            x2="18"
                                            y2="18" />
                                    </svg>
                                </button>
                            </template>
                            <button
                                v-else-if="file.isSharded"
                                class="ai-hf-download-btn ai-hf-download-sharded"
                                type="button"
                                :title="t('ai.download_all_parts', { count: file.shardCount, name: file.name })"
                                :aria-label="t('ai.download_all_parts', { count: file.shardCount, name: file.name })"
                                @click="$emit('download', file)">
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line
                                        x1="12"
                                        y1="15"
                                        x2="12"
                                        y2="3" />
                                </svg>
                                <span class="ai-hf-download-label">{{ t('ai.all') }}</span>
                            </button>
                            <button
                                v-else
                                class="ai-hf-download-btn"
                                type="button"
                                :title="t('ai.download_to', { name: file.name })"
                                :aria-label="t('ai.download_to', { name: file.name })"
                                @click="$emit('download', file)">
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line
                                        x1="12"
                                        y1="15"
                                        x2="12"
                                        y2="3" />
                                </svg>
                            </button>
                        </div>
                    </li>
                </ul>
            </template>

            <!-- No files found in repo -->
            <div
                v-else-if="hfSelectedRepo && !hfIsLoadingFiles"
                class="ai-hf-empty"
                role="status">
                {{ t('ai.no_gguf_files_found') }}
            </div>

            <!-- Search results list -->
            <template v-else-if="hfSearchResults.length > 0">
                <ul class="ai-hf-repos-list">
                    <li
                        v-for="repo in hfSearchResults"
                        :key="repo.id"
                        class="ai-hf-result-item">
                        <button
                            type="button"
                            class="ai-hf-result-button"
                            :aria-label="t('ai.open_repository', { id: repo.id })"
                            @click="$emit('select-repo', repo.id)">
                            <div class="ai-hf-result-info">
                                <span class="ai-hf-result-name">{{ repo.id }}</span>
                                <div class="ai-hf-result-meta">
                                    <span :title="t('ai.downloads')">↓ {{ formatNumber(repo.downloads) }}</span>
                                    <span :title="t('ai.likes')">♥ {{ formatNumber(repo.likes) }}</span>
                                    <span
                                        v-if="repo.architecture"
                                        class="ai-hf-result-tag"
                                        :title="t('ai.architecture')"
                                        >{{ repo.architecture }}</span
                                    >
                                    <span
                                        v-if="repo.parameterCount"
                                        class="ai-hf-result-tag"
                                        :title="t('ai.parameters')"
                                        >{{ repo.parameterCount }}</span
                                    >
                                </div>
                            </div>
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </li>
                </ul>

                <!-- Load more results -->
                <button
                    v-if="hfHasMore"
                    class="ai-hf-load-more"
                    type="button"
                    :disabled="hfIsLoadingMore"
                    :aria-label="t('ai.load_more_results')"
                    @click="$emit('load-more')">
                    {{ hfIsLoadingMore ? t('ai.loading') : t('ai.load_more') }}
                </button>
            </template>

            <!-- Empty state -->
            <div
                v-else-if="!hfIsSearching"
                class="ai-hf-empty"
                role="status">
                {{ t('ai.search_for_gguf_models') }}
            </div>
        </section>
    </aside>
</template>

<style lang="scss" scoped>
/* ––– Root Container ––– */

.ai-hf-panel {
    flex-shrink: 0;
    max-height: 50%;
    display: flex;
    flex-direction: column;
    border-bottom: $border-width-thin $text3;
}

/* ––– Header Section ––– */

.ai-hf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-2 $space-3 $space-1;
}

.ai-hf-title {
    margin: 0;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $text2;
    text-transform: uppercase;
    letter-spacing: $letter-spacing-wider;
}

/* ––– Search Bar ––– */

.ai-hf-search-bar {
    display: flex;
    align-items: center;
    gap: $space-1;
    margin: 0 $space-2 $space-2;
    background: $bg-primary;
    border: $border-width-thin $text3;
    border-radius: $border-radius-lg;
    padding: $space-0 $space-2 $space-0 $space-2;

    &:focus-within {
        border-color: $accent-color;
    }
}

.ai-hf-search-input {
    flex: 1;
    min-width: 0;
    padding: $space-1 0;
    background: transparent;
    color: $text1;
    border: none;
    font-size: $font-size-xs;
    font-family: inherit;
    outline: none;

    &::placeholder {
        color: $text2;
    }

    &:focus {
        outline: none;
    }
}

/* ––– Sort Bar ––– */

.ai-hf-sort-bar {
    display: flex;
    gap: $space-1;
    margin: 0 $space-2 $space-1;
    padding: $space-0;
    background: $bg-primary;
    border-radius: $border-radius;
    border: none;
}

.ai-hf-sort-btn {
    flex: 1;
    padding: $space-1 $space-2;
    background: none;
    border: none;
    color: $text2;
    font-size: $font-size-xxs;
    font-family: inherit;
    cursor: pointer;
    border-radius: $border-radius-sm;
    transition: all $transition-fast;

    &:hover {
        color: $text1;
        background: $bg-hover;
    }

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
    }

    &[aria-pressed='true'] {
        color: $text1;
        background: $bg-hover;
        font-weight: $font-weight-semibold;
    }
}

/* ––– Back Button ––– */

.ai-hf-back-btn {
    display: flex;
    align-items: center;
    gap: $space-1;
    padding: $space-1 $space-2;
    margin: 0 $space-2 $space-1;
    background: none;
    border: none;
    color: $text2;
    font-size: $font-size-xs;
    cursor: pointer;
    border-radius: $border-radius;
    transition: all $transition-fast;

    &:hover {
        color: $text1;
        background: $bg-hover;
    }

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
    }
}

/* ––– Results Container ––– */

.ai-hf-results {
    flex: 1;
    overflow-y: auto;
    padding: 0 $space-2 $space-2;
}

.ai-hf-error {
    padding: $space-2 $space-3;
    margin: $space-1 $space-3;
    font-size: $font-size-xs;
    color: $danger-color;
    background: $danger-color-alpha;
    border-radius: $border-radius;
    border: $border-width-thin $danger-color-alpha;
}

.ai-hf-loading,
.ai-hf-empty {
    font-size: $font-size-xs;
    color: $text2;
    text-align: center;
    padding: $space-4 0;
}

/* ––– Repo Search Results ––– */

.ai-hf-repos-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.ai-hf-result-item {
    display: flex;
    align-items: center;
    border-radius: $border-radius-lg;
    transition: background $transition-fast;

    &:hover {
        background: $bg-hover;
    }
}

.ai-hf-result-button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: $space-1;
    padding: $space-2 $space-2;
    background: none;
    border: none;
    color: inherit;
    font-family: inherit;
    cursor: pointer;
    text-align: left;

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
        border-radius: $border-radius-lg;
    }
}

.ai-hf-result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.ai-hf-result-name {
    font-size: $font-size-xs;
    color: $text1;
    overflow-wrap: break-word;
    line-height: $line-height;
}

.ai-hf-result-meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    font-size: $font-size-xxs;
    color: $text2;
    opacity: $opacity-mid-high;
    align-items: center;
}

.ai-hf-result-tag {
    font-size: $font-size-xxs;
    background: $bg-hover;
    padding: $space-0 $space-1;
    border-radius: $border-radius-xs;
    overflow-wrap: nowrap;
}

.ai-hf-load-more {
    display: block;
    width: 100%;
    padding: $space-2;
    margin-top: $space-1;
    background: none;
    border: $border-width-thin $text3;
    color: $text2;
    font-size: $font-size-xs;
    font-family: inherit;
    cursor: pointer;
    border-radius: $border-radius;
    transition: all $transition-fast;

    &:hover:not(:disabled) {
        color: $text1;
        border-color: $text2;
        background: $bg-hover;
    }

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
    }

    &:disabled {
        opacity: $opacity-mid-low;
        cursor: not-allowed;
    }
}

/* ––– Repo Header Section ––– */

.ai-hf-repo-header {
    padding: $space-1 $space-2 $space-2;

    .ai-hf-repo-title {
        margin: 0;
        font-size: $font-size-xs;
        font-weight: $font-weight-semibold;
        color: $text1;
        overflow-wrap: break-word;
    }

    .ai-hf-model-meta {
        display: flex;
        flex-wrap: wrap;
        gap: $space-1;
        margin-top: $space-1;

        .ai-hf-meta-tag {
            font-size: $font-size-xxs;
            color: $text2;
            background: $bg-hover;
            padding: $space-0 $space-2;
            border-radius: $border-radius-sm;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: $space-1;

            svg {
                flex-shrink: 0;
                opacity: $opacity-mid-high;
            }
        }
    }
}

/* ––– Files List ––– */

.ai-hf-files-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.ai-hf-file-item {
    display: flex;
    align-items: flex-start;
    gap: $space-1;
    padding: $space-2;
    border-radius: $border-radius-lg;
    transition: background $transition-fast;

    &:hover {
        background: $bg-hover;
    }
}

.ai-hf-file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.ai-hf-file-top-row {
    display: flex;
    align-items: center;
    gap: $space-1;
}

.ai-hf-file-name {
    font-size: $font-size-xs;
    color: $text1;
    overflow-wrap: break-all;
    line-height: $line-height;
    font-family: $font-family-mono;
}

.ai-hf-tier-badge {
    font-size: $font-size-xxs;
    font-weight: $font-weight-semibold;
    padding: $space-0 $space-2;
    border-radius: $border-radius-sm;
    white-space: nowrap;
    flex-shrink: 0;
    color: $text1;

    &.ai-hf-tier-green {
        background: $tier-small;
    }

    &.ai-hf-tier-blue {
        background: $tier-medium;
    }

    &.ai-hf-tier-orange {
        background: $tier-large;
    }

    &.ai-hf-tier-red {
        background: $tier-extreme;
    }
}

/* ––– File Details & Metadata ––– */

.ai-hf-file-details {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    align-items: center;
}

.ai-hf-file-size {
    font-size: $font-size-xxs;
    color: $text2;
}

.ai-hf-quant-badge {
    font-size: $font-size-xxs;
    font-weight: $font-weight-semibold;
    background: $bg-tertiary;
    color: $text1;
    padding: $space-0 $space-2;
    border-radius: $border-radius;
    font-family: $font-family-mono;
}

.ai-hf-ram-estimate {
    font-size: $font-size-xxs;
    color: $text2;
    opacity: $opacity-highest;
}

.ai-hf-shard-info {
    font-size: $font-size-xxs;
    color: $text2;
    opacity: $opacity-mid-high;
    font-style: italic;
}

/* ––– File Actions ––– */

.ai-hf-file-actions {
    display: flex;
    align-items: center;
    gap: $space-1;
    flex-shrink: 0;
    margin-top: $space-0;
}

.ai-hf-download-btn {
    background: none;
    border: $border-width-thin $accent-color;
    color: $accent-color;
    cursor: pointer;
    padding: $space-1;
    border-radius: $border-radius;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    transition: all $transition-fast;
    font-family: inherit;

    &:hover:not(:disabled) {
        background: $accent-color;
        color: $base1;
    }

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
    }

    &:disabled {
        opacity: $opacity-mid-low;
        cursor: not-allowed;
    }

    &.ai-hf-download-sharded {
        padding: $space-1 $space-2;
    }

    .ai-hf-download-label {
        font-size: $font-size-xxs;
        font-weight: $font-weight-semibold;
    }
}

/* ––– Download Progress ––– */

.ai-hf-progress {
    display: flex;
    align-items: center;
    gap: $space-1;
    min-width: $size-18;
}

.ai-hf-progress-bar {
    flex: 1;
    height: $size-1;
    background: $text3;
    border-radius: $border-radius-xs;
    overflow: hidden;
}

.ai-hf-progress-fill {
    height: 100%;
    background: $accent-color;
    border-radius: $border-radius-xs;
    transition: width $transition-slow;
}

.ai-hf-progress-text {
    font-size: $font-size-xxs;
    color: $text2;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

/* ––– Button Styles ––– */

.ai-btn-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-1;
    border-radius: $border-radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-base;
    flex-shrink: 0;
    font-size: 0;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }

    &:focus-visible {
        outline: $border-width-thick $accent-color;
        outline-offset: $size-0;
    }

    &:disabled {
        opacity: $opacity-lowest;
        cursor: not-allowed;
    }
}

.ai-btn-tiny {
    padding: $space-1;
}

.ai-btn-danger {
    &:hover:not(:disabled) {
        color: $danger-color;
    }
}
</style>
