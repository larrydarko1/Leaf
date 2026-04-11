<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, shallowRef } from 'vue';
import {
    isImageFile as checkImage,
    isVideoFile as checkVideo,
    isAudioFile as checkAudio,
    isPdfFile as checkPdf,
    isCodeFile as checkCode,
    isMarkdownFile as checkMarkdown,
    isDrawingFile as checkDrawing,
} from '../utils/fileTypes';
import DrawingCanvas from './DrawingCanvas.vue';
import ImageViewer from './editor/ImageViewer.vue';
import VideoViewer from './editor/VideoViewer.vue';
import AudioViewer from './editor/AudioViewer.vue';
import PdfViewer from './editor/PdfViewer.vue';
import type { FileInfo } from '../types/electron';
import { useEmbedResolver } from '../composables/editor/useEmbedResolver';
import { useEditorDrop } from '../composables/editor/useEditorDrop';
import { useDictation } from '../composables/editor/useDictation';
import { useNotePersistence } from '../composables/editor/useNotePersistence';
import { useCodemirror } from '../composables/editor/useCodemirror';
import { useCodemirrorToolbar, markdownKeymap } from '../composables/editor/cm-toolbar';
import { createMarkdownWidgetsPlugin, interactiveExtension } from '../composables/editor/cm-markdown-widgets';
import { leafEditorTheme } from '../composables/editor/cm-theme';
import { listContinuationKeymap } from '../composables/editor/cm-list-continuation';
import { taskFoldExtension } from '../composables/editor/cm-task-fold';
import { useCodeEditor } from '../composables/editor/useCodeEditor';
import { keymap, EditorView } from '@codemirror/view';

const props = defineProps<{
    file: FileInfo | null;
    workspacePath: string | null;
}>();

const emit = defineEmits<{
    save: [content: string];
    contentChanged: [hasChanges: boolean];
}>();

// CodeMirror container ref (replaces textarea + preview)
const cmContainerRef = ref<HTMLElement | null>(null);
// CodeMirror container ref for code files
const codeContainerRef = ref<HTMLElement | null>(null);
// Textarea ref for plain-text (non-markdown) files
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Obsidian-style embed resolver (must be initialized before useNotePersistence)
const {
    embedCache,
    embedCacheVersion,
    resolveEmbeds,
    getEmbedMediaType,
    clearCache: clearEmbedCache,
} = useEmbedResolver(
    () => props.file,
    () => props.workspacePath,
);

// Note persistence: content, save, load, auto-save
const {
    content,
    originalContent,
    hasUnsavedChanges,
    lastLoadedPath,
    justSaved,
    onContentChange,
    saveFile,
    loadFile,
    handleDrawingSave,
    clearAutoSaveTimeout,
} = useNotePersistence(
    () => props.file,
    () => !!props.file && checkMarkdown(props.file.extension),
    resolveEmbeds,
    (c) => emit('save', c),
    (v) => emit('contentChanged', v),
);

/** Reload the current file's content from disk */
async function reloadContent() {
    if (props.file) {
        await loadFile(props.file);
    }
}

defineExpose({ reloadContent });

// Dictation
const { isDictating, isDictationLoading, toggleDictation, stopDictation } = useDictation(content, onContentChange);

// Check if current file is an image
const isImageFile = computed(() => !!props.file && checkImage(props.file.extension));
const isVideoFile = computed(() => !!props.file && checkVideo(props.file.extension));
const isAudioFile = computed(() => !!props.file && checkAudio(props.file.extension));
const isPdfFile = computed(() => !!props.file && checkPdf(props.file.extension));
const isCodeFile = computed(() => !!props.file && checkCode(props.file.extension));
const isMarkdownFile = computed(() => !!props.file && checkMarkdown(props.file.extension));
const isDrawingFile = computed(() => !!props.file && checkDrawing(props.file.extension));

// Check if current file supports dictation (txt or md only)
const isDictatable = computed(() => {
    if (!props.file) return false;
    const ext = props.file.extension.toLowerCase();
    return ext === '.txt' || ext === '.md';
});

// CodeMirror markdown editor (live preview mode)
const cmViewRef = shallowRef<EditorView | null>(null);

