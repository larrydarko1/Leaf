<script setup lang="ts">
import { useContextMenu } from '@/renderer/composables/ui/useContextMenu';
import { useI18n } from 'vue-i18n';
import type { ContextMenuItem } from '@/schemas/vault';

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

const { t } = useI18n();

const { menuRef, adjustedPosition } = useContextMenu(
    () => props.visible,
    () => props.position,
    () => emit('close'),
);

// used as template ref via ref="menuRef"

function handleItemClick(item: ContextMenuItem): void {
    if (item.disabled !== true) {
        emit('action', item.action);
        emit('close');
    }
}

void menuRef;
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            ref="menuRef"
            class="context-menu floating"
            role="menu"
            :aria-label="t('context_menu.label')"
            :style="{ top: adjustedPosition.y + 'px', left: adjustedPosition.x + 'px' }"
            @click.stop>
            <button
                v-for="item in items"
                :key="item.label"
                class="context-menu-item menu-item"
                role="menuitem"
                :aria-disabled="item.disabled"
                :disabled="item.disabled"
                @click="handleItemClick(item)">
                <span class="menu-label menu-item-label">{{ item.label }}</span>
                <span
                    v-if="item.shortcut"
                    class="menu-shortcut menu-item-meta"
                    :aria-label="t('context_menu.keyboard_shortcut', { shortcut: item.shortcut })"
                    >{{ item.shortcut }}</span
                >
            </button>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
// The surface is `.floating`, the rows are `.menu-item` — this is only where the
// menu opens and how narrow it may be. It sat on $bg-secondary with $shadow-sm
// while the other three floating panels used the shared surface; that difference
// was never a decision.
.context-menu {
    position: fixed;
    padding: $space-1 0;
    min-width: $size-22;
    z-index: $z-extreme;
}

// Wider than a dropdown's: the shortcut on the right has to clear the label, not
// sit against it.
.context-menu-item {
    justify-content: space-between;
    gap: $space-4;
    font-size: $font-size-sm;
}
</style>
