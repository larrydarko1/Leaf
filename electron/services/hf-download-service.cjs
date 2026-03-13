// Hugging Face Model Download Service
// Allows searching and downloading GGUF models directly from Hugging Face
// into the local ~/leaf-models/ directory.

const https = require('https');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');

const DEFAULT_MODELS_DIR = path.join(os.homedir(), 'leaf-models');

// Track active downloads
const activeDownloads = new Map();

/**
 * Make an HTTPS GET request to Hugging Face API and return parsed JSON
 */
function hfApiGet(apiPath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'huggingface.co',
            path: apiPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Leaf-App/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
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

/**
 * Search Hugging Face for GGUF models
 * @param {string} query - Search query
 * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
 */
async function searchModels(query) {
    try {
        const searchQuery = query ? `${query} gguf` : 'gguf';
        const apiPath = `/api/models?search=${encodeURIComponent(searchQuery)}&filter=gguf&sort=downloads&direction=-1&limit=20`;
        const models = await hfApiGet(apiPath);

        const results = models.map(m => ({
            id: m.modelId || m.id,
            author: m.author || m.modelId?.split('/')[0] || '',
            name: m.modelId?.split('/').pop() || m.id,
            downloads: m.downloads || 0,
            likes: m.likes || 0,
            tags: m.tags || [],
            lastModified: m.lastModified || ''
        }));

        return { success: true, results };
    } catch (err) {
        return { success: false, error: `Search failed: ${err.message}` };
    }
}

/**
 * Extract quantization type from a filename (e.g. "Q4_K_M", "Q8_0", "IQ2_XS", "BF16", "F16", "F32")
 */
function extractQuantType(filename) {
    // Match common quantization patterns in GGUF filenames
    const patterns = [
        /[_\-\.](IQ[1-4]_[A-Z]+)/i,
        /[_\-\.](Q[0-9]+_K_[A-Z]+)/i,
        /[_\-\.](Q[0-9]+_K)/i,
        /[_\-\.](Q[0-9]+_[0-9]+)/i,
        /[_\-\.](BF16)/i,
        /[_\-\.](F16)/i,
        /[_\-\.](F32)/i,
    ];

    for (const pat of patterns) {
        const match = filename.match(pat);
        if (match) return match[1].toUpperCase();
    }

    // Also check if quant type is a directory-level prefix (e.g. "Q4_1/model.gguf")
    const dirMatch = filename.match(/^(IQ[1-4]_[A-Z]+|Q[0-9]+_K_[A-Z]+|Q[0-9]+_K|Q[0-9]+_[0-9]+|BF16|F16|F32)\//i);
    if (dirMatch) return dirMatch[1].toUpperCase();

    return null;
}

/**
 * Estimate RAM requirement for a GGUF model based on file size
 * The actual RAM needed is roughly 1.1-1.2x the model file size (weights + KV cache overhead)
 */
function estimateRam(fileSize) {
    return Math.ceil(fileSize * 1.2);
}

/**
 * Get a difficulty/recommendation label for a model based on size
 */
function getModelTier(fileSize) {
    const gb = fileSize / (1024 * 1024 * 1024);
    if (gb <= 2) return { label: 'Small', color: 'green', description: 'Runs well on most machines (< 2 GB)' };
    if (gb <= 5) return { label: 'Medium', color: 'blue', description: 'Moderate resource use (2 – 5 GB)' };
    if (gb <= 10) return { label: 'Large', color: 'orange', description: 'Needs 16 GB+ RAM (5 – 10 GB)' };
    if (gb <= 30) return { label: 'Very Large', color: 'red', description: 'Needs 32 GB+ RAM (10 – 30 GB)' };
    return { label: 'Extreme', color: 'red', description: 'Needs 64 GB+ RAM (> 30 GB), may not run' };
}

/**
 * Recursively fetch tree listing for a HF repo path.
 * Returns flat array of file entries with { path, size }.
 */
async function fetchTree(repoId, treePath) {
    const apiPath = `/api/models/${repoId}/tree/main${treePath ? '/' + treePath : ''}`;
    const entries = await hfApiGet(apiPath);

    let files = [];
    for (const entry of entries) {
        if (entry.type === 'file') {
            const size = (entry.lfs && entry.lfs.size) ? entry.lfs.size : (entry.size || 0);
            files.push({ path: entry.path, size });
        } else if (entry.type === 'directory') {
            // Recurse into subdirectories
            const subFiles = await fetchTree(repoId, entry.path);
            files = files.concat(subFiles);
        }
    }
    return files;
}

/**
 * List available GGUF files in a Hugging Face repo with full metadata
 * @param {string} repoId - e.g. "TheBloke/Llama-2-7B-GGUF"
 * @returns {Promise<{success: boolean, files?: Array, modelInfo?: object, error?: string}>}
 */
async function listRepoFiles(repoId) {
    try {
        // Fetch model detail for metadata (architecture, context length, etc.)
        // Note: repoId contains "/" (e.g. "unsloth/Qwen3-Coder-Next-GGUF") — do NOT encodeURIComponent it
        const [modelData, treeFiles] = await Promise.all([
            hfApiGet(`/api/models/${repoId}`),
            fetchTree(repoId, '')
        ]);

        // Extract GGUF metadata from model info
        const ggufMeta = modelData.gguf || {};
        const architecture = ggufMeta.architecture || null;
        const contextLength = ggufMeta.context_length || null;
        const totalParamSize = ggufMeta.total || null;

        // Filter tree files for .gguf only
        const ggufTreeFiles = treeFiles.filter(f => f.path.endsWith('.gguf'));

        if (ggufTreeFiles.length === 0) {
            return {
                success: true,
                files: [],
                modelInfo: { architecture, contextLength, totalParamSize },
                repoId,
                repoName: modelData.modelId || repoId
            };
        }

        // Detect sharded files and group them
        // Sharded pattern: *-00001-of-00003.gguf, *-00002-of-00003.gguf, etc.
        const shardPattern = /^(.+)-(\d{5})-of-(\d{5})\.gguf$/;
        const shardGroups = new Map(); // baseKey -> { files: [], totalShards: number }
        const standaloneFiles = [];

        for (const f of ggufTreeFiles) {
            const fileName = f.path.split('/').pop();
            const match = fileName.match(shardPattern);
            if (match) {
                const baseName = match[1];
                // Use directory prefix + baseName as group key
                const dir = f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '';
                const groupKey = dir ? `${dir}/${baseName}` : baseName;
                if (!shardGroups.has(groupKey)) {
                    shardGroups.set(groupKey, { files: [], totalShards: parseInt(match[3], 10), baseName, dir });
                }
                shardGroups.get(groupKey).files.push(f);
            } else {
                standaloneFiles.push(f);
            }
        }

        const resultFiles = [];

        // Process standalone files
        for (const f of standaloneFiles) {
            const fileName = f.path.split('/').pop();
            const quantType = extractQuantType(f.path);
            const tier = getModelTier(f.size);

            resultFiles.push({
                name: fileName,
                path: f.path,
                size: f.size,
                sizeFormatted: formatFileSize(f.size),
                downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.path}`,
                quantType,
                estimatedRam: estimateRam(f.size),
                estimatedRamFormatted: formatFileSize(estimateRam(f.size)),
                tier,
                isSharded: false,
                shardCount: 1,
                shardFiles: null,
                architecture,
                contextLength
            });
        }

        // Process shard groups
        for (const [groupKey, group] of shardGroups) {
            const totalSize = group.files.reduce((sum, f) => sum + f.size, 0);
            const quantType = extractQuantType(groupKey);
            const tier = getModelTier(totalSize);
            const displayName = `${group.baseName}.gguf (${group.files.length} parts)`;

            // Build shard download info
            const shardFiles = group.files
                .sort((a, b) => a.path.localeCompare(b.path))
                .map(f => ({
                    name: f.path.split('/').pop(),
                    path: f.path,
                    size: f.size,
                    sizeFormatted: formatFileSize(f.size),
                    downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.path}`
                }));

            resultFiles.push({
                name: displayName,
                path: group.dir ? `${group.dir}/${group.baseName}.gguf` : `${group.baseName}.gguf`,
                size: totalSize,
                sizeFormatted: formatFileSize(totalSize),
                downloadUrl: shardFiles[0].downloadUrl, // first shard for single-click
                quantType,
                estimatedRam: estimateRam(totalSize),
                estimatedRamFormatted: formatFileSize(estimateRam(totalSize)),
                tier,
                isSharded: true,
                shardCount: group.files.length,
                shardFiles,
                architecture,
                contextLength
            });
        }

        // Sort: by quantization quality descending (larger quant number = better quality but bigger)
        // Group by quant type, then by size ascending within each group
        resultFiles.sort((a, b) => {
            // Sort by size ascending (smallest first — most user-friendly)
            return a.size - b.size;
        });

        return {
            success: true,
            files: resultFiles,
            modelInfo: { architecture, contextLength, totalParamSize, totalParamSizeFormatted: formatFileSize(totalParamSize || 0) },
            repoId,
            repoName: modelData.modelId || repoId
        };
    } catch (err) {
        return { success: false, error: `Failed to list files: ${err.message}` };
    }
}

