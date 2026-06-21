import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, createApp } from 'vue';
import { useListKeyboardNavigation } from '@/renderer/composables/ui/useListKeyboardNavigation';

// ── lifecycle helpers ─────────────────────────────────────────────────────────

/**
 * Mount a composable inside a minimal Vue app so that onMounted / onUnmounted
 * lifecycle hooks fire correctly.  Returns the composable result and an
 * `unmount` function to clean up after the test.
 */
function withSetup<T>(composable: () => T): [T, () => void] {
    let result!: T;
    const app = createApp(
        defineComponent({
            setup() {
                result = composable();
                return {};
            },
            template: '<div></div>',
        }),
    );
    const el = document.createElement('div');
    document.body.appendChild(el);
    app.mount(el);
    return [
        result,
        () => {
            app.unmount();
            document.body.removeChild(el);
        },
    ];
}

// ── key event helper ──────────────────────────────────────────────────────────

function pressKey(key: string, target: EventTarget = window): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useListKeyboardNavigation', () => {
    let list: string[];
    let onSelect: (item: string, index: number) => void;
    let onOpen: (item: string, index: number) => void;
    let onEscape: () => void;

    beforeEach(() => {
        list = ['alpha', 'beta', 'gamma'];
        onSelect = vi.fn() as unknown as (item: string, index: number) => void;
        onOpen = vi.fn() as unknown as (item: string, index: number) => void;
        onEscape = vi.fn() as unknown as () => void;
    });

    // ── wrap = true (default) ─────────────────────────────────────────────────

    describe('with wrap = true', () => {
        let nav: ReturnType<typeof useListKeyboardNavigation>;
        let unmount: () => void;

        beforeEach(() => {
            [nav, unmount] = withSetup(() =>
                useListKeyboardNavigation(() => list, { onSelect, onOpen, onEscape }, { wrap: true }),
            );
        });

        afterEach(() => unmount());

        it('ArrowDown from -1 selects the first item', () => {
            pressKey('ArrowDown');
            expect(onSelect).toHaveBeenCalledWith('alpha', 0);
            expect(nav.selectedIndex.value).toBe(0);
        });

        it('ArrowDown moves to the next item', () => {
            pressKey('ArrowDown'); // 0
            pressKey('ArrowDown'); // 1
            expect(onSelect).toHaveBeenLastCalledWith('beta', 1);
            expect(nav.selectedIndex.value).toBe(1);
        });

        it('ArrowDown wraps from the last item to the first', () => {
            pressKey('ArrowDown'); // 0
            pressKey('ArrowDown'); // 1
            pressKey('ArrowDown'); // 2
            pressKey('ArrowDown'); // wraps to 0
            expect(onSelect).toHaveBeenLastCalledWith('alpha', 0);
        });

        it('ArrowUp from -1 selects the last item', () => {
            pressKey('ArrowUp');
            expect(onSelect).toHaveBeenCalledWith('gamma', 2);
        });

        it('ArrowUp wraps from the first item to the last', () => {
            pressKey('ArrowDown'); // select 0
            pressKey('ArrowUp'); // wraps to 2
            expect(onSelect).toHaveBeenLastCalledWith('gamma', 2);
        });

        it('Enter calls onOpen with the currently selected item', () => {
            pressKey('ArrowDown'); // select index 0
            pressKey('Enter');
            expect(onOpen).toHaveBeenCalledWith('alpha', 0);
        });

        it('Enter is a no-op when no item is selected (index -1)', () => {
            pressKey('Enter');
            expect(onOpen).not.toHaveBeenCalled();
        });

        it('Escape calls the onEscape callback', () => {
            pressKey('Escape');
            expect(onEscape).toHaveBeenCalled();
        });
    });

    // ── wrap = false ──────────────────────────────────────────────────────────

    describe('with wrap = false', () => {
        let nav: ReturnType<typeof useListKeyboardNavigation>;
        let unmount: () => void;

        beforeEach(() => {
            [nav, unmount] = withSetup(() =>
                useListKeyboardNavigation(() => list, { onSelect, onOpen }, { wrap: false }),
            );
        });

        afterEach(() => unmount());

        it('ArrowDown clamps at the last item', () => {
            pressKey('ArrowDown'); // 0
            pressKey('ArrowDown'); // 1
            pressKey('ArrowDown'); // 2
            pressKey('ArrowDown'); // stays at 2
            expect(nav.selectedIndex.value).toBe(2);
        });

        it('ArrowUp from index 0 stays at 0', () => {
            pressKey('ArrowDown'); // 0
            pressKey('ArrowUp'); // clamps to 0
            expect(nav.selectedIndex.value).toBe(0);
        });
    });

    // ── ignoreWhen ────────────────────────────────────────────────────────────

    describe('ignoreWhen (default: ignore INPUT, TEXTAREA, contenteditable)', () => {
        let unmount: () => void;

        beforeEach(() => {
            [, unmount] = withSetup(() => useListKeyboardNavigation(() => list, { onSelect, onOpen }));
        });

        afterEach(() => unmount());

        it('ignores keydown events originating from an INPUT element', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            pressKey('ArrowDown', input);
            expect(onSelect).not.toHaveBeenCalled();
            document.body.removeChild(input);
        });

        it('ignores keydown events originating from a TEXTAREA element', () => {
            const ta = document.createElement('textarea');
            document.body.appendChild(ta);
            pressKey('ArrowDown', ta);
            expect(onSelect).not.toHaveBeenCalled();
            document.body.removeChild(ta);
        });
    });

    // ── external index ────────────────────────────────────────────────────────

    describe('external index (getExternalIndex provided)', () => {
        let externalIndex: number;
        let unmount: () => void;

        beforeEach(() => {
            externalIndex = -1;
            [, unmount] = withSetup(() =>
                useListKeyboardNavigation(
                    () => list,
                    { onSelect, onOpen },
                    {
                        wrap: true,
                        getExternalIndex: () => externalIndex,
                    },
                ),
            );
        });

        afterEach(() => unmount());

        it('uses getExternalIndex to determine the starting position', () => {
            externalIndex = 1; // external says we are at index 1
            pressKey('ArrowDown');
            expect(onSelect).toHaveBeenCalledWith('gamma', 2); // 1 + 1 = 2
        });

        it('does not update the internal selectedIndex ref', () => {
            // externalIndex starts at -1 → ArrowDown → index 0 (alpha)
            pressKey('ArrowDown');
            expect(onSelect).toHaveBeenCalledWith('alpha', 0);
        });
    });

    // ── resetIndex ────────────────────────────────────────────────────────────

    describe('resetIndex', () => {
        let nav: ReturnType<typeof useListKeyboardNavigation>;
        let unmount: () => void;

        beforeEach(() => {
            [nav, unmount] = withSetup(() => useListKeyboardNavigation(() => list, { onSelect, onOpen }));
        });

        afterEach(() => unmount());

        it('resets selectedIndex to -1', () => {
            pressKey('ArrowDown'); // index 0
            nav.resetIndex();
            expect(nav.selectedIndex.value).toBe(-1);
        });
    });

    // ── unmount removes the listener ──────────────────────────────────────────

    describe('listener cleanup on unmount', () => {
        it('stops responding to keydown after unmount', () => {
            const [_nav, doUnmount] = withSetup(() => useListKeyboardNavigation(() => list, { onSelect, onOpen }));
            pressKey('ArrowDown'); // registers one call
            doUnmount();
            vi.clearAllMocks();
            pressKey('ArrowDown'); // should be ignored
            expect(onSelect).not.toHaveBeenCalled();
        });
    });
});
