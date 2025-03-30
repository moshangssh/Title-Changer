import { TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from './types/symbols';
import type { TitleChangerSettings } from './settings';
import { FolderChecker } from './utils/folder-checker';
import { TitleProcessor } from './utils/title-processor';
import type { ICacheManager } from './types/obsidian-extensions';

/**
 * 缓存管理器，用于存储和管理文件名处理结果的缓存
 */
@injectable()
export class CacheManager implements ICacheManager {
    // 文件 ID 到显示标题的映射
    private cache: Map<string, string | null> = new Map();
    
    /**
     * 构造函数
     * @param settings 插件设置
     */
    constructor(
        @inject(TYPES.Settings) private settings: TitleChangerSettings
    ) {
        console.log('Title Changer: 初始化完成');
    }
    
    /**
     * 记录当前设置
     */
    private logCurrentSettings(): void {
        // 移除冗余的设置记录，仅在调试模式下记录
        if (process.env.NODE_ENV === 'development') {
            console.log('Title Changer: 当前设置:', {
                regexPattern: this.settings.regexPattern,
                folderRestrictionEnabled: this.settings.folderRestrictionEnabled,
                includedFolders: this.settings.folderRestrictionEnabled ? this.settings.includedFolders : '未启用'
            });
        }
    }
    
    /**
     * 更新设置
     * @param newSettings 新的设置
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        // 检查设置是否变化
        if (
            this.settings.regexPattern !== newSettings.regexPattern ||
            this.settings.folderRestrictionEnabled !== newSettings.folderRestrictionEnabled ||
            JSON.stringify(this.settings.includedFolders) !== JSON.stringify(newSettings.includedFolders)
        ) {
            console.log('Title Changer: 设置已更新，清空缓存');
            this.clearCache();
        }
        
        this.settings = newSettings;
        this.logCurrentSettings();
    }
    
    /**
     * 处理文件，获取显示的标题
     * @param file 要处理的文件
     * @returns 显示的标题，如果不应该更改则返回 null
     */
    processFile(file: TFile): string | null {
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
        
        // 处理文件，获取显示标题
        const displayTitle = TitleProcessor.processFile(file, this.settings);
        
        // 缓存结果
        this.cache.set(fileId, displayTitle);
        
        return displayTitle;
    }
    
    /**
     * 清除所有缓存
     */
    clearCache(): void {
        this.cache.clear();
    }
    
    /**
     * 使指定文件的缓存失效
     * @param file 要移除缓存的文件
     */
    invalidateFile(file: TFile): void {
        const fileId = file.path;
        this.cache.delete(fileId);
    }
} 