import vitest from '@vitest/eslint-plugin';

export default [
    {
        files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
        plugins: { vitest },
        rules: {
            'vitest/no-focused-tests': 'error',
            'vitest/no-disabled-tests': 'error',
            'vitest/expect-expect': 'error',
            'vitest/no-identical-title': 'error',
            'vitest/valid-expect': 'error',
            'vitest/no-standalone-expect': 'error',
            'vitest/valid-describe-callback': 'error',
            'vitest/no-commented-out-tests': 'error',
            'vitest/consistent-test-it': ['error', { fn: 'test', withinDescribe: 'it' }],
        },
    },
];
