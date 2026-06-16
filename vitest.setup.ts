import { createApp } from 'vue';
import { i18n } from './src/renderer/i18n';

// Create a minimal Vue app instance with i18n plugin installed
// This makes the plugin available to all components during testing
const app = createApp({});
app.use(i18n);

// Make i18n available globally in tests
(globalThis as Record<string, unknown>).i18nPlugin = i18n;