/**
 * Download a GGUF file from Hugging Face
 * @param {string} url - Direct download URL
 * @param {string} fileName - Target file name
 * @param {function} onProgress - Callback with {downloaded, total, percent}
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function downloadModel(url, fileName, onProgress) {
    // Ensure models directory exists
    await fsPromises.mkdir(DEFAULT_MODELS_DIR, { recursive: true });

    const filePath = path.join(DEFAULT_MODELS_DIR, fileName);
    const tempPath = filePath + '.downloading';

    // Check if already downloaded
    try {
        const existing = await fsPromises.stat(filePath);
        if (existing.size > 0) {
            return { success: false, error: 'Model file already exists. Delete it first to re-download.' };
        }
    } catch {
        // File doesn't exist — good
    }

    // Check if already downloading
    if (activeDownloads.has(fileName)) {
        return { success: false, error: 'This model is already being downloaded.' };
    }

    const downloadId = fileName;
    const abortController = { aborted: false };
    activeDownloads.set(downloadId, { abortController, filePath, tempPath });

    return new Promise((resolve) => {
        function doRequest(requestUrl) {
            const urlObj = new URL(requestUrl);

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Leaf-App/1.0'
                }
            };

            const req = https.request(options, (res) => {
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    doRequest(res.headers.location);
                    return;
                }

                if (res.statusCode !== 200) {
                    activeDownloads.delete(downloadId);
                    resolve({ success: false, error: `Download failed: HTTP ${res.statusCode}` });
                    return;
                }

                const totalSize = parseInt(res.headers['content-length'] || '0', 10);
                let downloaded = 0;

                const writeStream = fs.createWriteStream(tempPath);

                res.on('data', (chunk) => {
                    if (abortController.aborted) {
                        res.destroy();
                        writeStream.close();
                        return;
                    }

                    writeStream.write(chunk);
                    downloaded += chunk.length;

                    if (onProgress && totalSize > 0) {
                        onProgress({
                            downloaded,
                            total: totalSize,
                            percent: Math.round((downloaded / totalSize) * 100),
                            fileName
                        });
                    }
                });

                res.on('end', async () => {
                    writeStream.close();

                    if (abortController.aborted) {
                        // Clean up temp file
                        try { await fsPromises.unlink(tempPath); } catch { }
                        activeDownloads.delete(downloadId);
                        resolve({ success: false, error: 'Download cancelled.' });
                        return;
                    }

                    // Rename temp file to final name
                    try {
                        await fsPromises.rename(tempPath, filePath);
                        activeDownloads.delete(downloadId);
                        resolve({ success: true, filePath });
                    } catch (err) {
                        activeDownloads.delete(downloadId);
                        resolve({ success: false, error: `Failed to save file: ${err.message}` });
                    }
                });

                res.on('error', async (err) => {
                    writeStream.close();
                    try { await fsPromises.unlink(tempPath); } catch { }
                    activeDownloads.delete(downloadId);
                    resolve({ success: false, error: `Download error: ${err.message}` });
                });
            });

            req.on('error', async (err) => {
                try { await fsPromises.unlink(tempPath); } catch { }
                activeDownloads.delete(downloadId);
                resolve({ success: false, error: `Network error: ${err.message}` });
            });

            req.end();
        }

        doRequest(url);
    });
}

/**
 * Cancel an active download
 * @param {string} fileName - The file name being downloaded
 */
