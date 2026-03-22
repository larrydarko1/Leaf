// Hugging Face Model Download Service
// Allows searching and downloading GGUF models directly from Hugging Face
// into the local ~/leaf-models/ directory.

import type { IpcMain, BrowserWindow } from 'electron';
import https from 'https';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_MODELS_DIR } from '../lib/paths';
import { assertSafeFileName } from '../lib/validation';

// Only allow downloads from Hugging Face domains
const ALLOWED_DOWNLOAD_HOSTS = ['huggingface.co', 'cdn-lfs.hf.co', 'cdn-lfs-us-1.hf.co', 'cdn-lfs.huggingface.co'];

function assertAllowedDownloadUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('Invalid download URL.');
    }
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS downloads are allowed.');
    if (!ALLOWED_DOWNLOAD_HOSTS.includes(parsed.hostname)) {
        throw new Error(`Downloads are only allowed from Hugging Face (got ${parsed.hostname}).`);
    }
}

interface DownloadEntry {
    abortController: { aborted: boolean };
    filePath: string;
    tempPath: string;
}

// Track active downloads
const activeDownloads = new Map<string, DownloadEntry>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hfApiGet(apiPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'huggingface.co',
            path: apiPath,
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Leaf-App/1.0',
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk: string) => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function searchModels(query: string): Promise<{ success: boolean; results?: object[]; error?: string }> {
    try {
        const searchQuery = query ? `${query} gguf` : 'gguf';
        const apiPath = `/api/models?search=${encodeURIComponent(searchQuery)}&filter=gguf&sort=downloads&direction=-1&limit=20`;
        const models: any[] = await hfApiGet(apiPath); // eslint-disable-line @typescript-eslint/no-explicit-any

        const results = models.map((m) => ({
            id: m.modelId || m.id,
            author: m.author || m.modelId?.split('/')[0] || '',
            name: m.modelId?.split('/').pop() || m.id,
            downloads: m.downloads || 0,
            likes: m.likes || 0,
            tags: m.tags || [],
            lastModified: m.lastModified || '',
        }));

        return { success: true, results };
    } catch (err) {
        return { success: false, error: `Search failed: ${(err as Error).message}` };
    }
}

