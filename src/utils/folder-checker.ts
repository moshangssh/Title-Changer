import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';

export class FolderChecker {
    /**
     * 检查文件是否应该应用标题修改
     * @param file 要检查的文件
     * @param settings 插件设置
     * @returns 如果文件应该应用标题修改则返回 true
     */
    static shouldApplyToFile(file: TFile, settings: TitleChangerSettings): boolean {
        // 如果未启用文件夹限制，对所有文件都应用
        if (!settings.folderRestrictionEnabled) {
            return true;
        }

        // 如果没有设置包含的文件夹，则默认应用于所有文件
        if (settings.includedFolders.length === 0) {
            return true;
        }

        // 获取文件的路径（不包括文件名）
        const filePath = this.getFilePath(file);

        // 检查文件是否在任何包含的文件夹中
        return settings.includedFolders.some(folder => {
            // 规范化文件夹路径，确保它们以 / 结尾
            const normalizedFolder = this.normalizePath(folder);
            return filePath.startsWith(normalizedFolder);
        });
    }

    /**
     * 获取文件所在的路径（不包括文件名）
     * @param file 文件对象
     * @returns 文件所在的路径
     */
    private static getFilePath(file: TFile): string {
        const fullPath = file.path;
        const lastSlashIndex = fullPath.lastIndexOf('/');
        
        if (lastSlashIndex === -1) {
            // 文件在根目录
            return '';
        }
        
        // 返回路径，并确保它以 / 结尾
        return this.normalizePath(fullPath.substring(0, lastSlashIndex));
    }

    /**
     * 规范化路径，确保它以 / 结尾
     * @param path 要规范化的路径
     * @returns 规范化后的路径
     */
    private static normalizePath(path: string): string {
        if (path === '') {
            return '';
        }
        
        return path.endsWith('/') ? path : path + '/';
    }
} 