/**
 * Application logger — thin wrapper over electron-log.
 *
 * Main process:  import log from './lib/logger'
 * Preload:       exposed via electronAPI.log.*
 * Renderer:      window.electronAPI.log.*
 *
 * Logs are written to rotating files in the OS-standard location:
 *   macOS  — ~/Library/Logs/Leaf/main.log
 *   Win    — %USERPROFILE%\AppData\Roaming\Leaf\logs\main.log
 *   Linux  — ~/.config/Leaf/logs/main.log
 */

import log from 'electron-log/main';

// Keep log files small — 1 MB max, 1 rotated backup
log.transports.file.maxSize = 1024 * 1024;

export { log };
