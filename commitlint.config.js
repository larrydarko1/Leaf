export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 200],
        'body-max-line-length': [2, 'always', 200],
        'type-enum': [
            2,
            'always',
            ['build', 'bump', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test', 'security']
        ]
    }
};
