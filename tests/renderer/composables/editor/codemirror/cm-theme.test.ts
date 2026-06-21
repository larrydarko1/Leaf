import { describe, it, expect } from 'vitest';
import { leafEditorTheme, leafCodeEditorTheme } from '@/renderer/composables/editor/codemirror/cm-theme';

describe('cm-theme exports', () => {
    it('leafEditorTheme is a defined CodeMirror extension', () => {
        expect(leafEditorTheme).toBeDefined();
    });

    it('leafCodeEditorTheme is a defined CodeMirror extension', () => {
        expect(leafCodeEditorTheme).toBeDefined();
    });

    it('the two themes are distinct objects', () => {
        expect(leafEditorTheme).not.toBe(leafCodeEditorTheme);
    });
});
