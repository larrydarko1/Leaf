import { createI18n } from 'vue-i18n';
import type en from '../../assets/locales/en.json';

export type MessageSchema = typeof en;
const DEFAULT_LOCALE = 'en';

/**
 * Locales are loaded at runtime from ~/.leaf/locales/ via IPC.
 * This i18n instance is initialized with empty messages and populated
 * dynamically by useLanguage() via i18n.global.setLocaleMessage().
 */
const defaultMessages = {};

export const i18n = createI18n({
    legacy: false,
    escapeParameter: true,
    locale: DEFAULT_LOCALE,
    messages: defaultMessages,
});
