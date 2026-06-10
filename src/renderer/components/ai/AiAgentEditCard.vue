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
    <article
        class="ai-agent-edit-card"
        :class="edit.status">
        <!-- Header with file info and status -->
        <header class="ai-agent-edit-header">
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
                    aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <span class="ai-agent-edit-filename">{{ edit.relativePath || edit.filePath }}</span>
                <span
                    v-if="edit.isNewFile"
                    class="ai-agent-edit-badge new"
                    aria-label="New file">
                    NEW
                </span>
            </div>
            <div class="ai-agent-edit-status">
                <span
                    v-if="edit.status === 'approved'"
                    class="ai-agent-status-text approved">
                    Approved
                </span>
                <span
                    v-else-if="edit.status === 'rejected'"
                    class="ai-agent-status-text rejected">
                    Reverted
                </span>
                <span
                    v-else-if="edit.status === 'error'"
                    class="ai-agent-status-text error">
                    Error
                </span>
            </div>
        </header>

        <!-- Diff viewer -->
        <details
            v-if="edit.originalContent !== undefined"
            class="ai-agent-diff-details">
            <summary class="ai-agent-diff-summary">View changes</summary>
            <div class="ai-agent-diff">
                <!-- Original content -->
                <div
                    v-if="!edit.isNewFile"
                    class="ai-agent-diff-section removed">
                    <div class="ai-agent-diff-label">Original</div>
                    <pre class="ai-agent-diff-code">{{ edit.originalContent }}</pre>
                </div>

                <!-- New/modified content -->
                <div class="ai-agent-diff-section added">
                    <div class="ai-agent-diff-label">
                        {{ edit.isNewFile ? 'New file' : 'Modified' }}
                    </div>
                    <pre class="ai-agent-diff-code">{{ edit.newContent }}</pre>
                </div>
            </div>
        </details>

        <!-- Error message -->
        <div
            v-if="edit.error"
            class="ai-agent-edit-error"
            role="alert">
            {{ edit.error }}
        </div>

        <!-- Action buttons -->
        <div
            v-if="edit.status === 'pending'"
            class="ai-agent-edit-actions"
            role="group"
            aria-label="Edit actions">
            <button
                type="button"
                class="ai-agent-btn approve"
                aria-label="Approve this file edit"
                @click="$emit('approve')">
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
            </button>
            <button
                type="button"
                class="ai-agent-btn reject"
                aria-label="Reject this file edit"
                @click="$emit('reject')">
                <svg
                    width="12"
                    height="12"
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
                Reject
            </button>
        </div>
    </article>
</template>

<style lang="scss" scoped>
/* ––– Root Container ––– */

.ai-agent-edit-card {
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-xl;
    overflow: hidden;
    transition: border-color $transition-base;

    &.pending {
        border-color: $accent-color;
        border-style: dashed;
    }

    &.approved {
        border-color: $success-color;
    }

    &.rejected {
        border-color: $danger-color;
        opacity: 0.7;
    }

    &.error {
        border-color: $danger-color;
    }
}

/* ––– Header Section ––– */

.ai-agent-edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-2 $space-3;
    border-bottom: 1px solid $text3;
    background: rgb(0 0 0 / 5%);
}

.ai-agent-edit-file {
    display: flex;
    align-items: center;
    gap: $space-1;
    min-width: 0;
    flex: 1;
}

.ai-agent-edit-filename {
    font-size: $font-size-xs;
    font-family: $font-family-mono;
    color: $text1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ai-agent-edit-badge {
    font-size: $font-size-xxs;
    font-weight: $font-weight-bold;
    padding: $space-0 $space-1;
    border-radius: $border-radius-sm;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;

    &.new {
        background: $accent-color;
        color: $base1;
    }
}

.ai-agent-edit-status {
    flex-shrink: 0;
}

.ai-agent-status-text {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    flex-shrink: 0;

    &.approved {
        color: $success-color;
    }

    &.rejected {
        color: $danger-color;
    }

    &.error {
        color: $danger-color;
    }
}

/* ––– Diff Section ––– */

.ai-agent-diff-details {
    border-bottom: 1px solid $text3;
}

.ai-agent-diff-summary {
    padding: $space-1 $space-2;
    font-size: $font-size-xs;
    color: $text2;
    cursor: pointer;
    user-select: none;
    transition: color $transition-fast;

    &:hover {
        color: $text1;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: -2px;
    }
}

.ai-agent-diff {
    max-height: 300px;
    overflow-y: auto;
}

.ai-agent-diff-section {
    &.removed {
        background: $danger-color-alpha;
    }

    &.added {
        background: $success-color-alpha;
    }
}

.ai-agent-diff-label {
    padding: $space-1 $space-3;
    font-size: $font-size-xxs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $text2;
    border-bottom: 1px solid $text3;
}

.ai-agent-diff-code {
    padding: $space-2 $space-3;
    font-size: $font-size-xs;
    font-family: $font-family-mono;
    line-height: $line-height;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: break-all;
    color: $text1;
    max-height: 140px;
    overflow-y: auto;
}

/* ––– Error Section ––– */

.ai-agent-edit-error {
    padding: $space-2 $space-3;
    font-size: $font-size-xs;
    color: $danger-color;
    border-bottom: 1px solid $text3;
}

/* ––– Action Buttons ––– */

.ai-agent-edit-actions {
    display: flex;
    gap: $space-2;
    padding: $space-2 $space-3;
}

.ai-agent-btn {
    display: flex;
    align-items: center;
    gap: $space-1;
    padding: $space-1 $space-2;
    border: none;
    border-radius: $border-radius-lg;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    cursor: pointer;
    transition:
        opacity $transition-fast,
        transform $transition-fast;
    flex: 1;
    justify-content: center;

    &:hover:not(:disabled) {
        opacity: 0.85;
        transform: scale(1.02);
    }

    &:focus-visible {
        outline: 2px solid currentcolor;
        outline-offset: 2px;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &.approve {
        background: $success-color-alpha;
        color: $success-color;
    }

    &.reject {
        background: $danger-color-alpha;
        color: $danger-color;
    }
}
</style>
