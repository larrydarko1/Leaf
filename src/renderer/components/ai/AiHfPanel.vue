<script setup lang="ts">
import type { HfRepoFile, HfModelInfo, HfSearchResult, HfDownloadProgress } from '../../types/hf';

defineProps<{
    hfSearchQuery: string;
    hfSearchResults: HfSearchResult[];
    hfIsSearching: boolean;
    hfSelectedRepo: string | null;
    hfRepoFiles: HfRepoFile[];
    hfModelInfo: HfModelInfo | null;
    hfIsLoadingFiles: boolean;
    hfDownloadProgress: HfDownloadProgress | null;
    hfActiveDownloads: Set<string>;
}>();

defineEmits<{
    (e: 'update:hfSearchQuery', value: string): void;
    (e: 'search'): void;
    (e: 'select-repo', id: string): void;
    (e: 'download', file: HfRepoFile): void;
    (e: 'cancel-download', fileName: string): void;
    (e: 'back'): void;
    (e: 'close'): void;
}>();

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}
</script>

<template>
    <div class="ai-hf-panel">
        <div class="ai-hf-header">
            <span class="ai-hf-title">Download Models</span>
            <button class="ai-btn-icon ai-btn-tiny" title="Close" @click="$emit('close')">
                <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
        <div class="ai-hf-search-bar">
            <input
                :value="hfSearchQuery"
                placeholder="Search GGUF models..."
                class="ai-hf-search-input"
                @input="$emit('update:hfSearchQuery', ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="$emit('search')"
            />
            <button class="ai-btn-icon" :disabled="hfIsSearching" title="Search" @click="$emit('search')">
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
            </button>
        </div>

        <!-- Back button when viewing files -->
        <button v-if="hfSelectedRepo" class="ai-hf-back-btn" @click="$emit('back')">
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to results
        </button>

        <div class="ai-hf-results">
            <!-- Loading state -->
            <div v-if="hfIsSearching || hfIsLoadingFiles" class="ai-hf-loading">Searching...</div>

            <!-- Repo file listing -->
            <template v-else-if="hfSelectedRepo && hfRepoFiles.length > 0">
                <div class="ai-hf-repo-header">
                    <span class="ai-hf-repo-title">{{ hfSelectedRepo }}</span>
                    <div v-if="hfModelInfo" class="ai-hf-model-meta">
                        <span v-if="hfModelInfo.architecture" class="ai-hf-meta-tag" title="Model Architecture">
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                <path d="M16 14a4 4 0 0 0-8 0v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4z" />
                            </svg>
                            {{ hfModelInfo.architecture }}
                        </span>
                        <span v-if="hfModelInfo.contextLength" class="ai-hf-meta-tag" title="Context Window">
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <polyline points="4 7 4 4 20 4 20 7" />
                                <line x1="9" y1="20" x2="15" y2="20" />
                                <line x1="12" y1="4" x2="12" y2="20" />
                            </svg>
                            {{ formatNumber(hfModelInfo.contextLength) }} tokens
                        </span>
                        <span
                            v-if="hfModelInfo.totalParamSize"
                            class="ai-hf-meta-tag"
                            title="Total Parameter Size (unquantized)"
                        >
                            <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path
                                    d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                                />
                            </svg>
                            {{ hfModelInfo.totalParamSizeFormatted }} params
                        </span>
                    </div>
                </div>
                <div v-for="file in hfRepoFiles" :key="file.name" class="ai-hf-file-item">
                    <div class="ai-hf-file-info">
                        <div class="ai-hf-file-top-row">
                            <span class="ai-hf-file-name">{{ file.name }}</span>
                            <span
                                v-if="file.tier"
                                class="ai-hf-tier-badge"
                                :class="'ai-hf-tier-' + file.tier.color"
                                :title="file.tier.description"
                            >
                                {{ file.tier.label }}
                            </span>
                        </div>
                        <div class="ai-hf-file-details">
                            <span class="ai-hf-file-size" title="Download size">{{ file.sizeFormatted }}</span>
                            <span v-if="file.quantType" class="ai-hf-quant-badge" title="Quantization type">{{
                                file.quantType
                            }}</span>
                            <span
                                v-if="file.estimatedRamFormatted"
                                class="ai-hf-ram-estimate"
                                title="Estimated RAM needed for inference"
                            >
                                RAM: ~{{ file.estimatedRamFormatted }}
                            </span>
                            <span
                                v-if="file.isSharded"
                                class="ai-hf-shard-info"
                                title="Model is split into multiple files"
                            >
                                {{ file.shardCount }} parts
                            </span>
                        </div>
                    </div>
                    <div class="ai-hf-file-actions">
                        <template v-if="hfActiveDownloads.has(file.name)">
                            <div
                                v-if="hfDownloadProgress && hfDownloadProgress.fileName === file.name"
                                class="ai-hf-progress"
                            >
                                <div class="ai-hf-progress-bar">
                                    <div
                                        class="ai-hf-progress-fill"
                                        :style="{ width: hfDownloadProgress.percent + '%' }"
                                    ></div>
                                </div>
                                <span class="ai-hf-progress-text">{{ hfDownloadProgress.percent }}%</span>
                            </div>
                            <button
                                class="ai-btn-icon ai-btn-tiny ai-btn-danger"
                                title="Cancel"
                                @click="$emit('cancel-download', file.name)"
                            >
                                <svg
                                    width="9"
                                    height="9"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </template>
                        <button
                            v-else-if="file.isSharded"
                            class="ai-hf-download-btn ai-hf-download-sharded"
                            title="Download all parts to ~/leaf-models/"
                            @click="$emit('download', file)"
                        >
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span class="ai-hf-download-label">All</span>
                        </button>
                        <button
                            v-else
                            class="ai-hf-download-btn"
                            title="Download to ~/leaf-models/"
                            @click="$emit('download', file)"
                        >
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </template>

            <!-- No files found -->
            <div v-else-if="hfSelectedRepo && !hfIsLoadingFiles" class="ai-hf-empty">
                No .gguf files found in this repository
            </div>

            <!-- Search results -->
            <template v-else-if="hfSearchResults.length > 0">
                <div
                    v-for="repo in hfSearchResults"
                    :key="repo.id"
                    class="ai-hf-result-item"
                    @click="$emit('select-repo', repo.id)"
                >
                    <div class="ai-hf-result-info">
                        <span class="ai-hf-result-name">{{ repo.id }}</span>
                        <span class="ai-hf-result-meta">
                            <span title="Downloads">↓ {{ formatNumber(repo.downloads) }}</span>
                            <span title="Likes">♥ {{ formatNumber(repo.likes) }}</span>
                        </span>
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
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </div>
            </template>

            <!-- Empty state -->
            <div v-else-if="!hfIsSearching" class="ai-hf-empty">Search for GGUF models on Hugging Face</div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.ai-hf-panel {
    flex-shrink: 0;
    max-height: 50%;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--text3);
    -webkit-app-region: no-drag;
}

