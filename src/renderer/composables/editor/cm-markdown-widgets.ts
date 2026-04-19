/**
 * cm-markdown-widgets — CodeMirror 6 ViewPlugin that renders inline decorations
 * for checkboxes, images, and embeds in markdown.
 */

import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { type EditorState, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { Ref } from 'vue';

// ── Interactive extension (links + media controls) ───────────────────────────

/**
 * Handles mousedown on markdown links and media progress bars.
 * Runs as domEventHandlers — fires BEFORE CM6's internal handlers,
 * so returning true prevents CM6 from moving the cursor / rebuilding widgets.
 */
export const interactiveExtension = EditorView.domEventHandlers({
    mousedown(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement;

        // ── Block CM6 from processing clicks inside embed media controls ────
        if (target.closest('.cm-embed-controls')) {
            return true;
        }

        // ── Block CM6 for clicks on the video element itself ────────────────
        if (target.closest('.cm-embed-video')) {
            return true;
        }

        // ── Link click via syntax tree ──────────────────────────────────────
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) {
            const tree = syntaxTree(view.state);
            let node = tree.resolveInner(pos, 1);
            for (let depth = 0; depth < 10 && node; depth++) {
                if (node.name === 'Link') {
                    const text = view.state.doc.sliceString(node.from, node.to);
                    const m = text.match(/\]\(([^)]+)\)$/);
                    if (m && (m[1].startsWith('http://') || m[1].startsWith('https://'))) {
                        event.preventDefault();
                        window.electronAPI.openExternal(m[1]);
                        return true;
                    }
                    break;
                }
                if (node.name === 'URL') {
                    const url = view.state.doc.sliceString(node.from, node.to);
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        event.preventDefault();
                        window.electronAPI.openExternal(url);
                        return true;
                    }
                    break;
                }
                if (!node.parent) break;
                node = node.parent;
            }
        }
        return false;
    },
});

// ── Widget classes ────────────────────────────────────────────────────────────

class HorizontalRuleWidget extends WidgetType {
    toDOM(): HTMLElement {
        const hr = document.createElement('hr');
        hr.className = 'cm-hr';
        return hr;
    }
}

class EmbedWidget extends WidgetType {
    fileName: string;
    resolvedPath: string | undefined;
    mediaType: string;
    displayOptions: string;

    constructor(fileName: string, resolvedPath: string | undefined, mediaType: string, displayOptions: string) {
        super();
        this.fileName = fileName;
        this.resolvedPath = resolvedPath;
        this.mediaType = mediaType;
        this.displayOptions = displayOptions;
    }

    eq(other: EmbedWidget): boolean {
        return this.fileName === other.fileName && this.resolvedPath === other.resolvedPath;
    }

