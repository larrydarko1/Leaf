export const noImportMetaEnv = {
    selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
    message:
        'Do not read `import.meta.env` here. Validate it once with Zod in a single renderer config module and import the typed value — every VITE_* var is inlined into the shipped bundle, so this is also the boundary that keeps a secret out of the packaged app.',
};

export default [
    {
        rules: { 'no-process-env': 'error' },
    },
    {
        files: ['tests/**/*.ts', 'vitest.setup.ts', 'scripts/**/*.mjs', 'build/**/*.cjs'],
        rules: { 'no-process-env': 'off' },
    },
];
