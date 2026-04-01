import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorTabs } from '../../src/renderer/composables/editor/useEditorTabs';
import type { FileInfo } from '../../src/renderer/types/electron';

function makeFile(name: string, path = `/${name}`): FileInfo {
    return {
        name,
        path,
        relativePath: name,
        extension: '.md',
        size: 0,
        modified: '',
        folder: '.',
    };
}

describe('useEditorTabs', () => {
    let tabs: ReturnType<typeof useEditorTabs>;

    beforeEach(() => {
        tabs = useEditorTabs();
    });

    // ── initial state ────────────────────────────────────────────────────────
    describe('initial state', () => {
        it('starts with no tabs', () => {
            expect(tabs.tabs.value).toHaveLength(0);
        });

        it('starts with activeIndex -1', () => {
            expect(tabs.activeIndex.value).toBe(-1);
        });

        it('activeFile is null when no tabs', () => {
            expect(tabs.activeFile.value).toBeNull();
        });

        it('activeTab is null when no tabs', () => {
            expect(tabs.activeTab.value).toBeNull();
        });
    });

    // ── openTab ──────────────────────────────────────────────────────────────
    describe('openTab', () => {
        it('adds a new tab and activates it', () => {
            const file = makeFile('note.md');
            const idx = tabs.openTab(file);
            expect(idx).toBe(0);
            expect(tabs.tabs.value).toHaveLength(1);
            expect(tabs.activeIndex.value).toBe(0);
            expect(tabs.activeFile.value?.path).toBe(file.path);
        });

        it('does not duplicate an already-open file', () => {
            const file = makeFile('note.md');
            tabs.openTab(file);
            tabs.openTab(file);
            expect(tabs.tabs.value).toHaveLength(1);
        });

        it('re-activates an existing tab when opened again', () => {
            const a = makeFile('a.md');
            const b = makeFile('b.md');
            tabs.openTab(a);
            tabs.openTab(b);
            expect(tabs.activeIndex.value).toBe(1);

            tabs.openTab(a);
            expect(tabs.activeIndex.value).toBe(0);
            expect(tabs.tabs.value).toHaveLength(2);
        });

        it('initialises a tab with null content and no unsaved changes', () => {
            tabs.openTab(makeFile('note.md'));
            const tab = tabs.activeTab.value!;
            expect(tab.content).toBeNull();
            expect(tab.savedContent).toBeNull();
            expect(tab.hasUnsavedChanges).toBe(false);
            expect(tab.scrollTop).toBe(0);
        });

        it('enforces the MAX_TABS cap', () => {
            for (let i = 0; i < tabs.MAX_TABS; i++) {
                tabs.openTab(makeFile(`file${i}.md`));
            }
            expect(tabs.tabs.value).toHaveLength(tabs.MAX_TABS);

            // Opening one more should not exceed the cap
            tabs.openTab(makeFile('overflow.md'));
            expect(tabs.tabs.value).toHaveLength(tabs.MAX_TABS);
        });

        it('replaces a non-active tab when at cap', () => {
            for (let i = 0; i < tabs.MAX_TABS; i++) {
                tabs.openTab(makeFile(`file${i}.md`));
            }
            // All 10 open; active is index 9 (last opened)
            const overflow = makeFile('overflow.md');
            tabs.openTab(overflow);
            const paths = tabs.tabs.value.map((t) => t.file.path);
            expect(paths).toContain(overflow.path);
            expect(tabs.tabs.value).toHaveLength(tabs.MAX_TABS);
        });
    });

    // ── closeTab ─────────────────────────────────────────────────────────────
    describe('closeTab', () => {
        it('removes the tab at the given index', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.closeTab(0);
            expect(tabs.tabs.value).toHaveLength(1);
            expect(tabs.tabs.value[0].file.name).toBe('b.md');
        });

        it('sets activeIndex to -1 when last tab is closed', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.closeTab(0);
            expect(tabs.tabs.value).toHaveLength(0);
            expect(tabs.activeIndex.value).toBe(-1);
            expect(tabs.activeFile.value).toBeNull();
        });

        it('activates previous tab when active tab is last and closed', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            // active = 1 (b.md); close it
            tabs.closeTab(1);
            expect(tabs.activeIndex.value).toBe(0);
        });

        it('adjusts activeIndex down when a tab before active is closed', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.openTab(makeFile('c.md'));
            tabs.switchTab(2); // active = c.md (index 2)
            tabs.closeTab(0); // remove a.md; c.md is now at index 1
            expect(tabs.activeIndex.value).toBe(1);
            expect(tabs.activeFile.value?.name).toBe('c.md');
        });

        it('does nothing for out-of-range index', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.closeTab(5);
            expect(tabs.tabs.value).toHaveLength(1);
        });

        it('activates next tab when a middle tab is closed', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.openTab(makeFile('c.md'));
            tabs.switchTab(1); // active = b.md
            tabs.closeTab(1); // close b.md; c.md slides to index 1
            expect(tabs.activeIndex.value).toBe(1);
            expect(tabs.activeFile.value?.name).toBe('c.md');
        });
    });

    // ── switchTab ────────────────────────────────────────────────────────────
    describe('switchTab', () => {
        it('changes the active tab', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.switchTab(0);
            expect(tabs.activeIndex.value).toBe(0);
            expect(tabs.activeFile.value?.name).toBe('a.md');
        });

        it('ignores out-of-range indices', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.switchTab(99);
            expect(tabs.activeIndex.value).toBe(0);
        });

        it('ignores negative indices', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.switchTab(-1);
            expect(tabs.activeIndex.value).toBe(0);
        });
    });

    // ── updateTabContent ─────────────────────────────────────────────────────
    describe('updateTabContent', () => {
        it('updates content and unsaved flag for matching tab', () => {
            const file = makeFile('a.md');
            tabs.openTab(file);
            tabs.updateTabContent(file.path, 'hello', true);
            const tab = tabs.tabs.value[0];
            expect(tab.content).toBe('hello');
            expect(tab.hasUnsavedChanges).toBe(true);
        });

        it('does nothing for an unknown file path', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.updateTabContent('/nonexistent.md', 'x', true);
            expect(tabs.tabs.value[0].content).toBeNull();
        });
    });

    // ── markTabSaved ─────────────────────────────────────────────────────────
    describe('markTabSaved', () => {
        it('clears unsaved flag and updates savedContent', () => {
            const file = makeFile('a.md');
            tabs.openTab(file);
            tabs.updateTabContent(file.path, 'new content', true);
            tabs.markTabSaved(file.path, 'new content');
            const tab = tabs.tabs.value[0];
            expect(tab.hasUnsavedChanges).toBe(false);
            expect(tab.savedContent).toBe('new content');
            expect(tab.content).toBe('new content');
        });
    });

    // ── saveScrollPosition ───────────────────────────────────────────────────
    describe('saveScrollPosition', () => {
        it('stores the scroll position on the tab', () => {
            const file = makeFile('a.md');
            tabs.openTab(file);
            tabs.saveScrollPosition(file.path, 320);
            expect(tabs.tabs.value[0].scrollTop).toBe(320);
        });

        it('does nothing for an unknown path', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.saveScrollPosition('/unknown.md', 100);
            expect(tabs.tabs.value[0].scrollTop).toBe(0);
        });
    });

    // ── syncTabFiles ─────────────────────────────────────────────────────────
    describe('syncTabFiles', () => {
        it('removes tabs whose files no longer exist', () => {
            const a = makeFile('a.md');
            const b = makeFile('b.md');
            tabs.openTab(a);
            tabs.openTab(b);
            tabs.syncTabFiles([b]);
            expect(tabs.tabs.value).toHaveLength(1);
            expect(tabs.tabs.value[0].file.name).toBe('b.md');
        });

        it('updates FileInfo reference when file still exists', () => {
            const a = makeFile('a.md');
            tabs.openTab(a);
            const updated = { ...a, size: 999 };
            tabs.syncTabFiles([updated]);
            expect(tabs.tabs.value[0].file.size).toBe(999);
        });

        it('clamps activeIndex if it exceeds new tab count', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.openTab(makeFile('c.md'));
            tabs.switchTab(2);
            // Only a.md survives the refresh
            tabs.syncTabFiles([makeFile('a.md')]);
            expect(tabs.activeIndex.value).toBe(0);
        });
    });

    // ── renameTabFile ────────────────────────────────────────────────────────
    describe('renameTabFile', () => {
        it('updates the FileInfo on the matching tab', () => {
            const file = makeFile('old.md', '/old.md');
            tabs.openTab(file);
            const renamed = makeFile('new.md', '/new.md');
            tabs.renameTabFile('/old.md', renamed);
            expect(tabs.tabs.value[0].file.name).toBe('new.md');
            expect(tabs.tabs.value[0].file.path).toBe('/new.md');
        });

        it('does nothing for an unknown old path', () => {
            const file = makeFile('a.md', '/a.md');
            tabs.openTab(file);
            tabs.renameTabFile('/nonexistent.md', makeFile('x.md'));
            expect(tabs.tabs.value[0].file.name).toBe('a.md');
        });
    });

    // ── clearTabs ────────────────────────────────────────────────────────────
    describe('clearTabs', () => {
        it('removes all tabs and resets activeIndex', () => {
            tabs.openTab(makeFile('a.md'));
            tabs.openTab(makeFile('b.md'));
            tabs.clearTabs();
            expect(tabs.tabs.value).toHaveLength(0);
            expect(tabs.activeIndex.value).toBe(-1);
            expect(tabs.activeFile.value).toBeNull();
        });
    });
});