    toDOM(): HTMLElement {
        if (!this.resolvedPath) {
            const placeholder = document.createElement('div');
            placeholder.className = 'cm-embed-placeholder';
            placeholder.innerHTML = `<span class="embed-placeholder-icon">\u{1F4CE}</span> <span>${this.escapeHtml(this.fileName)}</span>`;
            return placeholder;
        }

        const fileUrl = `leaf://localhost${encodeURI(this.resolvedPath).replace(/#/g, '%23')}`;

        switch (this.mediaType) {
            case 'image': {
                const wrapper = document.createElement('div');
                wrapper.className = 'cm-embed-image-wrapper';
                const img = document.createElement('img');
                img.src = fileUrl;
                img.alt = this.fileName;
                img.className = 'cm-embed-image';
                img.loading = 'lazy';
                if (this.displayOptions) {
                    const dimMatch = this.displayOptions.match(/^(\d+)(?:x(\d+))?$/);
                    if (dimMatch) {
                        img.width = parseInt(dimMatch[1]);
                        if (dimMatch[2]) img.height = parseInt(dimMatch[2]);
                    }
                }
                wrapper.appendChild(img);
                return wrapper;
            }
            case 'video':
            case 'audio': {
                const isVideo = this.mediaType === 'video';
                const wrapper = document.createElement('div');
                wrapper.className = isVideo ? 'cm-embed-video-wrapper' : 'cm-embed-audio-wrapper';

                const media = isVideo
                    ? Object.assign(document.createElement('video'), {
                          src: fileUrl,
                          preload: 'auto',
                          className: 'cm-embed-video',
                      })
                    : Object.assign(document.createElement('audio'), { src: fileUrl, preload: 'auto' });

                const ctrlBar = document.createElement('div');
                ctrlBar.className = 'cm-embed-controls' + (isVideo ? '' : ' cm-embed-audio-controls');

                const playBtn = document.createElement('button');
                playBtn.className = 'cm-embed-play-btn';
                const playSvg =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                const pauseSvg =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
                playBtn.innerHTML = playSvg;

                const timeEl = document.createElement('span');
                timeEl.className = 'cm-embed-time';
                timeEl.textContent = '0:00';

                const progressWrap = document.createElement('div');
                progressWrap.className = 'cm-embed-progress-wrapper';
                const progressTrack = document.createElement('div');
                progressTrack.className = 'cm-embed-progress-track';
                const progressFill = document.createElement('div');
                progressFill.className = 'cm-embed-progress-fill';
                progressTrack.appendChild(progressFill);
                progressWrap.appendChild(progressTrack);

                const durEl = document.createElement('span');
                durEl.className = 'cm-embed-time';
                durEl.textContent = '0:00';

                // Volume controls
                const volSvg =
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06a6.5 6.5 0 010 13.42v2.06A8.5 8.5 0 0014 3.23z"/></svg>';
                const muteSvg =
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 8.5v2.09l2.44 2.44c.03-.31.06-.63.06-.97zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12a8.5 8.5 0 00-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.4 8.4 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';

                const volBtn = document.createElement('button');
                volBtn.className = 'cm-embed-vol-btn';
                volBtn.innerHTML = volSvg;

                const volWrap = document.createElement('div');
                volWrap.className = 'cm-embed-vol-wrapper';
                const volTrack = document.createElement('div');
                volTrack.className = 'cm-embed-vol-track';
                const volFill = document.createElement('div');
                volFill.className = 'cm-embed-vol-fill';
                volFill.style.width = '100%';
                volTrack.appendChild(volFill);
                volWrap.appendChild(volTrack);

                const fmt = (s: number) => {
                    if (!isFinite(s) || isNaN(s) || s <= 0) return '0:00';
                    const m = Math.floor(s / 60);
                    return `${m}:${Math.floor(s % 60)
                        .toString()
                        .padStart(2, '0')}`;
                };

                // Duration resolution: some formats report Infinity via custom protocol.
                // Probe by seeking to a huge value — Chromium clamps to actual end and
                // fires durationchange with the real value.
                let realDuration = 0;
                let probing = false;

                const captureDuration = () => {
                    if (isFinite(media.duration) && media.duration > 0) {
                        realDuration = media.duration;
                        durEl.textContent = fmt(realDuration);
                        wrapper.dataset.realDuration = String(realDuration);
                    }
                };

                media.addEventListener('loadedmetadata', () => {
                    captureDuration();
                    if (!realDuration) {
                        probing = true;
                        media.currentTime = 1e10;
                    }
                });

                media.addEventListener('durationchange', captureDuration);

                media.addEventListener('seeked', () => {
                    if (probing) {
                        probing = false;
                        captureDuration();
                        media.currentTime = 0;
                    }
                });

                media.addEventListener('timeupdate', () => {
                    if (probing) return;
                    timeEl.textContent = fmt(media.currentTime);
                    if (realDuration > 0) {
                        progressFill.style.width = `${(media.currentTime / realDuration) * 100}%`;
                    }
                });

                media.addEventListener('play', () => {
                    playBtn.innerHTML = pauseSvg;
                });
                media.addEventListener('pause', () => {
                    playBtn.innerHTML = playSvg;
                });
                media.addEventListener('ended', () => {
                    playBtn.innerHTML = playSvg;
                });

                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (media.paused) media.play();
                    else media.pause();
                };
                if (isVideo)
                    (media as HTMLVideoElement).onclick = () => {
                        if (media.paused) media.play();
                        else media.pause();
                    };

                // Seek handler — uses realDuration from closure (set by probe)
                progressWrap.onclick = (e) => {
                    e.stopPropagation();
                    const dur = realDuration || (isFinite(media.duration) ? media.duration : 0);
                    if (!dur) return;
                    const rect = progressTrack.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    media.currentTime = ratio * dur;
                };

                let savedVol = 1;
                volBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (media.volume > 0) {
                        savedVol = media.volume;
                        media.volume = 0;
                        volFill.style.width = '0%';
                        volBtn.innerHTML = muteSvg;
                    } else {
                        media.volume = savedVol;
                        volFill.style.width = `${savedVol * 100}%`;
                        volBtn.innerHTML = volSvg;
                    }
                };
                volWrap.onclick = (e) => {
                    e.stopPropagation();
                    const rect = volTrack.getBoundingClientRect();
                    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    media.volume = v;
                    volFill.style.width = `${v * 100}%`;
                    volBtn.innerHTML = v === 0 ? muteSvg : volSvg;
                };

                ctrlBar.append(playBtn, timeEl, progressWrap, durEl, volBtn, volWrap);
                wrapper.append(media, ctrlBar);
                return wrapper;
            }
            case 'pdf': {
                const wrapper = document.createElement('div');
                wrapper.className = 'cm-embed-pdf-wrapper';
                const iframe = document.createElement('iframe');
                iframe.src = fileUrl;
                iframe.className = 'cm-embed-pdf';
                iframe.setAttribute('frameborder', '0');
                iframe.loading = 'lazy';
                wrapper.appendChild(iframe);
                return wrapper;
            }
            case 'note': {
                const wrapper = document.createElement('div');
                wrapper.className = 'cm-embed-note-link';
                wrapper.innerHTML = `\u{1F4C4} ${this.escapeHtml(this.fileName)}`;
                return wrapper;
            }
            default: {
                const wrapper = document.createElement('div');
                wrapper.className = 'cm-embed-placeholder';
                wrapper.innerHTML = `<span class="embed-placeholder-icon">\u{1F4CE}</span> <span>${this.escapeHtml(this.fileName)}</span>`;
                return wrapper;
            }
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

class TaskCheckboxWidget extends WidgetType {
    checked: 'checked' | 'half' | 'unchecked';
    pos: number;

