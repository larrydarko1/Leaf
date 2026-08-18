export const tsSourceSelectors = [
    {
        selector: 'ExportNamedDeclaration[source=null][declaration=null]',
        message:
            'Export at the declaration site (`export const foo = …`), not in a detached `export { foo }` block — a detached export disconnects the symbol from its definition and makes rename-refactoring unreliable. Re-export barrels (`export { x } from "./y"`) are exempt.',
    },
];

// src/schemas is the shared contract between main, preload and renderer — it must stay process-neutral.
export const schemasBannedImports = {
    patterns: [
        {
            group: ['electron', 'electron/*', 'electron-log', 'electron-log/*'],
            message:
                'src/schemas is the shared contract all three processes import — it must not pull in Electron. A main-process type belongs in src/main, a renderer type in src/renderer.',
        },
        {
            group: ['vue', 'vue/*', '@vue/*', 'vue-i18n'],
            message:
                'src/schemas is framework-neutral — the main process imports it, so it must not pull in Vue. A Vue-flavoured type belongs in src/renderer.',
        },
    ],
};

// The renderer is sandboxed: it reaches the OS through window.electronAPI, never directly.
export const rendererBannedImports = {
    patterns: [
        {
            group: ['electron', 'electron/*', 'electron-log', 'electron-log/*'],
            message:
                'The renderer must not import Electron directly — contextIsolation means it would not resolve at runtime anyway. Add an IPC channel in src/preload and call it through `window.electronAPI`.',
        },
        {
            group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'crypto'],
            message:
                'No Node built-ins in the renderer — it is a sandboxed browser context. Do the filesystem/OS work in a main-process service and expose it over IPC.',
        },
        {
            group: ['@/main/*', '@/main/**', '@/preload/*', '@/preload/**'],
            message:
                'The renderer must not import main or preload modules — that bundles main-process code into the browser context. Cross the boundary over IPC, and share types through src/schemas.',
        },
    ],
};

export const mainBannedImports = {
    patterns: [
        {
            group: ['@/renderer/*', '@/renderer/**', 'vue', 'vue/*', '@vue/*'],
            message:
                'The main process must not import renderer code or Vue — it has no DOM. Share the type through src/schemas and send the value over IPC.',
        },
    ],
};

export default [
    {
        files: ['src/**/*.{ts,vue}'],
        // The `*.vue` module shim has to `export default` — the ban is for our own modules.
        ignores: ['**/*.d.ts'],
        rules: {
            'no-restricted-exports': [
                'error',
                {
                    restrictDefaultExports: {
                        direct: true,
                        named: true,
                        defaultFrom: true,
                        namedFrom: true,
                        namespaceFrom: true,
                    },
                },
            ],
        },
    },
    {
        files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
        rules: {
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            'no-var': 'error',
            'prefer-const': ['error', { destructuring: 'all' }],
            'no-restricted-globals': [
                'error',
                {
                    name: '__dirname',
                    message: 'Use `import.meta.dirname` (Node 21.2+) — `__dirname` is CommonJS-only.',
                },
                {
                    name: '__filename',
                    message: 'Use `import.meta.filename` (Node 21.2+) — `__filename` is CommonJS-only.',
                },
            ],
        },
    },
];
