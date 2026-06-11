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

export type SpeechStatus = {
    isModelLoaded: boolean;
    isModelLoading: boolean;
};

export type SpeechStatusEvent = {
    status: 'loading' | 'ready' | 'error';
    message: string;
};
