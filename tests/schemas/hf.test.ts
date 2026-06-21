import { describe, it, expect } from 'vitest';
import {
    HfSortOptionSchema,
    HfSearchResultSchema,
    HfSearchResponseSchema,
    HfModelTierSchema,
    HfShardFileSchema,
    HfRepoFileSchema,
    HfModelInfoSchema,
    HfListFilesResponseSchema,
    HfDownloadProgressSchema,
    HfDownloadResultSchema,
    HfDownloadEntrySchema,
    HfTreeFileSchema,
    HfProgressInfoSchema,
    SortOptionSchema,
    HfGgufMetaSchema,
    HfModelSchema,
    HfTreeEntryLfsSchema,
    HfTreeEntrySchema,
} from '@/schemas/hf';

const validTier = {
    label: 'Small' as const,
    color: 'green' as const,
    description: 'Under 4 GB',
};

const validShardFile = {
    name: 'shard-0.gguf',
    path: 'model/shard-0.gguf',
    size: 1024,
    sizeFormatted: '1 KB',
    downloadUrl: 'https://example.com/shard-0.gguf',
};

describe('HfSortOptionSchema', () => {
    it.each(['downloads', 'likes', 'lastModified', 'trending'] as const)('accepts "%s"', (value) => {
        expect(HfSortOptionSchema.parse(value)).toBe(value);
    });

    it('rejects invalid sort option', () => {
        expect(HfSortOptionSchema.safeParse('popular').success).toBe(false);
    });
});

describe('SortOptionSchema', () => {
    it('accepts all valid sort values', () => {
        expect(SortOptionSchema.parse('trending')).toBe('trending');
    });

    it('rejects invalid value', () => {
        expect(SortOptionSchema.safeParse('newest').success).toBe(false);
    });
});

describe('HfSearchResultSchema', () => {
    const valid = {
        id: 'org/model',
        author: 'org',
        name: 'model',
        downloads: 1000,
        likes: 50,
        tags: ['gguf', 'llama'],
        lastModified: '2024-01-01T00:00:00Z',
        architecture: 'llama',
        parameterCount: '7B',
    };

    it('parses a valid search result', () => {
        const result = HfSearchResultSchema.parse(valid);
        expect(result.id).toBe('org/model');
        expect(result.tags).toHaveLength(2);
    });

    it('accepts null architecture and parameterCount', () => {
        const result = HfSearchResultSchema.parse({ ...valid, architecture: null, parameterCount: null });
        expect(result.architecture).toBeNull();
        expect(result.parameterCount).toBeNull();
    });

    it('rejects missing required fields', () => {
        expect(HfSearchResultSchema.safeParse({ id: 'org/model' }).success).toBe(false);
    });

    it('rejects non-number downloads', () => {
        expect(HfSearchResultSchema.safeParse({ ...valid, downloads: '1000' }).success).toBe(false);
    });
});

describe('HfSearchResponseSchema', () => {
    it('parses a successful response', () => {
        const result = HfSearchResponseSchema.parse({
            success: true,
            results: [],
            hasMore: false,
        });
        expect(result.success).toBe(true);
    });

    it('parses an error response', () => {
        const result = HfSearchResponseSchema.parse({ success: false, error: 'timeout' });
        expect(result.error).toBe('timeout');
    });

    it('rejects missing success field', () => {
        expect(HfSearchResponseSchema.safeParse({ results: [] }).success).toBe(false);
    });
});

describe('HfModelTierSchema', () => {
    it.each(['Small', 'Medium', 'Large', 'Very Large', 'Extreme'] as const)('accepts label "%s"', (label) => {
        const result = HfModelTierSchema.parse({ ...validTier, label });
        expect(result.label).toBe(label);
    });

    it.each(['green', 'blue', 'orange', 'red'] as const)('accepts color "%s"', (color) => {
        const result = HfModelTierSchema.parse({ ...validTier, color });
        expect(result.color).toBe(color);
    });

    it('rejects invalid label', () => {
        expect(HfModelTierSchema.safeParse({ ...validTier, label: 'Tiny' }).success).toBe(false);
    });

    it('rejects invalid color', () => {
        expect(HfModelTierSchema.safeParse({ ...validTier, color: 'purple' }).success).toBe(false);
    });
});

describe('HfShardFileSchema', () => {
    it('parses valid shard file', () => {
        const result = HfShardFileSchema.parse(validShardFile);
        expect(result.name).toBe('shard-0.gguf');
    });

    it('rejects non-number size', () => {
        expect(HfShardFileSchema.safeParse({ ...validShardFile, size: '1024' }).success).toBe(false);
    });
});

describe('HfRepoFileSchema', () => {
    const valid = {
        name: 'model.gguf',
        path: 'model.gguf',
        size: 4096,
        sizeFormatted: '4 GB',
        downloadUrl: 'https://example.com/model.gguf',
        quantType: 'Q4_K_M',
        estimatedRam: 6000,
        estimatedRamFormatted: '6 GB',
        tier: validTier,
        isSharded: false,
        shardCount: null,
        architecture: 'llama',
        contextLength: 4096,
    };

    it('parses valid repo file', () => {
        const result = HfRepoFileSchema.parse(valid);
        expect(result.name).toBe('model.gguf');
        expect(result.tier.label).toBe('Small');
    });

    it('accepts null nullable fields', () => {
        const result = HfRepoFileSchema.parse({
            ...valid,
            quantType: null,
            shardCount: null,
            architecture: null,
            contextLength: null,
        });
        expect(result.quantType).toBeNull();
    });

    it('accepts shardCount as array of shard files', () => {
        const result = HfRepoFileSchema.parse({ ...valid, isSharded: true, shardCount: [validShardFile] });
        expect(result.shardCount).toHaveLength(1);
    });

    it('rejects missing tier', () => {
        const { tier: _tier, ...rest } = valid;
        expect(HfRepoFileSchema.safeParse(rest).success).toBe(false);
    });
});

