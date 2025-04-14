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
import { LRUCache } from './utils/LRUCache';

/**
 * 缓存管理器，用于存储和管理文件名处理结果的缓存
 */
@injectable()
export class CacheManager implements ICacheManager {
    private readonly titleCache: LRUCache<string, string | null>;
    private cacheHitRateInterval: NodeJS.Timeout | null = null;

    constructor(
        @inject(TYPES.Settings) private settings: TitleChangerSettings,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        // 从设置中获取缓存容量，默认1000
        const capacity = this.settings.cacheCapacity || 1000;
        this.titleCache = new LRUCache<string, string | null>(capacity);
        this.logger.info(`缓存管理器初始化完成，缓存容量: ${capacity}`);
        
        // 如果启用，开始定期记录缓存统计信息
        if (this.settings.logCacheStats) {
            this.startCacheStatsLogging();
        }
    }

    /**
     * 记录当前设置状态信息
     */
    private logSettingsState(): void {
        this.logger.debug('当前缓存设置:', {
            regexPattern: this.settings.regexPattern,
            includedFolders: this.settings.includedFolders,
            enabled: this.settings.enabled,
            cacheCapacity: this.settings.cacheCapacity,
            logCacheStats: this.settings.logCacheStats
        });
    }

    /**
     * 更新设置并处理缓存
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        tryCatchWrapper(
            () => {
                const hasSettingsChanged = this.hasSettingsChanged(newSettings);
                const hasCacheCapacityChanged = this.settings.cacheCapacity !== newSettings.cacheCapacity;
                
                // 缓存容量变更需要创建新的缓存对象
                if (hasCacheCapacityChanged) {
                    this.logger.info(`缓存容量变更: ${this.settings.cacheCapacity} -> ${newSettings.cacheCapacity}`);
                    // 保存当前缓存中的所有条目
                    const entries = Array.from(this.titleCache.entries());
                    
                    // 创建新容量的缓存
                    const newCapacity = newSettings.cacheCapacity || 1000;
                    const newCache = new LRUCache<string, string | null>(newCapacity);
                    
                    // 恢复缓存内容，但如果新容量较小，可能只会保留部分条目
                    for (const [key, value] of entries) {
                        newCache.set(key, value);
                    }
                    
                    // 用新缓存替换旧缓存
                    Object.defineProperty(this, 'titleCache', {
                        value: newCache,
                        writable: false
                    });
                }
                
                // 处理缓存统计记录设置变更
                if (this.settings.logCacheStats !== newSettings.logCacheStats) {
                    if (newSettings.logCacheStats) {
                        this.startCacheStatsLogging();
                    } else {
                        this.stopCacheStatsLogging();
                    }
                }
                
                // 如果关键设置变更，清空缓存
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
        const cacheSize = this.titleCache.size();
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
        const entries = Array.from(this.titleCache.entries());
        for (const [file, title] of entries) {
            if (title !== null) {
                result.set(file, title);
            }
        }
        
        return result;
    }
    
    /**
     * 启动缓存统计日志记录
     */
    private startCacheStatsLogging(): void {
        // 停止现有计时器（如果存在）
        this.stopCacheStatsLogging();
        
        // 每小时记录一次缓存命中率
        this.cacheHitRateInterval = setInterval(() => {
            const hitRate = this.titleCache.getHitRate();
            const cacheSize = this.titleCache.size();
            this.logger.info(`缓存统计: 命中率 ${(hitRate * 100).toFixed(2)}%, 当前大小 ${cacheSize}`);
        }, 3600000); // 1小时
    }

    /**
     * 停止缓存统计日志记录
     */
    private stopCacheStatsLogging(): void {
        if (this.cacheHitRateInterval) {
            clearInterval(this.cacheHitRateInterval);
            this.cacheHitRateInterval = null;
        }
    }
    
    /**
     * 析构函数，清理资源
     */
    dispose(): void {
        this.stopCacheStatsLogging();
    }
} 