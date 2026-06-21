import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import ContextMenu from '@/renderer/components/explorer/ContextMenu.vue';

const baseItems = [
    { label: 'Rename', action: 'rename' },
    { label: 'Delete', action: 'delete' },
    { label: 'Move', action: 'move', disabled: true },
];

describe('ContextMenu', () => {
    it('renders nothing when visible is false', () => {
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: false, position: { x: 0, y: 0 }, items: baseItems },
            attachTo: document.body,
        });
        // The menu is teleported to body, but v-if prevents rendering
        expect(wrapper.find('.context-menu').exists()).toBe(false);
        wrapper.unmount();
    });

    it('renders the menu with all items when visible is true', () => {
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: true, position: { x: 10, y: 20 }, items: baseItems },
            attachTo: document.body,
        });
        // Teleport renders to body, not inside the wrapper's element
        const menu = document.querySelector('.context-menu');
        expect(menu).not.toBeNull();
        const buttons = document.querySelectorAll('.context-menu-item');
        expect(buttons.length).toBe(3);
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('emits "action" with the item action when a non-disabled item is clicked', async () => {
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: true, position: { x: 0, y: 0 }, items: baseItems },
            attachTo: document.body,
        });
        const buttons = document.querySelectorAll<HTMLButtonElement>('.context-menu-item');
        buttons[0].click(); // 'rename' — not disabled
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('action')?.[0]).toEqual(['rename']);
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('emits "close" when a non-disabled item is clicked', async () => {
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: true, position: { x: 0, y: 0 }, items: baseItems },
            attachTo: document.body,
        });
        const buttons = document.querySelectorAll<HTMLButtonElement>('.context-menu-item');
        buttons[0].click(); // 'rename'
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('close')).toBeDefined();
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('does not emit "action" when a disabled item is clicked', async () => {
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: true, position: { x: 0, y: 0 }, items: baseItems },
            attachTo: document.body,
        });
        const buttons = document.querySelectorAll<HTMLButtonElement>('.context-menu-item');
        buttons[2].click(); // 'move' — disabled
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('action')).toBeUndefined();
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });

    it('shows keyboard shortcuts when provided', () => {
        const items = [{ label: 'Copy', action: 'copy', shortcut: '⌘C' }];
        const wrapper = mountWithI18n(ContextMenu, {
            props: { visible: true, position: { x: 0, y: 0 }, items },
            attachTo: document.body,
        });
        const shortcut = document.querySelector('.menu-shortcut');
        expect(shortcut?.textContent).toBe('⌘C');
        wrapper.unmount();
        document.querySelector('.context-menu')?.remove();
    });
});
