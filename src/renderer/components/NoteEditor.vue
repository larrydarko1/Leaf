<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, shallowRef } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import {
    isImageFile as checkImage,
    isVideoFile as checkVideo,
    isAudioFile as checkAudio,
    isPdfFile as checkPdf,
    isCodeFile as checkCode,
    isMarkdownFile as checkMarkdown,
    isDrawingFile as checkDrawing,
} from '@/renderer/utils/fileTypes';
import DrawingCanvas from '@/renderer/components/DrawingCanvas.vue';
import ImageViewer from '@/renderer/components/editor/ImageViewer.vue';
import VideoViewer from '@/renderer/components/editor/VideoViewer.vue';
import AudioViewer from '@/renderer/components/editor/AudioViewer.vue';
import PdfViewer from '@/renderer/components/editor/PdfViewer.vue';
import MarkdownToolbar from '@/renderer/components/editor/MarkdownToolbar.vue';
import type { FileInfo } from '@/schemas/vault';
import { useEmbedResolver } from '@/renderer/composables/editor/useEmbedResolver';
import { useEditorDrop } from '@/renderer/composables/editor/useEditorDrop';
import { useDictation } from '@/renderer/composables/editor/useDictation';
import { useNotePersistence } from '@/renderer/composables/editor/useNotePersistence';
import { useCodemirror } from '@/renderer/composables/editor/codemirror/useCodemirror';
import { useCodemirrorToolbar, markdownKeymap } from '@/renderer/composables/editor/codemirror/cm-toolbar';
import {
    createMarkdownWidgetsPlugin,
    interactiveExtension,
} from '@/renderer/composables/editor/codemirror/cm-markdown-widgets';
import { leafEditorTheme } from '@/renderer/composables/editor/codemirror/cm-theme';
import { listContinuationKeymap } from '@/renderer/composables/editor/codemirror/cm-list-continuation';
import { taskFoldExtension } from '@/renderer/composables/editor/codemirror/cm-task-fold';
import { useCodeEditor } from '@/renderer/composables/editor/codemirror/useCodeEditor';
import { keymap, EditorView } from '@codemirror/view';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    file: FileInfo | null;
    workspacePath: string | null;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    save: [content: string];
    contentChanged: [hasChanges: boolean];
}>();

defineExpose({ reloadContent });

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
// Debounce the contentChanged emission — avoid firing on every keystroke
type DebouncedEmitFn = ((hasChanges: boolean) => void) & { cancel?: () => void };
const debouncedEmitContentChanged = useDebounceFn(
    (hasChanges: boolean) => {
        emit('contentChanged', hasChanges);
    },
    150,
    { maxWait: 500 },
) as unknown as DebouncedEmitFn;

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
    () => props.file !== null && checkMarkdown(props.file.extension),
    (s) => {
        void resolveEmbeds(s);
    },
    (c) => emit('save', c),
    (v) => debouncedEmitContentChanged(v),
);

// Dictation
const { isDictating, isDictationLoading, toggleDictation, stopDictation } = useDictation(content, onContentChange);

// Check if current file is an image
const isImageFile = computed(() => props.file !== null && checkImage(props.file.extension));
const isVideoFile = computed(() => props.file !== null && checkVideo(props.file.extension));
const isAudioFile = computed(() => props.file !== null && checkAudio(props.file.extension));
const isPdfFile = computed(() => props.file !== null && checkPdf(props.file.extension));
const isCodeFile = computed(() => props.file !== null && checkCode(props.file.extension));
const isMarkdownFile = computed(() => props.file !== null && checkMarkdown(props.file.extension));
const isDrawingFile = computed(() => props.file !== null && checkDrawing(props.file.extension));

