import { mount, type VueWrapper, type ComponentMountingOptions } from '@vue/test-utils';
import { i18n } from '../../src/renderer/i18n';

/**
 * Custom mount function that automatically installs vue-i18n
 * This ensures components can use `useI18n()` without errors
 */
export function mountWithI18n<T>(component: T, options?: ComponentMountingOptions<T>): VueWrapper {
    const mountOptions: ComponentMountingOptions<any> = {
        ...options,
        global: {
            ...(options?.global ?? {}),
            plugins: [...(options?.global?.plugins ?? []), i18n],
        },
    };
    return mount(component as any, mountOptions);
}

export default mountWithI18n;
