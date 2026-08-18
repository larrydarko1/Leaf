import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import securityStandards, { bannedCryptoModules } from './eslint/security.js';
import loggingStandards, { loggerCallSelectors } from './eslint/logging.js';
import typescriptStandards, {
    tsSourceSelectors,
    schemasBannedImports,
    rendererBannedImports,
    mainBannedImports,
} from './eslint/typescript.js';
import htmlStandards from './eslint/html.js';
import i18nStandards from './eslint/i18n.js';
import vueStandards, { noStoreLibraryPatterns, aliasOnlyImportPatterns } from './eslint/vue.js';
import envStandards, { noImportMetaEnv } from './eslint/env.js';
import { noSingleLetterDeclaration, utilsBannedImportPatterns, libBannedImportPatterns } from './eslint/code-style.js';
import { errorHandlingSelectors } from './eslint/error-handling.js';
import refactoringStandards from './eslint/refactoring.js';
import testingStandards from './eslint/testing.js';
import { functionContractsPlugin } from './eslint/function-contracts.js';

const SOURCE = ['src/**/*.{ts,vue}'];
const TYPED_SOURCE = ['src/**/*.{ts,vue}', 'tests/**/*.ts', 'vitest.setup.ts'];
const TEST_FILES = ['tests/**/*.ts', 'vitest.setup.ts'];

// Type-aware presets only reach files a tsconfig covers — locale JSON and config files are not.
const typedOnly = (preset) => preset.map((block) => ({ ...block, files: TYPED_SOURCE }));

