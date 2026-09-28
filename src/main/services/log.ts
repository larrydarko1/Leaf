/**
 * Log Service — lets the renderer write into the application log.
 *
 * Every entry is validated against LogEntrySchema before it reaches
 * electron-log. The renderer is the untrusted side of this boundary: the
 * handlers used to forward `...args` straight to the logger, so whatever it
 * chose to send was written to disk unchecked.
 */
import { type IpcMain } from 'electron';

import { log } from '@/main/lib/logger';
import { LogEntrySchema, type LogLevel } from '@/schemas/log';

export function register(ipc: IpcMain): void {
    // One channel per line rather than generated from the levels: a channel
    // assembled from a template is a string ipc:check cannot see.
    ipc.on('log:error', (_event, rawEntry: unknown): void => write('error', rawEntry));
    ipc.on('log:warn', (_event, rawEntry: unknown): void => write('warn', rawEntry));
    ipc.on('log:info', (_event, rawEntry: unknown): void => write('info', rawEntry));
    ipc.on('log:debug', (_event, rawEntry: unknown): void => write('debug', rawEntry));
}

function write(level: LogLevel, rawEntry: unknown): void {
    const parsed = LogEntrySchema.safeParse(rawEntry);
    // A malformed entry is itself worth a line — dropping it silently would hide
    // the very failure the renderer was trying to report.
    if (!parsed.success) {
        log.warn('Discarded a malformed log entry from the renderer', {
            level,
            issue: parsed.error.issues[0]?.message ?? 'Invalid log entry',
        });
        return;
    }
    log[level](parsed.data.message, ...parsed.data.details);
}
