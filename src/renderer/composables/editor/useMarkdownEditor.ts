import { ref } from 'vue';
import type { Ref } from 'vue';
import { useMarkdownRender } from './useMarkdownRender';
import { useMarkdownToolbar } from './useMarkdownToolbar';
import { useMarkdownPreview } from './useMarkdownPreview';

/**
 * Orchestrates markdown editing: rendering, toolbar formatting, and preview interactions.
 *
 * @param isMarkdownFile    - getter returning true when the current file is markdown
 * @param content           - reactive note content ref (shared with persistence)
 * @param embedCacheVersion - incremented each time the embed cache updates (for computed reactivity)
 * @param embedCache        - map of filename → resolved absolute path for ![[embeds]]
 * @param getEmbedMediaType - given a filename, returns 'image' | 'video' | 'audio' | 'pdf' | 'note' | ''
 * @param textareaRef       - ref to the markdown textarea element
 * @param onContentChange   - call after any programmatic content mutation to trigger save/emit
 * @param formatTime        - format seconds to 'm:ss' string, used in embedded media controls
 */
export function useMarkdownEditor(
    isMarkdownFile: () => boolean,
    content: Ref<string>,
    embedCacheVersion: Ref<number>,
    embedCache: Ref<Map<string, string>>,
    getEmbedMediaType: (fileName: string) => string,
    textareaRef: Ref<HTMLTextAreaElement | null>,
    onContentChange: () => void,
    formatTime: (seconds: number) => string,
) {
    const showPreview = ref(false);

    const { renderedMarkdown } = useMarkdownRender(
        isMarkdownFile,
        content,
        embedCacheVersion,
        embedCache,
        getEmbedMediaType,
    );
    const { mdFormatText, mdInsertHeading, onTextareaKeydown } = useMarkdownToolbar(
        isMarkdownFile,
        content,
        textareaRef,
        onContentChange,
    );
    const { onMarkdownPreviewClick, onMarkdownPreviewInput } = useMarkdownPreview(content, onContentChange, formatTime);

    return {
        showPreview,
        renderedMarkdown,
        mdFormatText,
        mdInsertHeading,
        onTextareaKeydown,
        onMarkdownPreviewClick,
        onMarkdownPreviewInput,
    };
}
