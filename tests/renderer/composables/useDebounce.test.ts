import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, effectScope } from 'vue';
import { useDebounceFn, watchDebounced } from '@/renderer/composables/useDebounce';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useDebounceFn', () => {
    it('runs once after the last call, with the latest args', () => {
        const fn = vi.fn();
        const debounced = useDebounceFn(fn, { ms: 100 });

        debounced('a');
        debounced('b');
        vi.advanceTimersByTime(99);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledExactlyOnceWith('b');
    });

    it('defaults to 200ms', () => {
        const fn = vi.fn();
        const debounced = useDebounceFn(fn);

        debounced();
        vi.advanceTimersByTime(199);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledOnce();
    });

    it('fires at maxWait while calls keep coming', () => {
        const fn = vi.fn();
        const debounced = useDebounceFn(fn, { ms: 100, maxWait: 250 });

        for (let i = 0; i < 5; i++) {
            debounced(i);
            vi.advanceTimersByTime(60);
        }

        expect(fn).toHaveBeenCalledExactlyOnceWith(4);
    });

    it('cancel drops the pending call', () => {
        const fn = vi.fn();
        const debounced = useDebounceFn(fn, { ms: 100 });

        debounced();
        debounced.cancel();
        vi.advanceTimersByTime(500);

        expect(fn).not.toHaveBeenCalled();
    });

    it('cancels pending calls when the owning scope is disposed', () => {
        const fn = vi.fn();
        const scope = effectScope();
        const debounced = scope.run(() => useDebounceFn(fn, { ms: 100 }));

        debounced?.();
        scope.stop();
        vi.advanceTimersByTime(500);

        expect(fn).not.toHaveBeenCalled();
    });
});

describe('watchDebounced', () => {
    it('runs the callback once for a burst of changes', async () => {
        const cb = vi.fn();
        const source = ref(0);
        watchDebounced(source, cb, { debounce: 100 });

        source.value = 1;
        await vi.advanceTimersByTimeAsync(0);
        source.value = 2;
        await vi.advanceTimersByTimeAsync(100);

        expect(cb).toHaveBeenCalledExactlyOnceWith(2, 1);
    });

    it('honours immediate', async () => {
        const cb = vi.fn();
        watchDebounced(ref('x'), cb, { debounce: 50, immediate: true });

        await vi.advanceTimersByTimeAsync(50);

        expect(cb).toHaveBeenCalledExactlyOnceWith('x', undefined);
    });

    it('stops when the owning scope is disposed', async () => {
        const cb = vi.fn();
        const source = ref(0);
        const scope = effectScope();
        scope.run(() => watchDebounced(source, cb, { debounce: 100 }));

        source.value = 1;
        await vi.advanceTimersByTimeAsync(0);
        scope.stop();
        await vi.advanceTimersByTimeAsync(500);

        expect(cb).not.toHaveBeenCalled();
    });
});
