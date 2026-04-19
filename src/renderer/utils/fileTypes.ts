/**
 * File extension classification — pure constants for routing files to viewers.
 */

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
export const PDF_EXTENSIONS = ['.pdf'];
export const DRAWING_EXTENSIONS = ['.drawing'];
export const CODE_EXTENSIONS = [
    '.py',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.vue',
    '.svelte',
    '.json',
    '.xml',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.conf',
    '.cfg',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.ps1',
    '.bat',
    '.cmd',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.java',
    '.kt',
    '.kts',
    '.go',
    '.rs',
    '.rb',
    '.php',
    '.swift',
    '.m',
    '.mm',
    '.r',
    '.R',
    '.pl',
    '.pm',
    '.lua',
    '.sql',
    '.graphql',
    '.gql',
    '.dockerfile',
    '.env',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.eslintrc',
    '.prettierrc',
    '.babelrc',
    '.npmrc',
    '.nvmrc',
];

export const isImageFile = (ext: string) => IMAGE_EXTENSIONS.includes(ext.toLowerCase());
export const isVideoFile = (ext: string) => VIDEO_EXTENSIONS.includes(ext.toLowerCase());
export const isAudioFile = (ext: string) => AUDIO_EXTENSIONS.includes(ext.toLowerCase());
export const isPdfFile = (ext: string) => PDF_EXTENSIONS.includes(ext.toLowerCase());
export const isDrawingFile = (ext: string) => DRAWING_EXTENSIONS.includes(ext.toLowerCase());
export const isCodeFile = (ext: string) => CODE_EXTENSIONS.includes(ext.toLowerCase());
export const isMarkdownFile = (ext: string) => ext.toLowerCase() === '.md';
