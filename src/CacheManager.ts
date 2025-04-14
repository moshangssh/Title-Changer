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
import { LRUCacheBase, CacheOptions, CacheEventType } from './utils/LRUCacheBase';
import { LRUCacheFactory, LRUCacheType, LRUCacheOptions, SerializedCache } from './utils/LRUCacheFactory';

/**
 * 缓存管理器，用于存储和管理文件名处理结果的缓存
 */
@injectable()
export class CacheManager implements ICacheManager {
    private readonly titleCache: LRUCacheBase<string, string | null>;
    private cacheHitRateInterval: NodeJS.Timeout | null = null;
    private cacheCleanupInterval: NodeJS.Timeout | null = null;
    private cacheType: LRUCacheType;

    constructor(
        @inject(TYPES.Settings) private settings: TitleChangerSettings,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        // 从设置中获取缓存选项
        const cacheOptions: LRUCacheOptions = {
            capacity: this.settings.cacheCapacity || 1000,
            maxWeight: this.settings.cacheMaxWeight || this.settings.cacheCapacity || 1000,
            purgeInterval: this.settings.cachePurgeInterval || 60000 // 默认60秒
        };
        
        this.cacheType = this.settings.useFastCache ? LRUCacheType.ENHANCED : LRUCacheType.CLASSIC;
        
        this.titleCache = LRUCacheFactory.create<string, string | null>(this.cacheType, cacheOptions);
        this.logger.info(`缓存管理器初始化完成，缓存类型: ${this.cacheType}，缓存容量: ${cacheOptions.capacity}，最大权重: ${cacheOptions.maxWeight}`);
        
        // 注册缓存事件监听器
        this.setupCacheEventListeners();
        
        // 如果启用，开始定期记录缓存统计信息
        if (this.settings.logCacheStats) {
            this.startCacheStatsLogging();
        }
        
        // 开启定期清理
        this.startCacheCleanup();
        
        // 尝试从本地存储恢复缓存
        this.tryRestoreCache();
    }
    
    /**
     * 设置缓存事件监听
     */
    private setupCacheEventListeners(): void {
        // 监听过期事件
        this.titleCache.on('expire', (eventType, key) => {
            this.logger.debug(`缓存项过期: ${key}`);
        });
        
        // 监听清理事件
        this.titleCache.on('clear', () => {
            this.logger.debug('缓存已完全清空');
        });
        
        // 可以根据需要添加更多事件监听器
        if (this.settings.debugMode) {
            // 调试模式下监控所有缓存操作
            this.titleCache.on('set', (eventType, key) => {
                this.logger.debug(`缓存项设置: ${key}`);
            });
            
            this.titleCache.on('delete', (eventType, key) => {
                this.logger.debug(`缓存项删除: ${key}`);
            });
        }
    }
    
    /**
     * 尝试从本地存储恢复缓存
     */
    private tryRestoreCache(): void {
        tryCatchWrapper(
            () => {
                // 检查是否启用了缓存持久化
                if (!this.settings.persistCache) {
                    return false;
                }
                
                // 从localStorage获取序列化的缓存
                const serializedCache = localStorage.getItem('title-changer-cache');
                if (!serializedCache) {
                    this.logger.debug('未找到持久化缓存');
                    return false;
                }
                
                try {
                    // 解析序列化数据
                    const parsedCache = JSON.parse(serializedCache) as SerializedCache<string, string | null>;
                    
                    // 恢复缓存
                    const restoredCache = LRUCacheFactory.deserialize<string, string | null>(parsedCache);
                    
                    // 替换当前缓存
                    Object.defineProperty(this, 'titleCache', {
                        value: restoredCache,
                        writable: false
                    });
                    
                    const cacheSize = restoredCache.size();
                    this.logger.info(`从持久化存储恢复了 ${cacheSize} 条缓存记录`);
                    return true;
                } catch (error) {
                    this.logger.error('恢复缓存失败:', { error: String(error) });
                    return false;
                }
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '恢复缓存时发生错误',
                category: ErrorCategory.CONFIG,
                userVisible: false
            }
        );
    }
    
