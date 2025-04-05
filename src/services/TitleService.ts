import { App, TFile, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { FileService } from './FileService';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { tryCatchWrapper } from '../utils/ErrorHelpers';
import { TitleChangedEvent } from '../types/ObsidianExtensions';

/**
 * 标题服务 - 处理文件标题的获取、缓存和事件分发
 */
@injectable()
export class TitleService {
    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.FileService) private fileService: FileService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        this.logger.info('标题服务已初始化');
    }
    
    /**
     * 获取文件的显示标题
     * @param fileName 文件名或路径
     * @param fallbackToOriginal 如果没有找到标题是否返回原始文件名
     * @returns 显示标题或原始文件名（如果设置了fallbackToOriginal）或null
     */
    getDisplayTitle(fileName: string, fallbackToOriginal = true): string | null {
        return tryCatchWrapper(
            () => {
                // 移除文件扩展名
                const baseName = this.fileService.getBaseName(fileName);
                
                // 尝试从缓存获取标题
                let displayTitle = this.cacheManager.getDisplayTitle(baseName);
                
                // 如果缓存中没有找到，尝试处理文件
                if (!displayTitle) {
                    // 查找匹配的文件
                    const file = this.fileService.findFile(baseName);
                    if (file) {
                        displayTitle = this.cacheManager.processFile(file);
                    }
                }
                
                return displayTitle || (fallbackToOriginal ? fileName : null);
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取显示标题时发生错误',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                details: { fileName }
            }
        );
    }
    
    /**
     * 从缓存获取文件的标题
     * @param file 文件对象
     * @returns 缓存的标题或null
     */
    getCachedDisplayTitle(file: TFile): string | null {
        return tryCatchWrapper(
            () => {
                return this.cacheManager.getDisplayTitle(file.basename) || null;
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '从缓存获取标题时发生错误',
                category: ErrorCategory.CACHE,
                level: ErrorLevel.WARNING,
                details: { filePath: file.path }
            }
        );
    }
    
    /**
     * 处理指定文件并缓存其标题
     * @param file 文件对象
     * @returns 处理后的标题或null
     */
    processFileTitle(file: TFile): string | null {
        return tryCatchWrapper(
            () => {
                const oldTitle = this.cacheManager.getDisplayTitle(file.basename);
                const newTitle = this.cacheManager.processFile(file);
                
                // 如果标题发生变化，触发标题变更事件
                if (oldTitle !== newTitle && newTitle !== null) {
                    this.dispatchTitleChangedEvent(file.basename, oldTitle || file.basename, newTitle);
                }
                
                return newTitle;
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '处理文件标题时发生错误',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                details: { filePath: file.path }
            }
        );
    }
    
    /**
     * 更新特定文件的标题
     * @param fileName 文件名
     * @param newTitle 新标题
     */
    updateFileTitle(fileName: string, newTitle: string): void {
        tryCatchWrapper(
            () => {
                const oldTitle = this.cacheManager.getDisplayTitle(fileName) || fileName;
                
                // 更新缓存
                this.cacheManager.updateTitleCache(fileName, newTitle);
                
                // 触发标题变更事件
                this.dispatchTitleChangedEvent(fileName, oldTitle, newTitle);
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新文件标题失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                details: { fileName, newTitle }
            }
        );
    }
    
    /**
     * 发送标题变更事件
     * @param fileName 文件名
     * @param oldTitle 旧标题
     * @param newTitle 新标题
     */
    private dispatchTitleChangedEvent(fileName: string, oldTitle: string, newTitle: string): void {
        tryCatchWrapper(
            () => {
                const event: TitleChangedEvent = {
                    oldTitle: oldTitle,
                    newTitle: newTitle
                };
                
                // 触发应用范围的事件
                (this.app.workspace as unknown as Events).trigger('title-changed', event);
                
                this.logger.debug(`标题变更事件已分发: ${oldTitle} -> ${newTitle}`);
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '分发标题变更事件失败',
                category: ErrorCategory.EVENT,
                level: ErrorLevel.WARNING,
                details: { fileName, oldTitle, newTitle }
            }
        );
    }
    
    /**
     * 无效化指定文件的缓存
     * @param file 文件对象
     */
    invalidateFileCache(file: TFile): void {
        tryCatchWrapper(
            () => {
                this.cacheManager.invalidateFile(file);
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '无效化文件缓存时发生错误',
                category: ErrorCategory.CACHE,
                level: ErrorLevel.WARNING,
                details: { filePath: file.path }
            }
        );
    }
    
    /**
     * 重新处理所有文件的标题
     */
    reprocessAllFiles(): void {
        tryCatchWrapper(
            () => {
                const files = this.app.vault.getMarkdownFiles();
                files.forEach(file => {
                    this.processFileTitle(file);
                });
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '重新处理所有文件标题时发生错误',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING
            }
        );
    }
    
    /**
     * 获取所有缓存的标题
     * @returns 文件名到标题的映射
     */
    getAllTitles(): Map<string, string> {
        return tryCatchWrapper(
            () => {
                return this.cacheManager.getAllTitles();
            },
            'TitleService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取所有标题失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING
            }
        ) || new Map<string, string>();
    }
} 