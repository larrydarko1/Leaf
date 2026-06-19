/**
 * useLanguage — manages the active language / locale.
 *
 * The library of languages lives at ~/.leaf/locales/*.json and is hand-edited
 * or added by the user. This composable lists them and switches the active one.
 *
 * Architecture mirrors useTheme.
 */

import { ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LanguageInfo } from '@/schemas/vault';

const ACTIVE_LANGUAGE_LS_KEY = 'leaf-language-id';

// Singleton state — one language applies app-wide.
const languages: Ref<LanguageInfo[]> = ref<LanguageInfo[]>([]);
const activeId: Ref<string> = ref<string>('en');
const isLoading: Ref<boolean> = ref<boolean>(false);

export function useLanguage() {
    const { locale } = useI18n();

    async function refresh() {
        isLoading.value = true;
        try {
            const result = await window.electronAPI.languageList();
            if (result.success && result.languages !== undefined) {
                languages.value = result.languages;
                activeId.value = result.activeId ?? 'en';
                locale.value = result.activeId ?? 'en';
            }
        } catch (err) {
            window.electronAPI.log.error('Failed to list languages:', err);
        } finally {
            isLoading.value = false;
        }
    }

    async function setActive(id: string): Promise<boolean> {
        // Early return if already active
        if (id === activeId.value) {
            return true;
        }

        const language = languages.value.find((l) => l.id === id);
        if (language === undefined) return false;
        try {
            const result = await window.electronAPI.languageSetActive(id);
            if (result.success) {
                activeId.value = id;
                locale.value = id;
                // Cache for next launch
                try {
                    localStorage.setItem(ACTIVE_LANGUAGE_LS_KEY, id);
                } catch {
                    /* ignore quota errors */
                }
                return true;
            }
            window.electronAPI.log.warn('languageSetActive failed:', result.error);
        } catch (err) {
            window.electronAPI.log.error('languageSetActive error:', err);
        }
        return false;
    }

    async function openLocalesFolder(): Promise<void> {
        try {
            await window.electronAPI.languageOpenLeafDir();
        } catch (err) {
            window.electronAPI.log.error('languageOpenLeafDir error:', err);
        }
    }

    return {
        languages,
        activeId,
        isLoading,
        refresh,
        setActive,
        openLocalesFolder,
    };
}
