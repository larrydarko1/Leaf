export const noSingleLetterDeclaration = {
    selector: 'VariableDeclarator[id.name=/^[a-hk-zA-Z$]$/]',
    message:
        'Name it. Single-letter variables are allowed only for `i`/`j` as loop counters and `_` for an ignored parameter — everywhere else the name is the only thing telling the next reader what the value is.',
};

export const utilsBannedImportPatterns = [
    {
        group: [
            '@/renderer/composables/*',
            '@/renderer/composables/**',
            '@/main/lib/*',
            '@/main/services/*',
            '**/composables/*',
            '**/services/*',
        ],
        message:
            'utils/ is pure functions — no side effects, no state, no I/O. Importing a composable or a service makes it none of those. Move the function to the composable that needs it, or to main/lib if it owns an external concern.',
    },
];

export const libBannedImportPatterns = [
    {
        group: ['@/main/services/*', '@/main/services/**', '**/services/*', '**/services/**'],
        message:
            'lib/ owns one external concern and is consumed BY services/ — never the reverse. If lib needs this type, the type belongs in lib (or src/schemas), not in the service.',
    },
];
