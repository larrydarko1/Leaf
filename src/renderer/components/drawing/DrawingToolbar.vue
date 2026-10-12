<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import IconArrow from '@/renderer/components/icons/IconArrow.vue';
import IconCircle from '@/renderer/components/icons/IconCircle.vue';
import IconCloud from '@/renderer/components/icons/IconCloud.vue';
import IconDatabase from '@/renderer/components/icons/IconDatabase.vue';
import IconEraser from '@/renderer/components/icons/IconEraser.vue';
import IconFileText from '@/renderer/components/icons/IconFileText.vue';
import IconHand from '@/renderer/components/icons/IconHand.vue';
import IconHexagon from '@/renderer/components/icons/IconHexagon.vue';
import IconLine from '@/renderer/components/icons/IconLine.vue';
import IconParallelogram from '@/renderer/components/icons/IconParallelogram.vue';
import IconPencil from '@/renderer/components/icons/IconPencil.vue';
import IconPointer from '@/renderer/components/icons/IconPointer.vue';
import IconRhombus from '@/renderer/components/icons/IconRhombus.vue';
import IconServer from '@/renderer/components/icons/IconServer.vue';
import IconSquare from '@/renderer/components/icons/IconSquare.vue';
import IconStar from '@/renderer/components/icons/IconStar.vue';
import IconTriangle from '@/renderer/components/icons/IconTriangle.vue';
import IconType from '@/renderer/components/icons/IconType.vue';
import IconUser from '@/renderer/components/icons/IconUser.vue';
import type { ToolType } from '@/schemas/drawing';

type Props = {
    currentTool: ToolType;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    selectTool: [tool: ToolType];
}>();

defineExpose({ handleClickOutside });

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

const { t } = useI18n();

const archDropdownEl = ref<HTMLDivElement | null>(null);
const archDropdownOpen = ref(false);

const archShapes = [
    {
        tool: 'database' as ToolType,
        label: t('drawing.database'),
        icon: IconDatabase,
    },
    {
        tool: 'server' as ToolType,
        label: t('drawing.server'),
        icon: IconServer,
    },
    {
        tool: 'user' as ToolType,
        label: t('drawing.user'),
        icon: IconUser,
    },
    {
        tool: 'cloud' as ToolType,
        label: t('drawing.cloud'),
        icon: IconCloud,
    },
    {
        tool: 'document' as ToolType,
        label: t('drawing.document'),
        icon: IconFileText,
    },
    {
        tool: 'hexagon' as ToolType,
        label: t('drawing.hexagon'),
        icon: IconHexagon,
    },
    {
        tool: 'parallelogram' as ToolType,
        label: t('drawing.parallelogram'),
        icon: IconParallelogram,
    },
    {
        tool: 'star' as ToolType,
        label: t('drawing.star'),
        icon: IconStar,
    },
];

const isArchTool = computed(() => archShapeTypes.includes(props.currentTool));

function toggleArchDropdown(): void {
    archDropdownOpen.value = !archDropdownOpen.value;
}

function selectArchTool(tool: ToolType): void {
    emit('selectTool', tool);
    archDropdownOpen.value = false;
}

function handleClickOutside(e: MouseEvent): void {
    const inside = e.target instanceof Node && archDropdownEl.value?.contains(e.target) === true;
    if (!inside) archDropdownOpen.value = false;
}
</script>

