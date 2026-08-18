import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope } from 'vue';
import { useThrottleFn } from '@/renderer/composables/useThrottle';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useThrottleFn', () => {
    it('runs the first call immediately', () => {
        const fn = vi.fn();
        const throttled = useThrottleFn(fn, 100);

        throttled('a');

        expect(fn).toHaveBeenCalledExactlyOnceWith('a');
    });

    it('collapses calls inside the window into one trailing call', () => {
        const fn = vi.fn();
        const throttled = useThrottleFn(fn, 100);

        throttled('a');
        throttled('b');
        throttled('c');
        expect(fn).toHaveBeenCalledExactlyOnceWith('a');

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith('c');
    });

    it('runs immediately again once the window has elapsed', () => {
        const fn = vi.fn();
        const throttled = useThrottleFn(fn, 100);

        throttled('a');
        vi.advanceTimersByTime(100);
        throttled('b');

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith('b');
    });

    it('defaults to 200ms', () => {
        const fn = vi.fn();
        const throttled = useThrottleFn(fn, undefined);

        throttled();
        vi.advanceTimersByTime(199);
        throttled();

        expect(fn).toHaveBeenCalledOnce();
    });

    it('cancel drops the trailing call', () => {
        const fn = vi.fn();
        const throttled = useThrottleFn(fn, 100);

        throttled('a');
        throttled('b');
        throttled.cancel();
        vi.advanceTimersByTime(500);

        expect(fn).toHaveBeenCalledExactlyOnceWith('a');
    });

    it('cancels the trailing call when the owning scope is disposed', () => {
        const fn = vi.fn();
        const scope = effectScope();
        const throttled = scope.run(() => useThrottleFn(fn, 100));

        throttled?.('a');
        throttled?.('b');
        scope.stop();
        vi.advanceTimersByTime(500);

        expect(fn).toHaveBeenCalledExactlyOnceWith('a');
    });
});