.ai-hf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem 0.35rem;
}

.ai-hf-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.ai-hf-search-bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0 0.5rem 0.4rem;
    background: var(--bg-primary);
    border: 1px solid var(--text3);
    border-radius: 8px;
    padding: 0.15rem 0.15rem 0.15rem 0.5rem;
    &:focus-within {
        border-color: var(--accent-color);
    }
}

.ai-hf-search-input {
    flex: 1;
    min-width: 0;
    padding: 0.3rem 0;
    background: transparent;
    color: var(--text1);
    border: none;
    font-size: 0.75rem;
    font-family: inherit;
    outline: none;
    &::placeholder {
        color: var(--text2);
    }
}

.ai-hf-back-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    margin: 0 0.5rem 0.3rem;
    background: none;
    border: none;
    color: var(--text2);
    font-size: 0.72rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
    &:hover {
        color: var(--text1);
        background: var(--bg-hover);
    }
}

.ai-hf-results {
    flex: 1;
    overflow-y: auto;
    padding: 0 0.5rem 0.5rem;
}

.ai-hf-loading,
.ai-hf-empty {
    font-size: 0.75rem;
    color: var(--text2);
    text-align: center;
    padding: 1rem 0;
}

.ai-hf-result-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.55rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;
    &:hover {
        background: var(--bg-hover);
    }
}

