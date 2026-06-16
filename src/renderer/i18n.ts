import { createI18n } from 'vue-i18n';
import en from '../../assets/locales/en.json';
import it from '../../assets/locales/it.json';

export type MessageSchema = typeof en;

// Default messages (from bundled locales)
const defaultMessages = {
    en,
    it,
};

export const i18n = createI18n({
    legacy: false,
    locale: navigator.language.split('-')[0] === 'it' ? 'it' : 'en',
    fallbackLocale: 'en',
    messages: defaultMessages,
});