async function cancelDownload(fileName) {
    const download = activeDownloads.get(fileName);
    if (!download) {
        return { success: false, error: 'No active download found for this file.' };
    }

    download.abortController.aborted = true;

    // Clean up temp file
    try {
        await fsPromises.unlink(download.tempPath);
    } catch { }

    activeDownloads.delete(fileName);
    return { success: true };
}

/**
 * Get list of active downloads
 */
function getActiveDownloads() {
    return Array.from(activeDownloads.keys());
}

// Utility: format file size
function formatFileSize(bytes) {
    if (bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Wire up all Hugging Face download IPC handlers.
 * @param {Electron.IpcMain} ipc
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function register(ipc, getMainWindow) {
    ipc.handle('hf:search', async (event, query) => {
        if (typeof query !== 'string') return { success: false, error: 'Invalid query' };
        return searchModels(query);
    });

    ipc.handle('hf:listFiles', async (event, repoId) => {
        if (typeof repoId !== 'string') return { success: false, error: 'Invalid repoId' };
        return listRepoFiles(repoId);
    });

    ipc.handle('hf:download', async (event, url, fileName) => {
        if (typeof url !== 'string' || typeof fileName !== 'string') return { success: false, error: 'Invalid arguments' };
        return downloadModel(url, fileName, (progress) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) win.webContents.send('hf:downloadProgress', progress);
        });
    });

    ipc.handle('hf:cancelDownload', async (event, fileName) => {
        if (typeof fileName !== 'string') return { success: false, error: 'Invalid fileName' };
        return cancelDownload(fileName);
    });

    ipc.handle('hf:getActiveDownloads', async () => ({
        success: true,
        downloads: getActiveDownloads(),
    }));
}

module.exports = {
    register,
    searchModels,
    listRepoFiles,
    downloadModel,
    cancelDownload,
    getActiveDownloads,
    DEFAULT_MODELS_DIR
};
