<script setup lang="ts">
import type { StrokeStyle } from '@/types/drawing';
import { useI18n } from 'vue-i18n';

type StyleKey = 'strokeColor' | 'fillColor' | 'strokeWidth' | 'strokeStyle' | 'borderRadius' | 'fontSize';

type Props = {
    visible: boolean;
    activeStrokeColor: string;
    activeFillColor: string;
    activeStrokeWidth: number;
    activeStrokeStyle: string;
    activeBorderRadius: number;
    activeFontSize: number;
    showFillOption: boolean;
    showFontSizeOption: boolean;
    showRoundnessOption: boolean;
    hasSelection: boolean;
};

const props = defineProps<Props>();
void props;

const { t } = useI18n();

const emit = defineEmits<{
    setProperty: [prop: StyleKey, value: string | number];
    copy: [];
    duplicate: [];
    delete: [];
}>();

const strokeColorPalette = [
    '#1e1e1e',
    '#343a40',
    '#e03131',
    '#c2255c',
    '#6741d9',
    '#1971c2',
    '#0c8599',
    '#2f9e44',
    '#66a80f',
    '#f08c00',
    '#e8590c',
    '#ffffff',
];

const fillColorPalette = [
    '#ffc9c9',
    '#fcc2d7',
    '#eebefa',
    '#d0bfff',
    '#bac8ff',
    '#a5d8ff',
    '#99e9f2',
    '#b2f2bb',
    '#d8f5a2',
    '#ffec99',
    '#ffd8a8',
    '#e9ecef',
];

const strokeWidthOptions = [1, 2, 4];

const strokeStyleOptions = [
    { value: 'solid' as StrokeStyle, label: t('drawing.solid'), dash: '' },
    { value: 'dashed' as StrokeStyle, label: t('drawing.dashed'), dash: '8,5' },
    { value: 'dotted' as StrokeStyle, label: t('drawing.dotted'), dash: '2,4' },
];

const fontSizeOptions = [
    { label: t('drawing.font_size_options.s'), value: 16 },
    { label: t('drawing.font_size_options.m'), value: 20 },
    { label: t('drawing.font_size_options.l'), value: 28 },
    { label: t('drawing.font_size_options.xl'), value: 36 },
];

const borderRadiusOptions = [
    { label: t('drawing.border_radius_options.sharp'), value: 0, icon: 'sharp' },
    { label: t('drawing.border_radius_options.round'), value: 8, icon: 'round' },
    { label: t('drawing.border_radius_options.extra_round'), value: 16, icon: 'extra' },
];
</script>

