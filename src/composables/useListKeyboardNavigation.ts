import { ref, onMounted, onUnmounted } from 'vue';

export function useListKeyboardNavigation<T>(
    getList: () => T[],
    callbacks: {
        onSelect: (item: T, index: number) => void;
        onOpen: (item: T, index: number) => void;
        onEscape?: () => void;
    },
    options: {
        /** Wrap around at list boundaries (default: true). Set false to clamp. */
        wrap?: boolean;
        /**
         * Provide this when selection state lives outside the composable (e.g. driven
         * by a parent prop). When omitted, the composable tracks the index internally
         * and exposes it via the returned `selectedIndex` ref.
         */
        getExternalIndex?: () => number;
        /** CSS selector to scrollIntoView after each navigation step. */
        scrollSelector?: string;
        /**
         * Return true to ignore the keyboard event for the given target element.
         * Default: ignores INPUT, TEXTAREA, and contentEditable elements.
         */
        ignoreWhen?: (target: HTMLElement) => boolean;
    } = {}
) {
    const {
        wrap = true,
        getExternalIndex,
        scrollSelector,
        ignoreWhen = (target) =>
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable,
    } = options;

    const selectedIndex = ref(-1);

    function resetIndex() {
        selectedIndex.value = -1;
    }

    function getCurrentIndex(): number {
        return getExternalIndex ? getExternalIndex() : selectedIndex.value;
    }

    function navigate(direction: 1 | -1) {
        const list = getList();
        if (list.length === 0) return;
        const current = getCurrentIndex();
        let next: number;
        if (wrap) {
            if (direction === 1) {
                next = current === -1 || current === list.length - 1 ? 0 : current + 1;
            } else {
                next = current === -1 || current === 0 ? list.length - 1 : current - 1;
            }
        } else {
            if (direction === 1) {
                next = current < 0 ? 0 : Math.min(current + 1, list.length - 1);
            } else {
                next = current < 0 ? 0 : Math.max(current - 1, 0);
            }
        }
        if (!getExternalIndex) selectedIndex.value = next;
        callbacks.onSelect(list[next], next);
        if (scrollSelector) {
            setTimeout(() => {
                document.querySelector(scrollSelector)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        const target = e.target as HTMLElement;
        if (ignoreWhen(target)) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigate(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigate(-1);
        } else if (e.key === 'Enter') {
            const list = getList();
            const idx = getCurrentIndex();
            if (idx >= 0 && idx < list.length) {
                e.preventDefault();
                callbacks.onOpen(list[idx], idx);
            }
        } else if (e.key === 'Escape' && callbacks.onEscape) {
            callbacks.onEscape();
        }
    }

    onMounted(() => window.addEventListener('keydown', handleKeyDown));
    onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));

    return { selectedIndex, resetIndex };
}
