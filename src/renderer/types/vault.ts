import type { FileInfo } from '../types/electron';

export type TreeNode = {
    path: string;
    name: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    file?: FileInfo;
};
