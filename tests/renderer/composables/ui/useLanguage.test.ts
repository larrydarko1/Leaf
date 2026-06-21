import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLanguage } from '@/renderer/composables/ui/useLanguage';

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    languageList: vi.fn(),
    languageSetActive: vi.fn(),
    languageOpenLeafDir: vi.fn(),
    log: { error: vi.fn(), warn: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// ── i18n mock ─────────────────────────────────────────────────────────────────

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        locale: { value: 'en' },
        setLocale: vi.fn((_locale: string) => {
            // Mock locale change
        }),
    }),
}));

// ── sample data ───────────────────────────────────────────────────────────────

const enLanguage = {
    id: 'en',
    name: 'English',
    path: '/locales/en.json',
};

const itLanguage = {
    id: 'it',
    name: 'Italiano',
    path: '/locales/it.json',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useLanguage', () => {
    let language: ReturnType<typeof useLanguage>;

    beforeEach(() => {
        vi.clearAllMocks();
        language = useLanguage();
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    describe('refresh', () => {
        it('populates the languages list from the IPC response', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage, itLanguage],
                activeId: 'en',
            });
            await language.refresh();
            expect(language.languages.value).toHaveLength(2);
            expect(language.languages.value[0].id).toBe('en');
        });

        it('sets activeId from the IPC response', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage, itLanguage],
                activeId: 'it',
            });
            await language.refresh();
            expect(language.activeId.value).toBe('it');
        });

        it('defaults to "en" when activeId is undefined in response', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage, itLanguage],
                activeId: undefined,
            });
            await language.refresh();
            expect(language.activeId.value).toBe('en');
        });

        it('sets isLoading to false after a successful call', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage],
                activeId: 'en',
            });
            await language.refresh();
            expect(language.isLoading.value).toBe(false);
        });

        it('sets isLoading to false when the IPC call throws', async () => {
            mockAPI.languageList.mockRejectedValue(new Error('IPC error'));
            await language.refresh();
            expect(language.isLoading.value).toBe(false);
        });

        it('logs error when IPC call fails', async () => {
            const error = new Error('Connection failed');
            mockAPI.languageList.mockRejectedValue(error);
            await language.refresh();
            expect(mockAPI.log.error).toHaveBeenCalledWith('Failed to list languages:', error);
        });
    });

    // ── setActive ─────────────────────────────────────────────────────────────

    describe('setActive', () => {
        beforeEach(async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage, itLanguage],
                activeId: 'en',
            });
            await language.refresh();
        });

        it('updates activeId when the IPC call succeeds', async () => {
            mockAPI.languageSetActive.mockResolvedValue({ success: true });
            await language.setActive('it');
            expect(language.activeId.value).toBe('it');
        });

        it('updates i18n locale when language changes', async () => {
            mockAPI.languageSetActive.mockResolvedValue({ success: true });
            await language.setActive('it');
            expect(language.activeId.value).toBe('it');
        });

        it('calls IPC handler with correct language id', async () => {
            mockAPI.languageSetActive.mockResolvedValue({ success: true });
            await language.setActive('it');
            expect(mockAPI.languageSetActive).toHaveBeenCalledWith('it');
        });

        it('returns early if trying to set the same language as active', async () => {
            language.activeId.value = 'en';
            await language.setActive('en');
            expect(mockAPI.languageSetActive).toHaveBeenCalledTimes(0);
        });

        it('logs error when IPC call fails', async () => {
            const error = new Error('Failed to set language');
            mockAPI.languageSetActive.mockRejectedValue(error);
            await language.setActive('it');
            expect(mockAPI.log.error).toHaveBeenCalled();
        });

        it('does not update activeId when IPC call fails', async () => {
            mockAPI.languageSetActive.mockRejectedValue(new Error('IPC error'));
            const originalId = language.activeId.value;
            await language.setActive('it');
            expect(language.activeId.value).toBe(originalId);
        });
    });

    // ── openLocalesFolder ─────────────────────────────────────────────────────

    describe('openLocalesFolder', () => {
        it('calls the IPC handler', async () => {
            mockAPI.languageOpenLeafDir.mockResolvedValue({ success: true });
            await language.openLocalesFolder();
            expect(mockAPI.languageOpenLeafDir).toHaveBeenCalled();
        });

        it('logs error when IPC call fails', async () => {
            const error = new Error('Could not open folder');
            mockAPI.languageOpenLeafDir.mockRejectedValue(error);
            await language.openLocalesFolder();
            expect(mockAPI.log.error).toHaveBeenCalled();
        });
    });

    // ── edge cases ────────────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles empty languages list', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [],
                activeId: 'en',
            });
            await language.refresh();
            expect(language.languages.value).toHaveLength(0);
        });

        it('handles IPC response with no languages key', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: undefined,
                activeId: 'en',
            });
            await language.refresh();
            expect(language.languages.value).toEqual([]);
        });

        it('defaults to "en" when activeId is missing and response succeeds', async () => {
            mockAPI.languageList.mockResolvedValue({
                success: true,
                languages: [enLanguage],
            });
            await language.refresh();
            expect(language.activeId.value).toBe('en');
        });
    });
});