<template>
    <transition name="panel-fade">
        <aside
            v-if="visible"
            class="properties-panel"
            :aria-label="t('drawing.properties_panel')"
            @mousedown.prevent>
            <!-- Stroke Color -->
            <section class="prop-section">
                <h3 class="prop-label">{{ t('drawing.stroke') }}</h3>
                <div
                    class="color-grid"
                    role="group"
                    :aria-label="t('drawing.stroke_color_options')">
                    <button
                        v-for="c in strokeColorPalette"
                        :key="'s-' + c"
                        class="color-swatch"
                        :class="{ active: activeStrokeColor === c }"
                        :style="{ background: c }"
                        :aria-label="`p${t('drawing.stroke_color_options')} ${c}`"
                        :aria-pressed="activeStrokeColor === c"
                        @click="emit('setProperty', 'strokeColor', c)" />
                </div>
            </section>

            <!-- Fill Color -->
            <section
                v-if="showFillOption"
                class="prop-section">
                <h3 class="prop-label">{{ t('drawing.fill') }}</h3>
                <div
                    class="color-grid"
                    role="group"
                    :aria-label="t('drawing.fill_color_options')">
                    <button
                        class="color-swatch transparent-swatch"
                        :class="{ active: activeFillColor === 'transparent' }"
                        :aria-label="t('drawing.transparent_background')"
                        :aria-pressed="activeFillColor === 'transparent'"
                        @click="emit('setProperty', 'fillColor', 'transparent')">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            focusable="false">
                            <line
                                x1="0"
                                y1="16"
                                x2="16"
                                y2="0"
                                stroke="currentColor"
                                stroke-width="1.5" />
                        </svg>
                    </button>
                    <button
                        v-for="c in fillColorPalette"
                        :key="'f-' + c"
                        class="color-swatch"
                        :class="{ active: activeFillColor === c }"
                        :style="{ background: c }"
                        :aria-label="`${t('drawing.fill_color_options')} ${c}`"
                        :aria-pressed="activeFillColor === c"
                        @click="emit('setProperty', 'fillColor', c)" />
                </div>
            </section>

            <!-- Stroke Width -->
            <section class="prop-section">
                <h3 class="prop-label">{{ t('drawing.stroke_width') }}</h3>
                <div
                    class="stroke-width-row"
                    role="group"
                    :aria-label="t('drawing.stroke_width_options')">
                    <button
                        v-for="w in strokeWidthOptions"
                        :key="w"
                        class="stroke-width-btn"
                        :class="{ active: activeStrokeWidth === w }"
                        :aria-label="`${t('drawing.stroke_width_options')} ${w}px`"
                        :aria-pressed="activeStrokeWidth === w"
                        @click="emit('setProperty', 'strokeWidth', w)">
                        <span
                            class="stroke-preview"
                            :style="{ height: w + 'px' }"
                            aria-hidden="true"></span>
                    </button>
                </div>
            </section>

            <!-- Stroke Style -->
            <section class="prop-section">
                <h3 class="prop-label">{{ t('drawing.stroke_style') }}</h3>
                <div
                    class="stroke-style-row"
                    role="group"
                    :aria-label="t('drawing.stroke_style_options')">
                    <button
                        v-for="s in strokeStyleOptions"
                        :key="s.value"
                        class="stroke-style-btn"
                        :class="{ active: activeStrokeStyle === s.value }"
                        :aria-label="s.label"
                        :aria-pressed="activeStrokeStyle === s.value"
                        @click="emit('setProperty', 'strokeStyle', s.value)">
                        <svg
                            width="40"
                            height="6"
                            viewBox="0 0 40 6"
                            aria-hidden="true"
                            focusable="false">
                            <line
                                x1="0"
                                y1="3"
                                x2="40"
                                y2="3"
                                stroke="currentColor"
                                stroke-width="2"
                                :stroke-dasharray="s.dash" />
                        </svg>
                    </button>
                </div>
            </section>

            <!-- Roundness -->
            <section
                v-if="showRoundnessOption"
                class="prop-section">
                <h3 class="prop-label">{{ t('drawing.roundness') }}</h3>
                <div
                    class="roundness-row"
                    role="group"
                    :aria-label="t('drawing.roundness_options')">
                    <button
                        v-for="r in borderRadiusOptions"
                        :key="r.value"
                        class="roundness-btn"
                        :class="{ active: activeBorderRadius === r.value }"
                        :aria-label="r.label"
                        :aria-pressed="activeBorderRadius === r.value"
                        @click="emit('setProperty', 'borderRadius', r.value)">
                        <svg
                            v-if="r.icon === 'sharp'"
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                            focusable="false">
                            <rect
                                x="2"
                                y="2"
                                width="16"
                                height="16" />
                        </svg>
                        <svg
                            v-else-if="r.icon === 'round'"
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                            focusable="false">
                            <rect
                                x="2"
                                y="2"
                                width="16"
                                height="16"
                                rx="4" />
                        </svg>
                        <svg
                            v-else
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                            focusable="false">
                            <rect
                                x="2"
                                y="2"
                                width="16"
                                height="16"
                                rx="8" />
                        </svg>
                    </button>
                </div>
            </section>

            <!-- Font Size -->
            <section
                v-if="showFontSizeOption"
                class="prop-section">
                <h3 class="prop-label">
                    {{ t('drawing.font_size') }}
                    <span
                        class="font-size-value"
                        aria-live="polite"
                        >{{ activeFontSize }}px</span
                    >
                </h3>
                <div
                    class="font-size-row"
                    role="group"
                    :aria-label="t('drawing.font_size_options')">
                    <button
                        v-for="fs in fontSizeOptions"
                        :key="fs.value"
                        class="font-size-btn"
                        :class="{ active: activeFontSize === fs.value }"
                        :aria-label="`${t('drawing.font_size_options')} ${fs.label}`"
                        :aria-pressed="activeFontSize === fs.value"
                        @click="emit('setProperty', 'fontSize', fs.value)">
                        {{ fs.label }}
                    </button>
                </div>
            </section>

            <!-- Actions -->
            <section
                v-if="hasSelection"
                class="prop-section">
                <div
                    class="prop-actions"
                    role="group"
                    :aria-label="t('drawing.element_actions')">
                    <button
                        class="action-btn"
                        :aria-label="t('drawing.copy')"
                        @click="emit('copy')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            focusable="false">
                            <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {{ t('drawing.copy') }}
                    </button>
                    <button
                        class="action-btn"
                        :aria-label="t('drawing.duplicate')"
                        @click="emit('duplicate')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            focusable="false">
                            <rect
                                x="3"
                                y="3"
                                width="13"
                                height="13"
                                rx="2" />
                            <rect
                                x="8"
                                y="8"
                                width="13"
                                height="13"
                                rx="2" />
                        </svg>
                        {{ t('drawing.duplicate') }}
                    </button>
                    <button
                        class="action-btn action-btn-delete"
                        :aria-label="t('drawing.delete')"
                        @click="emit('delete')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            focusable="false">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        {{ t('drawing.delete') }}
                    </button>
                </div>
            </section>
        </aside>
    </transition>
