export type HfSortOption = 'downloads' | 'likes' | 'lastModified' | 'trending';

export type HfSearchResult = {
    id: string;
    author: string;
    name: string;
    downloads: number;
    likes: number;
    tags: string[];
    lastModified: string;
    architecture: string | null;
    parameterCount: string | null;
};

export type HfSearchResponse = {
    success: boolean;
    results?: HfSearchResult[];
    hasMore?: boolean;
    error?: string;
};

export type HfModelTier = {
    label: 'Small' | 'Medium' | 'Large' | 'Very Large' | 'Extreme';
    color: 'green' | 'blue' | 'orange' | 'red';
    description: string;
};

export type HfShardFile = {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
};

export type HfRepoFile = {
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
};

export type HfModelInfo = {
    architecture: string | null;
    contextLength: number | null;
    totalParamSize: number | null;
    totalParamSizeFormatted: string;
};

export type HfListFilesResponse = {
    success: boolean;
    files?: HfRepoFile[];
    modelInfo?: HfModelInfo;
    repoId?: string;
    repoName?: string;
    error?: string;
};

export type HfDownloadProgress = {
    downloaded: number;
    total: number;
    percent: number;
    fileName: string;
};

export type HfDownloadResult = {
    success: boolean;
    filePath?: string;
    error?: string;
};
