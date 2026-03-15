import { ref, watch, nextTick, onUnmounted } from 'vue';

export function useContextMenu(
    getVisible: () => boolean,
    getPosition: () => { x: number; y: number },
    onClose: () => void,
) {
    const menuRef = ref<HTMLElement | null>(null);
    const adjustedPosition = ref({ x: 0, y: 0 });

    function handleClickOutside(event: MouseEvent) {
        if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
            onClose();
        }
    }

    function handleEscape(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onClose();
        }
    }

    function removeListeners() {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('contextmenu', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
    }

    watch(getVisible, (visible) => {
        if (visible) {
            adjustedPosition.value = { ...getPosition() };
            nextTick(() => {
                if (menuRef.value) {
                    const rect = menuRef.value.getBoundingClientRect();
                    let { x, y } = getPosition();
                    if (y + rect.height > window.innerHeight) {
                        y = Math.max(0, window.innerHeight - rect.height - 4);
                    }
                    if (x + rect.width > window.innerWidth) {
                        x = Math.max(0, window.innerWidth - rect.width - 4);
                    }
                    adjustedPosition.value = { x, y };
                }
            });
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
                document.addEventListener('contextmenu', handleClickOutside);
                document.addEventListener('keydown', handleEscape);
            }, 0);
        } else {
            removeListeners();
        }
    });

    onUnmounted(removeListeners);

    return { menuRef, adjustedPosition };
}
