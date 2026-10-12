import type { IpcErrorCode } from '@/schemas/errors';

type Translate = (key: string) => string;

/** The sentence a user reads for a failed IPC call, in the active locale. */
export function formatIpcError(t: Translate, code: IpcErrorCode | undefined): string {
    switch (code) {
        case 'INVALID_ARGUMENTS':
            return t('errors.invalid_arguments');
        case 'NO_WINDOW':
            return t('errors.no_window');
        case 'NO_VAULT':
            return t('errors.no_vault');
        case 'ACCESS_DENIED':
            return t('errors.access_denied');
        case 'INVALID_NAME':
            return t('errors.invalid_name');
        case 'NOT_FOUND':
            return t('errors.not_found');
        case 'ALREADY_EXISTS':
            return t('errors.already_exists');
        case 'MOVE_INTO_SELF':
            return t('errors.move_into_self');
        case 'DISK_FULL':
            return t('errors.disk_full');
        case 'MODEL_NOT_LOADED':
            return t('errors.model_not_loaded');
        case 'BUSY':
            return t('errors.busy');
        case 'INVALID_STATE':
            return t('errors.invalid_state');
        case 'UNKNOWN':
        case undefined:
            return t('errors.unknown');
    }
}
