/** IPC failure replies: a caught error's message goes to the log, the renderer gets a code. */

import { log } from '@/main/lib/logger';
import type { IpcErrorCode } from '@/schemas/errors';

const ERRNO_CODES: Record<string, IpcErrorCode> = {
    ENOENT: 'NOT_FOUND',
    EEXIST: 'ALREADY_EXISTS',
    ENOTEMPTY: 'ALREADY_EXISTS',
    EACCES: 'ACCESS_DENIED',
    EPERM: 'ACCESS_DENIED',
    ENOSPC: 'DISK_FULL',
};

/** A failure this app raises itself, carrying the code the renderer is told. */
export class IpcError extends Error {
    readonly code: IpcErrorCode;

    constructor(code: IpcErrorCode, message: string) {
        super(message);
        this.name = 'IpcError';
        this.code = code;
    }
}

export function toIpcErrorCode(error: unknown): IpcErrorCode {
    if (error instanceof IpcError) return error.code;
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
        return ERRNO_CODES[error.code] ?? 'UNKNOWN';
    }
    return 'UNKNOWN';
}

/** A handler's failure reply: the error goes to the log, the renderer gets its code. */
export function ipcFailure(scope: string, error: unknown): { success: false; error: IpcErrorCode } {
    log.warn('IPC handler failed', { scope }, error);
    return { success: false, error: toIpcErrorCode(error) };
}
