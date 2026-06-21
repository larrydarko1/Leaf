import { describe, it, expect } from 'vitest';
import {
    HorizontalRuleWidget,
    TableWidget,
    EmbedWidget,
    TaskCheckboxWidget,
} from '@/renderer/composables/editor/codemirror/cm-widgets';

// ── HorizontalRuleWidget ──────────────────────────────────────────────────────

describe('HorizontalRuleWidget', () => {
    it('renders an <hr> with cm-hr class', () => {
        const w = new HorizontalRuleWidget();
        const el = w.toDOM();
        expect(el.tagName).toBe('HR');
        expect(el.className).toBe('cm-hr');
    });
});

// ── TableWidget ───────────────────────────────────────────────────────────────

describe('TableWidget.eq', () => {
    it('returns true for identical raw text', () => {
        const a = new TableWidget('| A |\n|---|\n| 1 |');
        const b = new TableWidget('| A |\n|---|\n| 1 |');
        expect(a.eq(b)).toBe(true);
    });

    it('returns false for different raw text', () => {
        const a = new TableWidget('| A |');
        const b = new TableWidget('| B |');
        expect(a.eq(b)).toBe(false);
    });
});

describe('TableWidget.ignoreEvent', () => {
    it('returns false so CodeMirror handles clicks', () => {
        expect(new TableWidget('').ignoreEvent()).toBe(false);
    });
});

