export interface SpeechInitResult {
    success: boolean;
    message?: string;
    error?: string;
}

export interface SpeechTranscribeResult {
    success: boolean;
    text?: string;
    error?: string;
}

export interface SpeechStatus {
    isModelLoaded: boolean;
    isModelLoading: boolean;
}

export interface SpeechStatusEvent {
    status: 'loading' | 'ready' | 'error';
    message: string;
}