    /**
     * 保存缓存到本地存储
     * 公共方法，可供外部调用
     * @returns 是否成功保存
     */
    saveCache(): boolean | null {
        return tryCatchWrapper(
            () => {
                // 检查是否启用了缓存持久化
                if (!this.settings.persistCache) {
                    this.logger.warn('缓存持久化未启用，无法保存');
                    return false;
                }
                
                // 序列化缓存
                const serializedCache = LRUCacheFactory.serialize<string, string | null>(this.titleCache, this.cacheType);
                
                // 保存到localStorage
                localStorage.setItem('title-changer-cache', JSON.stringify(serializedCache));
                
                const cacheSize = this.titleCache.size();
                this.logger.info(`已将 ${cacheSize} 条缓存记录保存到持久化存储`);
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '保存缓存时发生错误',
                category: ErrorCategory.CONFIG,
                userVisible: true
            }
        );
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
            logCacheStats: this.settings.logCacheStats,
            useFastCache: this.settings.useFastCache,
            persistCache: this.settings.persistCache
        });
    }

    /**
     * 更新设置并处理缓存
     */
    updateSettings(newSettings: TitleChangerSettings): void {
        tryCatchWrapper(
            () => {
                const hasSettingsChanged = this.hasSettingsChanged(newSettings);
                const hasCacheConfigChanged = 
                    this.settings.cacheCapacity !== newSettings.cacheCapacity ||
                    this.settings.cacheMaxWeight !== newSettings.cacheMaxWeight ||
                    this.settings.cachePurgeInterval !== newSettings.cachePurgeInterval ||
                    this.settings.useFastCache !== newSettings.useFastCache;
                
                // 缓存持久化设置变化
                const hasPersistenceChanged = this.settings.persistCache !== newSettings.persistCache;
                
                // 在配置变更前保存现有缓存
                if (this.settings.persistCache) {
                    this.saveCache();
                }
                
                // 缓存配置变更需要创建新的缓存对象
                if (hasCacheConfigChanged) {
                    this.logger.info(`缓存配置变更: 容量: ${this.settings.cacheCapacity} -> ${newSettings.cacheCapacity}, ` +
                                      `最大权重: ${this.settings.cacheMaxWeight} -> ${newSettings.cacheMaxWeight}, ` +
                                      `清理间隔: ${this.settings.cachePurgeInterval} -> ${newSettings.cachePurgeInterval}, ` +
                                      `类型: ${this.settings.useFastCache} -> ${newSettings.useFastCache}`);
                    
                    // 保存当前缓存中的所有条目
                    const entries = Array.from(this.titleCache.entries());
                    
                    // 创建新的缓存选项
                    const cacheOptions: LRUCacheOptions = {
                        capacity: newSettings.cacheCapacity || 1000,
                        maxWeight: newSettings.cacheMaxWeight || newSettings.cacheCapacity || 1000,
                        purgeInterval: newSettings.cachePurgeInterval || 60000
                    };
                    
                    // 创建新类型的缓存
                    this.cacheType = newSettings.useFastCache ? LRUCacheType.ENHANCED : LRUCacheType.CLASSIC;
                    const newCache = LRUCacheFactory.create<string, string | null>(this.cacheType, cacheOptions);
                    
                    // 恢复缓存内容，但如果新容量较小，可能只会保留部分条目
                    newCache.setMany(entries);
                    
                    // 重新设置事件监听器
                    this.setupCacheEventListeners();
                    
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
                
                // 处理持久化设置变更
                if (hasPersistenceChanged) {
                    if (newSettings.persistCache) {
                        // 如果新开启了持久化，保存当前缓存
                        this.saveCache();
                    } else {
                        // 如果关闭了持久化，清除存储中的缓存
                        localStorage.removeItem('title-changer-cache');
                        this.logger.info('已关闭缓存持久化，清除存储中的缓存');
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
                    // 不需要处理的文件缓存较短时间
                    const cacheOptions: CacheOptions = {
                        ttl: Math.min(this.settings.cacheExpiration * 60000, 300000), // 最多5分钟
                        slidingExpiration: false,
                        weight: 1 // 低权重
                    };
                    this.titleCache.set(fileId, null, cacheOptions);
                    return null;
                }

                const displayTitle = TitleProcessor.processFile(file, this.settings, this.errorManager, this.logger);
                
                // 配置缓存选项
                const cacheOptions: CacheOptions = {
                    ttl: this.settings.cacheExpiration * 60000, // 转换为毫秒
                    slidingExpiration: this.settings.cacheSlidingExpiration ?? true,
                    weight: 5 // 较高权重，稳定重要的缓存项
                };
                
                this.titleCache.set(fileId, displayTitle, cacheOptions);
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
        const cacheOptions: CacheOptions = {
            ttl: this.settings.cacheExpiration * 60000, // 转换为毫秒
            slidingExpiration: this.settings.cacheSlidingExpiration ?? true,
            weight: 5 // 重要文件的标题，较高权重
        };
        
        this.titleCache.set(fileName, displayTitle, cacheOptions);
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
     * 启动定期清理缓存
     */
    private startCacheCleanup(): void {
        // 如果已有清理任务，先停止
        this.stopCacheCleanup();
        
        // 创建新的清理任务
        this.cacheCleanupInterval = setInterval(() => {
            const purgedCount = this.titleCache.purgeExpired();
            if (purgedCount > 0) {
                this.logger.debug(`清理过期缓存项: ${purgedCount}项`);
            }
            
            // 每次清理后自动保存缓存（如果启用了持久化）
            if (this.settings.persistCache) {
                this.saveCache();
            }
        }, this.settings.cachePurgeInterval || 60000);
    }
    
    /**
     * 停止缓存清理
     */
    private stopCacheCleanup(): void {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }
    }
    
    /**
     * 析构函数，清理资源
     */
    dispose(): void {
        // 停止统计记录和清理任务
        this.stopCacheStatsLogging();
        this.stopCacheCleanup();
        
        // 保存缓存
        if (this.settings.persistCache) {
            this.saveCache();
        }
        
        // 清理事件监听器
        this.clearEventListeners();
    }
    
    /**
     * 清理所有事件监听器
     */
    private clearEventListeners(): void {
        const eventTypes: CacheEventType[] = ['set', 'get', 'delete', 'clear', 'expire'];
        
        for (const eventType of eventTypes) {
            // 通过创建空的回调创建占位符，然后移除它，来清空事件监听器
            // 这是因为我们没有直接的方法来获取所有注册的监听器
            const dummyCallback = () => {};
            this.titleCache.on(eventType, dummyCallback);
            this.titleCache.off(eventType, dummyCallback);
        }
    }
} 