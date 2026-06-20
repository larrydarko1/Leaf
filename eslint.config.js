import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import a11y from 'eslint-plugin-vuejs-accessibility';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

export default [
    // ── Global ignores ───────────────────────────────────────────────────────
    { ignores: ['out/', 'dist-electron/', 'node_modules/', 'models/'] },

    // ── Base JS rules ────────────────────────────────────────────────────────
    js.configs.recommended,

    // ── TypeScript rules ─────────────────────────────────────────────────────
    ...ts.configs.recommended,
    ...ts.configs.recommendedTypeChecked,
    ...ts.configs.strict,
    ...ts.configs.stylistic,

    // ── Vue rules ────────────────────────────────────────────────────────────
    ...vue.configs['flat/recommended'],

    // ── Vue Accessibility rules ──────────────────────────────────────────────
    {
        files: ['src/renderer/**/*.vue'],
        plugins: { 'vuejs-accessibility': a11y },
        rules: {
            ...a11y.configs.recommended.rules,
        },
    },

    // Vue files need the TypeScript parser inside <script> blocks
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: { 
                parser: ts.parser,
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.vue'],
            },
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
        files: ['**/*.{ts,tsx,vue}'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // ── Strict TypeScript type checking ──────────────────────────────
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/strict-boolean-expressions': ['error', {
                allowString: false,
                allowNumber: false,
                allowNullableObject: false,
            }],
            

            // Only allow types, not interfaces
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            }],
            '@typescript-eslint/no-empty-object-type': 'error',
            
            // never allow console logs in production code — use a proper logger instead
            "no-console": "error",

            // Allow unused vars when prefixed with _
            '@typescript-eslint/no-unused-vars': ['error', { 
                argsIgnorePattern: '^_', 
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],

            // naming convention
            '@typescript-eslint/naming-convention': [
                'error',
                // Catch-all: camelCase for anything not matched below
                {
                    selector: 'default',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Variables: camelCase or UPPER_CASE constants; PascalCase for Vue component refs
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Import bindings: PascalCase for Vue SFCs and class constructors
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
                // Functions: camelCase; PascalCase allowed for Vue SFCs
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
                // Class / type properties: camelCase; UPPER_CASE for static readonly
                {
                    selector: 'property',
                    format: ['camelCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Escape hatch for class/type quoted properties
                {
                    selector: 'property',
                    modifiers: ['requiresQuotes'],
                    format: null,
                },
                // Object literal properties
                {
                    selector: 'objectLiteralProperty',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Escape hatch for object literals with quoted keys
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
                // Enum members: UPPER_CASE
                {
                    selector: 'enumMember',
                    format: ['UPPER_CASE'],
                },
                // Generic type parameters: T-prefixed PascalCase
                {
                    selector: 'typeParameter',
                    format: ['PascalCase'],
                    prefix: ['T'],
                },
            ],

            // Vue component naming
            'vue/multi-word-component-names': 'off',

            // v-html is used intentionally for rendered content
            'vue/no-v-html': 'off',

        },
    },

    // ── Import extension rule — strip extensions from TS/JS, require for .vue ─
    {
        files: ['**/*.{ts,tsx,vue}'],
        plugins: { 'import-x': importX },
        settings: {
            'import-x/resolver-next': [
                createTypeScriptImportResolver({ alwaysTryTypes: true }),
            ],
        },
        rules: {
            // Disallow file extensions on TS/JS imports; .vue/.json must keep theirs.
            // ignorePackages skips deep package imports (e.g. 'electron-log/main.js')
            'import-x/extensions': ['error', 'never', { ignorePackages: true, pattern: { vue: 'always', json: 'always' } }],
        },
    },

    // ── Prettier last — disables formatting rules that conflict ──────────────
    prettier,

    // Test files — use a dedicated tsconfig.test.json so the project service
    // can find them without allowDefaultProject hacks
    // Strict type rules are relaxed here since test/mock code routinely uses `any`
    {
        files: ['tests/**/*.ts', 'vitest.setup.ts'],
        languageOptions: {
            parserOptions: {
                projectService: false,
                project: ['./tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-dynamic-delete': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/await-thenable': 'off',
        },
    },
];