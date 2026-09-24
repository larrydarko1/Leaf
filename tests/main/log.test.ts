import { describe, it, expect, vi, beforeEach } from 'vitest';

import { log } from '@/main/lib/logger';
import { register } from '@/main/services/log';

type Listener = (event: unknown, ...args: unknown[]) => void;

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function registered(): Record<string, Listener> {
    const listeners: Record<string, Listener> = {};
    register({
        on: (channel: string, fn: Listener) => {
            listeners[channel] = fn;
        },
    } as never);
    return listeners;
}

describe('log service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers one listener per level', () => {
        expect(Object.keys(registered()).sort()).toEqual(['log:debug', 'log:error', 'log:info', 'log:warn']);
    });

    it.each(['error', 'warn', 'info', 'debug'] as const)('writes a valid entry at %s', (level) => {
        const err = new Error('boom');
        registered()[`log:${level}`]!({}, { message: 'Failed to save:', details: [err] });
        expect(log[level]).toHaveBeenCalledWith('Failed to save:', err);
    });

    it('writes a message with no details on its own', () => {
        registered()['log:info']!({}, { message: 'ready', details: [] });
        expect(log.info).toHaveBeenCalledWith('ready');
    });

    it.each([
        ['a bare string', 'just a string'],
        ['a non-string message', { message: 42, details: [] }],
        ['details that are not a list', { message: 'x', details: 'y' }],
        ['nothing', undefined],
    ])('discards %s, and says so at warn', (_label, entry) => {
        registered()['log:error']!({}, entry);
        expect(log.error).not.toHaveBeenCalled();
        expect(log.warn).toHaveBeenCalledWith(
            'Discarded a malformed log entry from the renderer',
            expect.objectContaining({ level: 'error' }),
        );
    });
});
