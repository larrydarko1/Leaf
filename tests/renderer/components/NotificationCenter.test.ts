import { describe, it, expect, vi, afterEach } from 'vitest';
import { nextTick } from 'vue';

import NotificationCenter from '@/renderer/components/NotificationCenter.vue';
import { notify, useNotifications } from '@/renderer/composables/ui/useNotifications';
import { mountWithI18n } from '@test-utils';

const { notifications, dismiss, resume } = useNotifications();

describe('NotificationCenter', () => {
    afterEach(() => {
        resume();
        for (const n of [...notifications.value]) dismiss(n.id);
    });

    it('renders each error as an alert', async () => {
        const wrapper = mountWithI18n(NotificationCenter);
        notify.error('Could not save.');
        notify.error('Could not rename.');
        await nextTick();
        const items = wrapper.findAll('li');
        expect(items.map((item) => item.attributes('role'))).toEqual(['alert', 'alert']);
        expect(items[0]?.text()).toContain('Could not save.');
    });

    it('removes a notification when its dismiss button is clicked', async () => {
        const wrapper = mountWithI18n(NotificationCenter);
        notify.error('Could not save.', { persistent: true });
        await nextTick();
        await wrapper.get('button').trigger('click');
        expect(notifications.value).toEqual([]);
    });

    it('keeps notifications on screen while the pointer is over them', async () => {
        vi.useFakeTimers();
        const wrapper = mountWithI18n(NotificationCenter);
        notify.error('Could not save.');
        await nextTick();
        await wrapper.get('li').trigger('mouseenter');
        vi.advanceTimersByTime(60_000);
        expect(notifications.value).toHaveLength(1);
        await wrapper.get('li').trigger('mouseleave');
        vi.advanceTimersByTime(6000);
        expect(notifications.value).toEqual([]);
        vi.useRealTimers();
    });
});
