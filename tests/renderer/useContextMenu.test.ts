import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, defineComponent, createApp } from 'vue';
import { useContextMenu } from '../../src/renderer/composables/ui/useContextMenu';

// ── lifecycle helper ──────────────────────────────────────────────────────────

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
            if (el.parentNode) el.parentNode.removeChild(el);
        },
    ];
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useContextMenu', () => {
    let visible: ReturnType<typeof ref<boolean>>;
    let position: ReturnType<typeof ref<{ x: number; y: number }>>;
    let onClose: ReturnType<typeof vi.fn>;
    let ctx: ReturnType<typeof useContextMenu>;
    let unmount: () => void;

    beforeEach(() => {
        vi.clearAllMocks();
        visible = ref<boolean>(false);
        position = ref({ x: 100, y: 100 });
        onClose = vi.fn();

        [ctx, unmount] = withSetup(() =>
            useContextMenu(
                () => visible.value!,
                () => position.value!,
                onClose as unknown as () => void,
            ),
        );
    });

    afterEach(() => unmount());

    // ── initial state ─────────────────────────────────────────────────────────

    it('menuRef starts as null', () => {
        expect(ctx.menuRef.value).toBeNull();
    });

    it('adjustedPosition starts as { x: 0, y: 0 }', () => {
        expect(ctx.adjustedPosition.value).toEqual({ x: 0, y: 0 });
    });

    // ── becoming visible ──────────────────────────────────────────────────────

    describe('when visible becomes true', () => {
        beforeEach(async () => {
            vi.useFakeTimers();
            visible.value = true;
            await nextTick();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('copies the current position to adjustedPosition', () => {
            expect(ctx.adjustedPosition.value).toEqual({ x: 100, y: 100 });
        });

        it('adds a click event listener to document', () => {
            const addEventSpy = vi.spyOn(document, 'addEventListener');
            vi.runAllTimers();
            expect(addEventSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    // ── Escape key dismissal ──────────────────────────────────────────────────

    describe('Escape key', () => {
        beforeEach(async () => {
            vi.useFakeTimers();
            visible.value = true;
            await nextTick();
            vi.runAllTimers(); // flush the setTimeout(0) that registers listeners
            vi.useRealTimers();
        });

        it('calls onClose when Escape is pressed while visible', () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(onClose).toHaveBeenCalled();
        });

        it('does not call onClose for other keys', () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    // ── click-outside dismissal ───────────────────────────────────────────────

    describe('click-outside dismissal', () => {
        beforeEach(async () => {
            vi.useFakeTimers();
            visible.value = true;
            await nextTick();
            vi.runAllTimers();
            vi.useRealTimers();
        });

        it('calls onClose when a click occurs on an element outside the menu', () => {
            // Attach a real element as the menuRef so click-outside logic can work.
            const menuEl = document.createElement('div');
            document.body.appendChild(menuEl);
            ctx.menuRef.value = menuEl;

            // Click somewhere outside the menu element
            const outside = document.createElement('div');
            document.body.appendChild(outside);
            outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(onClose).toHaveBeenCalled();

            document.body.removeChild(menuEl);
            document.body.removeChild(outside);
        });

        it('does not call onClose when the click is inside the menu element', () => {
            const menuEl = document.createElement('div');
            document.body.appendChild(menuEl);
            ctx.menuRef.value = menuEl;

            // Click inside the menu
            menuEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(onClose).not.toHaveBeenCalled();
            document.body.removeChild(menuEl);
        });
    });

    // ── listener removal when hidden ──────────────────────────────────────────

    describe('when visible becomes false', () => {
        it('removes the keydown listener so Escape no longer calls onClose', async () => {
            vi.useFakeTimers();
            visible.value = true;
            await nextTick();
            vi.runAllTimers();
            vi.useRealTimers();

            visible.value = false;
            await nextTick();

            onClose.mockClear();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    // ── unmount cleanup ───────────────────────────────────────────────────────

    describe('onUnmounted cleanup', () => {
        it('removes listeners so Escape does not fire after unmount', async () => {
            vi.useFakeTimers();
            visible.value = true;
            await nextTick();
            vi.runAllTimers();
            vi.useRealTimers();

            unmount();

            onClose.mockClear();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    // ── viewport boundary clamping ─────────────────────────────────────────────

    describe('viewport boundary clamping', () => {
        it('clamps the y position if the menu would overflow the bottom of the viewport', async () => {
            // Simulate window.innerHeight = 600 and menu positioned near the bottom
            Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
            position.value = { x: 100, y: 580 };

            // Provide a fake menuRef element with a bounding rect
            const fakeEl = document.createElement('div');
            fakeEl.getBoundingClientRect = () => ({
                height: 200,
                width: 150,
                x: 100,
                y: 580,
                top: 580,
                left: 100,
                right: 250,
                bottom: 780,
                toJSON() {
                    return {};
                },
            });
            ctx.menuRef.value = fakeEl;

            visible.value = true;
            await nextTick();
            await nextTick(); // allow the inner nextTick inside the watcher to fire

            // y should be clamped: max(0, 600 - 200 - 4) = 396
            expect(ctx.adjustedPosition.value.y).toBeLessThan(580);
        });

        it('clamps the x position if the menu would overflow the right edge', async () => {
            Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
            position.value = { x: 700, y: 100 };

            const fakeEl = document.createElement('div');
            fakeEl.getBoundingClientRect = () => ({
                height: 100,
                width: 200,
                x: 700,
                y: 100,
                top: 100,
                left: 700,
                right: 900,
                bottom: 200,
                toJSON() {
                    return {};
                },
            });
            ctx.menuRef.value = fakeEl;

            visible.value = true;
            await nextTick();
            await nextTick();

            // x should be clamped: max(0, 800 - 200 - 4) = 596
            expect(ctx.adjustedPosition.value.x).toBeLessThan(700);
        });
    });
});
