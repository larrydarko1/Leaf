/** Speech IPC result shapes. Plain types: nothing validates these at runtime — the main process is the only producer. */

export type SpeechInitResult = {
    success: boolean;
    message?: string;
    error?: string;
};

export type SpeechTranscribeResult = {
    success: boolean;
    text?: string;
    error?: string;
};

export type SpeechResetSessionResult = {
    success: boolean;
};

export type SpeechStatus = {
    isModelLoaded: boolean;
    isModelLoading: boolean;
};

export type SpeechStatusEvent = {
    status: 'loading' | 'ready' | 'error';
    message: string;
};
