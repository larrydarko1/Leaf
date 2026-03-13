// Agent Service - Manages AI file editing with version control (backup/restore)
// This runs in the Electron main process and handles:
//   - Reading files for AI context
//   - Proposing edits (backup original → write new content)
//   - Approving edits (delete backup)
//   - Rejecting edits (restore from backup)

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const os = require('os');

// In-memory registry of pending edits
// Map<editId, { filePath, backupPath, originalContent, newContent, timestamp }>
const pendingEdits = new Map();

// Backup directory inside system temp
const BACKUP_DIR = path.join(os.tmpdir(), 'leaf-agent-backups');

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create agent backup directory:', err);
    }
}

/**
 * Generate a unique edit ID
 */
function generateEditId() {
    return crypto.randomUUID();
}

/**
 * Read a file for the agent (scoped to workspace for security)
 * @param {string} filePath - Absolute path to the file
 * @param {string} workspacePath - The workspace root path (for security scoping)
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
async function readFileForAgent(filePath, workspacePath) {
    try {
        // Security: ensure the file is within the workspace
        const resolvedFile = path.resolve(filePath);
        const resolvedWorkspace = path.resolve(workspacePath);
        if (!resolvedFile.startsWith(resolvedWorkspace + path.sep) && resolvedFile !== resolvedWorkspace) {
            return { success: false, error: 'Access denied: file is outside the workspace.' };
        }

        // Check file exists
        if (!fsSync.existsSync(resolvedFile)) {
            return { success: false, error: `File not found: ${filePath}` };
        }

        const content = await fs.readFile(resolvedFile, 'utf-8');
        return { success: true, content, filePath: resolvedFile };
    } catch (error) {
        console.error('Agent readFile error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Propose an edit: back up the original file and write new content.
 * The edit is "pending" until the user approves or rejects it.
 * @param {string} filePath - Absolute path to the file
 * @param {string} newContent - The new file content proposed by the AI
 * @param {string} workspacePath - The workspace root path
 * @returns {{ success: boolean, editId?: string, error?: string }}
 */
async function proposeEdit(filePath, newContent, workspacePath) {
    try {
        const resolvedFile = path.resolve(filePath);
        const resolvedWorkspace = path.resolve(workspacePath);

        // Security: ensure the file is within the workspace
        if (!resolvedFile.startsWith(resolvedWorkspace + path.sep) && resolvedFile !== resolvedWorkspace) {
            return { success: false, error: 'Access denied: file is outside the workspace.' };
        }

        await ensureBackupDir();

        // Read original content (file may not exist yet for new files)
        let originalContent = '';
        let isNewFile = false;
        try {
            originalContent = await fs.readFile(resolvedFile, 'utf-8');
        } catch {
            isNewFile = true;
        }

        // Create backup
        const editId = generateEditId();
        const backupPath = path.join(BACKUP_DIR, `${editId}.bak`);

        // Save original content to backup (even if empty for new files)
        await fs.writeFile(backupPath, originalContent, 'utf-8');

        // Write the new content to the file
        // Ensure parent directory exists (for new files)
        const parentDir = path.dirname(resolvedFile);
        await fs.mkdir(parentDir, { recursive: true });
        await fs.writeFile(resolvedFile, newContent, 'utf-8');

        // Register pending edit
        const editRecord = {
            editId,
            filePath: resolvedFile,
            relativePath: path.relative(resolvedWorkspace, resolvedFile),
            backupPath,
            originalContent,
            newContent,
            isNewFile,
            timestamp: new Date().toISOString()
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
            isNewFile
        };
    } catch (error) {
        console.error('Agent proposeEdit error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Approve a pending edit: the new content stays, backup is removed.
 * @param {string} editId
 * @returns {{ success: boolean, error?: string }}
 */
async function approveEdit(editId) {
    try {
        const edit = pendingEdits.get(editId);
        if (!edit) {
            return { success: false, error: `Edit ${editId} not found or already resolved.` };
        }

        // Remove backup file
        try {
            await fs.unlink(edit.backupPath);
        } catch {
            // Backup may already be removed
        }

        pendingEdits.delete(editId);
        console.log(`Agent: approved edit ${editId} for ${edit.relativePath}`);
        return { success: true };
    } catch (error) {
        console.error('Agent approveEdit error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a pending edit: restore original content from backup.
 * @param {string} editId
 * @returns {{ success: boolean, error?: string }}
 */
async function rejectEdit(editId) {
    try {
        const edit = pendingEdits.get(editId);
        if (!edit) {
            return { success: false, error: `Edit ${editId} not found or already resolved.` };
        }

        // Restore original content from backup
        const backupContent = await fs.readFile(edit.backupPath, 'utf-8');

        if (edit.isNewFile && backupContent === '') {
            // If it was a new file, delete it
            try {
                await fs.unlink(edit.filePath);
            } catch {
                // File may already be removed
            }
        } else {
            // Restore the original content
            await fs.writeFile(edit.filePath, backupContent, 'utf-8');
        }

        // Remove backup file
        try {
            await fs.unlink(edit.backupPath);
        } catch {
            // Already removed
        }

        pendingEdits.delete(editId);
        console.log(`Agent: rejected edit ${editId} for ${edit.relativePath} — reverted`);
        return { success: true };
    } catch (error) {
        console.error('Agent rejectEdit error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all pending edits
 * @returns {{ success: boolean, edits: Array }}
 */
function getPendingEdits() {
    const edits = [];
    for (const [id, edit] of pendingEdits) {
        edits.push({
            editId: id,
            filePath: edit.filePath,
            relativePath: edit.relativePath,
            isNewFile: edit.isNewFile,
            timestamp: edit.timestamp
        });
    }
    return { success: true, edits };
}

/**
 * Clean up all pending edits (restore all, used on shutdown)
 */
async function cleanupAllPendingEdits() {
    for (const [editId] of pendingEdits) {
        try {
            await rejectEdit(editId);
        } catch (err) {
            console.error(`Failed to cleanup edit ${editId}:`, err);
        }
    }
}

/**
 * Wire up all agent IPC handlers.
 * @param {Electron.IpcMain} ipc
 */
function register(ipc) {
    ipc.handle('agent:readFile', async (event, filePath, workspacePath) => {
        if (typeof filePath !== 'string' || typeof workspacePath !== 'string') return { success: false, error: 'Invalid arguments' };
        return readFileForAgent(filePath, workspacePath);
    });

    ipc.handle('agent:proposeEdit', async (event, filePath, newContent, workspacePath) => {
        if (typeof filePath !== 'string' || typeof newContent !== 'string' || typeof workspacePath !== 'string') return { success: false, error: 'Invalid arguments' };
        return proposeEdit(filePath, newContent, workspacePath);
    });

    ipc.handle('agent:approveEdit', async (event, editId) => {
        if (typeof editId !== 'string') return { success: false, error: 'Invalid editId' };
        return approveEdit(editId);
    });

    ipc.handle('agent:rejectEdit', async (event, editId) => {
        if (typeof editId !== 'string') return { success: false, error: 'Invalid editId' };
        return rejectEdit(editId);
    });

    ipc.handle('agent:getPendingEdits', async () => getPendingEdits());
}

module.exports = {
    register,
    readFileForAgent,
    proposeEdit,
    approveEdit,
    rejectEdit,
    getPendingEdits,
    cleanupAllPendingEdits
};
