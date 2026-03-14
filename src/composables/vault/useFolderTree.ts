import { ref, computed, watch } from 'vue';
import type { FileInfo, FolderInfo } from '../../types/electron';
import type { TreeNode } from '../../components/FolderNode.vue';

export function useFolderTree(
    getFiles: () => FileInfo[],
    getFolders: () => FolderInfo[] | undefined,
    getCurrentFolder: () => string | null
) {
    const expandedFolders = ref<Set<string>>(new Set());

    function getFileNameWithoutExtension(fileName: string): string {
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    }

    const allFolderPaths = computed(() => {
        const paths = new Set<string>();
        const folders = getFolders();
        const files = getFiles();

        if (folders) {
            folders.forEach(folder => paths.add(folder.relativePath));
        }

        files.forEach(file => {
            if (file.folder === '.') return;
            const parts = file.folder.split(/[/\\]/);
            let currentPath = '';
            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                paths.add(currentPath);
            });
        });

        return paths;
    });

    const folderTree = computed(() => {
        const files = getFiles();
        const folders = getFolders();
        const root: TreeNode[] = [];
        const folderMap = new Map<string, TreeNode>();

        // First pass: create folder nodes from explicit folders list
        if (folders) {
            folders.forEach(folder => {
                if (!folderMap.has(folder.relativePath)) {
                    folderMap.set(folder.relativePath, {
                        path: folder.relativePath,
                        name: folder.name,
                        type: 'folder',
                        children: []
                    });
                }
            });
        }

        // Second pass: create folder nodes from file paths (backwards compatibility)
        files.forEach(file => {
            if (file.folder === '.') return;
            const parts = file.folder.split(/[/\\]/);
            let currentPath = '';
            parts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!folderMap.has(currentPath)) {
                    folderMap.set(currentPath, {
                        path: currentPath,
                        name: part,
                        type: 'folder',
                        children: []
                    });
                }
            });
        });

        // Third pass: build the tree hierarchy
        folderMap.forEach((node, path) => {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (!parentPath) {
                root.push(node);
            } else {
                const parent = folderMap.get(parentPath);
                if (parent?.children) parent.children.push(node);
            }
        });

        // Fourth pass: add files to their folders and root
        files.forEach(file => {
            const fileNode: TreeNode = {
                path: file.path,
                name: getFileNameWithoutExtension(file.name),
                type: 'file',
                file
            };
            if (file.folder === '.') {
                root.push(fileNode);
            } else {
                const parent = folderMap.get(file.folder);
                if (parent?.children) parent.children.push(fileNode);
            }
        });

        // Sort: folders first, then alphabetical within each group
        const sortNodes = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => { if (node.children) sortNodes(node.children); });
        };
        sortNodes(root);
        return root;
    });

    const flattenedItems = computed(() => {
        const items: { type: 'file' | 'folder'; file?: FileInfo; folderPath?: string }[] = [];

        function traverse(nodes: TreeNode[]) {
            for (const node of nodes) {
                if (node.type === 'folder') {
                    items.push({ type: 'folder', folderPath: node.path });
                    if (expandedFolders.value.has(node.path) && node.children) {
                        traverse(node.children);
                    }
                } else if (node.type === 'file' && node.file) {
                    items.push({ type: 'file', file: node.file });
                }
            }
        }

        traverse(folderTree.value);
        return items;
    });

    const visibleFiles = computed(() =>
        flattenedItems.value
            .filter(item => item.type === 'file' && item.file)
            .map(item => item.file!)
    );

    function toggleFolder(folderPath: string) {
        if (expandedFolders.value.has(folderPath)) {
            expandedFolders.value.delete(folderPath);
        } else {
            expandedFolders.value.add(folderPath);
        }
        expandedFolders.value = new Set(expandedFolders.value);
    }

    // Load expanded folders state from localStorage when vault changes
    watch(getCurrentFolder, (newFolder) => {
        if (newFolder) {
            const saved = localStorage.getItem(`leaf-expanded-folders-${newFolder}`);
            if (saved) {
                try {
                    expandedFolders.value = new Set(JSON.parse(saved));
                } catch {
                    expandedFolders.value = new Set(allFolderPaths.value);
                }
            } else {
                expandedFolders.value = new Set(allFolderPaths.value);
            }
        }
    }, { immediate: true });

    // Persist expanded folders state to localStorage
    watch(expandedFolders, (newExpanded) => {
        const currentFolder = getCurrentFolder();
        if (currentFolder) {
            localStorage.setItem(
                `leaf-expanded-folders-${currentFolder}`,
                JSON.stringify(Array.from(newExpanded))
            );
        }
    }, { deep: true });

    return { expandedFolders, folderTree, flattenedItems, visibleFiles, toggleFolder, getFileNameWithoutExtension };
}
