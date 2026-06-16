<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ToolType } from '../../types/drawing';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
    currentTool: ToolType;
}>();

const emit = defineEmits<{
    selectTool: [tool: ToolType];
}>();

const archDropdownEl = ref<HTMLDivElement | null>(null);
const archDropdownOpen = ref(false);

const archShapeTypes: ToolType[] = [
    'database',
    'server',
    'user',
    'cloud',
    'document',
    'hexagon',
    'parallelogram',
    'star',
];

const archShapes = [
    {
        tool: 'database' as ToolType,
        label: t('drawing.database'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
    },
    {
        tool: 'server' as ToolType,
        label: t('drawing.server'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>',
    },
    {
        tool: 'user' as ToolType,
        label: t('drawing.user'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M3 21c0-4.42 4-8 9-8s9 3.58 9 8"/></svg>',
    },
    {
        tool: 'cloud' as ToolType,
        label: t('drawing.cloud'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    },
    {
        tool: 'document' as ToolType,
        label: t('drawing.document'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    },
    {
        tool: 'hexagon' as ToolType,
        label: t('drawing.hexagon'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>',
    },
    {
        tool: 'parallelogram' as ToolType,
        label: t('drawing.parallelogram'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="6,4 22,4 18,20 2,20"/></svg>',
    },
    {
        tool: 'star' as ToolType,
        label: t('drawing.star'),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
    },
];

const isArchTool = computed(() => archShapeTypes.includes(props.currentTool));

function toggleArchDropdown() {
    archDropdownOpen.value = !archDropdownOpen.value;
}

function selectArchTool(tool: ToolType) {
    emit('selectTool', tool);
    archDropdownOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
    if (archDropdownOpen.value && archDropdownEl.value !== null && !archDropdownEl.value.contains(e.target as Node)) {
        archDropdownOpen.value = false;
    }
}

defineExpose({ handleClickOutside });
</script>

<template>
    <nav
        class="floating-toolbar"
        :aria-label="t('drawing.toolbar')">
        <div
            class="toolbar-inner"
            role="toolbar"
            :aria-label="t('drawing.tool_selection')">
            <!-- Selection -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'select' }"
                :aria-label="t('drawing.selection_tool', { shortcut: 'V' })"
                :aria-pressed="currentTool === 'select'"
                @click="emit('selectTool', 'select')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false">
                    <path
                        d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                        fill="currentColor" />
                </svg>
            </button>

            <!-- Hand -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'hand' }"
                :aria-label="t('drawing.hand_tool', { shortcut: 'H' })"
                :aria-pressed="currentTool === 'hand'"
                @click="emit('selectTool', 'hand')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false">
                    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                    <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                    <path
                        d="M10 9.5V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7 20.64A4 4 0 0 0 9.83 22H15a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1" />
                </svg>
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Rectangle -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'rectangle' }"
                :aria-label="t('drawing.rectangle_tool', { shortcut: 'R' })"
                :aria-pressed="currentTool === 'rectangle'"
                @click="emit('selectTool', 'rectangle')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                    focusable="false">
                    <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2" />
                </svg>
            </button>

            <!-- Diamond -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'diamond' }"
                :aria-label="t('drawing.diamond_tool', { shortcut: 'D' })"
                :aria-pressed="currentTool === 'diamond'"
                @click="emit('selectTool', 'diamond')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                    focusable="false">
                    <polygon points="12,2 22,12 12,22 2,12" />
                </svg>
            </button>

            <!-- Ellipse -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'ellipse' }"
                :aria-label="t('drawing.ellipse_tool', { shortcut: 'O' })"
                :aria-pressed="currentTool === 'ellipse'"
                @click="emit('selectTool', 'ellipse')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                    focusable="false">
                    <circle
                        cx="12"
                        cy="12"
                        r="10" />
                </svg>
            </button>

            <!-- Triangle -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'triangle' }"
                :aria-label="t('drawing.triangle_tool', { shortcut: 'T' })"
                :aria-pressed="currentTool === 'triangle'"
                @click="emit('selectTool', 'triangle')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                    focusable="false">
                    <polygon points="12,3 22,21 2,21" />
                </svg>
            </button>

            <!-- Arrow -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'arrow' }"
                :aria-label="t('drawing.arrow_tool', { shortcut: 'A' })"
                :aria-pressed="currentTool === 'arrow'"
                @click="emit('selectTool', 'arrow')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false">
                    <line
                        x1="5"
                        y1="19"
                        x2="19"
                        y2="5" />
                    <polyline points="10,5 19,5 19,14" />
                </svg>
            </button>

            <!-- Line -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'line' }"
                :aria-label="t('drawing.line_tool', { shortcut: 'L' })"
                :aria-pressed="currentTool === 'line'"
                @click="emit('selectTool', 'line')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    aria-hidden="true"
                    focusable="false">
                    <line
                        x1="5"
                        y1="19"
                        x2="19"
                        y2="5" />
                </svg>
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Freedraw -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'freedraw' }"
                :aria-label="t('drawing.freedraw_tool', { shortcut: 'P' })"
                :aria-pressed="currentTool === 'freedraw'"
                @click="emit('selectTool', 'freedraw')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
            </button>

            <!-- Text -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'text' }"
                :aria-label="t('drawing.text_tool', { shortcut: 'X' })"
                :aria-pressed="currentTool === 'text'"
                @click="emit('selectTool', 'text')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false">
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line
                        x1="9.5"
                        y1="20"
                        x2="14.5"
                        y2="20" />
                    <line
                        x1="12"
                        y1="4"
                        x2="12"
                        y2="20" />
                </svg>
            </button>

            <!-- Eraser -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'eraser' }"
                :aria-label="t('drawing.eraser_tool', { shortcut: 'E' })"
                :aria-pressed="currentTool === 'eraser'"
                @click="emit('selectTool', 'eraser')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false">
                    <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 18" />
                </svg>
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Architecture shapes dropdown -->
            <div
                ref="archDropdownEl"
                class="arch-dropdown">
                <button
                    class="toolbar-btn"
                    :class="{ active: isArchTool }"
                    :aria-label="t('drawing.architecture_shapes')"
                    :aria-pressed="isArchTool"
                    :aria-expanded="archDropdownOpen"
                    aria-haspopup="menu"
                    @click="toggleArchDropdown">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                        focusable="false">
                        <ellipse
                            cx="12"
                            cy="5"
                            rx="9"
                            ry="3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                    </svg>
                </button>
                <transition name="panel-fade">
                    <div
                        v-if="archDropdownOpen"
                        class="arch-dropdown-menu"
                        role="menu"
                        :aria-label="t('drawing.architecture_shape_options')">
                        <button
                            v-for="shape in archShapes"
                            :key="shape.tool"
                            class="arch-shape-btn"
                            :class="{ active: currentTool === shape.tool }"
                            :aria-label="shape.label"
                            :aria-pressed="currentTool === shape.tool"
                            role="menuitem"
                            @click="selectArchTool(shape.tool)">
                            <span
                                class="arch-shape-icon"
                                aria-hidden="true"
                                v-html="shape.icon"></span>
                            <span class="arch-shape-label">{{ shape.label }}</span>
                        </button>
                    </div>
                </transition>
            </div>
        </div>
    </nav>
