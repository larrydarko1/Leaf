/** The slice of ipcMain the services use; named IpcMain because that is the type the IPC gate reads. */
export type IpcMain = {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
};