describe('HfModelInfoSchema', () => {
    it('parses with all null fields', () => {
        const result = HfModelInfoSchema.parse({
            architecture: null,
            contextLength: null,
            totalParamSize: null,
            totalParamSizeFormatted: '',
        });
        expect(result.architecture).toBeNull();
    });

    it('parses with populated fields', () => {
        const result = HfModelInfoSchema.parse({
            architecture: 'llama',
            contextLength: 4096,
            totalParamSize: 7000000000,
            totalParamSizeFormatted: '7B',
        });
        expect(result.contextLength).toBe(4096);
    });
});

describe('HfListFilesResponseSchema', () => {
    it('parses a successful response', () => {
        const result = HfListFilesResponseSchema.parse({
            success: true,
            files: [],
            repoId: 'org/model',
            repoName: 'model',
        });
        expect(result.success).toBe(true);
    });

    it('parses an error response', () => {
        const result = HfListFilesResponseSchema.parse({ success: false, error: 'not found' });
        expect(result.error).toBe('not found');
    });
});

describe('HfDownloadProgressSchema', () => {
    it('parses valid progress', () => {
        const result = HfDownloadProgressSchema.parse({
            downloaded: 512,
            total: 1024,
            percent: 50,
            fileName: 'model.gguf',
        });
        expect(result.percent).toBe(50);
    });

    it('rejects non-number percent', () => {
        expect(
            HfDownloadProgressSchema.safeParse({ downloaded: 0, total: 0, percent: '50%', fileName: 'f' }).success,
        ).toBe(false);
    });
});

describe('HfDownloadResultSchema', () => {
    it('parses success', () => {
        const result = HfDownloadResultSchema.parse({ success: true, filePath: '/models/m.gguf' });
        expect(result.filePath).toBe('/models/m.gguf');
    });

    it('parses failure', () => {
        const result = HfDownloadResultSchema.parse({ success: false, error: 'cancelled' });
        expect(result.error).toBe('cancelled');
    });
});

describe('HfDownloadEntrySchema', () => {
    it('parses valid entry', () => {
        const result = HfDownloadEntrySchema.parse({
            abortController: { aborted: false },
            filePath: '/models/m.gguf',
            tempPath: '/tmp/m.gguf.tmp',
        });
        expect(result.abortController.aborted).toBe(false);
    });

    it('rejects missing abortController', () => {
        expect(HfDownloadEntrySchema.safeParse({ filePath: '/f', tempPath: '/t' }).success).toBe(false);
    });
});

describe('HfTreeFileSchema', () => {
    it('parses valid tree file', () => {
        const result = HfTreeFileSchema.parse({ path: 'model.gguf', size: 1024 });
        expect(result.size).toBe(1024);
    });

    it('rejects missing path', () => {
        expect(HfTreeFileSchema.safeParse({ size: 1024 }).success).toBe(false);
    });
});

describe('HfProgressInfoSchema', () => {
    it('parses valid progress info', () => {
        const result = HfProgressInfoSchema.parse({
            downloaded: 100,
            total: 200,
            percent: 50,
            fileName: 'f.gguf',
        });
        expect(result.downloaded).toBe(100);
    });
});

describe('HfGgufMetaSchema', () => {
    it('parses with all optional fields', () => {
        expect(() => HfGgufMetaSchema.parse({})).not.toThrow();
    });

    it('parses with all fields provided', () => {
        const result = HfGgufMetaSchema.parse({ total: 7e9, architecture: 'llama', contextLength: 4096 });
        expect(result.architecture).toBe('llama');
    });
});

describe('HfModelSchema', () => {
    it('parses with all optional fields absent', () => {
        expect(() => HfModelSchema.parse({})).not.toThrow();
    });

    it('parses with fields provided', () => {
        const result = HfModelSchema.parse({
            id: 'org/model',
            modelId: 'org/model',
            downloads: 500,
            tags: ['gguf'],
        });
        expect(result.downloads).toBe(500);
    });
});

describe('HfTreeEntryLfsSchema', () => {
    it('parses empty object', () => {
        expect(() => HfTreeEntryLfsSchema.parse({})).not.toThrow();
    });

    it('parses with size', () => {
        const result = HfTreeEntryLfsSchema.parse({ size: 2048 });
        expect(result.size).toBe(2048);
    });
});

describe('HfTreeEntrySchema', () => {
    it.each(['file', 'directory'] as const)('accepts type "%s"', (type) => {
        const result = HfTreeEntrySchema.parse({ type, path: 'some/path' });
        expect(result.type).toBe(type);
    });

    it('rejects invalid type', () => {
        expect(HfTreeEntrySchema.safeParse({ type: 'symlink', path: 'p' }).success).toBe(false);
    });

    it('rejects missing path', () => {
        expect(HfTreeEntrySchema.safeParse({ type: 'file' }).success).toBe(false);
    });
});