</template>

<style scoped lang="scss">
/* ––– Properties Panel Container ––– */

.properties-panel {
    position: absolute;
    top: 64px;
    left: 12px;
    width: 192px;
    background: $bg-primary;
    border: 1px solid $border-color;
    border-radius: $border-radius-xl;
    box-shadow:
        0 1px 5px rgb(0 0 0 / 8%),
        0 4px 16px rgb(0 0 0 / 4%);
    padding: $space-3;
    z-index: $z-mid;
}

/* ––– Panel Transition Animation ––– */

.panel-fade-enter-active,
.panel-fade-leave-active {
    transition:
        opacity $transition-base,
        transform $transition-base;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
    opacity: 0;
    transform: translateX(-8px);
}

/* ––– Section Layout & Labels ––– */

.prop-section {
    margin-bottom: $space-3;

    &:last-child {
        margin-bottom: 0;
    }
}

.prop-label {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: $space-2;
}

/* ––– Action Buttons ––– */

.prop-actions {
    display: flex;
    flex-direction: column;
    gap: $space-1;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    padding: $space-2 $space-3;
    border-radius: $border-radius;
    border: none;
    background: transparent;
    color: $text1;
    font-size: $font-size-xs;
    cursor: pointer;
    transition: background $transition-fast;
    text-align: left;

    &:hover {
        background: $bg-hover;
    }

    &.action-btn-delete {
        color: $danger-color;

        &:hover {
            background: $danger-color-alpha;
        }
    }
}

/* ––– Color Selection ––– */

.color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
}

.color-swatch {
    width: 22px;
    height: 22px;
    border: 2px solid transparent;
    border-radius: $border-radius-sm;
    cursor: pointer;
    transition:
        border-color $transition-fast,
        transform $transition-fast;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;

    &:hover {
        transform: scale(1.15);
    }

    &.active {
        border-color: $accent-color;
        transform: scale(1.15);
    }

    &.transparent-swatch {
        background:
            linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%);
        background-size: 8px 8px;
        background-position:
            0 0,
            0 4px,
            4px -4px,
            -4px 0;
        color: $text2;

        svg {
            filter: drop-shadow(0 0 1px rgb(0 0 0 / 30%));
        }
    }
}

/* ––– Stroke Width Controls ––– */

.stroke-width-row {
    display: flex;
    gap: $space-1;
}

.stroke-width-btn {
    flex: 1;
    height: 32px;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
        background $transition-fast,
        border-color $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: $accent-color;
    }

    .stroke-preview {
        width: 60%;
        background: $text1;
        border-radius: $border-radius-sm;
        min-height: 1px;
    }
}

/* ––– Stroke Style Controls ––– */

.stroke-style-row {
    display: flex;
    gap: $space-1;
}

.stroke-style-btn {
    flex: 1;
    height: 32px;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text1;
    transition:
        background $transition-fast,
        border-color $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: $accent-color;
    }
}

/* ––– Roundness Controls ––– */

.roundness-row {
    display: flex;
    gap: $space-1;
}

.roundness-btn {
    flex: 1;
    height: 32px;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text1;
    transition:
        background $transition-fast,
        border-color $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: $accent-color;
    }
}

/* ––– Font Size Controls ––– */

.font-size-row {
    display: flex;
    gap: $space-1;
}

.font-size-btn {
    flex: 1;
    height: 32px;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text1;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    transition:
        background $transition-fast,
        border-color $transition-fast;

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color-alpha;
        border-color: $accent-color;
    }
}

.font-size-value {
    font-weight: $font-weight-normal;
    opacity: 0.6;
    margin-left: $space-1;
}
</style>
