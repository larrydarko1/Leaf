import type { Ref } from 'vue';

/**
 * Handles click and input interactions within the markdown preview pane:
 * heading fold toggles, embedded media play/pause/seek/volume, and checkbox toggling.
 */
export function useMarkdownPreview(
    content: Ref<string>,
    onContentChange: () => void,
    formatTime: (seconds: number) => string,
) {
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

        // --- Task list fold toggle ---
        const taskFoldToggle = target.closest('.task-fold-toggle') as HTMLElement;
        if (taskFoldToggle) {
            event.preventDefault();
            event.stopPropagation();
            const li = taskFoldToggle.closest('li.task') as HTMLElement;
            li?.classList.toggle('task-collapsed');
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
                vidPlayBtn.innerHTML =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
                const updateProgress = () => {
                    const fill = container.querySelector('.embed-video-progress-fill') as HTMLElement;
                    const curEl = container.querySelector('.embed-video-current') as HTMLElement;
                    if (fill && video.duration) fill.style.width = (video.currentTime / video.duration) * 100 + '%';
                    if (curEl) curEl.textContent = formatTime(video.currentTime);
                    if (!video.paused) requestAnimationFrame(updateProgress);
                };
                updateProgress();
                video.onended = () => {
                    vidPlayBtn.innerHTML =
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
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
                vidPlayBtn.innerHTML =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
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
                audPlayBtn.innerHTML =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
                const updateProgress = () => {
                    const fill = container.querySelector('.embed-audio-progress-fill') as HTMLElement;
                    const curEl = container.querySelector('.embed-audio-current') as HTMLElement;
                    if (fill && audio.duration) fill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
                    if (curEl) curEl.textContent = formatTime(audio.currentTime);
                    if (!audio.paused) requestAnimationFrame(updateProgress);
                };
                updateProgress();
                audio.onended = () => {
                    audPlayBtn.innerHTML =
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
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
                audPlayBtn.innerHTML =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
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
            if (fill) fill.style.width = pct * 100 + '%';
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
            if (fill) fill.style.width = pct * 100 + '%';
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
            const svgMuted =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
            const svgLow =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            const svgHigh =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
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
            const svgMuted =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2"15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
            const svgLow =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            const svgHigh =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            if (vol === 0) {
                muteBtn.innerHTML = svgMuted;
            } else if (vol < 0.5) {
                muteBtn.innerHTML = svgLow;
            } else {
                muteBtn.innerHTML = svgHigh;
            }
        }
    }

    return { onMarkdownPreviewClick, onMarkdownPreviewInput };
}
