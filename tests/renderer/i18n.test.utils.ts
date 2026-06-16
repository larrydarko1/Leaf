/**
 * i18n test utilities — shared setup and helpers for tests involving translations
 */

import { vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import type { I18n } from 'vue-i18n';

/**
 * Create a mock i18n instance for testing
 * @param messages Optional translation messages (defaults to empty)
 * @returns I18n instance
 */
export function createMockI18n(messages: Record<string, any> = {}): I18n {
    const defaultMessages = {
        en: {
            common: { save: 'Save', cancel: 'Cancel', close: 'Close' },
            app: {
                select_folder: 'Select Folder',
                change_folder: 'Change folder',
                create_new_note: 'Create new note',
                language_selector: 'Select language',
                theme_selector: 'Select theme',
                ai_assistant: 'AI assistant',
                open_files: 'Open files',
            },
            editor: {
                tab_unsaved_indicator: 'Unsaved changes',
                tab_close_button: 'Close {filename}',
            },
            theme: {
                title: 'Theme',
                selection_panel: 'Theme selection panel',
                panel_controls: 'Theme panel controls',
                refresh_list: 'Refresh theme list',
                close_panel: 'Close theme panel',
                available_themes: 'Available themes',
                no_themes_found: 'No themes found',
                open_folder: 'Open themes folder',
            },
            ...messages,
        },
    };

    return createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: defaultMessages,
    });
}

/**
 * Mock useI18n composable for component tests
 * @param i18n Optional i18n instance (creates one if not provided)
 */
export function mockUseI18n(i18n?: I18n) {
    const _instance = i18n || createMockI18n();
    return vi.mocked({
        t: (key: string, values?: Record<string, any>) => {
            if (values && values.filename) {
                return key.replace('{filename}', values.filename);
            }
            return key;
        },
        locale: { value: 'en' },
        setLocale: vi.fn(),
    });
}

/**
 * Setup vue-i18n mock in tests
 * Call this in your test file's describe block before component tests
 */
export function setupI18nMock() {
    vi.mock('vue-i18n', () => ({
        useI18n: () => mockUseI18n(),
    }));
}

/**
 * Helper to check if a string contains i18n key pattern (useful for validation)
 * @param str String to check
 * @returns True if string looks like an i18n key (e.g., "common.save")
 */
export function looksLikeI18nKey(str: string): boolean {
    return /^[a-z_]+\.[a-z_]+/.test(str);
}
