<script setup lang="ts">
defineEmits<{
    (e: 'format', type: string): void;
    (e: 'heading', event: Event): void;
}>();
</script>

<template>
    <div class="md-toolbar">
        <button class="md-toolbar-btn" title="Bold (⌘B)" @mousedown.prevent="$emit('format', 'bold')">
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Italic (⌘I)" @mousedown.prevent="$emit('format', 'italic')">
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
                <line x1="19" y1="4" x2="10" y2="4"></line>
                <line x1="14" y1="20" x2="5" y2="20"></line>
                <line x1="15" y1="4" x2="9" y2="20"></line>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Strikethrough" @mousedown.prevent="$emit('format', 'strikethrough')">
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
                <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.1 0 1.4.8 2.3 2.3 3"></path>
                <path d="M4 12h16"></path>
                <path d="M17 16c0 2.3-2 4-5.5 4-2 0-3.7-.4-5.5-1.5"></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Highlight (⌘⇧H)" @mousedown.prevent="$emit('format', 'highlight')">
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
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Inline code" @mousedown.prevent="$emit('format', 'code')">
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
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
        </button>
        <div class="md-toolbar-separator"></div>
        <select class="md-toolbar-select" title="Heading level" @change="$emit('heading', $event)">
            <option value="" selected disabled>Heading</option>
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
            <option value="4">H4</option>
        </select>
        <div class="md-toolbar-separator"></div>
        <button class="md-toolbar-btn" title="Bullet list" @mousedown.prevent="$emit('format', 'ul')">
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
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Numbered list" @mousedown.prevent="$emit('format', 'ol')">
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
                <line x1="10" y1="6" x2="21" y2="6"></line>
                <line x1="10" y1="12" x2="21" y2="12"></line>
                <line x1="10" y1="18" x2="21" y2="18"></line>
                <path d="M4 6h1v4"></path>
                <path d="M4 10h2"></path>
                <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Checkbox" @mousedown.prevent="$emit('format', 'checkbox')">
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
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <path d="M9 12l2 2 4-4"></path>
            </svg>
        </button>
        <div class="md-toolbar-separator"></div>
        <button class="md-toolbar-btn" title="Blockquote" @mousedown.prevent="$emit('format', 'quote')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M10 11H6a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 017 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0010 11zM20 11h-4a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 0117 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0020 11z"
                ></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Link (⌘K)" @mousedown.prevent="$emit('format', 'link')">
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
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Table" @mousedown.prevent="$emit('format', 'table')">
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
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="3" y1="15" x2="21" y2="15"></line>
                <line x1="9" y1="9" x2="9" y2="21"></line>
                <line x1="15" y1="9" x2="15" y2="21"></line>
            </svg>
        </button>
        <button class="md-toolbar-btn" title="Horizontal rule" @mousedown.prevent="$emit('format', 'hr')">
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <line x1="3" y1="12" x2="21" y2="12"></line>
            </svg>
        </button>
    </div>
</template>

<style lang="scss" scoped>
.md-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--base1) 60%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid color-mix(in srgb, var(--text2) 12%, transparent);
    flex-shrink: 0;
    flex-wrap: wrap;
}

.md-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        background: color-mix(in srgb, var(--text2) 15%, transparent);
        color: $text1;
    }

    &:active {
        background: var(--accent-color, #4a9eff);
        color: #fff;
        transform: scale(0.92);
    }

    svg {
        width: 14px;
        height: 14px;
    }
}

.md-toolbar-separator {
    width: 1px;
    height: 16px;
    background: color-mix(in srgb, var(--text2) 20%, transparent);
    margin: 0 4px;
    flex-shrink: 0;
    border-radius: 1px;
}

.md-toolbar-select {
    height: 26px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--text2) 15%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--text2) 8%, transparent);
    color: $text1;
    font-size: 11px;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--text2) 30%, transparent);
        background: color-mix(in srgb, var(--text2) 15%, transparent);
    }

    &:focus {
        border-color: $accent-color;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #4a9eff) 20%, transparent);
    }
}
</style>