export default [
    // ── Global ignores ───────────────────────────────────────────────────────
    { ignores: ['out/', 'dist-electron/', 'node_modules/', 'models/', 'coverage/', 'build/'] },

    // ── Base JS rules ────────────────────────────────────────────────────────
    js.configs.recommended,

    // ── TypeScript rules ─────────────────────────────────────────────────────
    ...ts.configs.recommended,
    ...typedOnly(ts.configs.recommendedTypeChecked),
    ...typedOnly(ts.configs.strict),
    ...typedOnly(ts.configs.stylistic),

    // ── Vue rules ────────────────────────────────────────────────────────────
    ...vue.configs['flat/recommended'],

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
        languageOptions: { globals: globals.browser },
    },

    // Main and preload run in Node
    {
        files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'scripts/**/*.mjs'],
        languageOptions: { globals: globals.node, sourceType: 'module' },
    },

    // ── Everywhere, typed or not ─────────────────────────────────────────────
    {
        rules: {
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
        },
    },

    // ── Project-wide overrides ───────────────────────────────────────────────
    {
        files: SOURCE,
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
            '@typescript-eslint/strict-boolean-expressions': [
                'error',
                { allowString: false, allowNumber: false, allowNullableObject: false },
            ],

            // Only allow types, not interfaces
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],

            // Allow unused vars when prefixed with _
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],

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
                { selector: 'import', format: ['camelCase', 'PascalCase'] },
                // Functions: camelCase; PascalCase allowed for Vue SFCs
                { selector: 'function', format: ['camelCase', 'PascalCase'] },
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
                { selector: 'property', modifiers: ['requiresQuotes'], format: null },
                // Object literal properties
                {
                    selector: 'objectLiteralProperty',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
                    leadingUnderscore: 'allow',
                    trailingUnderscore: 'forbid',
                },
                // Escape hatch for object literals with quoted keys
                { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
                // Classes, interfaces, type aliases, enums: PascalCase
                { selector: 'typeLike', format: ['PascalCase'] },
                // Enum members: UPPER_CASE
                { selector: 'enumMember', format: ['UPPER_CASE'] },
                // Generic type parameters: T-prefixed PascalCase
                { selector: 'typeParameter', format: ['PascalCase'], prefix: ['T'] },
            ],

            // Vue component naming
            'vue/multi-word-component-names': 'off',

            // Every v-for must have a key
            'vue/require-v-for-key': 'error',
        },
    },

    // Every exported function states its return type — the signature is the contract
    {
        files: SOURCE,
        rules: {
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                { allowTypedFunctionExpressions: false, allowIIFEs: true },
            ],
        },
    },

    // ── Import extension rule — strip extensions from TS/JS, require for .vue ─
    {
        files: ['**/*.{ts,tsx,vue}'],
        plugins: { 'import-x': importX },
        settings: {
            'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
        },
        rules: {
            // Disallow file extensions on TS/JS imports; .vue/.json must keep theirs.
            // ignorePackages skips deep package imports (e.g. 'electron-log/main.js')
            'import-x/extensions': [
                'error',
                'never',
                { ignorePackages: true, pattern: { vue: 'always', json: 'always' } },
            ],
        },
    },

    // ── Standards modules ────────────────────────────────────────────────────
    ...securityStandards,
    ...loggingStandards,
    ...typescriptStandards,
    ...envStandards,
    ...htmlStandards,
    ...vueStandards,
    ...i18nStandards,
    ...refactoringStandards,
    ...testingStandards,

    // ── Restricted syntax, composed per process ──────────────────────────────
    // One block per area: `no-restricted-syntax` is last-match-wins, not additive.
    {
        files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                ...loggerCallSelectors,
                ...errorHandlingSelectors,
                ...tsSourceSelectors,
                noSingleLetterDeclaration,
            ],
        },
    },
    {
        files: ['src/renderer/**/*.{ts,vue}'],
        rules: {
            'no-restricted-syntax': [
                'error',
                ...loggerCallSelectors,
                ...errorHandlingSelectors,
                noImportMetaEnv,
                ...tsSourceSelectors,
                noSingleLetterDeclaration,
            ],
        },
    },
    {
        files: ['src/schemas/**/*.ts'],
        rules: {
            'no-restricted-syntax': ['error', ...tsSourceSelectors, noSingleLetterDeclaration],
        },
    },

    // ── Restricted imports, composed per process ─────────────────────────────
    {
        files: ['src/main/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: bannedCryptoModules,
                    patterns: [...mainBannedImports.patterns, ...aliasOnlyImportPatterns],
                },
            ],
        },
    },
    {
        files: ['src/main/lib/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: bannedCryptoModules,
                    patterns: [...mainBannedImports.patterns, ...aliasOnlyImportPatterns, ...libBannedImportPatterns],
                },
            ],
        },
    },
    {
        files: ['src/preload/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', { paths: bannedCryptoModules, patterns: aliasOnlyImportPatterns }],
        },
    },
    {
        files: ['src/schemas/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: bannedCryptoModules,
                    patterns: [...schemasBannedImports.patterns, ...aliasOnlyImportPatterns],
                },
            ],
        },
    },
    {
        files: ['src/renderer/**/*.{ts,vue}'],
        // i18n.ts loads the locale JSON that lives outside src/ — no alias reaches it.
        ignores: ['src/renderer/i18n.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: bannedCryptoModules,
                    patterns: [
                        ...rendererBannedImports.patterns,
                        ...noStoreLibraryPatterns,
                        ...aliasOnlyImportPatterns,
                    ],
                },
            ],
        },
    },
    {
        files: ['src/renderer/utils/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: bannedCryptoModules,
                    patterns: [
                        ...rendererBannedImports.patterns,
                        ...noStoreLibraryPatterns,
                        ...aliasOnlyImportPatterns,
                        ...utilsBannedImportPatterns,
                    ],
                },
            ],
        },
    },

    // ── Function contracts — the name must match what the signature promises ─
    {
        files: SOURCE,
        plugins: { contracts: functionContractsPlugin },
        rules: {
            'contracts/name-contract': 'error',
            'contracts/one-failure-channel': 'error',
            'contracts/no-undefined-hole': 'error',
            'contracts/no-boolean-flag': 'error',
            'no-nested-ternary': 'error',
        },
    },

    // Test files — use a dedicated tsconfig.test.json so the project service
    // can find them without allowDefaultProject hacks.
    // Strict type rules are relaxed here since test/mock code routinely uses `any`
    {
        files: TEST_FILES,
        languageOptions: {
            globals: globals.node,
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
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        },
    },

    // The rule modules quote their own trigger patterns
    {
        files: ['eslint/**/*.js', 'eslint.config.js'],
        rules: { '@typescript-eslint/naming-convention': 'off' },
    },

    prettier, // Prettier last — disables formatting rules that conflict
];
