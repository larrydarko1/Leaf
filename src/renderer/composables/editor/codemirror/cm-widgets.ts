/**
 * cm-widgets — CodeMirror 6 WidgetType classes for markdown live-preview.
 */

import { WidgetType } from '@codemirror/view';

// ── Widget classes ────────────────────────────────────────────────────────────

export class HorizontalRuleWidget extends WidgetType {
    toDOM(): HTMLElement {
        const hr = document.createElement('hr');
        hr.className = 'cm-hr';
        return hr;
    }
}

// ── Table widget ──────────────────────────────────────────────────────────────

/**
 * Renders a GFM markdown table as an HTML <table> element.
 * Shown when the cursor is not on any line of the table (Obsidian-style live preview).
 */
export class TableWidget extends WidgetType {
    rawText: string;

    constructor(rawText: string) {
        super();
        this.rawText = rawText;
    }

    eq(other: TableWidget): boolean {
        return this.rawText === other.rawText;
    }

    /** Safe HTML escape using the DOM (prevents XSS). */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render inline markdown within a cell (bold, italic, code, strikethrough, highlight).
     * Content is HTML-escaped first, so regex replacements are safe.
     */
    private renderInline(text: string): string {
        const escaped = this.escapeHtml(text);
        return escaped
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            .replace(/==(.+?)==/g, '<mark>$1</mark>');
    }

    /**
     * Split a raw table row into trimmed cell strings.
     * Handles both `| a | b |` and `a | b` forms.
     */
    private parseCells(line: string): string[] {
        const trimmed = line.trim();
        const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
        const stripped = inner.endsWith('|') ? inner.slice(0, -1) : inner;
        return stripped.split('|').map((c) => c.trim());
    }

    /** Derive CSS text-align from a GFM delimiter cell (e.g. `:---:`, `---:`). */
    private parseAlignment(cell: string): string {
        const t = cell.trim();
        const left = t.startsWith(':');
        const right = t.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
    }

    toDOM(): HTMLElement {
        const lines = this.rawText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

        const wrapper = document.createElement('div');
        wrapper.className = 'cm-table-wrapper';

        const table = document.createElement('table');
        table.className = 'cm-table';

        if (lines.length < 2) {
            // Malformed — render as plain text fallback
            table.textContent = this.rawText;
            wrapper.appendChild(table);
            return wrapper;
        }

        const headerCells = this.parseCells(lines[0]);
        const delimCells = this.parseCells(lines[1]);
        const aligns = delimCells.map((c) => this.parseAlignment(c));

        // <thead>
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerCells.forEach((cell, i) => {
            const th = document.createElement('th');
            if (aligns[i] !== '') th.style.textAlign = aligns[i];
            th.innerHTML = this.renderInline(cell);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // <tbody>
        if (lines.length > 2) {
            const tbody = document.createElement('tbody');
            for (let r = 2; r < lines.length; r++) {
                const cells = this.parseCells(lines[r]);
                const tr = document.createElement('tr');
                cells.forEach((cell, i) => {
                    const td = document.createElement('td');
                    if (aligns[i] !== '') td.style.textAlign = aligns[i];
                    td.innerHTML = this.renderInline(cell);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
        }

        wrapper.appendChild(table);
        return wrapper;
    }

    /** Let CM handle events so clicks place the cursor (triggering raw-edit mode). */
    ignoreEvent(): boolean {
        return false;
    }
}

export class EmbedWidget extends WidgetType {
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
        if (this.resolvedPath == null || this.resolvedPath === '') {
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
                if (this.displayOptions !== '') {
                    const dimMatch = this.displayOptions.match(/^(\d+)(?:x(\d+))?$/);
                    if (dimMatch !== null) {
                        img.width = parseInt(dimMatch[1]);
                        if (dimMatch[2] !== undefined) img.height = parseInt(dimMatch[2]);
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
                    if (realDuration === 0) {
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
                    if (realDuration !== 0) {
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
                    if (media.paused) void media.play();
                    else void media.pause();
                };
                if (isVideo)
                    (media as HTMLVideoElement).onclick = () => {
                        if (media.paused) void media.play();
                        else void media.pause();
                    };

                // Seek handler — uses realDuration from closure (set by probe)
                progressWrap.onclick = (e) => {
                    e.stopPropagation();
                    const dur = realDuration !== 0 ? realDuration : isFinite(media.duration) ? media.duration : 0;
                    if (dur === 0) return;
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

export class TaskCheckboxWidget extends WidgetType {
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
