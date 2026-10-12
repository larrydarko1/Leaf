import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import type { Component } from 'vue';

const ICONS_DIR = resolve(import.meta.dirname, '../../../../src/renderer/components/icons');
const ICONS = readdirSync(ICONS_DIR).filter((file) => file.endsWith('.vue'));

function isComponentModule(mod: unknown): mod is { default: Component } {
    return typeof mod === 'object' && mod !== null && 'default' in mod;
}

describe('icons', () => {
    it('finds the icon components', () => {
        expect(ICONS.length).toBeGreaterThan(0);
    });

    it.each(ICONS)('%s renders a decorative svg', async (file) => {
        const mod: unknown = await import(resolve(ICONS_DIR, file));
        if (!isComponentModule(mod)) throw new Error(`${file} has no default export`);

        const wrapper = mount(mod.default);

        expect(wrapper.element).toBeInstanceOf(SVGSVGElement);
        expect(wrapper.attributes('aria-hidden')).toBe('true');
    });
});
