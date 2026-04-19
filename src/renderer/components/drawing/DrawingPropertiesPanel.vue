<script setup lang="ts">
import type { StrokeStyle } from '../../types/drawing';

defineProps<{
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
}>();

type StyleKey = 'strokeColor' | 'fillColor' | 'strokeWidth' | 'strokeStyle' | 'borderRadius' | 'fontSize';

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
    { value: 'solid' as StrokeStyle, label: 'Solid', dash: '' },
    { value: 'dashed' as StrokeStyle, label: 'Dashed', dash: '8,5' },
    { value: 'dotted' as StrokeStyle, label: 'Dotted', dash: '2,4' },
];

const fontSizeOptions = [
    { label: 'S', value: 16 },
    { label: 'M', value: 20 },
    { label: 'L', value: 28 },
    { label: 'XL', value: 36 },
];

const borderRadiusOptions = [
    { label: 'Sharp', value: 0, icon: 'sharp' },
    { label: 'Round', value: 8, icon: 'round' },
    { label: 'Extra round', value: 16, icon: 'extra' },
];
</script>

<template>
    <transition name="panel-fade">
        <div v-if="visible" class="properties-panel" @mousedown.prevent>
            <!-- Stroke Color -->
            <div class="prop-section">
                <div class="prop-label">Stroke</div>
                <div class="color-grid">
                    <button
                        v-for="c in strokeColorPalette"
                        :key="'s-' + c"
                        class="color-swatch"
                        :class="{ active: activeStrokeColor === c }"
                        :style="{ background: c }"
                        @click="emit('setProperty', 'strokeColor', c)"
                    />
                </div>
            </div>

            <!-- Fill Color -->
            <div v-if="showFillOption" class="prop-section">
                <div class="prop-label">Background</div>
                <div class="color-grid">
                    <button
                        class="color-swatch transparent-swatch"
                        :class="{ active: activeFillColor === 'transparent' }"
                        @click="emit('setProperty', 'fillColor', 'transparent')"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <line x1="0" y1="16" x2="16" y2="0" stroke="currentColor" stroke-width="1.5" />
                        </svg>
                    </button>
                    <button
                        v-for="c in fillColorPalette"
                        :key="'f-' + c"
                        class="color-swatch"
                        :class="{ active: activeFillColor === c }"
                        :style="{ background: c }"
                        @click="emit('setProperty', 'fillColor', c)"
                    />
                </div>
            </div>

            <!-- Stroke Width -->
            <div class="prop-section">
                <div class="prop-label">Stroke width</div>
                <div class="stroke-width-row">
                    <button
                        v-for="w in strokeWidthOptions"
                        :key="w"
                        class="stroke-width-btn"
                        :class="{ active: activeStrokeWidth === w }"
                        @click="emit('setProperty', 'strokeWidth', w)"
                    >
                        <span class="stroke-preview" :style="{ height: w + 'px' }"></span>
                    </button>
                </div>
            </div>

            <!-- Stroke Style -->
            <div class="prop-section">
                <div class="prop-label">Stroke style</div>
                <div class="stroke-style-row">
                    <button
                        v-for="s in strokeStyleOptions"
                        :key="s.value"
                        class="stroke-style-btn"
                        :class="{ active: activeStrokeStyle === s.value }"
                        :title="s.label"
                        @click="emit('setProperty', 'strokeStyle', s.value)"
                    >
                        <svg width="40" height="6" viewBox="0 0 40 6">
                            <line
                                x1="0"
                                y1="3"
                                x2="40"
                                y2="3"
                                stroke="currentColor"
                                stroke-width="2"
                                :stroke-dasharray="s.dash"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Roundness -->
            <div v-if="showRoundnessOption" class="prop-section">
                <div class="prop-label">Roundness</div>
                <div class="roundness-row">
                    <button
                        v-for="r in borderRadiusOptions"
                        :key="r.value"
                        class="roundness-btn"
                        :class="{ active: activeBorderRadius === r.value }"
                        :title="r.label"
                        @click="emit('setProperty', 'borderRadius', r.value)"
                    >
                        <svg
                            v-if="r.icon === 'sharp'"
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <rect x="2" y="2" width="16" height="16" />
                        </svg>
                        <svg
                            v-else-if="r.icon === 'round'"
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <rect x="2" y="2" width="16" height="16" rx="4" />
                        </svg>
                        <svg
                            v-else
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <rect x="2" y="2" width="16" height="16" rx="8" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Font Size -->
            <div v-if="showFontSizeOption" class="prop-section">
                <div class="prop-label">
                    Font size <span class="font-size-value">{{ activeFontSize }}px</span>
                </div>
                <div class="font-size-row">
                    <button
                        v-for="fs in fontSizeOptions"
                        :key="fs.value"
                        class="font-size-btn"
                        :class="{ active: activeFontSize === fs.value }"
                        @click="emit('setProperty', 'fontSize', fs.value)"
                    >
                        {{ fs.label }}
                    </button>
                </div>
            </div>

            <!-- Actions -->
            <div v-if="hasSelection" class="prop-section">
                <div class="prop-actions">
                    <button class="action-btn" title="Copy (⌘C)" @click="emit('copy')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                    </button>
                    <button class="action-btn" title="Duplicate (⌘D)" @click="emit('duplicate')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <rect x="3" y="3" width="13" height="13" rx="2" />
                            <rect x="8" y="8" width="13" height="13" rx="2" />
                        </svg>
                        Duplicate
                    </button>
                    <button class="action-btn action-btn--delete" title="Delete (⌫)" @click="emit('delete')">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped lang="scss">
// ─── Properties Panel ────────────────────────────────────────────────────────

.properties-panel {
    position: absolute;
    top: 64px;
    left: 12px;
    width: 192px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 1px 5px rgba(0, 0, 0, 0.08),
        0 4px 16px rgba(0, 0, 0, 0.04);
    padding: 12px;
    z-index: 15;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
    opacity: 0;
    transform: translateX(-8px);
}

.prop-section {
    margin-bottom: 12px;

    &:last-child {
        margin-bottom: 0;
    }
}

.prop-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text1, #1d1d1f);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s;
    text-align: left;

    &:hover {
        background: var(--hover-bg, rgba(128, 128, 128, 0.12));
    }

    &.action-btn--delete {
        color: #e05555;

        &:hover {
            background: rgba(224, 85, 85, 0.1);
        }
    }
}

.prop-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #8e8e93);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
}

.color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.color-swatch {
    width: 22px;
    height: 22px;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition:
        border-color 0.12s,
        transform 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;

    &:hover {
        transform: scale(1.15);
    }

    &.active {
        border-color: var(--accent-color, #3eb489);
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
        color: var(--text2, #888);

        svg {
            filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));
        }
    }
}

.stroke-width-row {
    display: flex;
    gap: 4px;
}

.stroke-width-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }

    .stroke-preview {
        width: 60%;
        background: var(--text1, #1d1d1f);
        border-radius: 4px;
        min-height: 1px;
    }
}

.stroke-style-row {
    display: flex;
    gap: 4px;
}

.stroke-style-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.roundness-row {
    display: flex;
    gap: 4px;
}

.roundness-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.font-size-row {
    display: flex;
    gap: 4px;
}

.font-size-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    font-size: 12px;
    font-weight: 500;
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.font-size-value {
    font-weight: 400;
    opacity: 0.6;
    margin-left: 4px;
}
</style>
