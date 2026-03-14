// Agent Service - Manages AI file editing with version control (backup/restore)
// This runs in the Electron main process and handles:
//   - Reading files for AI context
//   - Proposing edits (backup original → write new content)
//   - Approving edits (delete backup)
//   - Rejecting edits (restore from backup)

import type { IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import os from 'os';

interface EditRecord {
    editId: string;
    filePath: string;
    relativePath: string;
    backupPath: string;
    originalContent: string;
    newContent: string;
    isNewFile: boolean;
    timestamp: string;
}

// In-memory registry of pending edits
const pendingEdits = new Map<string, EditRecord>();

// Backup directory inside system temp
const BACKUP_DIR = path.join(os.tmpdir(), 'leaf-agent-backups');

async function ensureBackupDir(): Promise<void> {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create agent backup directory:', err);
    }
}

function generateEditId(): string {
    return randomUUID();
}

async function readFileForAgent(filePath: string, workspacePath: string): Promise<{ success: boolean; content?: string; filePath?: string; error?: string }> {
    try {
        const resolvedFile = path.resolve(filePath);
        const resolvedWorkspace = path.resolve(workspacePath);
        if (!resolvedFile.startsWith(resolvedWorkspace + path.sep) && resolvedFile !== resolvedWorkspace) {
            return { success: false, error: 'Access denied: file is outside the workspace.' };
        }

        if (!existsSync(resolvedFile)) {
            return { success: false, error: `File not found: ${filePath}` };
        }

        const content = await fs.readFile(resolvedFile, 'utf-8');
        return { success: true, content, filePath: resolvedFile };
    } catch (error) {
        console.error('Agent readFile error:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function proposeEdit(filePath: string, newContent: string, workspacePath: string): Promise<{ success: boolean; editId?: string; filePath?: string; relativePath?: string; originalContent?: string; newContent?: string; isNewFile?: boolean; error?: string }> {
    try {
        const resolvedFile = path.resolve(filePath);
        const resolvedWorkspace = path.resolve(workspacePath);

        if (!resolvedFile.startsWith(resolvedWorkspace + path.sep) && resolvedFile !== resolvedWorkspace) {
            return { success: false, error: 'Access denied: file is outside the workspace.' };
        }

        await ensureBackupDir();

        let originalContent = '';
        let isNewFile = false;
        try {
            originalContent = await fs.readFile(resolvedFile, 'utf-8');
        } catch {
            isNewFile = true;
        }

        const editId = generateEditId();
        const backupPath = path.join(BACKUP_DIR, `${editId}.bak`);

        await fs.writeFile(backupPath, originalContent, 'utf-8');

        const parentDir = path.dirname(resolvedFile);
        await fs.mkdir(parentDir, { recursive: true });
        await fs.writeFile(resolvedFile, newContent, 'utf-8');

        const editRecord: EditRecord = {
            editId,
            filePath: resolvedFile,
            relativePath: path.relative(resolvedWorkspace, resolvedFile),
            backupPath,
            originalContent,
            newContent,
            isNewFile,
            timestamp: new Date().toISOString(),
        };
        pendingEdits.set(editId, editRecord);

        console.log(`Agent: proposed edit ${editId} for ${editRecord.relativePath}`);
        return {
            success: true,
            editId,
            filePath: resolvedFile,
            relativePath: editRecord.relativePath,
            originalContent,
            newContent,
            isNewFile,
        };
    } catch (error) {
        console.error('Agent proposeEdit error:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function approveEdit(editId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const edit = pendingEdits.get(editId);
        if (!edit) {
            return { success: false, error: `Edit ${editId} not found or already resolved.` };
        }

        try {
            await fs.unlink(edit.backupPath);
        } catch { /* backup may already be removed */ }

        pendingEdits.delete(editId);
        console.log(`Agent: approved edit ${editId} for ${edit.relativePath}`);
        return { success: true };
    } catch (error) {
        console.error('Agent approveEdit error:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function rejectEdit(editId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const edit = pendingEdits.get(editId);
        if (!edit) {
            return { success: false, error: `Edit ${editId} not found or already resolved.` };
        }

        const backupContent = await fs.readFile(edit.backupPath, 'utf-8');

        if (edit.isNewFile && backupContent === '') {
            try {
                await fs.unlink(edit.filePath);
            } catch { /* file may already be removed */ }
        } else {
            await fs.writeFile(edit.filePath, backupContent, 'utf-8');
        }

        try {
            await fs.unlink(edit.backupPath);
        } catch { /* already removed */ }

        pendingEdits.delete(editId);
        console.log(`Agent: rejected edit ${editId} for ${edit.relativePath} — reverted`);
        return { success: true };
    } catch (error) {
        console.error('Agent rejectEdit error:', error);
        return { success: false, error: (error as Error).message };
    }
}

function getPendingEdits(): { success: boolean; edits: object[] } {
    const edits = [];
    for (const [id, edit] of pendingEdits) {
        edits.push({
            editId: id,
            filePath: edit.filePath,
            relativePath: edit.relativePath,
            isNewFile: edit.isNewFile,
            timestamp: edit.timestamp,
        });
    }
    return { success: true, edits };
}

export async function cleanupAllPendingEdits(): Promise<void> {
    for (const [editId] of pendingEdits) {
        try {
            await rejectEdit(editId);
        } catch (err) {
            console.error(`Failed to cleanup edit ${editId}:`, err);
        }
    }
}

export function register(ipc: IpcMain): void {
    ipc.handle('agent:readFile', async (_event, filePath: string, workspacePath: string) => {
        if (typeof filePath !== 'string' || typeof workspacePath !== 'string') return { success: false, error: 'Invalid arguments' };
        return readFileForAgent(filePath, workspacePath);
    });

    ipc.handle('agent:proposeEdit', async (_event, filePath: string, newContent: string, workspacePath: string) => {
        if (typeof filePath !== 'string' || typeof newContent !== 'string' || typeof workspacePath !== 'string') return { success: false, error: 'Invalid arguments' };
        return proposeEdit(filePath, newContent, workspacePath);
    });

    ipc.handle('agent:approveEdit', async (_event, editId: string) => {
        if (typeof editId !== 'string') return { success: false, error: 'Invalid editId' };
        return approveEdit(editId);
    });

    ipc.handle('agent:rejectEdit', async (_event, editId: string) => {
        if (typeof editId !== 'string') return { success: false, error: 'Invalid editId' };
        return rejectEdit(editId);
    });

    ipc.handle('agent:getPendingEdits', async () => getPendingEdits());
}
