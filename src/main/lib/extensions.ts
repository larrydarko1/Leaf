/**
 * Allowed file extension sets for vault scanning — pure data, no dependencies.
 * Used by fs-service to decide which files to index.
 */

export const TEXT_EXTENSIONS: string[] = ['.txt', '.md'];

export const CODE_EXTENSIONS: string[] = [
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
    '.cjs',
];

export const IMAGE_EXTENSIONS: string[] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
export const VIDEO_EXTENSIONS: string[] = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
export const AUDIO_EXTENSIONS: string[] = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
export const PDF_EXTENSIONS: string[] = ['.pdf'];
export const DRAWING_EXTENSIONS: string[] = ['.drawing'];

export const ALLOWED_EXTENSIONS: Set<string> = new Set<string>([
    ...TEXT_EXTENSIONS,
    ...CODE_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...PDF_EXTENSIONS,
    ...DRAWING_EXTENSIONS,
]);
