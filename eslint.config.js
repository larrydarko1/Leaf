import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
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
            // Only allow types, not interfaces
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-empty-interface': 'error',
            
            // Allow unused vars when prefixed with _ (common pattern for ignored params)
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

            // naming convention
            '@typescript-eslint/naming-convention': [
                'error',
                // Catch-all: camelCase for anything not matched below
                {
                    selector: 'default',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow', // allow _id (MongoDB), _unused etc.
                    trailingUnderscore: 'forbid',
                },
                // Variables: camelCase or UPPER_CASE constants; PascalCase for Vue component refs
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Import bindings: PascalCase for Vue SFCs and class constructors (Redis, Hls, etc.)
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
                // Functions: camelCase; PascalCase allowed for Vue SFCs defined as functions
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                // Parameters: leading _ for intentionally unused params only
                {
                    selector: 'parameter',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Class / type properties: camelCase; UPPER_CASE for static readonly constants
                {
                    selector: 'property',
                    format: ['camelCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Escape hatch for class/type quoted properties ('Content-Type', '__v', etc.)
                {
                    selector: 'property',
                    modifiers: ['requiresQuotes'],
                    format: null,
                },
                // Object literal properties: PascalCase for AWS SDK / vi.mock keys; snake_case for
                // DB field names and wire-format identifiers (notification types, action names, etc.)
                {
                    selector: 'objectLiteralProperty',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Escape hatch for object literals with keys that require quotes
                {
                    selector: 'objectLiteralProperty',
                    modifiers: ['requiresQuotes'],
                    format: null,
                },
                // Classes, interfaces, type aliases, enums: PascalCase
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
                // Enum members: UPPER_CASE — Status.ACTIVE not Status.Active
                {
                    selector: 'enumMember',
                    format: ['UPPER_CASE'],
                },
                // Generic type parameters: T-prefixed PascalCase — TKey, TValue, TResult
                {
                    selector: 'typeParameter',
                    format: ['PascalCase'],
                    prefix: ['T'],
                },
            ],

            // We use explicit `any` sparingly at external boundaries
            '@typescript-eslint/no-explicit-any': 'warn',

            // Vue component naming — single-word names are ok for App.vue
            'vue/multi-word-component-names': 'off',

            // v-html is used intentionally for rendered content
            'vue/no-v-html': 'off',
        },
    },

    // ── Prettier last — disables formatting rules that conflict ──────────────
    prettier,
];
