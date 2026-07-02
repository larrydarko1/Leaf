import { createApp } from 'vue';
import { i18n } from './src/renderer/i18n';
import en from './assets/locales/en.json';

// Create a minimal Vue app instance with i18n plugin installed
// This makes the plugin available to all components during testing
const app = createApp({});
app.use(i18n);

// Production loads messages async via IPC (see useLanguage.ts); tests have no
// IPC bridge, so seed the real English strings directly for translated-text assertions.
i18n.global.setLocaleMessage('en', en);

// Make i18n available globally in tests
(globalThis as Record<string, unknown>).i18nPlugin = i18n;