// Check if current file supports dictation (txt or md only)
const isDictatable = computed(() => {
    if (props.file === null) return false;
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
                void saveFile();
                return true;
            },
        },
    ]),
    // Prevent CM6 from inserting raw text when files are dropped
    // (the actual embed insertion is handled by useEditorDrop on the parent container)
    EditorView.domEventHandlers({
        drop(event) {
            const dt = event.dataTransfer;
            if (dt === null) return false;
            const plain = dt.getData('text/plain');
            if ((plain !== '' && plain.startsWith('file:')) || dt.types.includes('Files')) {
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
const codeFileExtension = computed(() => (props.file !== null ? props.file.extension : ''));
useCodeEditor(codeContainerRef, content, onContentChange, codeFileExtension, cmFileId);

// When embed cache updates (async resolution), poke CodeMirror so the
// widget plugin re-evaluates and renders the newly resolved embeds.
watch(embedCacheVersion, () => {
    const v = cmViewRef.value;
    if (v === null) return;
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
        if (newFile !== null && lastLoadedPath.value !== null && newFile.path === lastLoadedPath.value) {
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
        lastLoadedPath.value = newFile !== null ? newFile.path : null;

        // Clear embed cache when switching files
        clearEmbedCache();

        if (newFile !== null) {
            const ext = newFile.extension.toLowerCase();

            if (
                checkImage(ext) === true ||
                checkVideo(ext) === true ||
                checkAudio(ext) === true ||
                checkPdf(ext) === true
            ) {
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

onMounted(() => {
    document.addEventListener('drop', preventGlobalDrop as EventListener, true);
    document.addEventListener('dragover', preventGlobalDragOver as EventListener, true);
});

// Cleanup
onUnmounted(() => {
    clearAutoSaveTimeout();
    debouncedEmitContentChanged.cancel?.();
    if (isDictating.value === true) {
        stopDictation();
    }
    window.electronAPI.removeSpeechStatusListener();
    document.removeEventListener('drop', preventGlobalDrop as EventListener, true);
    document.removeEventListener('dragover', preventGlobalDragOver as EventListener, true);
    window.removeEventListener('keydown', handleKeyboard as EventListener);
});

/** Reload the current file's content from disk */
async function reloadContent() {
    if (props.file !== null) {
        await loadFile(props.file);
    }
}

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
    if ((e.metaKey === true || e.ctrlKey === true) && e.key === 's') {
        e.preventDefault();
        void saveFile();
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
    window.addEventListener('keydown', handleKeyboard as EventListener);
}
</script>

<template>
    <div
        class="note-editor"
        role="main"
        :aria-label="t('editor.note_editor')">
        <!-- Media viewers -->
        <section
            v-if="file && isImageFile"
            :aria-label="t('editor.image_viewer')">
            <ImageViewer
                :file-path="file.path"
                :file-name="file.name" />
        </section>

        <section
            v-else-if="file && isVideoFile"
            :aria-label="t('editor.video_viewer')">
            <VideoViewer :file-path="file.path" />
        </section>

        <section
            v-else-if="file && isPdfFile"
            :aria-label="t('editor.pdf_viewer')">
            <PdfViewer :file-path="file.path" />
        </section>

        <section
            v-else-if="file && isAudioFile"
            :aria-label="t('editor.audio_player')">
            <AudioViewer :file-path="file.path" />
        </section>

        <!-- Drawing canvas for drawing files -->
        <section
            v-else-if="file && isDrawingFile"
            :aria-label="t('editor.drawing_canvas')">
            <DrawingCanvas
                :file-path="file.path"
                :initial-content="content"
                @save="handleDrawingSave"
                @content-changed="(hasChanges) => (hasUnsavedChanges = hasChanges)" />
        </section>

        <!-- Text editor for text files -->
        <!-- eslint-disable-next-line a11y/no-static-element-interactions -->
        <section
            v-else-if="file && !isImageFile && !isVideoFile && !isAudioFile && !isPdfFile && !isDrawingFile"
            class="text-editor-container"
            :aria-label="t('editor.text_editor')"
            @dragenter.prevent="onEditorDragEnter"
            @dragover.prevent="onEditorDragOver"
            @dragleave.prevent="onEditorDragLeave"
            @drop.prevent="onFileDrop">
            <!-- Drop overlay for drag-and-drop media embed -->
            <div
                v-show="isDragOverEditor"
                class="drop-overlay"
                role="status"
                aria-live="polite"
                :aria-label="t('editor.drag_and_drop_zone_active')">
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
                        aria-hidden="true"
                        focusable="false">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line
                            x1="12"
                            y1="15"
                            x2="12"
                            y2="3"></line>
                    </svg>
                    <p>{{ t('editor.drop_to_embed') }}</p>
                </div>
            </div>

            <!-- Markdown formatting toolbar -->
            <nav
                v-if="isMarkdownFile"
                :aria-label="t('editor.markdown_formatting_toolbar')">
                <MarkdownToolbar
                    @format="mdFormatText"
                    @heading="mdInsertHeading" />
            </nav>

            <!-- CodeMirror live-preview editor for markdown files -->
            <div
                v-if="isMarkdownFile"
                ref="cmContainerRef"
                class="cm-editor-container"
                role="textbox"
                :aria-label="t('editor.markdown_editor')"
                aria-multiline="true"></div>

            <!-- CodeMirror code editor for code files -->
            <div
                v-else-if="isCodeFile"
                ref="codeContainerRef"
                class="cm-editor-container code-editor-container"
                role="textbox"
                :aria-label="t('editor.code_editor')"
                aria-multiline="true"></div>

            <!-- Plain textarea for other text files -->
            <textarea
                v-else
                ref="textareaRef"
                v-model="content"
                class="editor-textarea"
                placeholder="Start writing..."
                :aria-label="t('editor.text_editor')"
                @input="onContentChange"></textarea>

            <!-- Dictation button for txt/md files -->
            <button
                v-if="isDictatable"
                class="dictation-btn"
                :class="{ active: isDictating, loading: isDictationLoading }"
                :aria-pressed="isDictating"
                :aria-label="
                    isDictating
                        ? t('editor.stop_dictation')
                        : isDictationLoading
                          ? t('editor.loading_whisper_model')
                          : t('editor.start_dictation')
                "
                :disabled="isDictationLoading"
                @click="toggleDictation">
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
                    aria-hidden="true"
                    focusable="false">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line
                        x1="12"
                        y1="19"
                        x2="12"
                        y2="23"></line>
                    <line
                        x1="8"
                        y1="23"
                        x2="16"
                        y2="23"></line>
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
                    aria-hidden="true"
                    focusable="false">
                    <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                </svg>
                <!-- Pulsing dot when active -->
                <span
                    v-if="isDictating"
                    class="dictation-pulse"
                    aria-hidden="true"></span>
            </button>
        </section>

        <!-- Empty state -->
        <section
            v-else
            class="editor-empty"
            aria-label="No note selected">
            <div class="empty-message">
                <div class="empty-logo">
                    <img
                        draggable="false"
                        src="@/renderer/assets/icons/icon.png"
                        :alt="t('editor.leaf_logo')"
                        class="empty-logo-icon" />
                    <span class="empty-logo-text">leaf.</span>
                </div>
                <h2>{{ t('editor.select_note_to_start_editing') }}</h2>
                <p class="hint">{{ t('editor.or_create_new_note') }}</p>
            </div>
        </section>
    </div>
</template>

<style scoped lang="scss">
/* ––– Note Editor Container ––– */

.note-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    position: relative;
    overflow: hidden;
}

/* ––– Text Editor Area ––– */

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

/* ––– Drop Overlay ––– */

.drop-overlay {
    position: absolute;
    inset: 0;
    z-index: $z-dropdown;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, $base1 85%, transparent);
    backdrop-filter: blur($backdrop-blur-xs);
    border: $border-width-md $accent-color;
    border-radius: $border-radius-lg;
    margin: $space-2;
    pointer-events: none;
}

.drop-overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
    color: $accent-color;

    svg {
        opacity: $opacity-higher;
    }

    p {
        margin: 0;
        font-size: $font-size-base;
        font-weight: $font-weight-medium;
    }
}

/* ––– Editor Textarea ––– */

.editor-textarea {
    flex: 1;
    padding: $space-7;
    background: transparent;
    color: $text1;
    border: none;
    outline: none;
    font-family: $font-family;
    font-size: $font-size-base;
    line-height: $line-height;
    resize: none;
    cursor: text;

    &::placeholder {
        color: $text2;
    }

    &.code-editor {
        font-family: $font-family-mono;
        font-size: $font-size-sm;
        line-height: $line-height;
        tab-size: 4;
        white-space: pre;
        overflow-wrap: normal;
    }
}

/* ––– Dictation Button ––– */

.dictation-btn {
    position: absolute;
    bottom: $space-5;
    right: $space-5;
    width: $size-14;
    height: $size-14;
    border-radius: $border-radius-xl;
    border: $border-width-thin $text3;
    background: $base1;
    color: $text2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all $transition-base;
    z-index: $z-mid;
    box-shadow: $shadow-sm;

    &:hover {
        background: $bg-hover;
        color: $text1;
        border-color: $text2;
    }

    &.active {
        background: $danger-color;
        color: $text1;
        border-color: $danger-color;
        box-shadow: $red-shadow;
    }

    &.loading {
        opacity: $opacity-mid;
        cursor: wait;
    }

    &:disabled {
        cursor: wait;
    }

    svg {
        display: block;
    }

    .spin {
        animation: spin $transition-fast linear infinite;
    }
}

.dictation-pulse {
    position: absolute;
    top: -$size-1;
    right: -$size-1;
    width: $size-5;
    height: $size-5;
    border-radius: $border-radius-xl;
    background: $danger-color;
    animation: pulse 1.5s ease-in-out infinite;
}

/* ––– Empty State ––– */

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
        margin-bottom: $space-4;
    }

    .empty-logo-icon {
        width: $size-20;
        height: $size-20;
        object-fit: contain;
    }

    .empty-logo-text {
        font-family: Inter, sans-serif;
        font-size: 4rem;
        font-weight: $font-weight-semibold;
        color: $text1;
        letter-spacing: $letter-spacing-tight;
        cursor: default;
    }

    h2 {
        margin: $space-2 0;
        font-size: $font-size-lg;
    }

    .hint {
        font-size: $font-size-base;
        color: $text2;
    }
}

section {
    display: contents;
}
</style>