function extractQuantType(filename: string): string | null {
    const patterns = [
        /[_\-.](IQ[1-4]_[A-Z]+)/i,
        /[_\-.](Q[0-9]+_K_[A-Z]+)/i,
        /[_\-.](Q[0-9]+_K)/i,
        /[_\-.](Q[0-9]+_[0-9]+)/i,
        /[_\-.](BF16)/i,
        /[_\-.](F16)/i,
        /[_\-.](F32)/i,
    ];

    for (const pat of patterns) {
        const match = filename.match(pat);
        if (match) return match[1].toUpperCase();
    }

    const dirMatch = filename.match(/^(IQ[1-4]_[A-Z]+|Q[0-9]+_K_[A-Z]+|Q[0-9]+_K|Q[0-9]+_[0-9]+|BF16|F16|F32)\//i);
    if (dirMatch) return dirMatch[1].toUpperCase();

    return null;
}

function estimateRam(fileSize: number): number {
    return Math.ceil(fileSize * 1.2);
}

function getModelTier(fileSize: number): { label: string; color: string; description: string } {
    const gb = fileSize / (1024 * 1024 * 1024);
    if (gb <= 2) return { label: 'Small', color: 'green', description: 'Runs well on most machines (< 2 GB)' };
    if (gb <= 5) return { label: 'Medium', color: 'blue', description: 'Moderate resource use (2 – 5 GB)' };
    if (gb <= 10) return { label: 'Large', color: 'orange', description: 'Needs 16 GB+ RAM (5 – 10 GB)' };
    if (gb <= 30) return { label: 'Very Large', color: 'red', description: 'Needs 32 GB+ RAM (10 – 30 GB)' };
    return { label: 'Extreme', color: 'red', description: 'Needs 64 GB+ RAM (> 30 GB), may not run' };
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface TreeFile {
    path: string;
    size: number;
}

async function fetchTree(repoId: string, treePath: string): Promise<TreeFile[]> {
    const apiPath = `/api/models/${repoId}/tree/main${treePath ? '/' + treePath : ''}`;
    const entries: any[] = await hfApiGet(apiPath); // eslint-disable-line @typescript-eslint/no-explicit-any

    let files: TreeFile[] = [];
    for (const entry of entries) {
        if (entry.type === 'file') {
            const size = entry.lfs && entry.lfs.size ? entry.lfs.size : entry.size || 0;
            files.push({ path: entry.path, size });
        } else if (entry.type === 'directory') {
            const subFiles = await fetchTree(repoId, entry.path);
            files = files.concat(subFiles);
        }
    }
    return files;
}

async function listRepoFiles(repoId: string): Promise<object> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [modelData, treeFiles]: [any, TreeFile[]] = await Promise.all([
            hfApiGet(`/api/models/${repoId}`),
            fetchTree(repoId, ''),
        ]);

        const ggufMeta = modelData.gguf || {};
        const architecture = ggufMeta.architecture || null;
        const contextLength = ggufMeta.context_length || null;
        const totalParamSize = ggufMeta.total || null;

        const ggufTreeFiles = treeFiles.filter((f) => f.path.endsWith('.gguf'));

        if (ggufTreeFiles.length === 0) {
            return {
                success: true,
                files: [],
                modelInfo: { architecture, contextLength, totalParamSize },
                repoId,
                repoName: modelData.modelId || repoId,
            };
        }

        const shardPattern = /^(.+)-(\d{5})-of-(\d{5})\.gguf$/;
        const shardGroups = new Map<
            string,
            { files: TreeFile[]; totalShards: number; baseName: string; dir: string }
        >();
        const standaloneFiles: TreeFile[] = [];

        for (const f of ggufTreeFiles) {
            const fileName = f.path.split('/').pop()!;
            const match = fileName.match(shardPattern);
            if (match) {
                const baseName = match[1];
                const dir = f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '';
                const groupKey = dir ? `${dir}/${baseName}` : baseName;
                if (!shardGroups.has(groupKey)) {
                    shardGroups.set(groupKey, { files: [], totalShards: parseInt(match[3], 10), baseName, dir });
                }
                shardGroups.get(groupKey)!.files.push(f);
            } else {
                standaloneFiles.push(f);
            }
        }

        const resultFiles: object[] = [];

        for (const f of standaloneFiles) {
            const fileName = f.path.split('/').pop()!;
            resultFiles.push({
                name: fileName,
                path: f.path,
                size: f.size,
                sizeFormatted: formatFileSize(f.size),
                downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.path}`,
                quantType: extractQuantType(f.path),
                estimatedRam: estimateRam(f.size),
                estimatedRamFormatted: formatFileSize(estimateRam(f.size)),
                tier: getModelTier(f.size),
                isSharded: false,
                shardCount: 1,
                shardFiles: null,
                architecture,
                contextLength,
            });
        }

        for (const [groupKey, group] of shardGroups) {
            const totalSize = group.files.reduce((sum, f) => sum + f.size, 0);
            const displayName = `${group.baseName}.gguf (${group.files.length} parts)`;
            const shardFiles = group.files
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((f) => ({
                    name: f.path.split('/').pop(),
                    path: f.path,
                    size: f.size,
                    sizeFormatted: formatFileSize(f.size),
                    downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.path}`,
                }));

            resultFiles.push({
                name: displayName,
                path: group.dir ? `${group.dir}/${group.baseName}.gguf` : `${group.baseName}.gguf`,
                size: totalSize,
                sizeFormatted: formatFileSize(totalSize),
                downloadUrl: shardFiles[0].downloadUrl,
                quantType: extractQuantType(groupKey),
                estimatedRam: estimateRam(totalSize),
                estimatedRamFormatted: formatFileSize(estimateRam(totalSize)),
                tier: getModelTier(totalSize),
                isSharded: true,
                shardCount: group.files.length,
                shardFiles,
                architecture,
                contextLength,
            });
        }

        resultFiles.sort((a: any, b: any) => a.size - b.size); // eslint-disable-line @typescript-eslint/no-explicit-any

        return {
            success: true,
            files: resultFiles,
            modelInfo: {
                architecture,
                contextLength,
                totalParamSize,
                totalParamSizeFormatted: formatFileSize(totalParamSize || 0),
            },
            repoId,
            repoName: modelData.modelId || repoId,
        };
    } catch (err) {
        return { success: false, error: `Failed to list files: ${(err as Error).message}` };
    }
}

interface ProgressInfo {
    downloaded: number;
    total: number;
    percent: number;
    fileName: string;
}

