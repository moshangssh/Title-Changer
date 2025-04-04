import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';

// BUG: 包含的文件夹功能不支持递归子文件夹
// Affects: folder-checker.ts
// 已修复: 现在支持递归子文件夹

export class FolderChecker {
    /**
     * 检查文件是否应该应用标题修改
     * @param file 要检查的文件
     * @param settings 插件设置
     * @returns 如果文件应该应用标题修改则返回 true
     */
    static shouldApplyToFile(file: TFile, settings: TitleChangerSettings): boolean {
        // 如果没有设置包含的文件夹，则默认应用于所有文件
        if (settings.includedFolders.length === 0) {
            return true;
        }

        // 获取文件的路径（不包括文件名）
        const filePath = this.getFilePath(file);

        // 检查文件是否在任何包含的文件夹中
        const result = settings.includedFolders.some(folder => {
            // 规范化文件夹路径，确保它们以 / 结尾
            const normalizedFolder = this.normalizePath(folder);
            
            // 检查文件路径是否与文件夹匹配
            // 支持三种情况:
            // 1. 完全匹配 (file.path === normalizedFolder)
            // 2. 直接子文件 (filePath === normalizedFolder)
            // 3. 子文件夹内的文件 (filePath.startsWith(normalizedFolder))
            return filePath === normalizedFolder || 
                   file.path === normalizedFolder || 
                   filePath.startsWith(normalizedFolder);
        });
        
        return result;
    }

    /**
     * 获取文件的路径（不包括文件名）
     * @param file 文件对象
     * @returns 文件的路径
     */
    private static getFilePath(file: TFile): string {
        // 获取文件路径
        const filePath = file.path;
        
        // 查找最后一个 / 的位置
        const lastSlashIndex = filePath.lastIndexOf('/');
        
        // 如果找不到 /，则文件位于根目录，返回空字符串
        if (lastSlashIndex === -1) {
            return '';
        }
        
        // 返回文件路径的目录部分
        return filePath.substring(0, lastSlashIndex + 1);
    }
    
    /**
     * 规范化路径，确保以 / 结尾
     * @param path 路径
     * @returns 规范化后的路径
     */
    private static normalizePath(path: string): string {
        // 如果路径为空，返回空字符串
        if (!path) {
            return '';
        }
        
        // 确保路径以 / 结尾
        return path.endsWith('/') ? path : path + '/';
    }
} 