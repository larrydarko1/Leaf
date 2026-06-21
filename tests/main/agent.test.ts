import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('electron', () => ({}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { register, cleanupAllPendingEdits } from '@/main/services/agent';

let workspace: string;
let handlers: Record<string, (...args: unknown[]) => unknown>;

function makeIpc() {
    const h: Record<string, (...args: unknown[]) => unknown> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            h[ch] = fn;
        }),
    };
    return { ipc, handlers: h };
}

beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-agent-ws-'));
    const r = makeIpc();
    handlers = r.handlers;
    register(r.ipc as never);
});

afterEach(async () => {
    await cleanupAllPendingEdits();
    fs.rmSync(workspace, { recursive: true, force: true });
});

// ── cleanupAllPendingEdits ────────────────────────────────────────────────────

describe('cleanupAllPendingEdits', () => {
    it('resolves without throwing when no edits are pending', async () => {
        await expect(cleanupAllPendingEdits()).resolves.toBeUndefined();
    });

    it('reverts all pending edits on cleanup', async () => {
        const filePath = path.join(workspace, 'dirty.md');
        fs.writeFileSync(filePath, 'original');
        const proposed = (await handlers['agent:proposeEdit']?.({}, filePath, 'changed', workspace)) as {
            success: boolean;
            editId: string;
        };
        expect(proposed.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('changed');

        await cleanupAllPendingEdits();
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('original');
    });
});

// ── agent:readFile ────────────────────────────────────────────────────────────

describe('agent:readFile', () => {
    it('returns failure for non-string arguments', async () => {
        const result = (await handlers['agent:readFile']?.({}, 123, workspace)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when the file does not exist', async () => {
        const filePath = path.join(workspace, 'missing.md');
        const result = (await handlers['agent:readFile']?.({}, filePath, workspace)) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('returns failure for path traversal outside workspace', async () => {
        const result = (await handlers['agent:readFile']?.({}, '/etc/passwd', workspace)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('reads a file inside the workspace', async () => {
        const filePath = path.join(workspace, 'note.md');
        fs.writeFileSync(filePath, '# Hello');
        const result = (await handlers['agent:readFile']?.({}, filePath, workspace)) as {
            success: boolean;
            content: string;
            filePath: string;
        };
        expect(result.success).toBe(true);
        expect(result.content).toBe('# Hello');
        expect(result.filePath).toBe(filePath);
    });
});

// ── agent:proposeEdit ─────────────────────────────────────────────────────────

describe('agent:proposeEdit', () => {
    it('returns failure for non-string arguments', async () => {
        const result = (await handlers['agent:proposeEdit']?.({}, 123, 'content', workspace)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for path traversal outside workspace', async () => {
        const result = (await handlers['agent:proposeEdit']?.({}, '/etc/passwd', 'content', workspace)) as {
            success: boolean;
        };
        expect(result.success).toBe(false);
    });

    it('proposes an edit to an existing file and preserves original content', async () => {
        const filePath = path.join(workspace, 'doc.md');
        fs.writeFileSync(filePath, 'original');
        const result = (await handlers['agent:proposeEdit']?.({}, filePath, 'new content', workspace)) as {
            success: boolean;
            editId: string;
            originalContent: string;
            newContent: string;
            isNewFile: boolean;
            relativePath: string;
        };
        expect(result.success).toBe(true);
        expect(result.editId).toBeTruthy();
        expect(result.originalContent).toBe('original');
        expect(result.newContent).toBe('new content');
        expect(result.isNewFile).toBe(false);
        expect(result.relativePath).toBe('doc.md');
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
    });

    it('marks isNewFile=true when the target file did not exist', async () => {
        const filePath = path.join(workspace, 'new-note.md');
        const result = (await handlers['agent:proposeEdit']?.({}, filePath, 'hello', workspace)) as {
            success: boolean;
            isNewFile: boolean;
        };
        expect(result.success).toBe(true);
        expect(result.isNewFile).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
    });

    it('creates parent directories that do not exist yet', async () => {
        const filePath = path.join(workspace, 'subdir', 'new.md');
        const result = (await handlers['agent:proposeEdit']?.({}, filePath, 'content', workspace)) as {
            success: boolean;
        };
        expect(result.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
    });
});

// ── agent:approveEdit ─────────────────────────────────────────────────────────

describe('agent:approveEdit', () => {
    it('returns failure for non-string editId', async () => {
        const result = (await handlers['agent:approveEdit']?.({}, 123)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for an unknown editId', async () => {
        const result = (await handlers['agent:approveEdit']?.({}, 'nonexistent-id')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('approves an edit and removes it from pending edits', async () => {
        const filePath = path.join(workspace, 'file.md');
        fs.writeFileSync(filePath, 'v1');
        const proposed = (await handlers['agent:proposeEdit']?.({}, filePath, 'v2', workspace)) as {
            success: boolean;
            editId: string;
        };

        const approved = (await handlers['agent:approveEdit']?.({}, proposed.editId)) as { success: boolean };
        expect(approved.success).toBe(true);

        const pending = handlers['agent:getPendingEdits']?.() as { success: boolean; edits: unknown[] };
        expect(pending.edits).toHaveLength(0);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('v2');
    });
});

// ── agent:rejectEdit ──────────────────────────────────────────────────────────

describe('agent:rejectEdit', () => {
    it('returns failure for non-string editId', async () => {
        const result = (await handlers['agent:rejectEdit']?.({}, 123)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure for an unknown editId', async () => {
        const result = (await handlers['agent:rejectEdit']?.({}, 'ghost')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('reverts the file to its original content', async () => {
        const filePath = path.join(workspace, 'revert.md');
        fs.writeFileSync(filePath, 'original content');
        const proposed = (await handlers['agent:proposeEdit']?.({}, filePath, 'changed', workspace)) as {
            editId: string;
        };

        const rejected = (await handlers['agent:rejectEdit']?.({}, proposed.editId)) as { success: boolean };
        expect(rejected.success).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('original content');
    });

    it('deletes the file when rejecting a newly created file', async () => {
        const filePath = path.join(workspace, 'new.md');
        const proposed = (await handlers['agent:proposeEdit']?.({}, filePath, 'content', workspace)) as {
            editId: string;
        };

        const rejected = (await handlers['agent:rejectEdit']?.({}, proposed.editId)) as { success: boolean };
        expect(rejected.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('removes the edit from pending edits after rejection', async () => {
        const filePath = path.join(workspace, 'remove.md');
        fs.writeFileSync(filePath, 'text');
        const proposed = (await handlers['agent:proposeEdit']?.({}, filePath, 'new', workspace)) as { editId: string };

        await handlers['agent:rejectEdit']?.({}, proposed.editId);
        const pending = handlers['agent:getPendingEdits']?.() as { edits: unknown[] };
        expect(pending.edits).toHaveLength(0);
    });
});

// ── agent:getPendingEdits ─────────────────────────────────────────────────────

describe('agent:getPendingEdits', () => {
    it('returns an empty list when no edits are pending', () => {
        const result = handlers['agent:getPendingEdits']?.() as { success: boolean; edits: unknown[] };
        expect(result.success).toBe(true);
        expect(result.edits).toHaveLength(0);
    });

    it('lists all pending edits with relative paths', async () => {
        const fileA = path.join(workspace, 'a.md');
        const fileB = path.join(workspace, 'b.md');
        fs.writeFileSync(fileA, 'a');
        fs.writeFileSync(fileB, 'b');
        await handlers['agent:proposeEdit']?.({}, fileA, 'a2', workspace);
        await handlers['agent:proposeEdit']?.({}, fileB, 'b2', workspace);

        const result = handlers['agent:getPendingEdits']?.() as { success: boolean; edits: { relativePath: string }[] };
        expect(result.success).toBe(true);
        expect(result.edits).toHaveLength(2);
        const relPaths = result.edits.map((e) => e.relativePath);
        expect(relPaths).toContain('a.md');
        expect(relPaths).toContain('b.md');
    });
});
