<script setup lang="ts">
import type { AgentFileEdit } from '../../types/chat';

defineProps<{
    edit: AgentFileEdit;
}>();

defineEmits<{
    (e: 'approve'): void;
    (e: 'reject'): void;
}>();
</script>

<template>
    <div class="ai-agent-edit-card" :class="edit.status">
        <div class="ai-agent-edit-header">
            <div class="ai-agent-edit-file">
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <span class="ai-agent-edit-filename">{{ edit.relativePath || edit.filePath }}</span>
                <span v-if="edit.isNewFile" class="ai-agent-edit-badge new">NEW</span>
            </div>
            <div class="ai-agent-edit-status">
                <span v-if="edit.status === 'approved'" class="ai-agent-status-text approved">Approved</span>
                <span v-else-if="edit.status === 'rejected'" class="ai-agent-status-text rejected">Reverted</span>
                <span v-else-if="edit.status === 'error'" class="ai-agent-status-text error">Error</span>
            </div>
        </div>
        <details v-if="edit.originalContent !== undefined" class="ai-agent-diff-details">
            <summary class="ai-agent-diff-summary">View changes</summary>
            <div class="ai-agent-diff">
                <div v-if="!edit.isNewFile" class="ai-agent-diff-section removed">
                    <div class="ai-agent-diff-label">Original</div>
                    <pre class="ai-agent-diff-code">{{ edit.originalContent }}</pre>
                </div>
                <div class="ai-agent-diff-section added">
                    <div class="ai-agent-diff-label">
                        {{ edit.isNewFile ? 'New file' : 'Modified' }}
                    </div>
                    <pre class="ai-agent-diff-code">{{ edit.newContent }}</pre>
                </div>
            </div>
        </details>
        <div v-if="edit.error" class="ai-agent-edit-error">{{ edit.error }}</div>
        <div v-if="edit.status === 'pending'" class="ai-agent-edit-actions">
            <button class="ai-agent-btn approve" @click="$emit('approve')">
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
            </button>
            <button class="ai-agent-btn reject" @click="$emit('reject')">
                <svg
                    width="12"
                    height="12"
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
                Reject
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.ai-agent-edit-card {
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s;
    &.pending {
        border-color: $accent-color;
        border-style: dashed;
    }
    &.approved {
        border-color: #2ecc71;
    }
    &.rejected {
        border-color: #e74c3c;
        opacity: 0.7;
    }
    &.error {
        border-color: #e74c3c;
    }
}

.ai-agent-edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.65rem;
    border-bottom: 1px solid $text3;
    background: rgba(0, 0, 0, 0.05);
}

.ai-agent-edit-file {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
}

.ai-agent-edit-filename {
    font-size: 0.75rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: $text1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ai-agent-edit-badge {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    &.new {
        background: $accent-color;
        color: $base1;
    }
}

.ai-agent-status-text {
    font-size: 0.7rem;
    font-weight: 600;
    flex-shrink: 0;
    &.approved {
        color: #2ecc71;
    }
    &.rejected {
        color: #e74c3c;
    }
    &.error {
        color: #e74c3c;
    }
}

.ai-agent-diff-details {
    border-bottom: 1px solid $text3;
}

.ai-agent-diff-summary {
    padding: 0.35rem 0.65rem;
    font-size: 0.72rem;
    color: $text2;
    cursor: pointer;
    user-select: none;
    transition: color 0.15s;
    &:hover {
        color: $text1;
    }
}

.ai-agent-diff {
    max-height: 300px;
    overflow-y: auto;
}

.ai-agent-diff-section {
    &.removed {
        background: rgba(231, 76, 60, 0.08);
    }
    &.added {
        background: rgba(46, 204, 113, 0.08);
    }
}

.ai-agent-diff-label {
    padding: 0.25rem 0.65rem;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $text2;
    border-bottom: 1px solid $text3;
}

.ai-agent-diff-code {
    padding: 0.5rem 0.65rem;
    font-size: 0.72rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    color: $text1;
    max-height: 140px;
    overflow-y: auto;
}

.ai-agent-edit-error {
    padding: 0.4rem 0.65rem;
    font-size: 0.72rem;
    color: #e74c3c;
    border-bottom: 1px solid $text3;
}

.ai-agent-edit-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
}

.ai-agent-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    border: none;
    border-radius: 7px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition:
        opacity 0.15s,
        transform 0.1s;
    flex: 1;
    justify-content: center;
    &:hover {
        opacity: 0.85;
        transform: scale(1.02);
    }
    &.approve {
        background: #2ecc71;
        color: #fff;
    }
    &.reject {
        background: #e74c3c;
        color: #fff;
    }
}
</style>
