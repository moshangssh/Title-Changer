import { TFile } from 'obsidian';
import { TitleChangerSettings } from './settings';
import { TitleProcessor } from './utils/title-processor';
import { FolderChecker } from './utils/folder-checker';

/**
 * 缓存管理器，用于存储和管理文件名处理结果的缓存
 */
export class CacheManager {
    // 文件 ID 到显示标题的映射
    private cache: Map<string, string | null> = new Map();
    
    // 当前使用的插件设置
    private settings: TitleChangerSettings;
    
    /**
     * 构造函数
     * @param settings 插件设置
     */
    constructor(settings: TitleChangerSettings) {
        this.settings = settings;
    }
    
    /**
     * 更新设置
     * @param newSettings 新的插件设置
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        // 如果正则表达式或文件夹设置发生变化，清空缓存
        if (
            this.settings.regexPattern !== newSettings.regexPattern ||
            this.settings.folderRestrictionEnabled !== newSettings.folderRestrictionEnabled ||
            JSON.stringify(this.settings.includedFolders) !== JSON.stringify(newSettings.includedFolders)
        ) {
            this.clearCache();
        }
        
        this.settings = newSettings;
    }
    
    /**
     * 获取文件的显示标题
     * @param file 文件对象
     * @returns 显示标题，如果不应更改则返回 null
     */
    getDisplayTitle(file: TFile): string | null {
        // 获取文件的唯一 ID
        const fileId = file.path;
        
        // 如果缓存中存在，直接返回
        if (this.cache.has(fileId)) {
            return this.cache.get(fileId) ?? null;
        }
        
        // 检查文件是否应该应用标题修改
        if (!FolderChecker.shouldApplyToFile(file, this.settings)) {
            // 如果不应该应用，缓存 null 并返回
            this.cache.set(fileId, null);
            return null;
        }
        
        // 处理文件标题
        const displayTitle = TitleProcessor.extractDisplayTitle(file, this.settings);
        
        // 缓存结果
        this.cache.set(fileId, displayTitle);
        
        return displayTitle;
    }
    
    /**
     * 清空缓存
     */
    clearCache(): void {
        this.cache.clear();
    }
    
    /**
     * 移除单个文件的缓存
     * @param file 要移除缓存的文件
     */
    invalidateFile(file: TFile): void {
        this.cache.delete(file.path);
    }
} 