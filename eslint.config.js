import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
    // ── Global ignores ───────────────────────────────────────────────────────
    { ignores: ['out/', 'dist-electron/', 'node_modules/', 'models/'] },

    // ── Base JS rules ────────────────────────────────────────────────────────
    js.configs.recommended,

    // ── TypeScript rules ─────────────────────────────────────────────────────
    ...ts.configs.recommended,

    // ── Vue rules ────────────────────────────────────────────────────────────
    ...vue.configs['flat/recommended'],

    // Vue files need the TypeScript parser inside <script> blocks
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: { parser: ts.parser },
        },
    },

    // Renderer code runs in the browser — expose DOM globals
    {
        files: ['src/renderer/**/*.{ts,vue}'],
        languageOptions: {
            globals: globals.browser,
        },
    },

    // ── Project-wide overrides ───────────────────────────────────────────────
    {
        rules: {
            // Allow unused vars when prefixed with _ (common pattern for ignored params)
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

            // We use explicit `any` sparingly in service layers (node-llama-cpp, transformers)
            '@typescript-eslint/no-explicit-any': 'warn',

            // Vue component naming — single-word names are ok for App.vue
            'vue/multi-word-component-names': 'off',

            // v-html is used intentionally for rendered markdown — accept the risk
            'vue/no-v-html': 'off',
        },
    },

    // ── Prettier last — disables formatting rules that conflict ──────────────
    prettier,
);