// Build CodeMirror extensions for markdown: live-preview, widgets, toolbar keybindings, list continuation
const markdownWidgetsPlugin = createMarkdownWidgetsPlugin(embedCache, embedCacheVersion, getEmbedMediaType);
const cmExtensions = [
    markdownWidgetsPlugin,
    interactiveExtension,
    listContinuationKeymap,
    taskFoldExtension(),
    leafEditorTheme,
    keymap.of(markdownKeymap(cmViewRef)),
    keymap.of([
        {
            key: 'Mod-s',
            run: () => {
                saveFile();
                return true;
            },
        },
    ]),
    // Prevent CM6 from inserting raw text when files are dropped
    // (the actual embed insertion is handled by useEditorDrop on the parent container)
    EditorView.domEventHandlers({
        drop(event) {
            const dt = event.dataTransfer;
            if (!dt) return false;
            const plain = dt.getData('text/plain');
            if ((plain && plain.startsWith('file:')) || dt.types.includes('Files')) {
                return true; // mark handled — CM6 won't insert raw text
            }
            return false;
        },
    }),
];

// A reactive file identifier — changes whenever a different file is loaded,
// telling CodeMirror to fully reset its state (undo history, scroll, cursor).
const cmFileId = computed(() => props.file?.path ?? null);

// Create CodeMirror instance (will mount/unmount reactively via v-if)
const { view: cmView } = useCodemirror(
    cmContainerRef,
    content,
    onContentChange,
    cmExtensions,
    'Start writing...',
    cmFileId,
);

// Keep the shared ref in sync
watch(
    cmView,
    (v) => {
        cmViewRef.value = v;
    },
    { immediate: true },
);

// ── Code file editor (syntax-highlighted, non-markdown) ──────────────
const codeFileExtension = computed(() => props.file?.extension ?? '');
useCodeEditor(codeContainerRef, content, onContentChange, codeFileExtension, cmFileId);

// When embed cache updates (async resolution), poke CodeMirror so the
// widget plugin re-evaluates and renders the newly resolved embeds.
watch(embedCacheVersion, () => {
    const v = cmViewRef.value;
    if (!v) return;
    // Dispatch a no-op transaction to trigger plugin update() calls
    v.dispatch({});
});

// Toolbar commands backed by CodeMirror
const { mdFormatText, mdInsertHeading } = useCodemirrorToolbar(cmViewRef);

// Watch for file changes
watch(
    () => props.file,
    async (newFile) => {
        // If the file path hasn't changed, skip the full reload.
        // This prevents autosave-triggered FS watcher refreshes from overwriting content.
        if (newFile && newFile.path === lastLoadedPath.value) {
            // If we just saved, clear the flag and skip entirely
            if (justSaved.value) {
                justSaved.value = false;
                return;
            }
            // Same file but not our save — could be an external change.
            // Only reload if we have no unsaved changes (don't overwrite user's work).
            if (!hasUnsavedChanges.value) {
                const result = await window.electronAPI.readFile(newFile.path);
                if (result.success && result.content !== undefined && result.content !== content.value) {
                    content.value = result.content;
                    originalContent.value = result.content;
                }
            }
            return;
        }

        // Different file — do a full load with state reset
        lastLoadedPath.value = newFile?.path || null;

        // Clear embed cache when switching files
        clearEmbedCache();

        if (newFile) {
            const ext = newFile.extension.toLowerCase();

            if (checkImage(ext) || checkVideo(ext) || checkAudio(ext) || checkPdf(ext)) {
                // Media file: clear text state (sub-components handle their own loading)
                content.value = '';
                originalContent.value = '';
                hasUnsavedChanges.value = false;
            } else {
                // Text file: load content
                await loadFile(newFile);
            }
        } else {
            content.value = '';
            originalContent.value = '';
            hasUnsavedChanges.value = false;
        }
    },
    { immediate: true },
);

// Editor drag-and-drop (showPreview no longer needed — always in live-preview mode)
const showPreview = ref(false); // kept for useEditorDrop API compat, always false now
const { isDragOverEditor, onEditorDragEnter, onEditorDragOver, onEditorDragLeave, onFileDrop } = useEditorDrop(
    isMarkdownFile,
    () => props.file,
    () => props.workspacePath,
    textareaRef,
    showPreview,
    content,
    onContentChange,
    cmViewRef,
);

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
}

// Prevent Electron from navigating when files are dropped anywhere on the window
function preventGlobalDrop(event: DragEvent) {
    event.preventDefault();
}
function preventGlobalDragOver(event: DragEvent) {
    event.preventDefault();
}

// Add keyboard listener
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyboard);
}

onMounted(() => {
    document.addEventListener('drop', preventGlobalDrop, true);
    document.addEventListener('dragover', preventGlobalDragOver, true);
});

// Cleanup
onUnmounted(() => {
    clearAutoSaveTimeout();
    if (isDictating.value) {
        stopDictation();
    }
    window.electronAPI.removeSpeechStatusListener();
    document.removeEventListener('drop', preventGlobalDrop, true);
    document.removeEventListener('dragover', preventGlobalDragOver, true);
    window.removeEventListener('keydown', handleKeyboard);
});
</script>

