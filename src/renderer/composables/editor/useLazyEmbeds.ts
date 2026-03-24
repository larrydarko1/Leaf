// useLazyEmbeds — defers media preload until elements scroll into view.
// Owns: IntersectionObserver lifecycle, preload attribute hydration.
// Does NOT own: embed HTML generation (useMarkdownRender), media playback (useMarkdownPreview).

import { watchEffect, onUnmounted, type Ref } from 'vue';

/**
 * Observes embedded video/audio elements inside the markdown preview container
 * and switches their `preload` from "none" to "metadata" when they enter the viewport.
 *
 * Images and iframes already use the native `loading="lazy"` attribute.
 * This composable handles `<video>` and `<audio>` which don't support that attribute.
 */
export function useLazyEmbeds(containerRef: Ref<HTMLElement | null>, renderedMarkdown: Ref<string>): void {
    let observer: IntersectionObserver | null = null;

    function hydrateMedia(el: Element): void {
        const preload = el.getAttribute('data-lazy-preload');
        if (preload) {
            el.setAttribute('preload', preload);
            el.removeAttribute('data-lazy-preload');
        }
        observer?.unobserve(el);
    }

    function observeContainer(): void {
        observer?.disconnect();

        const container = containerRef.value;
        if (!container) return;

        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        hydrateMedia(entry.target);
                    }
                }
            },
            {
                root: container,
                rootMargin: '200px 0px', // start preloading 200px before visible
            },
        );

        container.querySelectorAll('[data-lazy-preload]').forEach((el) => {
            observer!.observe(el);
        });
    }

    // Re-observe whenever the container mounts/unmounts or rendered HTML changes.
    // flush: 'post' ensures the DOM has been updated before we query it.
    watchEffect(
        () => {
            void containerRef.value;
            void renderedMarkdown.value;
            observeContainer();
        },
        { flush: 'post' },
    );

    onUnmounted(() => {
        observer?.disconnect();
        observer = null;
    });
}
