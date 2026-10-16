<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IconDownload from '@/renderer/components/icons/IconDownload.vue';
import IconMinus from '@/renderer/components/icons/IconMinus.vue';
import IconPlus from '@/renderer/components/icons/IconPlus.vue';
import IconRedo from '@/renderer/components/icons/IconRedo.vue';
import IconTrash from '@/renderer/components/icons/IconTrash.vue';
import IconUndo from '@/renderer/components/icons/IconUndo.vue';

type Props = {
    zoom: number;
    zoomPercent: number;
    historyIndex: number;
    historyLength: number;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
};

defineProps<Props>();

const emit = defineEmits<{
    zoomToCenter: [value: number];
    undo: [];
    redo: [];
    clearAll: [];
    openExportDialog: [];
}>();

const { t } = useI18n();
</script>

<template>
    <footer
        class="canvas-footer row"
        :aria-label="t('drawing.canvas_controls')">
        <!-- Zoom controls -->
        <div class="footer-left row">
            <div
                class="zoom-controls row"
                role="group"
                :aria-label="t('drawing.zoom_controls')">
                <button
                    class="zoom-btn icon-btn-square"
                    :aria-label="t('drawing.zoom_out')"
                    @click="emit('zoomToCenter', zoom - 0.1)">
                    <IconMinus
                        width="14"
                        height="14" />
                </button>
                <button
                    class="zoom-value"
                    :aria-label="t('drawing.reset_zoom')"
                    @click="emit('zoomToCenter', 1)">
                    <span aria-hidden="true">{{ zoomPercent }}%</span>
                </button>
                <button
                    class="zoom-btn icon-btn-square"
                    :aria-label="t('drawing.zoom_in')"
                    @click="emit('zoomToCenter', zoom + 0.1)">
                    <IconPlus
                        width="14"
                        height="14" />
                </button>
            </div>
        </div>

        <!-- History controls: undo, redo, clear -->
        <div class="footer-center row">
            <button
                class="footer-btn icon-btn-square"
                :disabled="historyIndex <= 0"
                :aria-label="t('drawing.undo')"
                @click="emit('undo')">
                <IconUndo
                    width="16"
                    height="16" />
            </button>
            <button
                class="footer-btn icon-btn-square"
                :disabled="historyIndex >= historyLength - 1"
                :aria-label="t('drawing.redo')"
                @click="emit('redo')">
                <IconRedo
                    width="16"
                    height="16" />
            </button>
            <button
                class="footer-btn icon-btn-square"
                :aria-label="t('drawing.clear_canvas')"
                @click="emit('clearAll')">
                <IconTrash
                    width="16"
                    height="16" />
            </button>
        </div>

        <!-- Save status and export -->
        <div class="footer-right row">
            <!-- eslint-disable-next-line a11y/form-control-has-label -->
            <output
                v-if="isSaving || hasUnsavedChanges"
                class="save-status"
                :class="{ saving: isSaving, unsaved: hasUnsavedChanges }"
                aria-live="polite"
                aria-atomic="true">
                {{ isSaving ? t('drawing.saving') : t('drawing.unsaved') }}
            </output>
            <button
                class="footer-btn export-btn icon-btn-square"
                :aria-label="t('drawing.export_image')"
                @click="emit('openExportDialog')">
                <IconDownload
                    width="16"
                    height="16" />
            </button>
        </div>
    </footer>
</template>

<style scoped lang="scss">
/* ––– Canvas Footer Container ––– */

.canvas-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: $size-14;
    justify-content: space-between;
    padding: 0 $space-3;
    background: $bg-primary;
    backdrop-filter: blur($backdrop-blur-sm);
    border-top: $border-width-thin $border-color;
    z-index: $z-mid;
}

/* ––– Footer Layout Sections ––– */

// The two outer sections are held at a minimum width so the centre group stays
// centred as the zoom reading and the save status change length.
.footer-left,
.footer-center,
.footer-right {
    gap: $space-1;
}

.footer-left {
    min-width: $size-22;
}

.footer-right {
    min-width: $size-22;
    justify-content: flex-end;
}

/* ––– Zoom Controls ––– */

// Joined rather than `.opt-btns`: these two are a stepper around a reading, not a
// choice between values, so they share one border instead of each having their own.
.zoom-controls {
    gap: 0;
    border: $border-width-thin $border-color;
    border-radius: $border-radius;
    overflow: hidden;
}

// Sits between the two zoom buttons inside their shared border, so it carries the
// dividing rules on both sides.
.zoom-value {
    display: flex;
    align-items: center;
    justify-content: center;
    background: $bg-primary;
    border: none;
    height: $size-12;
    min-width: $size-15;
    padding: 0 $space-2;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $text2;
    border-left: $border-width-thin $border-color;
    border-right: $border-width-thin $border-color;
}

/* ––– Footer Buttons ––– */

.export-btn {
    margin-left: $space-2;
}

/* ––– Save Status Indicator ––– */

.save-status {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.saving {
        color: $text-muted;
        font-style: italic;
    }

    &.unsaved {
        color: $accent-color;
    }
}
</style>
