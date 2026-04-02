import { EditorView } from '@codemirror/view';

/**
 * CodeMirror theme for Leaf's live-preview markdown editor.
 * Uses the same CSS custom properties as the rest of the app,
 * so it automatically applies dark/light themes.
 */
export const leafEditorTheme = EditorView.theme({
    // ── Root editor ───────────────────────────────────────────────────────
    '&': {
        flex: '1',
        height: '100%',
        fontSize: '1rem',
        fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        lineHeight: '1.6',
        color: 'var(--text1)',
        backgroundColor: 'transparent',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        overflow: 'auto',
        padding: '2rem',
        fontFamily: 'inherit',
    },
    '.cm-content': {
        caretColor: 'var(--accent-color, #3eb489)',
        padding: '0',
    },
    '.cm-cursor': {
        borderLeftColor: 'var(--accent-color, #3eb489)',
        borderLeftWidth: '2px',
    },
    '.cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--accent-color, #3eb489) 25%, transparent) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--accent-color, #3eb489) 30%, transparent) !important',
    },
    '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--text2) 5%, transparent)',
    },
    '.cm-gutters': {
        display: 'none',
    },
    '.cm-placeholder': {
        color: 'var(--text2)',
    },

    // ── Live preview: headings ────────────────────────────────────────────
    '.cm-heading': {
        fontWeight: '600',
        color: 'var(--text1)',
        lineHeight: '1.4',
    },
    '.cm-heading-1': { fontSize: '2em' },
    '.cm-heading-2': { fontSize: '1.5em' },
    '.cm-heading-3': { fontSize: '1.25em' },
    '.cm-heading-4': { fontSize: '1.1em' },
    '.cm-heading-5': { fontSize: '1em' },
    '.cm-heading-6': { fontSize: '0.9em', color: 'var(--text2)' },

    // ── Live preview: inline styles ───────────────────────────────────────
    '.cm-emphasis': {
        fontStyle: 'italic',
    },
    '.cm-strong': {
        fontWeight: '600',
        color: 'var(--accent-color, #3eb489)',
    },
    '.cm-strikethrough': {
        textDecoration: 'line-through',
        opacity: '0.7',
    },
    '.cm-inline-code': {
        fontFamily: "'SF Mono', Monaco, Inconsolata, 'Fira Code', Menlo, Consolas, monospace",
        fontSize: '0.9em',
        background: 'color-mix(in srgb, var(--text2) 15%, transparent)',
        padding: '0.2em 0.4em',
        borderRadius: '3px',
        color: 'var(--base2)',
    },
    '.cm-highlight': {
        backgroundColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)',
        padding: '0.1em 0.3em',
        borderRadius: '4px',
    },
    '.cm-link': {
        color: 'var(--accent-color, #3eb489)',
        textDecoration: 'none',
        cursor: 'pointer',
    },
    '.cm-link:hover': {
        textDecoration: 'underline',
    },
    '.cm-image-link': {
        color: 'var(--accent-color, #3eb489)',
        fontStyle: 'italic',
    },

    // ── Live preview: blocks ──────────────────────────────────────────────
    '.cm-blockquote': {
        paddingLeft: '1em',
        borderLeft: '4px solid var(--accent-color, #3eb489)',
        color: 'var(--text2)',
    },
    '.cm-code-block': {
        fontFamily: "'SF Mono', Monaco, Inconsolata, 'Fira Code', Menlo, Consolas, monospace",
        fontSize: '0.875em',
        backgroundColor: 'color-mix(in srgb, var(--text2) 10%, transparent)',
        padding: '0 1em',
    },
    '.cm-hr': {
        border: 'none',
        borderTop: '2px solid var(--text3)',
        margin: '1em 0',
    },

    // ── Live preview: lists ───────────────────────────────────────────────
    '.cm-list-bullet': {
        color: 'var(--accent-color, #3eb489)',
        fontWeight: '700',
    },

    // ── Task checkboxes ───────────────────────────────────────────────────
    '.cm-task-line': {
        // No extra styling needed, the checkboxes are inline widgets
    },
    '.cm-task-done': {
        textDecoration: 'line-through',
        textDecorationColor: 'var(--text2)',
        color: 'var(--text2)',
    },
    '.cm-task-label': {
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        marginRight: '0.5em',
        verticalAlign: 'middle',
    },
    '.cm-task-checkbox-input': {
        position: 'absolute',
        opacity: '0',
        width: '0',
        height: '0',
    },
    '.cm-task-checkbox': {
        width: '18px',
        height: '18px',
        minWidth: '18px',
        backgroundColor: 'var(--text3)',
        borderRadius: '5px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
        position: 'relative',
        display: 'inline-block',
    },
    '.cm-task-checked': {
        backgroundColor: '#4caf50',
        boxShadow: '0 0 8px #4caf5088',
    },
    // Checkmark pseudo-element via CSS
    '.cm-task-checked::after': {
        content: '""',
        position: 'absolute',
        left: '50%',
        top: '45%',
        width: '5px',
        height: '9px',
        border: 'solid var(--text1)',
        borderWidth: '0 2px 2px 0',
        transform: 'translate(-50%, -55%) rotate(45deg)',
        display: 'block',
    },
    '.cm-task-half': {
        background: 'linear-gradient(to top, #4caf50 50%, var(--text3, #ddd) 50%)',
        boxShadow: '0 0 6px #4caf5055',
    },

    // ── Embed widgets ─────────────────────────────────────────────────────
    '.cm-embed-image-wrapper': {
        margin: '0.5em 0',
    },
    '.cm-embed-image': {
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '8px',
        display: 'block',
    },
    '.cm-embed-video-wrapper': {
        margin: '0.5em 0',
        maxWidth: '100%',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--text3)',
    },
    '.cm-embed-video': {
        maxWidth: '100%',
        maxHeight: '500px',
        display: 'block',
        width: '100%',
        cursor: 'pointer',
    },
    '.cm-embed-audio-wrapper': {
        margin: '0.5em 0',
        maxWidth: '500px',
    },
    '.cm-embed-audio-controls': {
        borderRadius: '12px',
        border: '1px solid var(--text3)',
    },

    // ── Custom media controls (shared by video & audio embeds) ────────────
    '.cm-embed-controls': {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        width: '100%',
        padding: '0.5rem 0.85rem',
        background: 'var(--base1, #1a1a2e)',
        boxSizing: 'border-box',
    },
    '.cm-embed-play-btn': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        minWidth: '30px',
        borderRadius: '50%',
        border: 'none',
        background: 'var(--accent-color, #3eb489)',
        color: 'white',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: '0',
    },
    '.cm-embed-play-btn:hover': {
        transform: 'scale(1.08)',
        filter: 'brightness(1.1)',
    },
    '.cm-embed-time': {
        fontSize: '0.7rem',
        color: 'var(--text2)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: '2.5em',
        textAlign: 'center',
        userSelect: 'none',
    },
    '.cm-embed-progress-wrapper': {
        flex: '1',
        cursor: 'pointer',
        padding: '0.4rem 0',
        display: 'flex',
        alignItems: 'center',
    },
    '.cm-embed-progress-track': {
        width: '100%',
        height: '4px',
        background: 'color-mix(in srgb, var(--text2) 20%, transparent)',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    '.cm-embed-progress-fill': {
        height: '100%',
        background: 'var(--accent-color, #3eb489)',
        borderRadius: '2px',
        transition: 'width 0.05s linear',
    },
    '.cm-embed-vol-btn': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        color: 'var(--text2)',
        cursor: 'pointer',
        padding: '0 0.15rem',
        minWidth: '20px',
        transition: 'color 0.15s ease',
    },
    '.cm-embed-vol-btn:hover': {
        color: 'var(--text1)',
    },
    '.cm-embed-vol-wrapper': {
        width: '60px',
        minWidth: '40px',
        cursor: 'pointer',
        padding: '0.4rem 0',
        display: 'flex',
        alignItems: 'center',
    },
    '.cm-embed-vol-track': {
        width: '100%',
        height: '4px',
        background: 'color-mix(in srgb, var(--text2) 20%, transparent)',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    '.cm-embed-vol-fill': {
        height: '100%',
        background: 'var(--text2)',
        borderRadius: '2px',
        transition: 'width 0.05s linear',
    },
    '.cm-embed-pdf-wrapper': {
        margin: '0.5em 0',
        border: '1px solid var(--text3)',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    '.cm-embed-pdf': {
        width: '100%',
        height: '600px',
        border: 'none',
        display: 'block',
    },
    '.cm-embed-note-link': {
        margin: '0.5em 0',
        padding: '0.5em 0.75em',
        background: 'color-mix(in srgb, var(--text2) 8%, transparent)',
        border: '1px solid var(--text3)',
        borderRadius: '6px',
        color: 'var(--accent-color, #3eb489)',
        cursor: 'pointer',
    },
    '.cm-embed-placeholder': {
        margin: '0.5em 0',
        padding: '0.5em 0.75em',
        background: 'color-mix(in srgb, var(--text2) 6%, transparent)',
        border: '1px dashed var(--text3)',
        borderRadius: '6px',
        color: 'var(--text2)',
        fontSize: '0.9em',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4em',
    },
});
