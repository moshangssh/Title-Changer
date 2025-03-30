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
    private readonly titleCache: Map<string, string | null> = new Map();
    private readonly logger = console;

    constructor(
        @inject(TYPES.Settings) private settings: TitleChangerSettings
    ) {
        this.logger.log('Title Changer: 缓存管理器初始化完成');
    }

    /**
     * 记录当前设置状态
     */
    private logSettingsState(): void {
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug('Title Changer: 当前设置状态:', {
                regexPattern: this.settings.regexPattern,
                folderRestrictionEnabled: this.settings.folderRestrictionEnabled,
                includedFolders: this.settings.folderRestrictionEnabled 
                    ? this.settings.includedFolders 
                    : '未启用文件夹限制'
            });
        }
    }

    /**
     * 更新设置并处理缓存
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        try {
            const hasSettingsChanged = this.hasSettingsChanged(newSettings);
            if (hasSettingsChanged) {
                this.logger.info('Title Changer: 检测到设置变更，清空缓存');
                this.clearCache();
            }

            this.settings = newSettings;
            this.logSettingsState();
        } catch (error) {
            this.logger.error('Title Changer: 更新设置时发生错误', error);
        }
    }

    /**
     * 处理文件并返回显示标题
     */
    processFile(file: TFile): string | null {
        try {
            const fileId = file.path;
            
            if (this.titleCache.has(fileId)) {
                return this.titleCache.get(fileId) ?? null;
            }

            if (!FolderChecker.shouldApplyToFile(file, this.settings)) {
                this.titleCache.set(fileId, null);
                return null;
            }

            const displayTitle = TitleProcessor.processFile(file, this.settings);
            this.titleCache.set(fileId, displayTitle);
            return displayTitle;
        } catch (error) {
            this.logger.error('Title Changer: 处理文件时发生错误', {
                fileName: file.name,
                error
            });
            return null;
        }
    }

    /**
     * 清除所有缓存
     */
    clearCache(): void {
        const cacheSize = this.titleCache.size;
        this.titleCache.clear();
        this.logger.debug(`Title Changer: 已清除 ${cacheSize} 条缓存记录`);
    }

    /**
     * 使指定文件的缓存失效
     */
    invalidateFile(file: TFile): void {
        try {
            const fileId = file.path;
            if (this.titleCache.has(fileId)) {
                this.titleCache.delete(fileId);
                this.logger.debug(`Title Changer: 已清除文件 ${file.name} 的缓存`);
            }
        } catch (error) {
            this.logger.error('Title Changer: 清除文件缓存时发生错误', {
                fileName: file.name,
                error
            });
        }
    }

    /**
     * 检查设置是否发生变化
     */
    private hasSettingsChanged(newSettings: TitleChangerSettings): boolean {
        return this.settings.regexPattern !== newSettings.regexPattern ||
               this.settings.folderRestrictionEnabled !== newSettings.folderRestrictionEnabled ||
               JSON.stringify(this.settings.includedFolders) !== JSON.stringify(newSettings.includedFolders);
    }

    getDisplayTitle(fileName: string): string | null {
        return this.titleCache.get(fileName) ?? null;
    }

    updateTitleCache(fileName: string, displayTitle: string): void {
        this.titleCache.set(fileName, displayTitle);
    }
} 