    constructor(checked: 'checked' | 'half' | 'unchecked', pos: number) {
        super();
        this.checked = checked;
        this.pos = pos;
    }

    eq(other: TaskCheckboxWidget): boolean {
        return this.checked === other.checked && this.pos === other.pos;
    }

    toDOM(): HTMLElement {
        const label = document.createElement('label');
        label.className = 'cm-task-label';
        label.dataset.taskPos = String(this.pos);

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'cm-task-checkbox-input';
        if (this.checked === 'checked') input.checked = true;
        if (this.checked === 'half') input.dataset.half = 'true';

        const span = document.createElement('span');
        span.className = 'cm-task-checkbox';
        if (this.checked === 'checked') span.classList.add('cm-task-checked');
        if (this.checked === 'half') span.classList.add('cm-task-half');

        label.appendChild(input);
        label.appendChild(span);
        return label;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeLinesSet(state: EditorState): Set<number> {
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
        const startLine = state.doc.lineAt(range.from).number;
        const endLine = state.doc.lineAt(range.to).number;
        for (let n = startLine; n <= endLine; n++) lines.add(n);
    }
    return lines;
}

// ── Regex-based decoration builders ───────────────────────────────────────────

const highlightRegex = /==((?!=).+?)==/g;
const embedRegex = /!\[\[([^\]]+)\]\]/g;
const taskRegex = /^(\s*)- \[([ x/])\] /gim;

/**
 * Expand a visible range to full-line boundaries so regex patterns
 * that use `^` (like tasks) match correctly.
 */
function expandToLines(state: EditorState, from: number, to: number): [number, number] {
    return [state.doc.lineAt(from).from, state.doc.lineAt(to).to];
}

function buildHighlightDecos(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
    activeLines: Set<number>,
): Range<Decoration>[] {
    const decos: Range<Decoration>[] = [];
    for (const { from: vFrom, to: vTo } of visibleRanges) {
        const [lineFrom, lineTo] = expandToLines(state, vFrom, vTo);
        const slice = state.doc.sliceString(lineFrom, lineTo);

        let match: RegExpExecArray | null;
        highlightRegex.lastIndex = 0;
        while ((match = highlightRegex.exec(slice)) !== null) {
            const from = lineFrom + match.index;
            const to = from + match[0].length;
            const lineNum = state.doc.lineAt(from).number;
            if (activeLines.has(lineNum)) continue;

            decos.push(Decoration.mark({ class: 'cm-highlight' }).range(from, to));
            decos.push(Decoration.replace({}).range(from, from + 2));
            decos.push(Decoration.replace({}).range(to - 2, to));
        }
    }
    return decos;
}

/**
 * Scans visible ranges for ![[embed]] syntax.
 * Returns decorations AND the set of character ranges covered by embeds
 * so the syntax-tree walker can skip those regions (preventing overlapping replaces).
 */
function buildEmbedDecos(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
    activeLines: Set<number>,
    embedCache: Map<string, string>,
    getEmbedMediaType: (fileName: string) => string,
): { decos: Range<Decoration>[]; coveredRanges: [number, number][] } {
    const decos: Range<Decoration>[] = [];
    const coveredRanges: [number, number][] = [];

    for (const { from: vFrom, to: vTo } of visibleRanges) {
        const [lineFrom, lineTo] = expandToLines(state, vFrom, vTo);
        const slice = state.doc.sliceString(lineFrom, lineTo);

        let match: RegExpExecArray | null;
        embedRegex.lastIndex = 0;
        while ((match = embedRegex.exec(slice)) !== null) {
            const from = lineFrom + match.index;
            const to = from + match[0].length;
            const lineNum = state.doc.lineAt(from).number;

            // Always mark as covered so syntax-tree walker skips these ranges
            coveredRanges.push([from, to]);

            if (activeLines.has(lineNum)) continue;

            const inner = match[1];
            const pipeIndex = inner.indexOf('|');
            let fileName: string;
            let displayOptions = '';
            if (pipeIndex !== -1) {
                fileName = inner.substring(0, pipeIndex).trim();
                displayOptions = inner.substring(pipeIndex + 1).trim();
            } else {
                fileName = inner.split('#')[0].trim();
            }

            const resolvedPath = embedCache.get(fileName) || undefined;
            const mediaType = resolvedPath ? getEmbedMediaType(fileName) : 'unknown';

            decos.push(
                Decoration.replace({
                    widget: new EmbedWidget(fileName, resolvedPath, mediaType, displayOptions),
                }).range(from, to),
            );
        }
    }
    return { decos, coveredRanges };
}

function buildTaskDecos(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
    activeLines: Set<number>,
): Range<Decoration>[] {
    const decos: Range<Decoration>[] = [];

    for (const { from: vFrom, to: vTo } of visibleRanges) {
        const [lineFrom, lineTo] = expandToLines(state, vFrom, vTo);
        const slice = state.doc.sliceString(lineFrom, lineTo);

        let match: RegExpExecArray | null;
        taskRegex.lastIndex = 0;
        while ((match = taskRegex.exec(slice)) !== null) {
            const matchFrom = lineFrom + match.index;
            const lineNum = state.doc.lineAt(matchFrom).number;
            if (activeLines.has(lineNum)) continue;

            const indent = match[1];
            const marker = match[2].toLowerCase();
            let checked: 'checked' | 'half' | 'unchecked' = 'unchecked';
            if (marker === 'x') checked = 'checked';
            else if (marker === '/') checked = 'half';

            const markerStart = matchFrom + indent.length;
            const markerEnd = markerStart + match[0].length - indent.length;

            const line = state.doc.line(lineNum);
            decos.push(
                Decoration.line({
                    class: `cm-task-line${checked === 'checked' ? ' cm-task-done' : ''}`,
                }).range(line.from),
            );
            decos.push(
                Decoration.replace({
                    widget: new TaskCheckboxWidget(checked, markerStart),
                }).range(markerStart, markerEnd),
            );
        }
    }
    return decos;
}

// ── Syntax-tree live-preview builder ──────────────────────────────────────────

/**
 * Walk the Lezer syntax tree for visible ranges, emitting decorations for
 * markdown syntax (headings, bold, italic, links, etc.) that is NOT on the
 * currently-focused line. Skips ranges already covered by embed widgets to
 * prevent overlapping replace decorations.
 */
function buildSyntaxDecos(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
    activeLines: Set<number>,
    embedRanges: [number, number][],
): Range<Decoration>[] {
    const decos: Range<Decoration>[] = [];

    function overlapsEmbed(from: number, to: number): boolean {
        for (const [ef, et] of embedRanges) {
            if (from < et && to > ef) return true;
        }
        return false;
    }

    // Track processed nodes to avoid duplicates when a node spans multiple visible ranges.
    const seen = new Set<string>();

    for (const { from: rangeFrom, to: rangeTo } of visibleRanges) {
        syntaxTree(state).iterate({
            from: rangeFrom,
            to: rangeTo,
            enter(node) {
                const { from, to } = node;
                const name = node.name;

                // Deduplicate nodes that span multiple visible ranges
                const key = `${name}:${from}:${to}`;
                if (seen.has(key)) return;
                seen.add(key);

                // Skip nodes covered by embed widgets
                if (overlapsEmbed(from, to)) return;

                const lineFrom = state.doc.lineAt(from).number;
                const lineTo = state.doc.lineAt(to).number;

                let isActive = false;
                for (let ln = lineFrom; ln <= lineTo; ln++) {
                    if (activeLines.has(ln)) {
                        isActive = true;
                        break;
                    }
                }
                if (isActive) return;

                // ── Headings ──────────────────────────────────────────
                if (/^(ATXHeading[1-6])$/.test(name)) {
                    const level = parseInt(name.replace('ATXHeading', ''));
                    decos.push(
                        Decoration.line({ class: `cm-heading cm-heading-${level}` }).range(state.doc.lineAt(from).from),
                    );
                    const text = state.doc.sliceString(from, to);
                    const markerMatch = text.match(/^(#{1,6})\s/);
                    if (markerMatch) {
                        decos.push(Decoration.replace({}).range(from, from + markerMatch[0].length));
                    }
                }

                // ── Emphasis (italic) ─────────────────────────────────
                if (name === 'Emphasis') {
                    decos.push(Decoration.mark({ class: 'cm-emphasis' }).range(from, to));
                    decos.push(Decoration.replace({}).range(from, from + 1));
                    decos.push(Decoration.replace({}).range(to - 1, to));
                }

                // ── Strong (bold) ─────────────────────────────────────
                if (name === 'StrongEmphasis') {
                    decos.push(Decoration.mark({ class: 'cm-strong' }).range(from, to));
                    decos.push(Decoration.replace({}).range(from, from + 2));
                    decos.push(Decoration.replace({}).range(to - 2, to));
                }

                // ── Strikethrough ─────────────────────────────────────
                if (name === 'Strikethrough') {
                    decos.push(Decoration.mark({ class: 'cm-strikethrough' }).range(from, to));
                    decos.push(Decoration.replace({}).range(from, from + 2));
                    decos.push(Decoration.replace({}).range(to - 2, to));
                }

                // ── Inline code ───────────────────────────────────────
                if (name === 'InlineCode') {
                    decos.push(Decoration.mark({ class: 'cm-inline-code' }).range(from, to));
                    decos.push(Decoration.replace({}).range(from, from + 1));
                    decos.push(Decoration.replace({}).range(to - 1, to));
                }

                // ── Code blocks ───────────────────────────────────────
                if (name === 'FencedCode') {
                    const firstLine = state.doc.line(lineFrom);
                    const lastLine = state.doc.line(lineTo);
                    const lastText = lastLine.text.trim();
                    const hasClosingFence = lineTo > lineFrom && (lastText === '```' || lastText === '~~~');

                    // Opening fence line: collapse via CSS, hide content
                    decos.push(Decoration.line({ class: 'cm-code-block cm-code-fence' }).range(firstLine.from));
                    if (firstLine.from < firstLine.to) {
                        decos.push(Decoration.replace({}).range(firstLine.from, firstLine.to));
                    }

                    // Content lines
                    for (let ln = lineFrom + 1; ln <= (hasClosingFence ? lineTo - 1 : lineTo); ln++) {
                        const line = state.doc.line(ln);
                        decos.push(Decoration.line({ class: 'cm-code-block' }).range(line.from));
                    }

                    // Closing fence line: collapse via CSS, hide content
                    if (hasClosingFence) {
                        decos.push(Decoration.line({ class: 'cm-code-block cm-code-fence' }).range(lastLine.from));
                        if (lastLine.from < lastLine.to) {
                            decos.push(Decoration.replace({}).range(lastLine.from, lastLine.to));
                        }
                    }
                }

                // ── Blockquote ────────────────────────────────────────
                if (name === 'Blockquote') {
                    for (let ln = lineFrom; ln <= lineTo; ln++) {
                        if (!activeLines.has(ln)) {
                            const line = state.doc.line(ln);
                            decos.push(Decoration.line({ class: 'cm-blockquote' }).range(line.from));
                            const lineText = line.text;
                            const markerMatch = lineText.match(/^(\s*>\s?)/);
                            if (markerMatch) {
                                decos.push(Decoration.replace({}).range(line.from, line.from + markerMatch[0].length));
                            }
                        }
                    }
                }

                // ── Links ─────────────────────────────────────────────
                if (name === 'Link') {
                    const text = state.doc.sliceString(from, to);
                    const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
                    if (linkMatch) {
                        decos.push(
                            Decoration.mark({
                                class: 'cm-link',
                                attributes: { title: linkMatch[2] },
                            }).range(from, to),
                        );
                        decos.push(Decoration.replace({}).range(from, from + 1));
                        const closeBracket = from + 1 + linkMatch[1].length;
                        decos.push(Decoration.replace({}).range(closeBracket, to));
                    }
                }

                // ── Images ────────────────────────────────────────────
                if (name === 'Image') {
                    const text = state.doc.sliceString(from, to);
                    const imgMatch = text.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
                    if (imgMatch) {
                        decos.push(Decoration.mark({ class: 'cm-image-link' }).range(from, to));
                    }
                }

                // ── Horizontal rule ───────────────────────────────────
                if (name === 'HorizontalRule') {
                    decos.push(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(from, to));
                }

                // ── Bullet list markers ───────────────────────────────
                if (name === 'ListMark') {
                    const text = state.doc.sliceString(from, to);
                    if (text === '-' || text === '*' || text === '+') {
                        decos.push(Decoration.mark({ class: 'cm-list-bullet' }).range(from, to));
                    }
                }
            },
        });
    }

    return decos;
}

// ── Combined plugin ───────────────────────────────────────────────────────────

/**
 * Merge and deduplicate visible ranges after line expansion.
 * Prevents regex scanners from producing duplicate decorations when
 * two adjacent visible ranges share the same line after expansion.
 */
function mergeVisibleRanges(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
): { from: number; to: number }[] {
    if (visibleRanges.length === 0) return [];
    const expanded = visibleRanges.map(({ from, to }) => {
        const [lf, lt] = expandToLines(state, from, to);
        return { from: lf, to: lt };
    });
    expanded.sort((a, b) => a.from - b.from);
    const merged: { from: number; to: number }[] = [{ ...expanded[0] }];
    for (let i = 1; i < expanded.length; i++) {
        const last = merged[merged.length - 1];
        if (expanded[i].from <= last.to) {
            last.to = Math.max(last.to, expanded[i].to);
        } else {
            merged.push({ ...expanded[i] });
        }
    }
    return merged;
}

/**
 * Single unified ViewPlugin for ALL markdown live-preview decorations:
 * syntax-tree (headings, bold, italic, links, code, etc.) and regex
 * (highlights, embeds, tasks). One plugin eliminates overlapping-replace
 * conflicts that occurred with two independent plugins.
 */
export function createMarkdownWidgetsPlugin(
    embedCache: Ref<Map<string, string>>,
    embedCacheVersion: Ref<number>,
    getEmbedMediaType: (fileName: string) => string,
) {
    let lastCacheVersion = embedCacheVersion.value;

    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.build(view.state, view.visibleRanges);
            }

            build(state: EditorState, visibleRanges: readonly { from: number; to: number }[]): DecorationSet {
                try {
                    const activeLines = activeLinesSet(state);

                    // Merge visible ranges so regex scanners don't produce duplicates
                    const merged = mergeVisibleRanges(state, visibleRanges);

                    // 1. Embeds first — they return covered ranges for the syntax walker to skip
                    const { decos: embedDecos, coveredRanges: embedRanges } = buildEmbedDecos(
                        state,
                        merged,
                        activeLines,
                        embedCache.value,
                        getEmbedMediaType,
                    );

                    // 2. Regex-based: highlights and tasks (merged visible ranges)
                    const highlightDecos = buildHighlightDecos(state, merged, activeLines);
                    const taskDecos = buildTaskDecos(state, merged, activeLines);

                    // 3. Syntax-tree: headings, bold, italic, links, etc.
                    const syntaxDecos = buildSyntaxDecos(state, visibleRanges, activeLines, embedRanges);

                    // 4. Merge all, deduplicate, and create DecorationSet
                    const allDecos = [...embedDecos, ...highlightDecos, ...taskDecos, ...syntaxDecos];

                    // Deduplicate: same from+to with same decoration type can crash RangeSetBuilder
                    const seen = new Set<string>();
                    const uniqueDecos: Range<Decoration>[] = [];
                    for (const d of allDecos) {
                        const key = `${d.from}:${d.to}:${d.value.startSide}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniqueDecos.push(d);
                        }
                    }

                    return Decoration.set(uniqueDecos, true);
                } catch (e) {
                    console.error('[Leaf] Widget plugin build error:', e);
                    return Decoration.none;
                }
            }

            update(update: ViewUpdate) {
                const cacheChanged = embedCacheVersion.value !== lastCacheVersion;
                if (update.docChanged || update.selectionSet || update.viewportChanged || cacheChanged) {
                    lastCacheVersion = embedCacheVersion.value;
                    this.decorations = this.build(update.state, update.view.visibleRanges);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
            eventHandlers: {
                mousedown(event: MouseEvent, view: EditorView) {
                    const target = event.target as HTMLElement;

                    // ── Task checkbox toggle ──
                    const label = target.closest('.cm-task-label') as HTMLElement | null;
                    if (!label) return;

                    const posStr = label.dataset.taskPos;
                    if (posStr == null) return;

                    event.preventDefault();
                    event.stopPropagation();

                    const taskPos = parseInt(posStr, 10);
                    if (isNaN(taskPos) || taskPos < 0 || taskPos >= view.state.doc.length) return;

                    const line = view.state.doc.lineAt(taskPos);
                    const lineText = line.text;

                    let newLine: string;
                    if (/- \[ \]/.test(lineText)) {
                        newLine = lineText.replace('- [ ]', '- [/]');
                    } else if (/- \[\/\]/.test(lineText)) {
                        newLine = lineText.replace('- [/]', '- [x]');
                    } else if (/- \[x\]/i.test(lineText)) {
                        newLine = lineText.replace(/- \[x\]/i, '- [ ]');
                    } else {
                        return;
                    }

                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: newLine },
                    });
                },
            },
        },
    );
}
