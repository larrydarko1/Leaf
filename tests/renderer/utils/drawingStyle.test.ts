import { describe, it, expect } from 'vitest';

import { toStylePatch } from '@/renderer/utils/drawingStyle';

describe('toStylePatch', () => {
    it('patches a colour with a string', () => {
        expect(toStylePatch('strokeColor', '#ff0000')).toEqual({ strokeColor: '#ff0000' });
        expect(toStylePatch('fillColor', 'transparent')).toEqual({ fillColor: 'transparent' });
    });

    it('patches a size with a number', () => {
        expect(toStylePatch('strokeWidth', 4)).toEqual({ strokeWidth: 4 });
        expect(toStylePatch('borderRadius', 8)).toEqual({ borderRadius: 8 });
        expect(toStylePatch('fontSize', 24)).toEqual({ fontSize: 24 });
    });

    it('patches the stroke style with a known style only', () => {
        expect(toStylePatch('strokeStyle', 'dashed')).toEqual({ strokeStyle: 'dashed' });
        expect(toStylePatch('strokeStyle', 'wavy')).toBeNull();
    });

    it('refuses a value of the wrong kind', () => {
        expect(toStylePatch('strokeColor', 3)).toBeNull();
        expect(toStylePatch('fontSize', '24')).toBeNull();
    });
});
