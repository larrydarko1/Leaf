<script setup lang="ts">
import { useContextMenu } from '../composables/ui/useContextMenu';

export interface ContextMenuItem {
    label: string;
    action: string;
    shortcut?: string;
    disabled?: boolean;
}

const props = defineProps<{
    visible: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
}>();

const emit = defineEmits<{
    close: [];
    action: [action: string];
}>();

const { menuRef, adjustedPosition } = useContextMenu(
    () => props.visible,
    () => props.position,
    () => emit('close'),
);
void menuRef; // used as template ref via ref="menuRef"

function handleItemClick(item: ContextMenuItem) {
    if (!item.disabled) {
        emit('action', item.action);
        emit('close');
    }
}
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            ref="menuRef"
            class="context-menu"
            :style="{ top: adjustedPosition.y + 'px', left: adjustedPosition.x + 'px' }"
            @click.stop
        >
            <div
                v-for="item in items"
                :key="item.label"
                class="context-menu-item"
                :class="{ disabled: item.disabled }"
                @click="handleItemClick(item)"
            >
                <span class="menu-label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
            </div>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.context-menu {
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0.25rem 0;
    min-width: 160px;
    z-index: 10000;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.context-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease;
    color: var(--text-primary);
    font-size: 0.875rem;
    gap: 1rem;

    &:hover:not(.disabled) {
        background: var(--bg-hover);
    }

    &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
}

.menu-label {
    flex: 1;
}

.menu-shortcut {
    color: var(--text2);
    font-size: 0.75rem;
    opacity: 0.7;
}
</style>
