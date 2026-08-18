export default [
    {
        files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
        rules: {
            'max-depth': ['error', 4],
            '@typescript-eslint/max-params': ['error', { max: 6 }],
        },
    },
    {
        files: ['src/**/*.{ts,vue}'],
        rules: { 'max-depth': ['error', 3] },
    },
    {
        rules: {
            'no-else-return': ['error', { allowElseIf: false }],
            'no-warning-comments': [
                'error',
                { terms: ['todo', 'fixme', 'fix me', 'hack', 'xxx', 'wip', 'tbd'], location: 'anywhere' },
            ],
        },
    },
    {
        files: ['eslint/**/*.js', 'eslint.config.js', 'scripts/**/*.mjs'],
        rules: { 'no-warning-comments': 'off' },
    },
];
