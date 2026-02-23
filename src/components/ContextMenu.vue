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

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';

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

const menuRef = ref<HTMLElement | null>(null);
const adjustedPosition = ref({ x: 0, y: 0 });

function handleItemClick(item: ContextMenuItem) {
  if (!item.disabled) {
    emit('action', item.action);
    emit('close');
  }
}

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close');
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    // Start at the raw click position, then adjust after render
    adjustedPosition.value = { x: props.position.x, y: props.position.y };
    nextTick(() => {
      if (menuRef.value) {
        const rect = menuRef.value.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        let { x, y } = props.position;

        // If menu overflows bottom, shift it up
        if (y + rect.height > viewportHeight) {
          y = Math.max(0, viewportHeight - rect.height - 4);
        }
        // If menu overflows right, shift it left
        if (x + rect.width > viewportWidth) {
          x = Math.max(0, viewportWidth - rect.width - 4);
        }
        adjustedPosition.value = { x, y };
      }
    });
    // Add listeners when menu opens
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
  } else {
    // Remove listeners when menu closes
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('contextmenu', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
});
</script>

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
