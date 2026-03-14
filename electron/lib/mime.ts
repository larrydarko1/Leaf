// MIME type maps — pure data, no dependencies.
// Used by:
//   main.ts         → MIME_MAP  (leaf:// protocol handler)
//   fs-service.ts   → IMAGE_MIMETYPES, AUDIO_MIMETYPES  (file:readImage, file:readAudio)

const IMAGE_MIMETYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
};

const AUDIO_MIMETYPES: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
};

const VIDEO_MIMETYPES: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
};

// Full map used by the leaf:// protocol to serve any local file with the
// correct Content-Type. Falls back to application/octet-stream if unknown.
const MIME_MAP: Record<string, string> = {
    ...IMAGE_MIMETYPES,
    ...AUDIO_MIMETYPES,
    ...VIDEO_MIMETYPES,
    '.pdf': 'application/pdf',
};

export { IMAGE_MIMETYPES, AUDIO_MIMETYPES, VIDEO_MIMETYPES, MIME_MAP };
