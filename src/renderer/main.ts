/** Renderer entry point — mounts the Vue application. */
import { createApp } from 'vue';
import { i18n } from './i18n';
import './style.scss';
import App from './App.vue';

createApp(App).use(i18n).mount('#app');
