import { ref } from 'vue';
import { isImageFile as checkImage, isVideoFile as checkVideo, isAudioFile as checkAudio } from '../../utils/fileTypes';

export function useEmbedResolver(getFile: () => { path: string } | null, getWorkspacePath: () => string | null) {
    const embedCache = ref<Map<string, string>>(new Map());
    const embedCacheVersion = ref(0);

    async function resolveEmbeds(text: string) {
        const file = getFile();
        const workspacePath = getWorkspacePath();
        if (!file || !workspacePath) return;

        const embedRegex = /!\[\[([^\]]+)\]\]/g;
        const matches = [...text.matchAll(embedRegex)];
        if (matches.length === 0) return;

        const noteDir = file.path.substring(0, file.path.lastIndexOf('/'));

        // Collect unique unresolved filenames
        const fileNames = new Set<string>();
        for (const match of matches) {
            const inner = match[1];
            const fileName = inner.split('|')[0].split('#')[0].trim();
            if (fileName && !embedCache.value.has(fileName)) {
                fileNames.add(fileName);
            }
        }
        if (fileNames.size === 0) return;

        // Resolve all embeds in parallel — single cache version bump at the end
        const results = await Promise.all(
            [...fileNames].map(async (fileName) => {
                try {
                    const result = await window.electronAPI.resolveEmbedPath(fileName, noteDir, workspacePath);
                    return { fileName, result };
                } catch (err) {
                    console.error('Failed to resolve embed:', fileName, err);
                    return null;
                }
            }),
        );

        let changed = false;
        for (const entry of results) {
            if (entry?.result.success && entry.result.path) {
                embedCache.value.set(entry.fileName, entry.result.path);
                changed = true;
            }
        }

        if (changed) {
            embedCacheVersion.value++;
        }
    }

    function getEmbedMediaType(fileName: string): 'image' | 'video' | 'audio' | 'pdf' | 'note' | 'unknown' {
        const ext = '.' + fileName.split('.').pop()!.toLowerCase();
        if (checkImage(ext)) return 'image';
        if (checkVideo(ext)) return 'video';
        if (checkAudio(ext)) return 'audio';
        if (ext === '.pdf') return 'pdf';
        if (ext === '.md' || ext === '.txt') return 'note';
        return 'unknown';
    }

    function clearCache() {
        embedCache.value.clear();
        embedCacheVersion.value++;
    }

    return { embedCache, embedCacheVersion, resolveEmbeds, getEmbedMediaType, clearCache };
}
