<script setup lang="ts">
import { useContextMenu } from '../../composables/ui/useContextMenu';
import { useI18n } from 'vue-i18n';

export type ContextMenuItem = {
    label: string;
    action: string;
    shortcut?: string;
    disabled?: boolean;
};

const { t } = useI18n();

type Props = {
    visible: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
};

const props = defineProps<Props>();

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
    if (item.disabled !== true) {
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
            role="menu"
            :aria-label="t('context_menu.label')"
            :style="{ top: adjustedPosition.y + 'px', left: adjustedPosition.x + 'px' }"
            @click.stop>
            <button
                v-for="item in items"
                :key="item.label"
                class="context-menu-item"
                role="menuitem"
                :aria-disabled="item.disabled"
                :disabled="item.disabled"
                @click="handleItemClick(item)">
                <span class="menu-label">{{ item.label }}</span>
                <span
                    v-if="item.shortcut"
                    class="menu-shortcut"
                    :aria-label="t('context_menu.keyboard_shortcut', { shortcut: item.shortcut })"
                    >{{ item.shortcut }}</span
                >
            </button>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.context-menu {
    position: fixed;
    background: $bg-secondary;
    border: 1px solid $border-color;
    color: $text-primary;
    border-radius: $border-radius;
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    padding: $space-1 0;
    min-width: 160px;
    z-index: $z-extreme;
    backdrop-filter: blur(20px);
}

.context-menu-item {
    display: flex;
    align-items: center;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    justify-content: space-between;
    padding: $space-2 $space-3;
    cursor: pointer;
    transition: background $transition-fast;
    color: $text-primary;
    font-size: $font-size-sm;
    gap: $space-4;

    &:hover:not(.disabled) {
        background: $bg-hover;
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
    color: $text2;
    font-size: $font-size-xs;
    opacity: 0.7;
}
</style>
