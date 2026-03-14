import { ref, computed, nextTick } from 'vue';
import type { Ref } from 'vue';
import { marked } from 'marked';

/**
 * Manages markdown preview rendering, toolbar formatting, and keyboard shortcuts.
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
    formatTime: (seconds: number) => string
) {
    const showPreview = ref(false);

    // ============================================================
    // Markdown render helpers
    // ============================================================

    /**
     * Wraps content under each heading into collapsible <div> sections.
     * Each heading gets a fold toggle arrow. Clicking it collapses/expands
     * all content until the next heading of equal or higher level.
     */
    function wrapHeadingSections(html: string): string {
        // Parse the HTML into a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const children = Array.from(temp.childNodes);
        const result = document.createElement('div');

        // Stack to track open sections: { level, wrapper }
        const stack: { level: number; wrapper: HTMLElement }[] = [];

        function currentParent(): HTMLElement {
            return stack.length > 0 ? stack[stack.length - 1].wrapper : result;
        }

        for (const node of children) {
            if (node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName)) {
                const level = parseInt(node.tagName[1]);

                // Close any open sections with equal or lower-level headings (higher or equal number)
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                // Add fold toggle arrow to the heading
                node.classList.add('collapsible-heading');
                node.setAttribute('data-heading-level', String(level));
                const arrow = document.createElement('span');
                arrow.className = 'heading-fold-toggle';
                arrow.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                node.insertBefore(arrow, node.firstChild);

                // Append heading to current parent
                currentParent().appendChild(node);

                // Create a collapsible content wrapper for content under this heading
                const wrapper = document.createElement('div');
                wrapper.className = 'heading-section-content';
                wrapper.setAttribute('data-section-level', String(level));
                currentParent().appendChild(wrapper);

                stack.push({ level, wrapper });
            } else {
                // Append content to the current innermost section, or to root if none
                currentParent().appendChild(node);
            }
        }

        return result.innerHTML;
    }

    // ============================================================
    // Markdown preview computed
    // ============================================================

    const renderedMarkdown = computed(() => {
        if (!isMarkdownFile()) return '';

        // Access embedCacheVersion to create reactive dependency
        void embedCacheVersion.value;

        // Pre-process: replace Obsidian-style ![[file]] embeds with HTML before marked parsing
        const processedContent = content.value.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
            // Parse the inner content: filename|options or filename#heading
            const pipeIndex = inner.indexOf('|');
            const hashIndex = inner.indexOf('#');

            let fileName: string;
            let displayOptions = '';

            if (pipeIndex !== -1) {
                fileName = inner.substring(0, pipeIndex).trim();
                displayOptions = inner.substring(pipeIndex + 1).trim();
            } else if (hashIndex !== -1) {
                fileName = inner.substring(0, hashIndex).trim();
            } else {
                fileName = inner.trim();
            }

            const resolvedPath = embedCache.value.get(fileName);
            if (!resolvedPath) {
                // Not resolved yet — show placeholder
                return `<div class="embed-placeholder" data-embed="${fileName}"><span class="embed-placeholder-icon">📎</span> <span>${fileName}</span></div>`;
            }

            const fileUrl = `leaf://localhost${encodeURI(resolvedPath).replace(/#/g, '%23')}`;
            const mediaType = getEmbedMediaType(fileName);

            switch (mediaType) {
                case 'image': {
                    // Parse dimension options: "300" or "300x200" or alt text
                    let widthAttr = '';
                    let heightAttr = '';
                    let altText = fileName;
                    if (displayOptions) {
                        const dimMatch = displayOptions.match(/^(\d+)(?:x(\d+))?$/);
                        if (dimMatch) {
                            widthAttr = ` width="${dimMatch[1]}"`;
                            if (dimMatch[2]) heightAttr = ` height="${dimMatch[2]}"`;
                        } else {
                            altText = displayOptions;
                        }
                    }
                    return `<img src="${fileUrl}" alt="${altText}"${widthAttr}${heightAttr} class="embed-image" />`;
                }
                case 'video':
                    return `<div class="embed-video-container">
          <video src="${fileUrl}" preload="metadata" class="embed-video"></video>
          <div class="embed-video-controls">
            <button class="embed-video-play" title="Play">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="embed-video-time embed-video-current">0:00</span>
            <div class="embed-video-progress">
              <div class="embed-video-progress-track">
                <div class="embed-video-progress-fill" style="width:0%"></div>
              </div>
            </div>
            <span class="embed-video-time embed-video-duration">0:00</span>
            <div class="embed-volume-wrapper">
              <button class="embed-volume-btn" title="Mute">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <input type="range" class="embed-volume-slider" min="0" max="1" step="0.01" value="1" />
            </div>
          </div>
        </div>`;
                case 'audio':
                    return `<div class="embed-audio-container">
          <audio src="${fileUrl}" preload="metadata" class="embed-audio"></audio>
          <div class="embed-audio-controls">
            <button class="embed-audio-play" title="Play">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="embed-audio-time embed-audio-current">0:00</span>
            <div class="embed-audio-progress">
              <div class="embed-audio-progress-track">
                <div class="embed-audio-progress-fill" style="width:0%"></div>
              </div>
            </div>
            <span class="embed-audio-time embed-audio-duration">0:00</span>
            <div class="embed-volume-wrapper">
              <button class="embed-volume-btn" title="Mute">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <input type="range" class="embed-volume-slider" min="0" max="1" step="0.01" value="1" />
            </div>
          </div>
        </div>`;
                case 'pdf':
                    return `<div class="embed-pdf-container"><iframe src="${fileUrl}" class="embed-pdf" frameborder="0"></iframe></div>`;
                case 'note':
                    return `<div class="embed-note-link"><a href="#" data-embed-note="${resolvedPath}">📄 ${fileName}</a></div>`;
                default:
                    return `<div class="embed-placeholder"><span class="embed-placeholder-icon">📎</span> <a href="${fileUrl}">${fileName}</a></div>`;
            }
        });

        // Convert ==highlight== syntax to <mark> tags before parsing
        const highlightedContent = processedContent.replace(/==((?!=).*?)==/g, '<mark>$1</mark>');

        // Convert - [/] half-complete tasks to a marked-compatible format with a marker
        const halfTaskProcessed = highlightedContent.replace(/^(\s*)- \[\/\] /gm, '$1- [ ] <!-- half --> ');

        let html = marked.parse(halfTaskProcessed, { async: false }) as string;

        // Add data-task-index to task list items for toggling and remove disabled
        // Also detect half-complete marker and add data-half attribute
        let taskIndex = 0;
        html = html.replace(/<li><input(.*?)>/g, (_match, attrs) => {
            const cleanAttrs = attrs.replace(/\s*disabled=""/g, '');
            return `<li class="task" data-task-index="${taskIndex++}"><input${cleanAttrs}>`;
        });

        // Convert half-complete markers into data attribute on the checkbox
        html = html.replace(/(<input[^>]*>)\s*<!-- half -->/g, (_match, inputTag) => {
            return inputTag.replace('<input', '<input data-half="true"');
        });

        // Wrap content under each heading into collapsible sections (Obsidian-style folding)
        html = wrapHeadingSections(html);

        return html;
    });

    // ============================================================
    // Markdown toolbar formatting
    // ============================================================

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
        let cursorOffset = 0; // offset from start for cursor placement

        switch (format) {
            case 'bold':
                replacement = `**${selected || 'bold text'}**`;
                cursorOffset = selected ? replacement.length : 2; // place cursor after ** if no selection
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
                    // Multi-line: use code block
                    replacement = `\`\`\`\n${selected}\n\`\`\``;
                } else {
                    replacement = `\`${selected || 'code'}\``;
                }
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'ul': {
                if (selected) {
                    replacement = selected.split('\n').map(line => `- ${line}`).join('\n');
                } else {
                    replacement = '- ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'ol': {
                if (selected) {
                    replacement = selected.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
                } else {
                    replacement = '1. ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'checkbox': {
                if (selected) {
                    replacement = selected.split('\n').map(line => `- [ ] ${line}`).join('\n');
                } else {
                    replacement = '- [ ] ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'quote': {
                if (selected) {
                    replacement = selected.split('\n').map(line => `> ${line}`).join('\n');
                } else {
                    replacement = '> ';
                }
                cursorOffset = replacement.length;
                break;
            }
            case 'link':
                if (selected) {
                    replacement = `[${selected}](url)`;
                    cursorOffset = replacement.length - 1; // place cursor before closing )
                } else {
                    replacement = '[link text](url)';
                    cursorOffset = 1; // place cursor after [
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

        // Place cursor appropriately
        nextTick(() => {
            textarea.focus();
            if (selected) {
                // Select the replacement text
                textarea.selectionStart = start;
                textarea.selectionEnd = start + replacement.length;
            } else {
                // For wrapping formats, place cursor inside the markers to type
                const innerStart = start + cursorOffset;
                textarea.selectionStart = innerStart;
                textarea.selectionEnd = innerStart;
                // For placeholders, select the placeholder text
                if (['bold', 'italic', 'strikethrough', 'highlight', 'code'].includes(format)) {
                    const markerLen = format === 'bold' || format === 'strikethrough' || format === 'highlight' ? 2 : 1;
                    const placeholder = replacement.substring(markerLen, replacement.length - markerLen);
                    textarea.selectionStart = start + markerLen;
                    textarea.selectionEnd = start + markerLen + placeholder.length;
                }
                if (format === 'link') {
                    // Select "link text"
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
        // Find the start of the current line
        const lineStart = content.value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = content.value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? content.value.length : lineEnd;
        const currentLine = content.value.substring(lineStart, actualLineEnd);

        // Strip any existing heading markers
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

        // Reset dropdown so it can be used again
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

            // Find the current line
            const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
            const currentLine = text.substring(lineStart, pos);

            // Match unordered list: "  - " or "- " (with optional indentation)
            const bulletMatch = currentLine.match(/^(\s*)- (\[[ x/]\] )?(.*)$/i);
            // Match ordered list: "  1. " (with optional indentation)
            const orderedMatch = currentLine.match(/^(\s*)(\d+)\. (.*)$/);
            // Match checkbox task: "  - [ ] " or "  - [x] " or "  - [/] "
            // (already captured in bulletMatch with the checkbox group)

            if (bulletMatch) {
                const indent = bulletMatch[1];
                const checkbox = bulletMatch[2] || '';
                const lineContent = bulletMatch[3];

                // If the line content is empty (just "- " or "- [ ] "), remove the marker
                if (!lineContent.trim()) {
                    event.preventDefault();
                    const newText = text.substring(0, lineStart) + '\n' + text.substring(pos);
                    content.value = newText;
                    onContentChange();
                    // Set cursor after the newline
                    nextTick(() => {
                        if (textarea) {
                            textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
                        }
                    });
                    return;
                }

                // Continue the list with the same prefix
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

                // If the line content is empty (just "1. "), remove the marker
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

                // Continue with the next number
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

    // ============================================================
    // Markdown preview interactions
    // ============================================================

    /** Handle clicks in markdown preview (checkbox toggling, embedded media controls) */
    function onMarkdownPreviewClick(event: MouseEvent) {
        const target = event.target as HTMLElement;

        // --- Heading fold toggle ---
        const foldToggle = target.closest('.heading-fold-toggle') as HTMLElement;
        if (foldToggle) {
            event.preventDefault();
            event.stopPropagation();
            const heading = foldToggle.closest('.collapsible-heading') as HTMLElement;
            if (!heading) return;
            const sectionContent = heading.nextElementSibling as HTMLElement;
            if (sectionContent && sectionContent.classList.contains('heading-section-content')) {
                const isCollapsed = sectionContent.classList.toggle('collapsed');
                heading.classList.toggle('collapsed', isCollapsed);
            }
            return;
        }

        // --- Embedded video play/pause ---
        const vidPlayBtn = target.closest('.embed-video-play') as HTMLElement;
        if (vidPlayBtn) {
            event.preventDefault();
            const container = vidPlayBtn.closest('.embed-video-container') as HTMLElement;
            if (!container) return;
            const video = container.querySelector('video') as HTMLVideoElement;
            if (!video) return;
            if (video.paused) {
                video.play();
                vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
                const updateProgress = () => {
                    const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
                    const curEl = container.querySelector('.embed-video-current') as HTMLElement;
                    if (fill && video.duration) fill.style.width = ((video.currentTime / video.duration) * 100) + '%';
                    if (curEl) curEl.textContent = formatTime(video.currentTime);
                    if (!video.paused) requestAnimationFrame(updateProgress);
                };
                updateProgress();
                video.onended = () => {
                    vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                    const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
                    if (fill) fill.style.width = '0%';
                    const curEl = container.querySelector('.embed-video-current') as HTMLElement;
                    if (curEl) curEl.textContent = '0:00';
                };
                video.onloadedmetadata = () => {
                    const durEl = container.querySelector('.embed-video-duration') as HTMLElement;
                    if (durEl) durEl.textContent = formatTime(video.duration);
                };
                if (video.duration) {
                    const durEl = container.querySelector('.embed-video-duration') as HTMLElement;
                    if (durEl) durEl.textContent = formatTime(video.duration);
                }
            } else {
                video.pause();
                vidPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            }
            return;
        }

        // --- Embedded audio play/pause ---
        const audPlayBtn = target.closest('.embed-audio-play') as HTMLElement;
        if (audPlayBtn) {
            event.preventDefault();
            const container = audPlayBtn.closest('.embed-audio-container') as HTMLElement;
            if (!container) return;
            const audio = container.querySelector('audio') as HTMLAudioElement;
            if (!audio) return;
            if (audio.paused) {
                audio.play();
                audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
                const updateProgress = () => {
                    const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
                    const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
                    if (fill && audio.duration) fill.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
                    if (curEl) curEl.textContent = formatTime(audio.currentTime);
                    if (!audio.paused) requestAnimationFrame(updateProgress);
                };
                updateProgress();
                audio.onended = () => {
                    audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                    const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
                    if (fill) fill.style.width = '0%';
                    const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
                    if (curEl) curEl.textContent = '0:00';
                };
                audio.onloadedmetadata = () => {
                    const durEl = container.querySelector('.embed-audio-duration') as HTMLElement;
                    if (durEl) durEl.textContent = formatTime(audio.duration);
                };
                if (audio.duration) {
                    const durEl = container.querySelector('.embed-audio-duration') as HTMLElement;
                    if (durEl) durEl.textContent = formatTime(audio.duration);
                }
            } else {
                audio.pause();
                audPlayBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            }
            return;
        }

        // --- Embedded audio seek ---
        const audProgress = target.closest('.embed-audio-progress') as HTMLElement;
        if (audProgress) {
            event.preventDefault();
            const container = audProgress.closest('.embed-audio-container') as HTMLElement;
            if (!container) return;
            const audio = container.querySelector('audio') as HTMLAudioElement;
            if (!audio || !audio.duration) return;
            const rect = audProgress.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            audio.currentTime = pct * audio.duration;
            const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
            if (fill) fill.style.width = (pct * 100) + '%';
            const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
            if (curEl) curEl.textContent = formatTime(audio.currentTime);
            return;
        }

        // --- Embedded video seek ---
        const vidProgress = target.closest('.embed-video-progress') as HTMLElement;
        if (vidProgress) {
            event.preventDefault();
            const container = vidProgress.closest('.embed-video-container') as HTMLElement;
            if (!container) return;
            const video = container.querySelector('video') as HTMLVideoElement;
            if (!video || !video.duration) return;
            const rect = vidProgress.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            video.currentTime = pct * video.duration;
            const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
            if (fill) fill.style.width = (pct * 100) + '%';
            const curEl = container.querySelector('.embed-video-current') as HTMLElement;
            if (curEl) curEl.textContent = formatTime(video.currentTime);
            return;
        }

        // --- Click on embedded video to play/pause ---
        const vidEl = target.closest('.embed-video') as HTMLVideoElement;
        if (vidEl) {
            event.preventDefault();
            const container = vidEl.closest('.embed-video-container') as HTMLElement;
            const playBtn = container?.querySelector('.embed-video-play') as HTMLElement;
            if (playBtn) playBtn.click();
            return;
        }

        // --- Embedded mute toggle (works for both video and audio containers) ---
        const muteBtn = target.closest('.embed-volume-btn') as HTMLElement;
        if (muteBtn) {
            event.preventDefault();
            const container = muteBtn.closest('.embed-video-container, .embed-audio-container') as HTMLElement;
            if (!container) return;
            const media = (container.querySelector('video') || container.querySelector('audio')) as HTMLMediaElement;
            if (!media) return;
            const slider = container.querySelector('.embed-volume-slider') as HTMLInputElement;
            const svgMuted = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
            const svgLow = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            const svgHigh = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            if (media.volume > 0) {
                media.dataset.prevVolume = String(media.volume);
                media.volume = 0;
                if (slider) slider.value = '0';
                muteBtn.innerHTML = svgMuted;
            } else {
                const prev = parseFloat(media.dataset.prevVolume || '1');
                media.volume = prev;
                if (slider) slider.value = String(prev);
                muteBtn.innerHTML = prev < 0.5 ? svgLow : svgHigh;
            }
            return;
        }

        // --- Embedded volume slider (works for both video and audio containers) ---
        const volSlider = target.closest('.embed-volume-slider') as HTMLInputElement;
        if (volSlider) {
            // Handled by 'input' event listener, but prevent click propagation
            return;
        }

        // --- Checkbox toggling ---
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).getAttribute('type') === 'checkbox') {
            event.preventDefault();
            const li = target.closest('li.task');
            if (!li) return;

            // Toggle checkbox state: [ ] → [/] → [x] → [ ]
            const lines = content.value.split('\n');
            let taskIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                const uncheckedMatch = lines[i].match(/^(\s*)- \[ \] /);
                const halfMatch = lines[i].match(/^(\s*)- \[\/\] /);
                const checkedMatch = lines[i].match(/^(\s*)- \[x\] /i);
                if (uncheckedMatch || halfMatch || checkedMatch) {
                    const liTaskIndex = li.getAttribute('data-task-index');
                    if (String(taskIndex) === liTaskIndex) {
                        if (uncheckedMatch) {
                            lines[i] = lines[i].replace(/^(\s*)- \[ \]/, '$1- [/]');
                        } else if (halfMatch) {
                            lines[i] = lines[i].replace(/^(\s*)- \[\/\]/, '$1- [x]');
                        } else {
                            lines[i] = lines[i].replace(/^(\s*)- \[x\]/i, '$1- [ ]');
                        }
                        content.value = lines.join('\n');
                        onContentChange();
                        break;
                    }
                    taskIndex++;
                }
            }
        }
    }

    /** Handle input events in markdown preview (for embedded volume sliders) */
    function onMarkdownPreviewInput(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.classList.contains('embed-volume-slider')) return;

        const container = target.closest('.embed-video-container, .embed-audio-container') as HTMLElement;
        if (!container) return;
        const media = (container.querySelector('video') || container.querySelector('audio')) as HTMLMediaElement;
        if (!media) return;

        const vol = parseFloat(target.value);
        media.volume = vol;

        const muteBtn = container.querySelector('.embed-volume-btn') as HTMLElement;
        if (muteBtn) {
            const svgMuted = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2"15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
            const svgLow = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            const svgHigh = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            if (vol === 0) {
                muteBtn.innerHTML = svgMuted;
            } else if (vol < 0.5) {
                muteBtn.innerHTML = svgLow;
            } else {
                muteBtn.innerHTML = svgHigh;
            }
        }
    }

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
