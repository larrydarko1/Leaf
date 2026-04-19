<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ToolType } from '../../types/drawing';

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

const isArchTool = computed(() => archShapeTypes.includes(props.currentTool));

const archShapes = [
    {
        tool: 'database' as ToolType,
        label: 'Database',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
    },
    {
        tool: 'server' as ToolType,
        label: 'Server',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>',
    },
    {
        tool: 'user' as ToolType,
        label: 'User',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M3 21c0-4.42 4-8 9-8s9 3.58 9 8"/></svg>',
    },
    {
        tool: 'cloud' as ToolType,
        label: 'Cloud',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    },
    {
        tool: 'document' as ToolType,
        label: 'Document',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    },
    {
        tool: 'hexagon' as ToolType,
        label: 'Hexagon',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>',
    },
    {
        tool: 'parallelogram' as ToolType,
        label: 'Parallelogram',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="6,4 22,4 18,20 2,20"/></svg>',
    },
    {
        tool: 'star' as ToolType,
        label: 'Star',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
    },
];

function toggleArchDropdown() {
    archDropdownOpen.value = !archDropdownOpen.value;
}

function selectArchTool(tool: ToolType) {
    emit('selectTool', tool);
    archDropdownOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
    if (archDropdownOpen.value && archDropdownEl.value && !archDropdownEl.value.contains(e.target as Node)) {
        archDropdownOpen.value = false;
    }
}

defineExpose({ handleClickOutside });
</script>

<template>
    <div class="floating-toolbar">
        <div class="toolbar-inner">
            <!-- Selection -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'select' }"
                title="Selection — V"
                @click="emit('selectTool', 'select')"
            >
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                        d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                        fill="currentColor"
                    />
                </svg>
            </button>

            <!-- Hand -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'hand' }"
                title="Hand (Pan) — H"
                @click="emit('selectTool', 'hand')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                    <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                    <path
                        d="M10 9.5V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7 20.64A4 4 0 0 0 9.83 22H15a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"
                    />
                </svg>
            </button>

            <span class="toolbar-sep"></span>

            <!-- Rectangle -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'rectangle' }"
                title="Rectangle — R"
                @click="emit('selectTool', 'rectangle')"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
            </button>

            <!-- Diamond -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'diamond' }"
                title="Diamond — D"
                @click="emit('selectTool', 'diamond')"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="12,2 22,12 12,22 2,12" />
                </svg>
            </button>

            <!-- Ellipse -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'ellipse' }"
                title="Ellipse — O"
                @click="emit('selectTool', 'ellipse')"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                </svg>
            </button>

            <!-- Triangle -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'triangle' }"
                title="Triangle — T"
                @click="emit('selectTool', 'triangle')"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="12,3 22,21 2,21" />
                </svg>
            </button>

            <!-- Arrow -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'arrow' }"
                title="Arrow — A"
                @click="emit('selectTool', 'arrow')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="5" y1="19" x2="19" y2="5" />
                    <polyline points="10,5 19,5 19,14" />
                </svg>
            </button>

            <!-- Line -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'line' }"
                title="Line — L"
                @click="emit('selectTool', 'line')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                >
                    <line x1="5" y1="19" x2="19" y2="5" />
                </svg>
            </button>

            <span class="toolbar-sep"></span>

            <!-- Freedraw -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'freedraw' }"
                title="Pen — P"
                @click="emit('selectTool', 'freedraw')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
            </button>

            <!-- Text -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'text' }"
                title="Text — X"
                @click="emit('selectTool', 'text')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9.5" y1="20" x2="14.5" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
            </button>

            <!-- Eraser -->
            <button
                class="toolbar-btn"
                :class="{ active: currentTool === 'eraser' }"
                title="Eraser — E"
                @click="emit('selectTool', 'eraser')"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 18" />
                </svg>
            </button>

            <span class="toolbar-sep"></span>

            <!-- Architecture shapes dropdown -->
            <div ref="archDropdownEl" class="arch-dropdown">
                <button
                    class="toolbar-btn"
                    :class="{ active: isArchTool }"
                    title="Architecture Shapes"
                    @click="toggleArchDropdown"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                    </svg>
                </button>
                <transition name="panel-fade">
                    <div v-if="archDropdownOpen" class="arch-dropdown-menu">
                        <button
                            v-for="shape in archShapes"
                            :key="shape.tool"
                            class="arch-shape-btn"
                            :class="{ active: currentTool === shape.tool }"
                            :title="shape.label"
                            @click="selectArchTool(shape.tool)"
                        >
                            <span class="arch-shape-icon" v-html="shape.icon"></span>
                            <span class="arch-shape-label">{{ shape.label }}</span>
                        </button>
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
// ─── Floating Toolbar ────────────────────────────────────────────────────────

.floating-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
}

.toolbar-inner {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 1px 5px rgba(0, 0, 0, 0.08),
        0 4px 16px rgba(0, 0, 0, 0.04);
}

.toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;
    flex-shrink: 0;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        color: var(--accent-color, #3eb489);
    }
}

.toolbar-sep {
    width: 1px;
    height: 24px;
    background: var(--border-color, #e0e0e0);
    margin: 0 2px;
    flex-shrink: 0;
}

// ─── Architecture Dropdown ───────────────────────────────────────────────────

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
    gap: 2px;
    padding: 6px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.12),
        0 1px 6px rgba(0, 0, 0, 0.06);
    z-index: 25;
    min-width: 200px;
}

.arch-shape-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;
    font-size: 12px;
    white-space: nowrap;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        color: var(--accent-color, #3eb489);
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
    font-weight: 500;
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
</style>
