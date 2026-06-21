import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── electron mock ─────────────────────────────────────────────────────────────

const mockSend = vi.fn();
const mockInvoke = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockRemoveAllListeners = vi.fn();

let capturedApi: Record<string, unknown> = {};

vi.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: (_channel: string, api: Record<string, unknown>) => {
            capturedApi = api;
        },
    },
    ipcRenderer: {
        send: mockSend,
        invoke: mockInvoke,
        on: mockOn,
        removeAllListeners: mockRemoveAllListeners,
    },
}));

// ── import preload (runs exposeInMainWorld immediately) ───────────────────────
// Dynamic import after mock so the factory captures our mock ipcRenderer

await import('@/preload/index');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('preload / electronAPI', () => {
    describe('log methods — route to ipcRenderer.send', () => {
        it('log.error sends "log:error"', () => {
            (capturedApi.log as Record<string, (...a: unknown[]) => void>).error('msg');
            expect(mockSend).toHaveBeenCalledWith('log:error', 'msg');
        });

        it('log.warn sends "log:warn"', () => {
            (capturedApi.log as Record<string, (...a: unknown[]) => void>).warn('warning');
            expect(mockSend).toHaveBeenCalledWith('log:warn', 'warning');
        });

        it('log.info sends "log:info"', () => {
            (capturedApi.log as Record<string, (...a: unknown[]) => void>).info('info msg');
            expect(mockSend).toHaveBeenCalledWith('log:info', 'info msg');
        });

        it('log.debug sends "log:debug"', () => {
            (capturedApi.log as Record<string, (...a: unknown[]) => void>).debug('debug msg');
            expect(mockSend).toHaveBeenCalledWith('log:debug', 'debug msg');
        });
    });

    describe('isElectron', () => {
        it('returns true', () => {
            expect((capturedApi.isElectron as () => boolean)()).toBe(true);
        });
    });

    describe('IPC invoke methods', () => {
        const invokeTests: [string, string, unknown[]][] = [
            ['openExternal', 'shell:openExternal', ['https://example.com']],
            ['openFolderDialog', 'dialog:openFolder', []],
            ['showSaveDialog', 'dialog:showSaveDialog', [{ defaultPath: '/tmp' }]],
            ['writeBuffer', 'file:writeBuffer', ['/path/file.bin', 'base64data']],
            ['scanFolder', 'files:scan', ['/vault']],
            ['readFile', 'file:read', ['/vault/note.md']],
            ['resolveEmbedPath', 'file:resolveEmbedPath', ['img.png', '/dir', '/root']],
            ['copyFileToVault', 'file:copyToVault', ['/src/img.png', '/vault']],
            ['readImage', 'file:readImage', ['/vault/img.png']],
            ['readAudio', 'file:readAudio', ['/vault/audio.mp3']],
            ['writeFile', 'file:write', ['/vault/note.md', 'content']],
            ['createFile', 'file:create', ['/vault', 'note.md']],
            ['createFolder', 'folder:create', ['/vault', 'new-folder']],
            ['deleteFile', 'file:delete', ['/vault/note.md']],
            ['renameFile', 'file:rename', ['/vault/old.md', 'new.md']],
            ['updateEmbedRefs', 'file:updateEmbedRefs', ['old.md', 'new.md']],
            ['renameFolder', 'folder:rename', ['/vault/old', 'new-name']],
            ['deleteFolder', 'folder:delete', ['/vault/folder']],
            ['moveFile', 'file:move', ['/vault/note.md', '/vault/sub']],
            ['moveFolder', 'folder:move', ['/vault/folder', '/vault/sub']],
            ['saveAudioRecording', 'audio:saveRecording', ['/vault', 'rec.wav', 'base64']],
            ['getSpellingSuggestions', 'spellcheck:getSuggestions', ['teh']],
            ['aiListModels', 'ai:listModels', []],
            ['aiLoadModel', 'ai:loadModel', ['/models/model.gguf']],
            ['aiUnloadModel', 'ai:unloadModel', []],
            ['aiChat', 'ai:chat', ['hello', 'context']],
            ['aiStopChat', 'ai:stopChat', []],
            ['aiResetChat', 'ai:resetChat', []],
            ['aiRestoreChatHistory', 'ai:restoreChatHistory', [[{ role: 'user', content: 'hi' }]]],
            ['aiGetStatus', 'ai:getStatus', []],
            ['aiOpenLeafDir', 'ai:openLeafDir', []],
            ['systemPromptList', 'systemPrompt:list', []],
            ['systemPromptSetActive', 'systemPrompt:setActive', ['creative']],
            ['systemPromptOpenLeafDir', 'systemPrompt:openLeafDir', []],
            ['themeList', 'theme:list', []],
            ['themeSetActive', 'theme:setActive', ['dark']],
            ['themeOpenLeafDir', 'theme:openLeafDir', []],
            ['languageList', 'language:list', []],
            ['languageSetActive', 'language:setActive', ['fr']],
            ['languageLoad', 'language:load', ['fr']],
            ['languageOpenLeafDir', 'language:openLeafDir', []],
            ['conversationList', 'conversations:list', []],
            ['conversationCreate', 'conversations:create', ['model.gguf']],
            ['conversationLoad', 'conversations:load', ['conv-1']],
            ['conversationSave', 'conversations:save', [{ id: 'conv-1' }]],
            ['conversationAddMessage', 'conversations:addMessage', ['conv-1', { role: 'user' }]],
            ['conversationUpdateLastMessage', 'conversations:updateLastMessage', ['conv-1', 'updated']],
            ['conversationDelete', 'conversations:delete', ['conv-1']],
            ['conversationRename', 'conversations:rename', ['conv-1', 'New Title']],
            ['agentReadFile', 'agent:readFile', ['/vault/note.md', '/vault']],
            ['agentProposeEdit', 'agent:proposeEdit', ['/vault/note.md', 'new content', '/vault']],
            ['agentApproveEdit', 'agent:approveEdit', ['edit-1']],
            ['agentRejectEdit', 'agent:rejectEdit', ['edit-1']],
            ['agentGetPendingEdits', 'agent:getPendingEdits', []],
            ['watchFolder', 'fs:watchFolder', ['/vault']],
            ['unwatchFolder', 'fs:unwatchFolder', []],
            ['hfSearch', 'hf:search', ['llama', 'downloads', 0]],
            ['hfListFiles', 'hf:listFiles', ['meta-llama/llama']],
            ['hfDownload', 'hf:download', ['https://example.com/model.gguf', 'model.gguf']],
            ['hfCancelDownload', 'hf:cancelDownload', ['model.gguf']],
            ['hfGetActiveDownloads', 'hf:getActiveDownloads', []],
            ['writeClipboard', 'clipboard:write', ['copied text']],
            ['bookmarksLoad', 'bookmarks:load', []],
            ['bookmarksSave', 'bookmarks:save', [['/vault/note.md']]],
            ['speechInit', 'speech:init', []],
            ['speechTranscribe', 'speech:transcribe', [[1, 2, 3]]],
            ['speechGetStatus', 'speech:getStatus', []],
        ];

        for (const [method, channel, args] of invokeTests) {
            it(`${method} invokes "${channel}"`, () => {
                (capturedApi[method] as (...a: unknown[]) => unknown)(...args);
                expect(mockInvoke).toHaveBeenCalledWith(channel, ...args);
            });
        }
    });

    describe('event listener methods', () => {
        it('onAiToken registers ipcRenderer.on handler for "ai:token"', () => {
            const cb = vi.fn();
            (capturedApi.onAiToken as (cb: (token: string) => void) => void)(cb);
            expect(mockOn).toHaveBeenCalledWith('ai:token', expect.any(Function));
            // Verify the handler forwards the token
            const handler = mockOn.mock.calls[0][1];
            handler({}, 'hello');
            expect(cb).toHaveBeenCalledWith('hello');
        });

        it('removeAiTokenListener calls removeAllListeners("ai:token")', () => {
            (capturedApi.removeAiTokenListener as () => void)();
            expect(mockRemoveAllListeners).toHaveBeenCalledWith('ai:token');
        });

        it('onFsChanged registers handler for "fs:changed"', () => {
            const cb = vi.fn();
            (capturedApi.onFsChanged as (cb: (data: object) => void) => void)(cb);
            expect(mockOn).toHaveBeenCalledWith('fs:changed', expect.any(Function));
            const handler = mockOn.mock.calls[0][1];
            handler({}, { type: 'change' });
            expect(cb).toHaveBeenCalledWith({ type: 'change' });
        });

        it('removeFsChangedListener calls removeAllListeners("fs:changed")', () => {
            (capturedApi.removeFsChangedListener as () => void)();
            expect(mockRemoveAllListeners).toHaveBeenCalledWith('fs:changed');
        });

        it('onHfDownloadProgress registers handler for "hf:downloadProgress"', () => {
            const cb = vi.fn();
            (capturedApi.onHfDownloadProgress as (cb: (p: object) => void) => void)(cb);
            expect(mockOn).toHaveBeenCalledWith('hf:downloadProgress', expect.any(Function));
            const handler = mockOn.mock.calls[0][1];
            handler({}, { percent: 50 });
            expect(cb).toHaveBeenCalledWith({ percent: 50 });
        });

        it('removeHfDownloadProgressListener calls removeAllListeners("hf:downloadProgress")', () => {
            (capturedApi.removeHfDownloadProgressListener as () => void)();
            expect(mockRemoveAllListeners).toHaveBeenCalledWith('hf:downloadProgress');
        });

        it('onSpeechStatus registers handler for "speech:status"', () => {
            const cb = vi.fn();
            (capturedApi.onSpeechStatus as (cb: (s: object) => void) => void)(cb);
            expect(mockOn).toHaveBeenCalledWith('speech:status', expect.any(Function));
        });

        it('removeSpeechStatusListener calls removeAllListeners("speech:status")', () => {
            (capturedApi.removeSpeechStatusListener as () => void)();
            expect(mockRemoveAllListeners).toHaveBeenCalledWith('speech:status');
        });
    });
});
