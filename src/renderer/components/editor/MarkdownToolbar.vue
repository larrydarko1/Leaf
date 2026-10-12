<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IconBold from '@/renderer/components/icons/IconBold.vue';
import IconCheckbox from '@/renderer/components/icons/IconCheckbox.vue';
import IconCode from '@/renderer/components/icons/IconCode.vue';
import IconHighlight from '@/renderer/components/icons/IconHighlight.vue';
import IconItalic from '@/renderer/components/icons/IconItalic.vue';
import IconLink from '@/renderer/components/icons/IconLink.vue';
import IconList from '@/renderer/components/icons/IconList.vue';
import IconListOrdered from '@/renderer/components/icons/IconListOrdered.vue';
import IconMinus from '@/renderer/components/icons/IconMinus.vue';
import IconQuote from '@/renderer/components/icons/IconQuote.vue';
import IconStrikethrough from '@/renderer/components/icons/IconStrikethrough.vue';
import IconTable from '@/renderer/components/icons/IconTable.vue';

defineEmits<{
    format: [type: string];
    heading: [event: Event];
}>();

const { t } = useI18n();
</script>

<template>
    <div
        class="md-toolbar"
        role="toolbar"
        :aria-label="t('editor.markdown_formatting_toolbar')">
        <!-- Text formatting buttons -->
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.bold') + ' (⌘B)'"
            :aria-label="t('editor.bold')"
            @mousedown.prevent="$emit('format', 'bold')">
            <IconBold
                width="14"
                height="14"
                stroke-width="3" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.italic') + ' (⌘I)'"
            :aria-label="t('editor.italic')"
            @mousedown.prevent="$emit('format', 'italic')">
            <IconItalic
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.strikethrough')"
            :aria-label="t('editor.strikethrough')"
            @mousedown.prevent="$emit('format', 'strikethrough')">
            <IconStrikethrough
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.highlight') + ' (⌘⇧H)'"
            :aria-label="t('editor.highlight')"
            @mousedown.prevent="$emit('format', 'highlight')">
            <IconHighlight
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.inline_code')"
            :aria-label="t('editor.inline_code')"
            @mousedown.prevent="$emit('format', 'code')">
            <IconCode
                width="14"
                height="14" />
        </button>

        <div
            class="md-toolbar-separator toolbar-sep"
            aria-hidden="true"></div>

        <!-- Heading level selector -->
        <select
            class="md-toolbar-select"
            :title="t('editor.heading_level')"
            :aria-label="t('editor.heading_level')"
            @change="$emit('heading', $event)">
            <option
                value=""
                selected
                disabled
                >{{ t('editor.heading') }}</option
            >
            <option value="1">{{ t('editor.heading_1') }}</option>
            <option value="2">{{ t('editor.heading_2') }}</option>
            <option value="3">{{ t('editor.heading_3') }}</option>
            <option value="4">{{ t('editor.heading_4') }}</option>
        </select>

        <div
            class="md-toolbar-separator toolbar-sep"
            aria-hidden="true"></div>

        <!-- List formatting buttons -->
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.bullet_list')"
            :aria-label="t('editor.bullet_list')"
            @mousedown.prevent="$emit('format', 'ul')">
            <IconList
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.numbered_list')"
            :aria-label="t('editor.numbered_list')"
            @mousedown.prevent="$emit('format', 'ol')">
            <IconListOrdered
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.checkbox')"
            :aria-label="t('editor.checkbox')"
            @mousedown.prevent="$emit('format', 'checkbox')">
            <IconCheckbox
                width="14"
                height="14" />
        </button>

        <div
            class="md-toolbar-separator toolbar-sep"
            aria-hidden="true"></div>

        <!-- Block-level formatting buttons -->
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.blockquote')"
            :aria-label="t('editor.blockquote')"
            @mousedown.prevent="$emit('format', 'quote')">
            <IconQuote
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.link')"
            :aria-label="t('editor.link')"
            @mousedown.prevent="$emit('format', 'link')">
            <IconLink
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.table')"
            :aria-label="t('editor.table')"
            @mousedown.prevent="$emit('format', 'table')">
            <IconTable
                width="14"
                height="14" />
        </button>
        <button
            class="md-toolbar-btn icon-btn-square"
            type="button"
            :title="t('editor.horizontal_rule')"
            :aria-label="t('editor.horizontal_rule')"
            @mousedown.prevent="$emit('format', 'hr')">
            <IconMinus
                width="14"
                height="14" />
        </button>
    </div>
</template>

<style lang="scss" scoped>
/* ––– Toolbar Container ––– */

.md-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    padding: $border-radius $border-radius-xl;
    background: color-mix(in srgb, $base1 60%, transparent);
    backdrop-filter: blur($backdrop-blur-md) saturate(1.4);
    border-bottom: $border-width-thin color-mix(in srgb, $text2 12%, transparent);
    flex-shrink: 0;
    flex-wrap: wrap;
}

/* ––– Toolbar Buttons ––– */

// Shorter than the square default: the toolbar is a dense strip above the editor,
// and full-height buttons would crowd the text.
.md-toolbar-btn {
    height: $size-11;

    &:active {
        background: $accent-color;
        color: $text1;
        transform: scale($scale-hover-sm);
    }

    svg {
        width: $size-7;
        height: $size-7;
    }
}

/* ––– Separator Dividers ––– */

/* ––– Heading Level Selector ––– */

.md-toolbar-select {
    height: $size-11;
    padding: 0 $space-2;
    border: $border-width-thin color-mix(in srgb, $text2 15%, transparent);
    border-radius: $border-radius-lg;
    background: color-mix(in srgb, $text2 8%, transparent);
    color: $text1;
    font-size: $font-size-xs;
    cursor: pointer;
    outline: none;
    transition: all $transition-fast;

    &:hover {
        border-color: color-mix(in srgb, $text2 30%, transparent);
        background: color-mix(in srgb, $text2 15%, transparent);
    }

    &:focus {
        border-color: $accent-color;
        box-shadow: $accent-shadow;
    }
}
</style>
