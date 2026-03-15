import { nextTick } from 'vue';
import type { Ref } from 'vue';

/**
 * Handles markdown toolbar formatting actions and textarea keyboard shortcuts.
 */
export function useMarkdownToolbar(
    isMarkdownFile: () => boolean,
    content: Ref<string>,
    textareaRef: Ref<HTMLTextAreaElement | null>,
    onContentChange: () => void,
) {
    /**
     * Apply markdown formatting to the selected text in the textarea.
     * Supports: bold, italic, strikethrough, highlight, code, ul, ol, checkbox, quote, link, hr
     */
    function mdFormatText(format: string) {
        const textarea = textareaRef.value;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = content.value.substring(start, end);
        const before = content.value.substring(0, start);
        const after = content.value.substring(end);

        let replacement = '';
        let cursorOffset = 0;

        switch (format) {
            case 'bold':
                replacement = `**${selected || 'bold text'}**`;
                cursorOffset = selected ? replacement.length : 2;
                break;
            case 'italic':
                replacement = `*${selected || 'italic text'}*`;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'strikethrough':
                replacement = `~~${selected || 'strikethrough text'}~~`;
                cursorOffset = selected ? replacement.length : 2;
                break;
            case 'highlight':
                replacement = `==${selected || 'highlighted text'}==`;
                cursorOffset = selected ? replacement.length : 2;
                break;
            case 'code':
                if (selected.includes('\n')) {
                    replacement = `\`\`\`\n${selected}\n\`\`\``;
                } else {
                    replacement = `\`${selected || 'code'}\``;
                }
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'ul': {
                if (selected) {
                    replacement = selected
                        .split('\n')
                        .map((line) => `- ${line}`)
                        .join('\n');
                } else {
                    replacement = '- ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'ol': {
                if (selected) {
                    replacement = selected
                        .split('\n')
                        .map((line, i) => `${i + 1}. ${line}`)
                        .join('\n');
                } else {
                    replacement = '1. ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'checkbox': {
                if (selected) {
                    replacement = selected
                        .split('\n')
                        .map((line) => `- [ ] ${line}`)
                        .join('\n');
                } else {
                    replacement = '- [ ] ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'quote': {
                if (selected) {
                    replacement = selected
                        .split('\n')
                        .map((line) => `> ${line}`)
                        .join('\n');
                } else {
                    replacement = '> ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'link':
                if (selected) {
                    replacement = `[${selected}](url)`;
                    cursorOffset = replacement.length - 1;
                } else {
                    replacement = '[link text](url)';
                    cursorOffset = 1;
                }
                break;
            case 'hr':
                replacement = `\n---\n`;
                cursorOffset = replacement.length;
                break;
            default:
                return;
        }

        content.value = before + replacement + after;

        nextTick(() => {
            textarea.focus();
            if (selected) {
                textarea.selectionStart = start;
                textarea.selectionEnd = start + replacement.length;
            } else {
                const innerStart = start + cursorOffset;
                textarea.selectionStart = innerStart;
                textarea.selectionEnd = innerStart;
                if (['bold', 'italic', 'strikethrough', 'highlight', 'code'].includes(format)) {
                    const markerLen = format === 'bold' || format === 'strikethrough' || format === 'highlight' ? 2 : 1;
                    const placeholder = replacement.substring(markerLen, replacement.length - markerLen);
                    textarea.selectionStart = start + markerLen;
                    textarea.selectionEnd = start + markerLen + placeholder.length;
                }
                if (format === 'link') {
                    textarea.selectionStart = start + 1;
                    textarea.selectionEnd = start + 10;
                }
            }
        });

        onContentChange();
    }

    /** Insert a markdown heading at the current line */
    function mdInsertHeading(event: Event) {
        const select = event.target as HTMLSelectElement;
        const level = parseInt(select.value);
        if (isNaN(level)) return;

        const textarea = textareaRef.value;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const lineStart = content.value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = content.value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? content.value.length : lineEnd;
        const currentLine = content.value.substring(lineStart, actualLineEnd);

        const stripped = currentLine.replace(/^#{1,6}\s*/, '');
        const prefix = '#'.repeat(level) + ' ';
        const newLine = prefix + stripped;

        content.value = content.value.substring(0, lineStart) + newLine + content.value.substring(actualLineEnd);

        nextTick(() => {
            textarea.focus();
            const newCursor = lineStart + newLine.length;
            textarea.selectionStart = newCursor;
            textarea.selectionEnd = newCursor;
        });

        select.value = '';
        onContentChange();
    }

    /** Handle keyboard shortcuts for markdown formatting in the textarea */
    function onTextareaKeydown(event: KeyboardEvent) {
        if (!isMarkdownFile()) return;

        // --- List continuation on Enter ---
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
            const textarea = textareaRef.value;
            if (!textarea) return;

            const pos = textarea.selectionStart;
            const text = content.value;

            const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
            const currentLine = text.substring(lineStart, pos);

            const bulletMatch = currentLine.match(/^(\s*)- (\[[ x/]\] )?(.*)$/i);
            const orderedMatch = currentLine.match(/^(\s*)(\d+)\. (.*)$/);

            if (bulletMatch) {
                const indent = bulletMatch[1];
                const checkbox = bulletMatch[2] || '';
                const lineContent = bulletMatch[3];

                if (!lineContent.trim()) {
                    event.preventDefault();
                    const newText = text.substring(0, lineStart) + '\n' + text.substring(pos);
                    content.value = newText;
                    onContentChange();
                    nextTick(() => {
                        if (textarea) {
                            textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
                        }
                    });
                    return;
                }

                event.preventDefault();
                const prefix = checkbox ? `${indent}- [ ] ` : `${indent}- `;
                const insertion = '\n' + prefix;
                const newText = text.substring(0, pos) + insertion + text.substring(pos);
                content.value = newText;
                onContentChange();
                nextTick(() => {
                    if (textarea) {
                        const newPos = pos + insertion.length;
                        textarea.selectionStart = textarea.selectionEnd = newPos;
                    }
                });
                return;
            }

            if (orderedMatch) {
                const indent = orderedMatch[1];
                const num = parseInt(orderedMatch[2]);
                const lineContent = orderedMatch[3];

                if (!lineContent.trim()) {
                    event.preventDefault();
                    const newText = text.substring(0, lineStart) + '\n' + text.substring(pos);
                    content.value = newText;
                    onContentChange();
                    nextTick(() => {
                        if (textarea) {
                            textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
                        }
                    });
                    return;
                }

                event.preventDefault();
                const prefix = `${indent}${num + 1}. `;
                const insertion = '\n' + prefix;
                const newText = text.substring(0, pos) + insertion + text.substring(pos);
                content.value = newText;
                onContentChange();
                nextTick(() => {
                    if (textarea) {
                        const newPos = pos + insertion.length;
                        textarea.selectionStart = textarea.selectionEnd = newPos;
                    }
                });
                return;
            }
        }

        if (event.metaKey || event.ctrlKey) {
            switch (event.key.toLowerCase()) {
                case 'b':
                    event.preventDefault();
                    mdFormatText('bold');
                    break;
                case 'i':
                    event.preventDefault();
                    mdFormatText('italic');
                    break;
                case 'k':
                    event.preventDefault();
                    mdFormatText('link');
                    break;
                case 'h':
                    if (event.shiftKey) {
                        event.preventDefault();
                        mdFormatText('highlight');
                    }
                    break;
            }
        }
    }

    return { mdFormatText, mdInsertHeading, onTextareaKeydown };
}
