import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import AiHistoryPanel from '@/renderer/components/ai/AiHistoryPanel.vue';
import type { ConversationMeta } from '@/schemas/ai';

function makeMeta(overrides: Partial<ConversationMeta> = {}): ConversationMeta {
    return {
        id: 'conv-1',
        title: 'Test conversation',
        model: 'test-model',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 5,
        tokenCount: 1000,
        ...overrides,
    };
}

const defaultProps = {
    conversationList: [] as ConversationMeta[],
    currentConversationId: null as string | null,
    renamingConversationId: null as string | null,
    renameValue: '',
};

describe('AiHistoryPanel', () => {
    describe('empty state', () => {
        it('shows empty message when conversationList is empty', () => {
            const wrapper = mountWithI18n(AiHistoryPanel, { props: defaultProps });
            expect(wrapper.find('.ai-history-empty').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides conversation list when empty', () => {
            const wrapper = mountWithI18n(AiHistoryPanel, { props: defaultProps });
            expect(wrapper.find('.ai-history-items').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('conversation list', () => {
        it('renders a list item for each conversation', () => {
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [makeMeta({ id: 'a' }), makeMeta({ id: 'b' })],
                },
            });
            expect(wrapper.findAll('.ai-history-item')).toHaveLength(2);
            wrapper.unmount();
        });

        it('shows conversation title', () => {
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeMeta({ title: 'My chat' })] },
            });
            expect(wrapper.find('.ai-history-item-title').text()).toBe('My chat');
            wrapper.unmount();
        });

        it('applies "active" class to the current conversation', () => {
            const conv = makeMeta({ id: 'active-conv' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [conv],
                    currentConversationId: 'active-conv',
                },
            });
            expect(wrapper.find('.ai-history-item').classes()).toContain('active');
            wrapper.unmount();
        });

        it('does not apply "active" class to non-current conversations', () => {
            const conv = makeMeta({ id: 'other-conv' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [conv],
                    currentConversationId: 'different-id',
                },
            });
            expect(wrapper.find('.ai-history-item').classes()).not.toContain('active');
            wrapper.unmount();
        });

        it('shows rename input when renamingConversationId matches', () => {
            const conv = makeMeta({ id: 'conv-1' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [conv],
                    renamingConversationId: 'conv-1',
                    renameValue: 'New title',
                },
            });
            expect(wrapper.find('.ai-history-rename-input').exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('event emissions', () => {
        it('emits "load" with conversation id on item click', async () => {
            const conv = makeMeta({ id: 'conv-abc' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [conv] },
            });
            await wrapper.find('.ai-history-item-button').trigger('click');
            expect(wrapper.emitted('load')?.[0]).toEqual(['conv-abc']);
            wrapper.unmount();
        });

        it('emits "start-rename" on rename button click', async () => {
            const conv = makeMeta({ id: 'conv-1' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [conv] },
            });
            await wrapper.findAll('.ai-btn-icon')[0].trigger('click');
            expect(wrapper.emitted('start-rename')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "delete" with conversation id on delete button click', async () => {
            const conv = makeMeta({ id: 'del-conv' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [conv] },
            });
            await wrapper.findAll('.ai-btn-icon')[1].trigger('click');
            expect(wrapper.emitted('delete')?.[0]).toEqual(['del-conv']);
            wrapper.unmount();
        });

        it('emits "confirm-rename" on Enter key in rename input', async () => {
            const conv = makeMeta({ id: 'conv-1' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [conv],
                    renamingConversationId: 'conv-1',
                    renameValue: 'New title',
                },
            });
            await wrapper.find('.ai-history-rename-input').trigger('keydown.enter');
            expect(wrapper.emitted('confirm-rename')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "cancel-rename" on Escape key in rename input', async () => {
            const conv = makeMeta({ id: 'conv-1' });
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: {
                    ...defaultProps,
                    conversationList: [conv],
                    renamingConversationId: 'conv-1',
                    renameValue: '',
                },
            });
            await wrapper.find('.ai-history-rename-input').trigger('keydown.escape');
            expect(wrapper.emitted('cancel-rename')).toBeTruthy();
            wrapper.unmount();
        });
    });

    describe('formatRelativeDate', () => {
        function makeConvWithDate(dateStr: string) {
            return makeMeta({ updatedAt: dateStr });
        }

        it('returns "just now" for timestamps less than 1 minute ago', () => {
            const recent = new Date(Date.now() - 30000).toISOString();
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeConvWithDate(recent)] },
            });
            expect(wrapper.find('.ai-history-item-meta').text()).toContain('just now');
            wrapper.unmount();
        });

        it('returns minutes for timestamps 1-59 minutes ago', () => {
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeConvWithDate(thirtyMinsAgo)] },
            });
            expect(wrapper.find('.ai-history-item-meta').text()).toContain('30m ago');
            wrapper.unmount();
        });

        it('returns hours for timestamps 1-23 hours ago', () => {
            const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeConvWithDate(threeHoursAgo)] },
            });
            expect(wrapper.find('.ai-history-item-meta').text()).toContain('3h ago');
            wrapper.unmount();
        });

        it('returns days for timestamps 1-6 days ago', () => {
            const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeConvWithDate(twoDaysAgo)] },
            });
            expect(wrapper.find('.ai-history-item-meta').text()).toContain('2d ago');
            wrapper.unmount();
        });

        it('returns locale date string for timestamps 7+ days ago', () => {
            const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
            const wrapper = mountWithI18n(AiHistoryPanel, {
                props: { ...defaultProps, conversationList: [makeConvWithDate(tenDaysAgo)] },
            });
            const text = wrapper.find('.ai-history-item-meta').text();
            // Should contain a locale-formatted date (not "ago")
            expect(text).not.toContain('ago');
            wrapper.unmount();
        });
    });
});
