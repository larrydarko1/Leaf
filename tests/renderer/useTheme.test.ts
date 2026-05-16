import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTheme } from '../../src/renderer/composables/ui/useTheme';

// ── electronAPI mock ──────────────────────────────────────────────────────────

const mockAPI = {
    themeList: vi.fn(),
    themeSetActive: vi.fn(),
    themeOpenLeafDir: vi.fn(),
    log: { error: vi.fn(), warn: vi.fn() },
};

Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
});

// ── localStorage stub ────────────────────────────────────────────────────────

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── sample data ───────────────────────────────────────────────────────────────

const darkTheme = {
    id: 'dark',
    name: 'Dark',
    description: 'Dark theme',
    colors: { 'bg-primary': '#1e1e1e', text1: '#ffffff' },
    path: '/themes/dark.json',
};

const lightTheme = {
    id: 'light',
    name: 'Light',
    description: 'Light theme',
    colors: { 'bg-primary': '#ffffff', text1: '#000000' },
    path: '/themes/light.json',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useTheme', () => {
    let theme: ReturnType<typeof useTheme>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        // useTheme uses module-level singletons — reset them by calling refresh
        theme = useTheme();
    });

    // ── refresh ───────────────────────────────────────────────────────────────

    describe('refresh', () => {
        it('populates the themes list from the IPC response', async () => {
            mockAPI.themeList.mockResolvedValue({
                success: true,
                themes: [darkTheme, lightTheme],
                activeId: 'dark',
            });
            await theme.refresh();
            expect(theme.themes.value).toHaveLength(2);
        });

        it('sets activeId from the IPC response', async () => {
            mockAPI.themeList.mockResolvedValue({
                success: true,
                themes: [darkTheme, lightTheme],
                activeId: 'light',
            });
            await theme.refresh();
            expect(theme.activeId.value).toBe('light');
        });

        it('applies the active theme to the document root as CSS custom properties', async () => {
            mockAPI.themeList.mockResolvedValue({
                success: true,
                themes: [darkTheme],
                activeId: 'dark',
            });
            await theme.refresh();
            expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('#1e1e1e');
        });

        it('sets isLoading to false after a successful call', async () => {
            mockAPI.themeList.mockResolvedValue({ success: true, themes: [], activeId: 'dark' });
            await theme.refresh();
            expect(theme.isLoading.value).toBe(false);
        });

        it('sets isLoading to false when the IPC call throws', async () => {
            mockAPI.themeList.mockRejectedValue(new Error('IPC error'));
            await theme.refresh();
            expect(theme.isLoading.value).toBe(false);
        });
    });

    // ── setActive ─────────────────────────────────────────────────────────────

    describe('setActive', () => {
        beforeEach(async () => {
            mockAPI.themeList.mockResolvedValue({
                success: true,
                themes: [darkTheme, lightTheme],
                activeId: 'dark',
            });
            await theme.refresh();
        });

        it('returns true and updates activeId when the IPC call succeeds', async () => {
            mockAPI.themeSetActive.mockResolvedValue({ success: true });
            const result = await theme.setActive('light');
            expect(result).toBe(true);
            expect(theme.activeId.value).toBe('light');
        });

        it('applies the new theme to the document root', async () => {
            mockAPI.themeSetActive.mockResolvedValue({ success: true });
            await theme.setActive('light');
            expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
        });

        it('persists the active theme id to localStorage', async () => {
            mockAPI.themeSetActive.mockResolvedValue({ success: true });
            await theme.setActive('light');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('leaf-theme-id', 'light');
        });

        it('returns false when the requested theme id is not in the themes list', async () => {
            const result = await theme.setActive('unknown-theme');
            expect(result).toBe(false);
        });

        it('returns false when the IPC call reports failure', async () => {
            mockAPI.themeSetActive.mockResolvedValue({ success: false, error: 'Not found' });
            const result = await theme.setActive('light');
            expect(result).toBe(false);
            expect(theme.activeId.value).toBe('dark'); // unchanged
        });

        it('returns false when the IPC call throws', async () => {
            mockAPI.themeSetActive.mockRejectedValue(new Error('IPC error'));
            const result = await theme.setActive('light');
            expect(result).toBe(false);
        });
    });

    // ── openThemesFolder ──────────────────────────────────────────────────────

    describe('openThemesFolder', () => {
        it('calls the IPC handler', async () => {
            mockAPI.themeOpenLeafDir.mockResolvedValue(undefined);
            await theme.openThemesFolder();
            expect(mockAPI.themeOpenLeafDir).toHaveBeenCalled();
        });

        it('does not throw when the IPC call rejects', async () => {
            mockAPI.themeOpenLeafDir.mockRejectedValue(new Error('shell error'));
            await expect(theme.openThemesFolder()).resolves.not.toThrow();
        });
    });
});