describe('TableWidget.toDOM', () => {
    function renderTable(raw: string): HTMLElement {
        return new TableWidget(raw).toDOM();
    }

    it('wraps the table in a cm-table-wrapper div', () => {
        const el = renderTable('| A |\n|---|\n| 1 |');
        expect(el.className).toBe('cm-table-wrapper');
        expect(el.querySelector('table.cm-table')).not.toBeNull();
    });

    it('renders header cells in <thead>', () => {
        const el = renderTable('| Name | Age |\n|---|---|\n| Alice | 30 |');
        const ths = el.querySelectorAll('thead th');
        expect(ths).toHaveLength(2);
        expect(ths[0].textContent).toBe('Name');
        expect(ths[1].textContent).toBe('Age');
    });

    it('renders body rows in <tbody>', () => {
        const el = renderTable('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
        const rows = el.querySelectorAll('tbody tr');
        expect(rows).toHaveLength(2);
    });

    it('applies center alignment for :---: delimiter', () => {
        const el = renderTable('| A |\n|:---:|\n| 1 |');
        const th = el.querySelector('thead th') as HTMLElement;
        expect(th.style.textAlign).toBe('center');
    });

    it('applies right alignment for ---: delimiter', () => {
        const el = renderTable('| A |\n|---:|\n| 1 |');
        const th = el.querySelector('thead th') as HTMLElement;
        expect(th.style.textAlign).toBe('right');
    });

    it('applies left alignment for :--- delimiter', () => {
        const el = renderTable('| A |\n|:---|\n| 1 |');
        const th = el.querySelector('thead th') as HTMLElement;
        expect(th.style.textAlign).toBe('left');
    });

    it('no alignment style for plain --- delimiter', () => {
        const el = renderTable('| A |\n|---|\n| 1 |');
        const th = el.querySelector('thead th') as HTMLElement;
        expect(th.style.textAlign).toBe('');
    });

    it('renders bold inline markdown', () => {
        const el = renderTable('| **bold** |\n|---|\n| x |');
        expect(el.querySelector('thead th strong')?.textContent).toBe('bold');
    });

    it('renders italic inline markdown', () => {
        const el = renderTable('| *italic* |\n|---|\n| x |');
        expect(el.querySelector('thead th em')?.textContent).toBe('italic');
    });

    it('renders code inline markdown', () => {
        const el = renderTable('| `code` |\n|---|\n| x |');
        expect(el.querySelector('thead th code')?.textContent).toBe('code');
    });

    it('renders strikethrough inline markdown', () => {
        const el = renderTable('| ~~strike~~ |\n|---|\n| x |');
        expect(el.querySelector('thead th del')?.textContent).toBe('strike');
    });

    it('renders highlight inline markdown', () => {
        const el = renderTable('| ==highlight== |\n|---|\n| x |');
        expect(el.querySelector('thead th mark')?.textContent).toBe('highlight');
    });

    it('escapes XSS in cell content', () => {
        const el = renderTable('| <script>alert(1)</script> |\n|---|\n| x |');
        expect(el.querySelector('thead th script')).toBeNull();
        expect(el.querySelector('thead th')?.innerHTML).not.toContain('<script>');
    });

    it('renders a fallback for malformed table with fewer than 2 rows', () => {
        const el = renderTable('| A |');
        const table = el.querySelector('table')!;
        expect(table.textContent).toContain('A');
    });

    it('omits <tbody> when table has only header and delimiter', () => {
        const el = renderTable('| A |\n|---|');
        expect(el.querySelector('tbody')).toBeNull();
    });

    it('handles tables without leading/trailing pipe characters', () => {
        const el = renderTable('A | B\n--- | ---\n1 | 2');
        const ths = el.querySelectorAll('thead th');
        expect(ths).toHaveLength(2);
    });
});

// ── EmbedWidget ───────────────────────────────────────────────────────────────

describe('EmbedWidget.eq', () => {
    it('returns true when fileName and resolvedPath match', () => {
        const a = new EmbedWidget('img.png', '/path/img.png', 'image', '');
        const b = new EmbedWidget('img.png', '/path/img.png', 'image', '');
        expect(a.eq(b)).toBe(true);
    });

    it('returns false when resolvedPath differs', () => {
        const a = new EmbedWidget('img.png', '/a/img.png', 'image', '');
        const b = new EmbedWidget('img.png', '/b/img.png', 'image', '');
        expect(a.eq(b)).toBe(false);
    });
});

describe('EmbedWidget.ignoreEvent', () => {
    it('returns true', () => {
        expect(new EmbedWidget('f', '/f', 'image', '').ignoreEvent()).toBe(true);
    });
});

describe('EmbedWidget.toDOM', () => {
    it('renders a placeholder when resolvedPath is undefined', () => {
        const el = new EmbedWidget('missing.png', undefined, 'image', '').toDOM();
        expect(el.className).toBe('cm-embed-placeholder');
    });

    it('renders a placeholder when resolvedPath is empty string', () => {
        const el = new EmbedWidget('missing.png', '', 'image', '').toDOM();
        expect(el.className).toBe('cm-embed-placeholder');
    });

    it('escapes XSS in filename within placeholder', () => {
        const el = new EmbedWidget('<script>xss</script>', undefined, 'image', '').toDOM();
        expect(el.innerHTML).not.toContain('<script>');
    });

    it('renders an image with src and alt', () => {
        const el = new EmbedWidget('photo.png', '/vault/photo.png', 'image', '').toDOM();
        const img = el.querySelector('img')!;
        expect(img.alt).toBe('photo.png');
        expect(img.src).toContain('photo.png');
    });

    it('applies width and height from displayOptions', () => {
        const el = new EmbedWidget('photo.png', '/vault/photo.png', 'image', '200x100').toDOM();
        const img = el.querySelector('img') as HTMLImageElement;
        expect(img.width).toBe(200);
        expect(img.height).toBe(100);
    });

    it('applies only width when displayOptions has no height', () => {
        const el = new EmbedWidget('photo.png', '/vault/photo.png', 'image', '300').toDOM();
        const img = el.querySelector('img') as HTMLImageElement;
        expect(img.width).toBe(300);
    });

    it('renders a video wrapper with controls', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        expect(el.className).toBe('cm-embed-video-wrapper');
        expect(el.querySelector('video')).not.toBeNull();
        expect(el.querySelector('button.cm-embed-play-btn')).not.toBeNull();
    });

    it('play button pauses when media is playing', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement & { paused: boolean; pause: () => void };
        const btn = el.querySelector('button.cm-embed-play-btn') as HTMLButtonElement;
        // Simulate playing state
        Object.defineProperty(media, 'paused', { get: () => false, configurable: true });
        media.pause = vi.fn();
        btn.click();
        expect(media.pause).toHaveBeenCalled();
    });

    it('play button plays when media is paused', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const btn = el.querySelector('button.cm-embed-play-btn') as HTMLButtonElement;
        Object.defineProperty(media, 'paused', { get: () => true, configurable: true });
        media.play = vi.fn().mockResolvedValue(undefined);
        btn.click();
        expect(media.play).toHaveBeenCalled();
    });

    it('media play event updates play button to pause icon', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const btn = el.querySelector('button.cm-embed-play-btn') as HTMLButtonElement;
        media.dispatchEvent(new Event('play'));
        expect(btn.innerHTML).toContain('rect'); // pause SVG has rect elements
    });

    it('media pause event updates play button to play icon', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const btn = el.querySelector('button.cm-embed-play-btn') as HTMLButtonElement;
        media.dispatchEvent(new Event('play'));
        media.dispatchEvent(new Event('pause'));
        expect(btn.innerHTML).toContain('path'); // play SVG has path
    });

    it('media ended event resets play button', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const btn = el.querySelector('button.cm-embed-play-btn') as HTMLButtonElement;
        media.dispatchEvent(new Event('play'));
        media.dispatchEvent(new Event('ended'));
        expect(btn.innerHTML).toContain('path');
    });

    it('timeupdate updates time display when realDuration is known', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        // Simulate duration known
        Object.defineProperty(media, 'duration', { get: () => 120, configurable: true });
        media.dispatchEvent(new Event('loadedmetadata'));
        Object.defineProperty(media, 'currentTime', { get: () => 60, configurable: true });
        media.dispatchEvent(new Event('timeupdate'));
        const timeEl = el.querySelector('.cm-embed-time') as HTMLSpanElement;
        expect(timeEl.textContent).toBe('1:00');
    });

    it('loadedmetadata captures finite duration', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(media, 'duration', { get: () => 90, configurable: true });
        media.dispatchEvent(new Event('loadedmetadata'));
        expect(el.dataset.realDuration).toBe('90');
    });

    it('loadedmetadata probes when duration is Infinity', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(media, 'duration', { get: () => Infinity, configurable: true });
        media.dispatchEvent(new Event('loadedmetadata'));
        // Should try to probe by seeking to 1e10
        expect(media.currentTime).toBe(1e10);
    });

    it('seeked event finalizes probe and captures duration', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        // Set up probing state
        Object.defineProperty(media, 'duration', { get: () => Infinity, configurable: true });
        media.dispatchEvent(new Event('loadedmetadata'));
        // Now duration becomes finite after seek
        Object.defineProperty(media, 'duration', { get: () => 120, configurable: true });
        media.dispatchEvent(new Event('seeked'));
        expect(el.dataset.realDuration).toBe('120');
    });

    it('volume button mutes when volume > 0', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const volBtn = el.querySelector('button.cm-embed-vol-btn') as HTMLButtonElement;
        Object.defineProperty(media, 'volume', { get: () => 1, set: vi.fn(), configurable: true });
        const setter = vi.fn();
        Object.defineProperty(media, 'volume', { get: () => 1, set: setter, configurable: true });
        volBtn.click();
        expect(setter).toHaveBeenCalledWith(0);
    });

    it('volume button unmutes when muted', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const volBtn = el.querySelector('button.cm-embed-vol-btn') as HTMLButtonElement;
        const setter = vi.fn();
        // First click: mute
        Object.defineProperty(media, 'volume', { get: () => 1, set: setter, configurable: true });
        volBtn.click();
        // Second click: unmute
        Object.defineProperty(media, 'volume', { get: () => 0, set: setter, configurable: true });
        volBtn.click();
        expect(setter).toHaveBeenCalledTimes(2);
    });

    it('progress bar click seeks to position', () => {
        const el = new EmbedWidget('clip.mp4', '/vault/clip.mp4', 'video', '').toDOM();
        const media = el.querySelector('video') as HTMLVideoElement;
        const progressWrap = el.querySelector('.cm-embed-progress-wrapper') as HTMLElement;
        // Simulate known duration
        Object.defineProperty(media, 'duration', { get: () => 100, configurable: true });
        media.dispatchEvent(new Event('loadedmetadata'));
        const setter = vi.fn();
        Object.defineProperty(media, 'currentTime', { get: () => 0, set: setter, configurable: true });
        // Simulate click in the middle of the progress bar
        const mockRect = { left: 0, width: 100 };
        const progressTrack = el.querySelector('.cm-embed-progress-track') as HTMLElement;
        vi.spyOn(progressTrack, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect);
        progressWrap.dispatchEvent(Object.assign(new MouseEvent('click', { clientX: 50 })));
        expect(setter).toHaveBeenCalledWith(50);
    });

    it('renders an audio wrapper with controls', () => {
        const el = new EmbedWidget('sound.mp3', '/vault/sound.mp3', 'audio', '').toDOM();
        expect(el.className).toBe('cm-embed-audio-wrapper');
        expect(el.querySelector('audio')).not.toBeNull();
    });

    it('volume slider click on audio sets volume', () => {
        const el = new EmbedWidget('sound.mp3', '/vault/sound.mp3', 'audio', '').toDOM();
        const media = el.querySelector('audio') as HTMLAudioElement;
        const volWrap = el.querySelector('.cm-embed-vol-wrapper') as HTMLElement;
        const setter = vi.fn();
        Object.defineProperty(media, 'volume', { get: () => 0.5, set: setter, configurable: true });
        const volTrack = el.querySelector('.cm-embed-vol-track') as HTMLElement;
        vi.spyOn(volTrack, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
        volWrap.dispatchEvent(Object.assign(new MouseEvent('click', { clientX: 75 })));
        expect(setter).toHaveBeenCalledWith(0.75);
    });

    it('renders a PDF iframe', () => {
        const el = new EmbedWidget('doc.pdf', '/vault/doc.pdf', 'pdf', '').toDOM();
        expect(el.className).toBe('cm-embed-pdf-wrapper');
        expect(el.querySelector('iframe')).not.toBeNull();
    });

    it('renders a note link', () => {
        const el = new EmbedWidget('note.md', '/vault/note.md', 'note', '').toDOM();
        expect(el.className).toBe('cm-embed-note-link');
        expect(el.textContent).toContain('note.md');
    });

    it('falls back to placeholder for unknown media type', () => {
        const el = new EmbedWidget('file.xyz', '/vault/file.xyz', 'unknown', '').toDOM();
        expect(el.className).toBe('cm-embed-placeholder');
    });
});