</template>

<style scoped lang="scss">
/* ––– Floating Toolbar Container ––– */

.floating-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: $z-mid;
}

.toolbar-inner {
    display: flex;
    align-items: center;
    gap: $space-0;
    padding: $space-1;
    background: $bg-primary;
    border: 1px solid $border-color;
    border-radius: $border-radius-xl;
    box-shadow:
        0 1px 5px rgb(0 0 0 / 8%),
        0 4px 16px rgb(0 0 0 / 4%);
}

/* ––– Toolbar Buttons & Controls ––– */

.toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: $border-radius-lg;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition:
        background $transition-fast,
        color $transition-fast;
    flex-shrink: 0;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }

    &.active {
        background: $accent-color-alpha;
        color: $accent-color;
    }
}

.toolbar-sep {
    width: 1px;
    height: 24px;
    background: $border-color;
    margin: 0 $space-0;
    flex-shrink: 0;
}

/* ––– Architecture Dropdown Menu ––– */

.arch-dropdown {
    position: relative;
}

.arch-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-0;
    padding: $space-2;
    background: $bg-primary;
    border: 1px solid $border-color;
    border-radius: $border-radius-xl;
    box-shadow:
        0 4px 20px rgb(0 0 0 / 12%),
        0 1px 6px rgb(0 0 0 / 6%);
    z-index: $z-mid;
    min-width: 200px;
}

.arch-shape-btn {
    display: flex;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-3;
    border: none;
    border-radius: $border-radius;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition:
        background $transition-fast,
        color $transition-fast;
    font-size: $font-size-xs;
    white-space: nowrap;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }

    &.active {
        background: $accent-color-alpha;
        color: $accent-color;
    }
}

.arch-shape-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;

    svg {
        width: 18px;
        height: 18px;
    }
}

.arch-shape-label {
    font-weight: $font-weight-medium;
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
</style>
