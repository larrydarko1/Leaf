/** Throttle helper. */
import { getCurrentScope, onScopeDispose } from 'vue';

/**
 * Throttle `fn`: it runs immediately, then at most once per `ms`. A final
 * trailing call is scheduled so the last invocation isn't dropped.
 */
export function useThrottleFn<TArgs extends unknown[]>(
    fn: (...args: TArgs) => void,
    ms = 200,
): ((...args: TArgs) => void) & { cancel: () => void } {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: TArgs | undefined;

    const cancel = (): void => {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
        lastArgs = undefined;
    };

    const throttled = (...args: TArgs): void => {
        lastArgs = args;
        const elapsed = Date.now() - last;
        if (elapsed >= ms) {
            last = Date.now();
            fn(...args);
        } else if (timer === undefined) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = undefined;
                const pending = lastArgs;
                lastArgs = undefined;
                if (pending !== undefined) fn(...pending);
            }, ms - elapsed);
        }
    };

    if (getCurrentScope() !== undefined) onScopeDispose(cancel);
    return Object.assign(throttled, { cancel });
}
