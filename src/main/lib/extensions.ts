/**
 * Allowed file extension sets for vault scanning — pure data, no dependencies.
 * Used by fs-service to decide which files to index.
 */

const TEXT_EXTENSIONS: string[] = ['.txt', '.md'];

const CODE_EXTENSIONS: string[] = [
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

const IMAGE_EXTENSIONS: string[] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const VIDEO_EXTENSIONS: string[] = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
const AUDIO_EXTENSIONS: string[] = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
const PDF_EXTENSIONS: string[] = ['.pdf'];
const DRAWING_EXTENSIONS: string[] = ['.drawing'];

export const ALLOWED_EXTENSIONS: Set<string> = new Set<string>([
    ...TEXT_EXTENSIONS,
    ...CODE_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...PDF_EXTENSIONS,
    ...DRAWING_EXTENSIONS,
]);
