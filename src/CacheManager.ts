import { TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from './types/symbols';
import type { TitleChangerSettings } from './settings';
import { FolderChecker } from './utils/FolderChecker';
import { TitleProcessor } from './utils/TitleProcessor';
import type { ICacheManager } from './types/ObsidianExtensions';
import { Logger } from './utils/logger';
import { ErrorManagerService } from './services/ErrorManagerService';
import { ErrorCategory } from './utils/errors';
import { tryCatchWrapper } from './utils/ErrorHelpers';

/**
 * 缓存管理器，用于存储和管理文件名处理结果的缓存
 */
@injectable()
export class CacheManager implements ICacheManager {
    private readonly titleCache: Map<string, string | null> = new Map();

    constructor(
        @inject(TYPES.Settings) private settings: TitleChangerSettings,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        this.logger.info('缓存管理器初始化完成');
    }

    /**
     * 记录当前设置状态信息
     */
    private logSettingsState(): void {
        this.logger.debug('当前缓存设置:', {
            regexPattern: this.settings.regexPattern,
            includedFolders: this.settings.includedFolders,
            enabled: this.settings.enabled
        });
    }

    /**
     * 更新设置并处理缓存
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        tryCatchWrapper(
            () => {
                const hasSettingsChanged = this.hasSettingsChanged(newSettings);
                if (hasSettingsChanged) {
                    this.logger.info('检测到设置变更，清空缓存');
                    this.clearCache();
                }

                this.settings = newSettings;
                this.logSettingsState();
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新设置时发生错误',
                category: ErrorCategory.CONFIG,
                userVisible: false
            }
        );
    }

    /**
     * 处理文件并返回显示标题
     */
    processFile(file: TFile): string | null {
        return tryCatchWrapper(
            () => {
                const fileId = file.path;
                
                if (this.titleCache.has(fileId)) {
                    return this.titleCache.get(fileId) ?? null;
                }

                if (!FolderChecker.shouldApplyToFile(file, this.settings)) {
                    this.titleCache.set(fileId, null);
                    return null;
                }

                const displayTitle = TitleProcessor.processFile(file, this.settings, this.errorManager, this.logger);
                this.titleCache.set(fileId, displayTitle);
                return displayTitle;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '处理文件时发生错误',
                category: ErrorCategory.FILE,
                details: { fileName: file.name },
                userVisible: false
            }
        );
    }

    /**
     * 清除所有缓存
     */
    clearCache(): void {
        const cacheSize = this.titleCache.size;
        this.titleCache.clear();
        this.logger.debug(`已清除 ${cacheSize} 条缓存记录`);
    }

    /**
     * 使指定文件的缓存失效
     */
    invalidateFile(file: TFile): void {
        tryCatchWrapper(
            () => {
                const fileId = file.path;
                
                // 删除特定文件的缓存
                if (this.titleCache.has(fileId)) {
                    this.titleCache.delete(fileId);
                    this.logger.debug(`已清除文件 ${file.name} 的缓存`);
                }
                
                // 在文件重命名的情况下，可能需要查找并清除旧路径的缓存
                // 这里使用一个启发式方法：检查缓存中是否有与当前文件basename相同但路径不同的项
                const entries = Array.from(this.titleCache.entries());
                for (const [cachedPath, _] of entries) {
                    if (cachedPath !== fileId && cachedPath.endsWith(file.basename)) {
                        this.titleCache.delete(cachedPath);
                        this.logger.debug(`检测到文件重命名，已清除旧路径 ${cachedPath} 的缓存`);
                    }
                }
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '清除文件缓存时发生错误',
                category: ErrorCategory.FILE,
                details: { fileName: file.name },
                userVisible: false
            }
        );
    }

    /**
     * 检查设置是否发生变化
     */
    private hasSettingsChanged(newSettings: TitleChangerSettings): boolean {
        return this.settings.regexPattern !== newSettings.regexPattern ||
               JSON.stringify(this.settings.includedFolders) !== JSON.stringify(newSettings.includedFolders);
    }

    getDisplayTitle(fileName: string): string | null {
        return this.titleCache.get(fileName) ?? null;
    }

    updateTitleCache(fileName: string, displayTitle: string): void {
        this.titleCache.set(fileName, displayTitle);
    }
    
    /**
     * 获取所有缓存的标题
     * @returns 文件名到标题的映射
     */
    getAllTitles(): Map<string, string> {
        const result = new Map<string, string>();
        
        // 只返回非null的标题
        this.titleCache.forEach((title, file) => {
            if (title !== null) {
                result.set(file, title);
            }
        });
        
        return result;
    }
} 