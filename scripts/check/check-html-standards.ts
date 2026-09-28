#!/usr/bin/env node
/**
 * Document-level standards gate for the renderer shell. `src/renderer/index.html` is
 * the one file ESLint's Vue parser never reads, and stylelint has the same blind spot
 * one level down: it can police how a rule is written but not that a rule still
 * EXISTS. The rules live in @larrydarko/lint-config/gates/html-standards.
 *
 * What stays here is this repo's answers.
 *
 * `require` is three tags, and the twelve it leaves out are deliberate, not missing.
 * There is no mobile viewport, no browser chrome and no tab, so `viewport`,
 * `theme-color` and `icon` mean nothing here — the window icon comes from
 * BrowserWindow and electron-builder. `title` is left out because src/main/index.ts
 * sets `title: ''` on purpose and a `<title>` in the shell would override the window
 * title the main process chose. Nothing crawls a `file://` document, so og:*,
 * twitter:*, canonical and description would be cargo cult. What is left is `lang`,
 * which screen readers read before the app picks a locale, `charset`, because notes
 * are UTF-8 text with arbitrary content, and `appMount`, because renaming `#app`
 * renders nothing with no error.
 *
 * `csp: true` — in a packaged build the renderer loads over `file://`, where there is
 * no server to send a header, so the meta tag IS the policy. It is also the only
 * thing between a malicious note — markdown is rendered, and there are `v-html`
 * sites — and script execution inside a window that can talk to the main process. It
 * is checked positively and negatively, because a CSP degrades silently: a directive
 * someone widened still parses, still loads the app, and reports nothing.
 *
 * The no-remote-subresources rule needs no option: this app's claim is that nothing
 * leaves the device, and a single remote `<script>` or `<link>` in the shell breaks
 * that claim at the one point where the CSP is also the only guard.
 */
import { checkHtmlStandards } from '@larrydarko/lint-config/gates/html-standards';

checkHtmlStandards({
    indexHtml: 'src/renderer/index.html',
    baseScss: 'src/renderer/styles/_base.scss',
    require: ['lang', 'charset', 'appMount'],
    csp: true,
});