<template>
    <div class="note-editor">
        <!-- Media viewers -->
        <ImageViewer v-if="file && isImageFile" :file-path="file.path" :file-name="file.name" />
        <VideoViewer v-else-if="file && isVideoFile" :file-path="file.path" />
        <PdfViewer v-else-if="file && isPdfFile" :file-path="file.path" />
        <AudioViewer v-else-if="file && isAudioFile" :file-path="file.path" />

        <!-- Drawing canvas for drawing files -->
        <DrawingCanvas
            v-else-if="file && isDrawingFile"
            :file-path="file.path"
            :initial-content="content"
            @save="handleDrawingSave"
            @content-changed="(hasChanges) => (hasUnsavedChanges = hasChanges)"
        />

        <!-- Text editor for text files -->
        <div
            v-else-if="file && !isImageFile && !isVideoFile && !isAudioFile && !isPdfFile && !isDrawingFile"
            class="text-editor-container"
            @dragenter.prevent="onEditorDragEnter"
            @dragover.prevent="onEditorDragOver"
            @dragleave.prevent="onEditorDragLeave"
            @drop.prevent="onFileDrop"
        >
            <!-- Drop overlay for drag-and-drop media embed (purely visual) -->
            <div v-show="isDragOverEditor" class="drop-overlay">
                <div class="drop-overlay-content">
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <p>Drop to embed</p>
                </div>
            </div>

            <!-- Markdown formatting toolbar (always visible for markdown files) -->
            <div v-if="isMarkdownFile" class="md-toolbar">
                <button class="md-toolbar-btn" title="Bold (⌘B)" @mousedown.prevent="mdFormatText('bold')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Italic (⌘I)" @mousedown.prevent="mdFormatText('italic')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="19" y1="4" x2="10" y2="4"></line>
                        <line x1="14" y1="20" x2="5" y2="20"></line>
                        <line x1="15" y1="4" x2="9" y2="20"></line>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Strikethrough" @mousedown.prevent="mdFormatText('strikethrough')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.1 0 1.4.8 2.3 2.3 3"></path>
                        <path d="M4 12h16"></path>
                        <path d="M17 16c0 2.3-2 4-5.5 4-2 0-3.7-.4-5.5-1.5"></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Highlight (⌘⇧H)" @mousedown.prevent="mdFormatText('highlight')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Inline code" @mousedown.prevent="mdFormatText('code')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                </button>
                <div class="md-toolbar-separator"></div>
                <select class="md-toolbar-select" title="Heading level" @change="mdInsertHeading($event)">
                    <option value="" selected disabled>Heading</option>
                    <option value="1">H1</option>
                    <option value="2">H2</option>
                    <option value="3">H3</option>
                    <option value="4">H4</option>
                </select>
                <div class="md-toolbar-separator"></div>
                <button class="md-toolbar-btn" title="Bullet list" @mousedown.prevent="mdFormatText('ul')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Numbered list" @mousedown.prevent="mdFormatText('ol')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="10" y1="6" x2="21" y2="6"></line>
                        <line x1="10" y1="12" x2="21" y2="12"></line>
                        <line x1="10" y1="18" x2="21" y2="18"></line>
                        <path d="M4 6h1v4"></path>
                        <path d="M4 10h2"></path>
                        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Checkbox" @mousedown.prevent="mdFormatText('checkbox')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <path d="M9 12l2 2 4-4"></path>
                    </svg>
                </button>
                <div class="md-toolbar-separator"></div>
                <button class="md-toolbar-btn" title="Blockquote" @mousedown.prevent="mdFormatText('quote')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path
                            d="M10 11H6a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 017 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0010 11zM20 11h-4a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v3a4 4 0 01-1.5 3.12A3.49 3.49 0 0117 14a.5.5 0 010-1 2.5 2.5 0 001.73-.72A2.49 2.49 0 0020 11z"
                        ></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Link (⌘K)" @mousedown.prevent="mdFormatText('link')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </button>
                <button class="md-toolbar-btn" title="Horizontal rule" @mousedown.prevent="mdFormatText('hr')">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    >
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                    </svg>
                </button>
            </div>

            <!-- CodeMirror live-preview editor for markdown files -->
            <div v-if="isMarkdownFile" ref="cmContainerRef" class="cm-editor-container"></div>

            <!-- CodeMirror code editor for code files (syntax highlighted) -->
            <div v-else-if="isCodeFile" ref="codeContainerRef" class="cm-editor-container code-editor-container"></div>

            <!-- Plain textarea for other text files (e.g. .txt) -->
            <textarea
                v-else
                ref="textareaRef"
                v-model="content"
                class="editor-textarea"
                placeholder="Start writing..."
                @input="onContentChange"
            ></textarea>

            <!-- Dictation button for txt/md files -->
            <button
                v-if="isDictatable"
                class="dictation-btn"
                :class="{ active: isDictating, loading: isDictationLoading }"
                :title="
                    isDictating
                        ? 'Stop dictation'
                        : isDictationLoading
                          ? 'Loading Whisper model...'
                          : 'Start dictation (Speech-to-Text)'
                "
                :disabled="isDictationLoading"
                @click="toggleDictation"
            >
                <!-- Microphone icon -->
                <svg
                    v-if="!isDictationLoading"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                <!-- Loading spinner -->
                <svg
                    v-else
                    class="spin"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                    ></path>
                </svg>
                <!-- Pulsing dot when active -->
                <span v-if="isDictating" class="dictation-pulse"></span>
            </button>
        </div>

        <div v-else class="editor-empty">
            <div class="empty-message">
                <div class="empty-logo">
                    <img draggable="false" src="../assets/icons/icon.png" alt="Leaf" class="empty-logo-icon" />
                    <span class="empty-logo-text">leaf.</span>
                </div>
                <p>Select a note to start editing</p>
                <p class="hint">or create a new one from your notes folder</p>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.note-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    position: relative;
    overflow: hidden;
}

