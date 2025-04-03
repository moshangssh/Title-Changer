import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../Settings';

// BUG: 包含的文件夹功能不支持递归子文件夹
// Affects: folder-checker.ts

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
        const result = settings.includedFolders.some(folder => {
            // 规范化文件夹路径，确保它们以 / 结尾
            const normalizedFolder = this.normalizePath(folder);
            
            if (settings.includeSubfolders) {
                // 递归子文件夹模式：检查文件路径是否以包含的文件夹开头
                return filePath.startsWith(normalizedFolder);
            } else {
                // 仅当前文件夹模式：检查文件是否直接位于包含的文件夹中
                // 获取文件夹的深度
                const folderDepth = normalizedFolder.split('/').filter(p => p.length > 0).length;
                
                // 获取文件路径的深度
                const filePathDepth = filePath.split('/').filter(p => p.length > 0).length;
                
                // 文件应该在指定文件夹的直接子级，深度差应该为1
                // 如果文件夹是根目录（空字符串），则文件深度应为1（直接在根目录下）
                const expectedDepthDiff = normalizedFolder === '' ? 1 : 0;
                
                return filePath.startsWith(normalizedFolder) && 
                       filePathDepth === folderDepth + expectedDepthDiff;
            }
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