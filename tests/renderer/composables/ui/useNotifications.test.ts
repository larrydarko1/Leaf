import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { notify, useNotifications } from '@/renderer/composables/ui/useNotifications';

const { notifications, dismiss, pause, resume } = useNotifications();

function messages(): string[] {
    return notifications.value.map((n) => n.message);
}

describe('useNotifications', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        resume();
        for (const n of [...notifications.value]) dismiss(n.id);
        vi.useRealTimers();
    });

    it('queues an error keyed by its message', () => {
        notify.error('Could not save.');
        expect(notifications.value).toEqual([{ id: 'Could not save.', message: 'Could not save.', persistent: false }]);
    });

    it('collapses an identical message into the one already shown', () => {
        notify.error('Could not save.');
        notify.error('Could not save.');
        expect(messages()).toEqual(['Could not save.']);
    });

    it('replaces the notification that shares an id', () => {
        notify.error('Disk full.', { id: 'save' });
        notify.error('Access denied.', { id: 'save' });
        expect(messages()).toEqual(['Access denied.']);
    });

    it('dismisses itself after a while', () => {
        notify.error('Could not save.');
        vi.advanceTimersByTime(6000);
        expect(notifications.value).toEqual([]);
    });

    it('restarts the timer when the same message comes in again', () => {
        notify.error('Could not save.');
        vi.advanceTimersByTime(5000);
        notify.error('Could not save.');
        vi.advanceTimersByTime(5000);
        expect(messages()).toEqual(['Could not save.']);
    });

    it('keeps a persistent notification until it is dismissed by id', () => {
        notify.error('Could not save.', { id: 'save', persistent: true });
        vi.advanceTimersByTime(60_000);
        expect(messages()).toEqual(['Could not save.']);
        notify.dismiss('save');
        expect(notifications.value).toEqual([]);
    });

    it('holds every timer while paused and restarts them on resume', () => {
        notify.error('Could not save.');
        pause();
        vi.advanceTimersByTime(60_000);
        expect(messages()).toEqual(['Could not save.']);
        resume();
        vi.advanceTimersByTime(6000);
        expect(notifications.value).toEqual([]);
    });

    it('drops the oldest temporary notification past the visible limit', () => {
        notify.error('kept', { persistent: true });
        for (const message of ['a', 'b', 'c', 'd']) notify.error(message);
        expect(messages()).toEqual(['kept', 'b', 'c', 'd']);
    });
});