.ai-hf-result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.ai-hf-result-name {
    font-size: 0.75rem;
    color: var(--text1);
    word-break: break-word;
    line-height: 1.3;
}

.ai-hf-result-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.65rem;
    color: var(--text2);
    opacity: 0.7;
}

.ai-hf-repo-header {
    padding: 0.3rem 0.55rem 0.5rem;

    .ai-hf-repo-title {
        display: block;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text1);
        word-break: break-word;
    }

    .ai-hf-model-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.35rem;

        .ai-hf-meta-tag {
            font-size: 0.62rem;
            color: var(--text2);
            background: var(--bg-hover);
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
            svg {
                flex-shrink: 0;
                opacity: 0.7;
            }
        }
    }
}

.ai-hf-file-item {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    padding: 0.45rem 0.55rem;
    border-radius: 8px;
    transition: background 0.12s;
    &:hover {
        background: var(--bg-hover);
    }
}

.ai-hf-file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.ai-hf-file-top-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.ai-hf-file-name {
    font-size: 0.72rem;
    color: var(--text1);
    word-break: break-all;
    line-height: 1.3;
    font-family: 'SF Mono', 'Fira Code', monospace;
}

.ai-hf-tier-badge {
    font-size: 0.58rem;
    font-weight: 600;
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;

    &.ai-hf-tier-green {
        background: rgba(40, 167, 69, 0.15);
        color: #28a745;
    }
    &.ai-hf-tier-blue {
        background: rgba(0, 123, 255, 0.15);
        color: #007bff;
    }
    &.ai-hf-tier-orange {
        background: rgba(255, 165, 0, 0.15);
        color: #e69500;
    }
    &.ai-hf-tier-red {
        background: rgba(220, 53, 69, 0.15);
        color: #dc3545;
    }
}

.ai-hf-file-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
}

.ai-hf-file-size {
    font-size: 0.62rem;
    color: var(--text2);
}

.ai-hf-quant-badge {
    font-size: 0.58rem;
    font-weight: 500;
    background: rgba(108, 117, 125, 0.15);
    color: var(--text2);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-family: 'SF Mono', 'Fira Code', monospace;
}

.ai-hf-ram-estimate {
    font-size: 0.6rem;
    color: var(--text2);
    opacity: 0.85;
}

.ai-hf-shard-info {
    font-size: 0.58rem;
    color: var(--text2);
    opacity: 0.7;
    font-style: italic;
}

.ai-hf-file-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    margin-top: 0.15rem;
}

.ai-hf-download-btn {
    background: none;
    border: 1px solid var(--accent-color);
    color: var(--accent-color);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    transition: all 0.15s;

    &:hover {
        background: var(--accent-color);
        color: var(--base1);
    }
    &.ai-hf-download-sharded {
        padding: 0.2rem 0.4rem;
    }
    .ai-hf-download-label {
        font-size: 0.58rem;
        font-weight: 600;
    }
}

.ai-hf-progress {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 60px;
}

.ai-hf-progress-bar {
    flex: 1;
    height: 3px;
    background: var(--text3);
    border-radius: 2px;
    overflow: hidden;
}

.ai-hf-progress-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: 2px;
    transition: width 0.3s ease;
}

.ai-hf-progress-text {
    font-size: 0.62rem;
    color: var(--text2);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

.ai-btn-icon {
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text1);
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.ai-btn-tiny {
    padding: 0.2rem !important;
}
.ai-btn-danger {
    &:hover:not(:disabled) {
        color: var(--danger-color);
    }
}
</style>
