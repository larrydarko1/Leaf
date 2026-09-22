#!/usr/bin/env node
/**
 * Error handling at this app's boundaries. What it checks — IPC handler
 * containment, the process-level backstops, shutdown, and swallows that state a
 * reason — lives in @larrydarko/lint-config/gates/error-handling/electron.
 *
 * Only the native handles are this project's own: what the gate cannot know is
 * which services hold a resource the OS does not reclaim when the window closes.
 */
import { checkElectronErrorHandling } from '@larrydarko/lint-config/gates/error-handling/electron';

checkElectronErrorHandling({
    cleanupRequired: [
        [
            'fsService',
            'holds the vault fs watcher — an active watcher keeps the event loop alive after the window is gone.',
        ],
        [
            'aiService',
            'holds a node-llama-cpp model and its context, which are gigabytes of native memory outside the JS heap.',
        ],
        ['speechService', 'holds the whisper ONNX session — a native handle with its own threads.'],
    ],
});
