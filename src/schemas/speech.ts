/** Speech IPC result shapes. Plain types: nothing validates these at runtime — the main process is the only producer. */

import type { IpcErrorCode } from '@/schemas/errors';

export type SpeechInitResult = {
    success: boolean;
    message?: string;
    error?: IpcErrorCode;
};

export type SpeechTranscribeResult = {
    success: boolean;
    text?: string;
    error?: IpcErrorCode;
};

export type SpeechResetSessionResult = {
    success: boolean;
};

export type SpeechStatus = {
    isModelLoaded: boolean;
    isModelLoading: boolean;
};

export type SpeechStatusEvent =
    { status: 'loading' | 'ready'; message: string } | { status: 'error'; error: IpcErrorCode };
