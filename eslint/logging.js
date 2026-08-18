const LOG_METHODS = '/^(trace|debug|info|warn|error|verbose|silly)$/';

export const loggerCallSelectors = [
    {
        selector: `CallExpression[callee.property.name=${LOG_METHODS}] > TemplateLiteral[expressions.length>0]:first-child`,
        message:
            'No interpolation in the log message — the message must stay low-cardinality so identical events group together when you read the log file. Pass the variables as a second argument: log.warn("Failed to load language", { id }).',
    },
    {
        selector: `CallExpression[callee.property.name=${LOG_METHODS}] Property[key.name='err'] > MemberExpression[property.name='message']`,
        message:
            'Log the whole error, not `err.message` — the stack and the error’s own fields (an fs error’s `code`, a node-llama-cpp error’s cause) are the part that tells you what happened.',
    },
];

export default [
    {
        files: ['src/**/*.{ts,vue}'],
        rules: { 'no-console': 'error' },
    },
];
