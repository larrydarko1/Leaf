import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '@test-utils';
import AiAgentEditCard from '@/renderer/components/ai/AiAgentEditCard.vue';
import type { AgentFileEdit } from '@/schemas/chat';

function makeEdit(overrides: Partial<AgentFileEdit> = {}): AgentFileEdit {
    return {
        filePath: '/vault/notes.md',
        newContent: 'new content',
        status: 'pending',
        ...overrides,
    };
}

describe('AiAgentEditCard', () => {
    describe('filename display', () => {
        it('shows relativePath when present', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ relativePath: 'relative/path.md' }) },
            });
            expect(wrapper.find('.ai-agent-edit-filename').text()).toBe('relative/path.md');
            wrapper.unmount();
        });

        it('falls back to filePath when relativePath is absent', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ filePath: '/absolute/path.md' }) },
            });
            expect(wrapper.find('.ai-agent-edit-filename').text()).toBe('/absolute/path.md');
            wrapper.unmount();
        });

        it('shows "new" badge when isNewFile is true', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ isNewFile: true }) },
            });
            expect(wrapper.find('.ai-agent-edit-badge.new').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides "new" badge when isNewFile is false', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ isNewFile: false }) },
            });
            expect(wrapper.find('.ai-agent-edit-badge.new').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('status indicator', () => {
        it('shows approved text for status="approved"', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'approved' }) },
            });
            expect(wrapper.find('.ai-agent-status-text.approved').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows rejected text for status="rejected"', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'rejected' }) },
            });
            expect(wrapper.find('.ai-agent-status-text.rejected').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows error text for status="error"', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'error' }) },
            });
            expect(wrapper.find('.ai-agent-status-text.error').exists()).toBe(true);
            wrapper.unmount();
        });

        it('shows no status text for status="pending"', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'pending' }) },
            });
            expect(wrapper.find('.ai-agent-status-text').exists()).toBe(false);
            wrapper.unmount();
        });

        it('applies the status class to the root element', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'approved' }) },
            });
            expect(wrapper.find('.ai-agent-edit-card').classes()).toContain('approved');
            wrapper.unmount();
        });
    });

    describe('diff viewer', () => {
        it('shows diff details when originalContent is provided', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ originalContent: 'old content' }) },
            });
            expect(wrapper.find('.ai-agent-diff-details').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides diff details when originalContent is not provided', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit() },
            });
            expect(wrapper.find('.ai-agent-diff-details').exists()).toBe(false);
            wrapper.unmount();
        });

        it('shows original section for modified file', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ originalContent: 'old', isNewFile: false }) },
            });
            expect(wrapper.find('.ai-agent-diff-section.removed').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides original section for new file', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ originalContent: '', isNewFile: true }) },
            });
            expect(wrapper.find('.ai-agent-diff-section.removed').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('error display', () => {
        it('shows error message when edit.error is set', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'error', error: 'Something went wrong' }) },
            });
            const errorEl = wrapper.find('.ai-agent-edit-error');
            expect(errorEl.exists()).toBe(true);
            expect(errorEl.text()).toContain('Something went wrong');
            wrapper.unmount();
        });

        it('hides error element when edit.error is absent', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit() },
            });
            expect(wrapper.find('.ai-agent-edit-error').exists()).toBe(false);
            wrapper.unmount();
        });
    });

    describe('action buttons', () => {
        it('shows approve and reject buttons for status="pending"', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'pending' }) },
            });
            expect(wrapper.find('.ai-agent-btn.approve').exists()).toBe(true);
            expect(wrapper.find('.ai-agent-btn.reject').exists()).toBe(true);
            wrapper.unmount();
        });

        it('hides action buttons when not pending', () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'approved' }) },
            });
            expect(wrapper.find('.ai-agent-edit-actions').exists()).toBe(false);
            wrapper.unmount();
        });

        it('emits "approve" on approve button click', async () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'pending' }) },
            });
            await wrapper.find('.ai-agent-btn.approve').trigger('click');
            expect(wrapper.emitted('approve')).toBeTruthy();
            wrapper.unmount();
        });

        it('emits "reject" on reject button click', async () => {
            const wrapper = mountWithI18n(AiAgentEditCard, {
                props: { edit: makeEdit({ status: 'pending' }) },
            });
            await wrapper.find('.ai-agent-btn.reject').trigger('click');
            expect(wrapper.emitted('reject')).toBeTruthy();
            wrapper.unmount();
        });
    });
});