<template>
    <nav
        class="floating-toolbar"
        :aria-label="t('drawing.toolbar')">
        <div
            class="toolbar-inner floating"
            role="toolbar"
            :aria-label="t('drawing.tool_selection')">
            <!-- Selection -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'select' }"
                :aria-label="t('drawing.selection_tool', { shortcut: 'V' })"
                :aria-pressed="currentTool === 'select'"
                @click="emit('selectTool', 'select')">
                <IconPointer
                    width="20"
                    height="20" />
            </button>

            <!-- Hand -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'hand' }"
                :aria-label="t('drawing.hand_tool', { shortcut: 'H' })"
                :aria-pressed="currentTool === 'hand'"
                @click="emit('selectTool', 'hand')">
                <IconHand
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Rectangle -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'rectangle' }"
                :aria-label="t('drawing.rectangle_tool', { shortcut: 'R' })"
                :aria-pressed="currentTool === 'rectangle'"
                @click="emit('selectTool', 'rectangle')">
                <IconSquare
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Diamond -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'diamond' }"
                :aria-label="t('drawing.diamond_tool', { shortcut: 'D' })"
                :aria-pressed="currentTool === 'diamond'"
                @click="emit('selectTool', 'diamond')">
                <IconRhombus
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Ellipse -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'ellipse' }"
                :aria-label="t('drawing.ellipse_tool', { shortcut: 'O' })"
                :aria-pressed="currentTool === 'ellipse'"
                @click="emit('selectTool', 'ellipse')">
                <IconCircle
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Triangle -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'triangle' }"
                :aria-label="t('drawing.triangle_tool', { shortcut: 'T' })"
                :aria-pressed="currentTool === 'triangle'"
                @click="emit('selectTool', 'triangle')">
                <IconTriangle
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Arrow -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'arrow' }"
                :aria-label="t('drawing.arrow_tool', { shortcut: 'A' })"
                :aria-pressed="currentTool === 'arrow'"
                @click="emit('selectTool', 'arrow')">
                <IconArrow
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Line -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'line' }"
                :aria-label="t('drawing.line_tool', { shortcut: 'L' })"
                :aria-pressed="currentTool === 'line'"
                @click="emit('selectTool', 'line')">
                <IconLine
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Freedraw -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'freedraw' }"
                :aria-label="t('drawing.freedraw_tool', { shortcut: 'P' })"
                :aria-pressed="currentTool === 'freedraw'"
                @click="emit('selectTool', 'freedraw')">
                <IconPencil
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Text -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'text' }"
                :aria-label="t('drawing.text_tool', { shortcut: 'X' })"
                :aria-pressed="currentTool === 'text'"
                @click="emit('selectTool', 'text')">
                <IconType
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <!-- Eraser -->
            <button
                class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                :class="{ active: currentTool === 'eraser' }"
                :aria-label="t('drawing.eraser_tool', { shortcut: 'E' })"
                :aria-pressed="currentTool === 'eraser'"
                @click="emit('selectTool', 'eraser')">
                <IconEraser
                    width="20"
                    height="20"
                    stroke-width="1.5" />
            </button>

            <span
                class="toolbar-sep"
                aria-hidden="true"></span>

            <!-- Architecture shapes dropdown -->
            <div
                ref="archDropdownEl"
                class="arch-dropdown">
                <button
                    class="toolbar-btn icon-btn-square icon-btn-square-lg icon-btn-toggle"
                    :class="{ active: isArchTool }"
                    :aria-label="t('drawing.architecture_shapes')"
                    :aria-pressed="isArchTool"
                    :aria-expanded="archDropdownOpen"
                    aria-haspopup="menu"
                    @click="toggleArchDropdown">
                    <IconDatabase
                        width="20"
                        height="20"
                        stroke-width="1.5" />
                </button>
                <transition name="panel-fade">
                    <div
                        v-if="archDropdownOpen"
                        class="arch-dropdown-menu floating"
                        role="menu"
                        :aria-label="t('drawing.architecture_shape_options')">
                        <button
                            v-for="shape in archShapes"
                            :key="shape.tool"
                            class="arch-shape-btn menu-item"
                            :class="{ active: currentTool === shape.tool }"
                            :aria-label="shape.label"
                            :aria-pressed="currentTool === shape.tool"
                            role="menuitem"
                            @click="selectArchTool(shape.tool)">
                            <span
                                class="arch-shape-icon"
                                aria-hidden="true">
                                <component
                                    :is="shape.icon"
                                    width="20"
                                    height="20"
                                    stroke-width="1.5" />
                            </span>
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
    top: $space-3;
    left: 50%;
    transform: translateX(-50%);
    z-index: $z-mid;
}

// The surface is `.floating`; what is left is where the toolbar floats.
.toolbar-inner {
    display: flex;
    align-items: center;
    gap: $space-0;
    padding: $space-1;
}

/* ––– Architecture Dropdown Menu ––– */

.arch-dropdown {
    position: relative;
}

// Two columns rather than `.menu`'s single one: these are short labels beside a
// glyph, and a one-column list of them would be twice as tall as the toolbar.
.arch-dropdown-menu {
    position: absolute;
    top: calc(100% + $space-2);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-0;
    padding: $space-2;
    z-index: $z-mid;
    min-width: $size-24;
}

.arch-shape-btn {
    white-space: nowrap;

    // The toolbar names this state `.active` and tints it the way `.icon-btn-toggle` does rather
    // than the way a dropdown row does: this menu chooses a tool, so it matches the buttons beside it.
    &.active {
        background: $accent-color-alpha;
        color: $accent-color;
    }
}

.arch-shape-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: $size-10;
    height: $size-10;
    flex-shrink: 0;

    svg {
        width: $size-9;
        height: $size-9;
    }
}

.arch-shape-label {
    font-weight: $font-weight-medium;
}
</style>