async function downloadModel(
    url: string,
    fileName: string,
    onProgress: (p: ProgressInfo) => void,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    // Validate URL against whitelist and filename against traversal
    assertAllowedDownloadUrl(url);
    assertSafeFileName(fileName);

    await fs.mkdir(DEFAULT_MODELS_DIR, { recursive: true });

    const filePath = path.join(DEFAULT_MODELS_DIR, fileName);
    const tempPath = filePath + '.downloading';

    try {
        const existing = await fs.stat(filePath);
        if (existing.size > 0) {
            return { success: false, error: 'Model file already exists. Delete it first to re-download.' };
        }
    } catch {
        /* file doesn't exist — good */
    }

    if (activeDownloads.has(fileName)) {
        return { success: false, error: 'This model is already being downloaded.' };
    }

    const abortController = { aborted: false };
    activeDownloads.set(fileName, { abortController, filePath, tempPath });

    return new Promise((resolve) => {
        function doRequest(requestUrl: string): void {
            const urlObj = new URL(requestUrl);

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: { 'User-Agent': 'Leaf-App/1.0' },
            };

            const req = https.request(options, (res) => {
                if (res.statusCode! >= 300 && res.statusCode! < 400 && res.headers.location) {
                    // Validate redirect targets against the same whitelist
                    try {
                        assertAllowedDownloadUrl(res.headers.location);
                    } catch (err) {
                        activeDownloads.delete(fileName);
                        resolve({ success: false, error: (err as Error).message });
                        return;
                    }
                    doRequest(res.headers.location);
                    return;
                }

                if (res.statusCode !== 200) {
                    activeDownloads.delete(fileName);
                    resolve({ success: false, error: `Download failed: HTTP ${res.statusCode}` });
                    return;
                }

                const totalSize = parseInt(res.headers['content-length'] || '0', 10);
                let downloaded = 0;

                const writeStream = createWriteStream(tempPath);

                res.on('data', (chunk: Buffer) => {
                    if (abortController.aborted) {
                        res.destroy();
                        writeStream.close();
                        return;
                    }

                    writeStream.write(chunk);
                    downloaded += chunk.length;

                    if (totalSize > 0) {
                        onProgress({
                            downloaded,
                            total: totalSize,
                            percent: Math.round((downloaded / totalSize) * 100),
                            fileName,
                        });
                    }
                });

                res.on('end', async () => {
                    writeStream.close();

                    if (abortController.aborted) {
                        try {
                            await fs.unlink(tempPath);
                        } catch {
                            /* ignore */
                        }
                        activeDownloads.delete(fileName);
                        resolve({ success: false, error: 'Download cancelled.' });
                        return;
                    }

                    try {
                        await fs.rename(tempPath, filePath);
                        activeDownloads.delete(fileName);
                        resolve({ success: true, filePath });
                    } catch (err) {
                        activeDownloads.delete(fileName);
                        resolve({ success: false, error: `Failed to save file: ${(err as Error).message}` });
                    }
                });

                res.on('error', async (err) => {
                    writeStream.close();
                    try {
                        await fs.unlink(tempPath);
                    } catch {
                        /* ignore */
                    }
                    activeDownloads.delete(fileName);
                    resolve({ success: false, error: `Download error: ${err.message}` });
                });
            });

            req.on('error', async (err) => {
                try {
                    await fs.unlink(tempPath);
                } catch {
                    /* ignore */
                }
                activeDownloads.delete(fileName);
                resolve({ success: false, error: `Network error: ${err.message}` });
            });

            req.end();
        }

        doRequest(url);
    });
}

async function cancelDownload(fileName: string): Promise<{ success: boolean; error?: string }> {
    const download = activeDownloads.get(fileName);
    if (!download) {
        return { success: false, error: 'No active download found for this file.' };
    }

    download.abortController.aborted = true;

    try {
        await fs.unlink(download.tempPath);
    } catch {
        /* ignore */
    }

    activeDownloads.delete(fileName);
    return { success: true };
}

function getActiveDownloads(): string[] {
    return Array.from(activeDownloads.keys());
}

export function register(ipc: IpcMain, getMainWindow: () => BrowserWindow | null): void {
    ipc.handle('hf:search', async (_event, query: string) => {
        if (typeof query !== 'string') return { success: false, error: 'Invalid query' };
        return searchModels(query);
    });

    ipc.handle('hf:listFiles', async (_event, repoId: string) => {
        if (typeof repoId !== 'string') return { success: false, error: 'Invalid repoId' };
        return listRepoFiles(repoId);
    });

    ipc.handle('hf:download', async (_event, url: string, fileName: string) => {
        if (typeof url !== 'string' || typeof fileName !== 'string')
            return { success: false, error: 'Invalid arguments' };
        return downloadModel(url, fileName, (progress) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) win.webContents.send('hf:downloadProgress', progress);
        });
    });

    ipc.handle('hf:cancelDownload', async (_event, fileName: string) => {
        if (typeof fileName !== 'string') return { success: false, error: 'Invalid fileName' };
        return cancelDownload(fileName);
    });

    ipc.handle('hf:getActiveDownloads', async () => ({
        success: true,
        downloads: getActiveDownloads(),
    }));
}