// ── TaskCheckboxWidget ────────────────────────────────────────────────────────

describe('TaskCheckboxWidget.eq', () => {
    it('returns true for identical state and pos', () => {
        const a = new TaskCheckboxWidget('checked', 10);
        const b = new TaskCheckboxWidget('checked', 10);
        expect(a.eq(b)).toBe(true);
    });

    it('returns false when checked state differs', () => {
        expect(new TaskCheckboxWidget('checked', 0).eq(new TaskCheckboxWidget('unchecked', 0))).toBe(false);
    });

    it('returns false when pos differs', () => {
        expect(new TaskCheckboxWidget('checked', 0).eq(new TaskCheckboxWidget('checked', 1))).toBe(false);
    });
});

describe('TaskCheckboxWidget.ignoreEvent', () => {
    it('returns false so clicks are handled', () => {
        expect(new TaskCheckboxWidget('unchecked', 0).ignoreEvent()).toBe(false);
    });
});

describe('TaskCheckboxWidget.toDOM', () => {
    it('renders a label with cm-task-label class', () => {
        const el = new TaskCheckboxWidget('unchecked', 5).toDOM();
        expect(el.tagName).toBe('LABEL');
        expect(el.className).toBe('cm-task-label');
        expect(el.dataset.taskPos).toBe('5');
    });

    it('renders a checked checkbox for "checked" state', () => {
        const el = new TaskCheckboxWidget('checked', 0).toDOM();
        const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input.checked).toBe(true);
        expect(el.querySelector('span.cm-task-checked')).not.toBeNull();
    });

    it('renders a half-checked checkbox for "half" state', () => {
        const el = new TaskCheckboxWidget('half', 0).toDOM();
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.dataset.half).toBe('true');
        expect(el.querySelector('span.cm-task-half')).not.toBeNull();
    });

    it('renders an unchecked checkbox for "unchecked" state', () => {
        const el = new TaskCheckboxWidget('unchecked', 0).toDOM();
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.checked).toBe(false);
        expect(el.querySelector('span.cm-task-checked')).toBeNull();
    });
});
