import { describe, it, expect } from 'vitest';

import { i18n } from '@/renderer/i18n';
import { formatIpcError } from '@/renderer/utils/ipcError';
import type { IpcErrorCode } from '@/schemas/errors';

const CODES: IpcErrorCode[] = [
    'INVALID_ARGUMENTS',
    'NO_WINDOW',
    'NO_VAULT',
    'ACCESS_DENIED',
    'INVALID_NAME',
    'NOT_FOUND',
    'ALREADY_EXISTS',
    'MOVE_INTO_SELF',
    'DISK_FULL',
    'MODEL_NOT_LOADED',
    'BUSY',
    'INVALID_STATE',
    'UNKNOWN',
];

describe('formatIpcError', () => {
    const { t } = i18n.global;

    it.each(CODES)('gives %s an English sentence of its own', (code) => {
        const sentence = formatIpcError(t, code);
        // vue-i18n answers a missing key with the key itself.
        expect(sentence).not.toMatch(/^errors\./);
        expect(sentence).toMatch(/\.$/);
    });

    it('gives every code a different sentence', () => {
        const sentences = new Set(CODES.map((code) => formatIpcError(t, code)));
        expect(sentences.size).toBe(CODES.length);
    });

    it('reads a missing code as an unknown failure', () => {
        expect(formatIpcError(t, undefined)).toBe(formatIpcError(t, 'UNKNOWN'));
    });
});