.md-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--base1) 60%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid color-mix(in srgb, var(--text2) 12%, transparent);
    flex-shrink: 0;
    flex-wrap: wrap;
}

.md-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        background: color-mix(in srgb, var(--text2) 15%, transparent);
        color: $text1;
    }

    &:active {
        background: var(--accent-color, #4a9eff);
        color: #fff;
        transform: scale(0.92);
    }

    svg {
        width: 14px;
        height: 14px;
    }
}

.md-toolbar-separator {
    width: 1px;
    height: 16px;
    background: color-mix(in srgb, var(--text2) 20%, transparent);
    margin: 0 4px;
    flex-shrink: 0;
    border-radius: 1px;
}

.md-toolbar-select {
    height: 26px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--text2) 15%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--text2) 8%, transparent);
    color: $text1;
    font-size: 11px;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--text2) 30%, transparent);
        background: color-mix(in srgb, var(--text2) 15%, transparent);
    }

    &:focus {
        border-color: $accent-color;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #4a9eff) 20%, transparent);
    }
}

.text-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

.cm-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    :deep(.cm-editor) {
        flex: 1;
        height: 100%;
        overflow: hidden;
    }
}

.drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--base1) 85%, transparent);
    backdrop-filter: blur(4px);
    border: 2px dashed $accent-color;
    border-radius: 8px;
    margin: 0.5rem;
    pointer-events: none;
}

.drop-overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: $accent-color;

    svg {
        opacity: 0.8;
    }

    p {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
    }
}

.editor-textarea {
    flex: 1;
    padding: 2rem;
    background: transparent;
    color: $text1;
    border: none;
    outline: none;
    font-family: $font-family;
    font-size: 1rem;
    line-height: 1.6;
    resize: none;
    cursor: text;

    &::placeholder {
        color: $text2;
    }

    &.code-editor {
        font-family:
            'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Menlo', 'Consolas', 'DejaVu Sans Mono', monospace;
        font-size: 0.875rem;
        line-height: 1.5;
        tab-size: 4;
        -moz-tab-size: 4;
        white-space: pre;
        overflow-wrap: normal;
        word-wrap: normal;
    }
}

// Dictation button
.dictation-btn {
    position: absolute;
    bottom: 1.25rem;
    right: 1.25rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid $text3;
    background: $base1;
    color: $text2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 20;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    &:hover {
        background: $bg-hover;
        color: $text1;
        border-color: $text2;
    }

    &.active {
        background: $danger-color;
        color: $text1;
        border-color: $danger-color;
        box-shadow: 0 2px 12px rgba(229, 62, 62, 0.4);
    }

    &.loading {
        opacity: 0.6;
        cursor: wait;
    }

    &:disabled {
        cursor: wait;
    }

    svg {
        display: block;
    }

    .spin {
        animation: spin 1.2s linear infinite;
    }
}

.dictation-pulse {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: $danger-color;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(1.3);
    }
}

.editor-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-message {
    text-align: center;
    color: $text2;

    .empty-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
    }

    .empty-logo-icon {
        width: 100px;
        height: 100px;
        object-fit: contain;
    }

    .empty-logo-text {
        font-family: 'Inter', sans-serif;
        font-size: 4rem;
        font-weight: 600;
        color: $text1;
        letter-spacing: -0.02em;
        cursor: default;
    }

    p {
        margin: 0.5rem 0;
        font-size: 1.1rem;
    }

    .hint {
        font-size: 0.9rem;
        color: $text2;
    }
}
</style>
