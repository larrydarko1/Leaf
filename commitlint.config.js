export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 200],
        'body-max-line-length': [2, 'always', 400],
        'type-enum': [
            2,
            'always',
            [
                // Core work (most common)
                'feat',      // A new feature
                'fix',       // A bug fix
                'perf',      // A code change that improves performance (no behavior change)
                'refactor',  // A code change that neither fixes a bug nor adds a feature
                
                // Quality & safety
                'test',      // Adding missing tests or correcting existing tests
                'security',  // Security-specific fix or hardening
                
                // Documentation & style
                'docs',      // Documentation only (including JSDoc, README, instruction files)
                'style',     // Formatting / CSS only (Prettier, whitespace)
                
                // Maintenance & operations
                'chore',     // Pipeline changes, lockfile updates, misc maintenance
                'bump',      // Version bump (`bump: version 1.0.1`) — release commits
                
                // Special
                'revert',    // Reverts a previous commit
            ],
        ],
    },
};
