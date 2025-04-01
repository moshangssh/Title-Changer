import { App, TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { FileService } from './file.service';
import { CacheManager } from '../cache-manager';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper } from '../utils/error-helpers';

/**
 * 标题服务 - 处理文件标题的获取和缓存
 */
@injectable()
export class TitleService {
    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.FileService) private fileService: FileService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}
    
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
                return this.cacheManager.processFile(file);
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
                    this.cacheManager.processFile(file);
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
} 