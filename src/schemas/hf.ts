import { z } from 'zod';

export const HfSortOptionSchema = z.enum(['downloads', 'likes', 'lastModified', 'trending']);

export type HfSortOption = z.infer<typeof HfSortOptionSchema>;

export const HfSearchResultSchema = z.object({
    id: z.string(),
    author: z.string(),
    name: z.string(),
    downloads: z.number(),
    likes: z.number(),
    tags: z.array(z.string()),
    lastModified: z.string(),
    architecture: z.string().nullable(),
    parameterCount: z.string().nullable(),
});

export type HfSearchResult = z.infer<typeof HfSearchResultSchema>;

export const HfSearchResponseSchema = z.object({
    success: z.boolean(),
    results: z.array(HfSearchResultSchema).optional(),
    hasMore: z.boolean().optional(),
    error: z.string().optional(),
});

export type HfSearchResponse = z.infer<typeof HfSearchResponseSchema>;

export const HfModelTierSchema = z.object({
    label: z.enum(['Small', 'Medium', 'Large', 'Very Large', 'Extreme']),
    color: z.enum(['green', 'blue', 'orange', 'red']),
    description: z.string(),
});

export type HfModelTier = z.infer<typeof HfModelTierSchema>;

export const HfShardFileSchema = z.object({
    name: z.string(),
    path: z.string(),
    size: z.number(),
    sizeFormatted: z.string(),
    downloadUrl: z.string(),
});

export type HfShardFile = z.infer<typeof HfShardFileSchema>;

export const HfRepoFileSchema = z.object({
    name: z.string(),
    path: z.string(),
    size: z.number(),
    sizeFormatted: z.string(),
    downloadUrl: z.string(),
    quantType: z.string().nullable(),
    estimatedRam: z.number(),
    estimatedRamFormatted: z.string(),
    tier: HfModelTierSchema,
    isSharded: z.boolean(),
    shardCount: z.array(HfShardFileSchema).nullable(),
    architecture: z.string().nullable(),
    contextLength: z.number().nullable(),
});

export type HfRepoFile = z.infer<typeof HfRepoFileSchema>;

export const HfModelInfoSchema = z.object({
    architecture: z.string().nullable(),
    contextLength: z.number().nullable(),
    totalParamSize: z.number().nullable(),
    totalParamSizeFormatted: z.string(),
});

export type HfModelInfo = z.infer<typeof HfModelInfoSchema>;

export const HfListFilesResponseSchema = z.object({
    success: z.boolean(),
    files: z.array(HfRepoFileSchema).optional(),
    modelInfo: HfModelInfoSchema.optional(),
    repoId: z.string().optional(),
    repoName: z.string().optional(),
    error: z.string().optional(),
});

export type HfListFilesResponse = z.infer<typeof HfListFilesResponseSchema>;

export const HfDownloadProgressSchema = z.object({
    downloaded: z.number(),
    total: z.number(),
    percent: z.number(),
    fileName: z.string(),
});

export type HfDownloadProgress = z.infer<typeof HfDownloadProgressSchema>;

export const HfDownloadResultSchema = z.object({
    success: z.boolean(),
    filePath: z.string().optional(),
    error: z.string().optional(),
});

export type HfDownloadResult = z.infer<typeof HfDownloadResultSchema>;

export const HfDownloadEntrySchema = z.object({
    abortController: z.object({
        aborted: z.boolean(),
    }),
    filePath: z.string(),
    tempPath: z.string(),
});

export type HfDownloadEntry = z.infer<typeof HfDownloadEntrySchema>;

export const HfTreeFileSchema = z.object({
    path: z.string(),
    size: z.number(),
});

export type HfTreeFile = z.infer<typeof HfTreeFileSchema>;

export const HfProgressInfoSchema = z.object({
    downloaded: z.number(),
    total: z.number(),
    percent: z.number(),
    fileName: z.string(),
});

export type HfProgressInfo = z.infer<typeof HfProgressInfoSchema>;

export const SortOptionSchema = z.enum(['downloads', 'likes', 'lastModified', 'trending']);

export type SortOption = z.infer<typeof SortOptionSchema>;

export const HfRepoIdSchema = z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Invalid repo ID');

export const HfSearchArgsSchema = z.object({
    query: z.string(),
    sort: SortOptionSchema.catch('downloads'),
    offset: z.number().int().nonnegative().catch(0),
});

// HF API response shapes

export const HfGgufMetaSchema = z.object({
    total: z.number().optional(),
    architecture: z.string().optional(),
    contextLength: z.number().optional(),
});

export type HfGgufMeta = z.infer<typeof HfGgufMetaSchema>;

export const HfModelSchema = z.object({
    id: z.string().optional(),
    modelId: z.string().optional(),
    author: z.string().optional(),
    downloads: z.number().optional(),
    likes: z.number().optional(),
    tags: z.array(z.string()).optional(),
    lastModified: z.string().optional(),
    gguf: HfGgufMetaSchema.optional(),
});

export type HfModel = z.infer<typeof HfModelSchema>;

export const HfTreeEntryLfsSchema = z.object({
    size: z.number().optional(),
});

export type HfTreeEntryLfs = z.infer<typeof HfTreeEntryLfsSchema>;

export const HfTreeEntrySchema = z.object({
    type: z.enum(['file', 'directory']),
    path: z.string(),
    size: z.number().optional(),
    lfs: HfTreeEntryLfsSchema.optional(),
});

export type HfTreeEntry = z.infer<typeof HfTreeEntrySchema>;
