import { z } from 'zod';

import type { IpcMain } from '@/main/lib/ipc';

type Listener = (event: unknown, ...args: unknown[]) => unknown;

type FakeIpc = IpcMain & {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    emit(channel: string, ...args: unknown[]): void;
};

/** A handler's reply as the renderer reads it. Fields a reply lacks stay undefined; extra ones pass. */
const ReplySchema = z.looseObject({
    success: z.boolean(),
    error: z.string().optional(),
    content: z.unknown().optional(),
    path: z.unknown().optional(),
    newPath: z.unknown().optional(),
    root: z.unknown().optional(),
    dataUrl: z.unknown().optional(),
    bookmarks: z.unknown().optional(),
    updatedCount: z.unknown().optional(),
});

/** Stands in for ipcMain: keeps each registered handler and calls it the way a renderer `invoke` would. */
export function createFakeIpc(): FakeIpc {
    const handlers = new Map<string, Listener>();
    const listeners = new Map<string, Listener>();
    return {
        handle(channel, listener) {
            handlers.set(channel, listener);
        },
        on(channel, listener) {
            listeners.set(channel, listener);
        },
        async invoke(channel, ...args) {
            const listener = handlers.get(channel);
            if (listener === undefined) throw new Error(`No handler registered for '${channel}'`);
            return listener(null, ...args);
        },
        emit(channel, ...args) {
            const listener = listeners.get(channel);
            if (listener === undefined) throw new Error(`Nothing listens on '${channel}'`);
            listener(null, ...args);
        },
    };
}

export function readReply(value: unknown): z.infer<typeof ReplySchema> {
    return ReplySchema.parse(value);
}

/** `readReply`, with the fields a test goes on to use typed by `shape`. */
export function readReplyWith<Shape extends z.ZodRawShape>(value: unknown, shape: Shape) {
    return z.object({ success: z.boolean() }).extend(shape).parse(value);
}
