import { computed } from 'vue';
import type { Ref } from 'vue';
import { marked } from 'marked';

/**
 * Handles markdown-to-HTML rendering with Obsidian-style embed support
 * and collapsible heading sections.
 */
export function useMarkdownRender(
    isMarkdownFile: () => boolean,
    content: Ref<string>,
    embedCacheVersion: Ref<number>,
    embedCache: Ref<Map<string, string>>,
    getEmbedMediaType: (fileName: string) => string
) {
    /**
     * Wraps content under each heading into collapsible <div> sections.
     * Each heading gets a fold toggle arrow. Clicking it collapses/expands
     * all content until the next heading of equal or higher level.
     */
    function wrapHeadingSections(html: string): string {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const children = Array.from(temp.childNodes);
        const result = document.createElement('div');

        const stack: { level: number; wrapper: HTMLElement }[] = [];

        function currentParent(): HTMLElement {
            return stack.length > 0 ? stack[stack.length - 1].wrapper : result;
        }

        for (const node of children) {
            if (node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName)) {
                const level = parseInt(node.tagName[1]);

                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                node.classList.add('collapsible-heading');
                node.setAttribute('data-heading-level', String(level));
                const arrow = document.createElement('span');
                arrow.className = 'heading-fold-toggle';
                arrow.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                node.insertBefore(arrow, node.firstChild);

                currentParent().appendChild(node);

                const wrapper = document.createElement('div');
                wrapper.className = 'heading-section-content';
                wrapper.setAttribute('data-section-level', String(level));
                currentParent().appendChild(wrapper);

                stack.push({ level, wrapper });
            } else {
                currentParent().appendChild(node);
            }
        }

        return result.innerHTML;
    }

    const renderedMarkdown = computed(() => {
        if (!isMarkdownFile()) return '';

        // Access embedCacheVersion to create reactive dependency
        void embedCacheVersion.value;

        // Pre-process: replace Obsidian-style ![[file]] embeds with HTML before marked parsing
        const processedContent = content.value.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
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
                return `<div class="embed-placeholder" data-embed="${fileName}"><span class="embed-placeholder-icon">📎</span> <span>${fileName}</span></div>`;
            }

            const fileUrl = `leaf://localhost${encodeURI(resolvedPath).replace(/#/g, '%23')}`;
            const mediaType = getEmbedMediaType(fileName);

            switch (mediaType) {
                case 'image': {
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

        // Wrap content under each heading into collapsible sections
        html = wrapHeadingSections(html);

        return html;
    });

    return { renderedMarkdown };
}
