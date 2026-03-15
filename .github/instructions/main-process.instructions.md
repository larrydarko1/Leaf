---
description: "Use when creating or editing Electron main process code, IPC handlers, or service modules. Covers security validation, atomic writes, and service patterns."
applyTo: "src/main/**"
---
# Main Process Guidelines

## IPC Service Pattern

Each service module in `src/main/services/` owns a domain of IPC handlers. Follow this pattern:

```ts
ipcMain.handle('channel:action', async (_event, arg1: string, arg2: string) => {
    // 1. Validate inputs (type checks)
    if (typeof arg1 !== 'string') return { success: false, error: 'Invalid argument' };

    // 2. Security boundary check (REQUIRED for any filesystem access)
    const resolved = assertInsideBoundary(arg1, vaultDir);

    // 3. Business logic
    // ...

    // 4. Return result object
    return { success: true, data: result };
});
```

## Security (mandatory)

- Call `assertInsideBoundary(targetPath, rootDir)` before ANY filesystem read/write — see `lib/validation.ts`
- Call `assertSafeFileName(name)` before using user-supplied filenames
- Never trust renderer input — always validate types and values

## Atomic Writes

For any file persistence (notes, conversations, settings), use write-then-rename:

```ts
const tmpPath = filePath + '.tmp';
await fs.promises.writeFile(tmpPath, data, 'utf-8');
await fs.promises.rename(tmpPath, filePath);
```

This prevents data corruption if the process crashes mid-write.

## File Organization

- `services/` — IPC handler modules (one per domain: fs, ai, agent, conversation, etc.)
- `lib/` — Pure utilities shared across services (validation, paths, extensions, MIME types)
