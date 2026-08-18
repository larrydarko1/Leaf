export const errorHandlingSelectors = [
    {
        selector:
            'CatchClause > BlockStatement > ExpressionStatement:has(CallExpression[callee.property.name=/^(error|warn|fatal)$/]) + ThrowStatement',
        message:
            'Do not log and rethrow — that logs the same failure once per layer. Log once at the boundary that handles it (the IPC handler), or attach the extra fields to the error you throw so the boundary writes them into the single line.',
    },
];
