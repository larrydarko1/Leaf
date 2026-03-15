// Hugging Face model download types
export interface HfSearchResult {
    id: string;
    author: string;
    name: string;
    downloads: number;
    likes: number;
    tags: string[];
    lastModified: string;
}

export interface HfSearchResponse {
    success: boolean;
    results?: HfSearchResult[];
    error?: string;
}

export interface HfModelTier {
    label: string; // 'Small' | 'Medium' | 'Large' | 'Very Large' | 'Extreme'
    color: string; // 'green' | 'blue' | 'orange' | 'red'
    description: string;
}

export interface HfShardFile {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
}

export interface HfRepoFile {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
    quantType: string | null;
    estimatedRam: number;
    estimatedRamFormatted: string;
    tier: HfModelTier;
    isSharded: boolean;
    shardCount: number;
    shardFiles: HfShardFile[] | null;
    architecture: string | null;
    contextLength: number | null;
}

export interface HfModelInfo {
    architecture: string | null;
    contextLength: number | null;
    totalParamSize: number | null;
    totalParamSizeFormatted: string;
}

export interface HfListFilesResponse {
    success: boolean;
    files?: HfRepoFile[];
    modelInfo?: HfModelInfo;
    repoId?: string;
    repoName?: string;
    error?: string;
}

export interface HfDownloadProgress {
    downloaded: number;
    total: number;
    percent: number;
    fileName: string;
}

export interface HfDownloadResult {
    success: boolean;
    filePath?: string;
    error?: string;
}
