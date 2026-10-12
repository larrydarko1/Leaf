/**
 * useNotifications — the app's one channel for telling the user something failed. Code calls
 * `notify`; NotificationCenter, mounted once in App.vue, renders the queue.
 */

import { readonly, shallowRef, type DeepReadonly, type Ref } from 'vue';

type Notification = {
    id: string;
    message: string;
    persistent: boolean;
};

type NotifyOptions = {
    // Reusing an id replaces that notification instead of stacking a second one.
    id?: string;
    // Stays until dismissed by the user or by `notify.dismiss(id)`.
    persistent?: boolean;
};

const DISMISS_AFTER_MS = 6000;
const MAX_VISIBLE = 4;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const notifications = shallowRef<Notification[]>([]);
let paused = false;

export const notify = {
    error: push,
    dismiss,
};

export function useNotifications(): {
    notifications: Readonly<Ref<DeepReadonly<Notification[]>>>;
    dismiss: (id: string) => void;
    pause: () => void;
    resume: () => void;
} {
    return { notifications: readonly(notifications), dismiss, pause, resume };
}

function push(message: string, options: NotifyOptions = {}): void {
    const notification: Notification = {
        id: options.id ?? message,
        message,
        persistent: options.persistent ?? false,
    };
    const others = notifications.value.filter((item): boolean => item.id !== notification.id);
    const overflow = others.length + 1 - MAX_VISIBLE;
    const dropped = overflow > 0 ? others.filter((item): boolean => !item.persistent).slice(0, overflow) : [];
    for (const item of dropped) clearTimer(item.id);
    notifications.value = [...others.filter((item): boolean => !dropped.includes(item)), notification];
    startTimer(notification);
}

function dismiss(id: string): void {
    clearTimer(id);
    notifications.value = notifications.value.filter((item): boolean => item.id !== id);
}

// Holds every timer while the user is reading or tabbing through the stack.
function pause(): void {
    paused = true;
    for (const id of [...timers.keys()]) clearTimer(id);
}

function resume(): void {
    paused = false;
    for (const item of notifications.value) startTimer(item);
}

function startTimer(notification: Notification): void {
    clearTimer(notification.id);
    if (notification.persistent || paused) return;
    timers.set(
        notification.id,
        setTimeout((): void => {
            dismiss(notification.id);
        }, DISMISS_AFTER_MS),
    );
}

function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
}
