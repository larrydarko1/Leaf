export const bannedCryptoModules = [
    { name: 'bcrypt', message: 'Password hashing must use Argon2id (argon2), never bcrypt' },
    { name: 'bcryptjs', message: 'Password hashing must use Argon2id (argon2), never bcrypt' },
    { name: 'scrypt-js', message: 'Password hashing must use Argon2id (argon2), never scrypt' },
    { name: 'scryptsy', message: 'Password hashing must use Argon2id (argon2), never scrypt' },
    {
        name: 'crypto-js',
        message: 'Use Node’s built-in `node:crypto` (AES-256-GCM / HMAC-SHA-256), not crypto-js',
    },
];

export default [
    {
        files: ['src/**/*.{ts,vue}'],
        rules: {
            'no-restricted-imports': ['error', { paths: bannedCryptoModules }],
            'no-eval': 'error',
            'no-implied-eval': 'error',
        },
    },
    {
        files: ['src/renderer/**/*.vue'],
        rules: { 'vue/no-v-html': 'error' },
    },
    {
        // Sanitised through DOMPurify in useAIChat; static internal icon markup in the toolbar.
        files: ['src/renderer/components/ai/AiMessageList.vue', 'src/renderer/components/drawing/DrawingToolbar.vue'],
        rules: { 'vue/no-v-html': 'off' },
    },
];
