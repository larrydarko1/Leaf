/** Why an IPC call failed. The renderer translates it; the error itself stays in the main-process log. */
export type IpcErrorCode =
    | 'INVALID_ARGUMENTS'
    | 'NO_WINDOW'
    | 'NO_VAULT'
    | 'ACCESS_DENIED'
    | 'INVALID_NAME'
    | 'NOT_FOUND'
    | 'ALREADY_EXISTS'
    | 'MOVE_INTO_SELF'
    | 'DISK_FULL'
    | 'MODEL_NOT_LOADED'
    | 'BUSY'
    | 'INVALID_STATE'
    | 'UNKNOWN';
