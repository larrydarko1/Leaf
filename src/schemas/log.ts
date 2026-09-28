/**
 * Log IPC shapes — what the renderer sends when it writes to the application log.
 * The main process validates every entry against LogEntrySchema before it
 * reaches electron-log (main/services/log.ts).
 */
import { z } from 'zod';

/** The severities the renderer may write at. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * One log entry from the renderer. Call sites read like `console.error` —
 * `log.error('Failed to list themes:', err)` — so `details` is whatever
 * followed the message, as a list: anything structured clone can carry.
 */
export const LogEntrySchema = z.object({
    message: z.string({ error: 'Log message must be a string' }),
    details: z.array(z.unknown()),
});
