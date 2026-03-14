// Allowed file extension sets for vault scanning — pure data, no dependencies.
// Used by fs-service.ts to decide which files to index.

const TEXT_EXTENSIONS = ['.txt', '.md'];

const CODE_EXTENSIONS = [
    '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php',
    '.swift', '.m', '.mm', '.r', '.R', '.pl', '.pm', '.lua', '.sql', '.graphql', '.gql',
    '.dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
    '.prettierrc', '.babelrc', '.npmrc', '.nvmrc', '.cjs',
];

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
const PDF_EXTENSIONS = ['.pdf'];
const DRAWING_EXTENSIONS = ['.drawing'];

const ALLOWED_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS,
    ...CODE_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...PDF_EXTENSIONS,
    ...DRAWING_EXTENSIONS,
]);

export {
    TEXT_EXTENSIONS,
    CODE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    PDF_EXTENSIONS,
    DRAWING_EXTENSIONS,
    ALLOWED_EXTENSIONS,
};
