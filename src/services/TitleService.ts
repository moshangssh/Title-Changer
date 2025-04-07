import { App, TFile, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { FileService } from './FileService';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { ErrorHandled, AsyncErrorHandled } from '../utils/ErrorDecorators';
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
    @ErrorHandled({
        errorMessage: '获取显示标题时发生错误',
        category: ErrorCategory.DATA,
        level: ErrorLevel.WARNING
    })
    getDisplayTitle(fileName: string | undefined, fallbackToOriginal = true): string | null {
        // 安全检查：如果文件名为undefined或null，则返回安全默认值
        if (fileName === undefined || fileName === null) {
            this.logger.debug('尝试获取未定义文件名的显示标题');
            return fallbackToOriginal ? 'Untitled' : null;
        }
        
        // 移除文件扩展名
        try {
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
        } catch (error) {
            this.logger.error('处理文件标题时出错', { fileName, error });
            return fallbackToOriginal ? fileName : null;
        }
    }
    
    /**
     * 从缓存获取文件的标题
     * @param file 文件对象
     * @returns 缓存的标题或null
     */
    @ErrorHandled({
        errorMessage: '从缓存获取标题时发生错误',
        category: ErrorCategory.CACHE,
        level: ErrorLevel.WARNING
    })
    getCachedDisplayTitle(file: TFile): string | null {
        return this.cacheManager.getDisplayTitle(file.basename) || null;
    }
    
    /**
     * 处理指定文件并缓存其标题
     * @param file 文件对象
     * @returns 处理后的标题或null
     */
    @ErrorHandled({
        errorMessage: '处理文件标题时发生错误',
        category: ErrorCategory.DATA,
        level: ErrorLevel.WARNING
    })
    processFileTitle(file: TFile): string | null {
        const oldTitle = this.cacheManager.getDisplayTitle(file.basename);
        const newTitle = this.cacheManager.processFile(file);
        
        // 如果标题发生变化，触发标题变更事件
        if (oldTitle !== newTitle && newTitle !== null) {
            this.dispatchTitleChangedEvent(file.basename, oldTitle || file.basename, newTitle);
        }
        
        return newTitle;
    }
    
    /**
     * 更新特定文件的标题
     * @param fileName 文件名
     * @param newTitle 新标题
     */
    @ErrorHandled({
        errorMessage: '更新文件标题失败',
        category: ErrorCategory.DATA,
        level: ErrorLevel.WARNING
    })
    updateFileTitle(fileName: string, newTitle: string): void {
        const oldTitle = this.cacheManager.getDisplayTitle(fileName) || fileName;
        
        // 更新缓存
        this.cacheManager.updateTitleCache(fileName, newTitle);
        
        // 触发标题变更事件
        this.dispatchTitleChangedEvent(fileName, oldTitle, newTitle);
    }
    
    /**
     * 发送标题变更事件
     * @param fileName 文件名
     * @param oldTitle 旧标题
     * @param newTitle 新标题
     */
    @ErrorHandled({
        errorMessage: '分发标题变更事件失败',
        category: ErrorCategory.EVENT,
        level: ErrorLevel.WARNING
    })
    private dispatchTitleChangedEvent(fileName: string, oldTitle: string, newTitle: string): void {
        const event: TitleChangedEvent = {
            oldTitle: oldTitle,
            newTitle: newTitle
        };
        
        // 触发应用范围的事件
        (this.app.workspace as unknown as Events).trigger('title-changed', event);
        
        this.logger.debug(`标题变更事件已分发: ${oldTitle} -> ${newTitle}`);
    }
    
    /**
     * 无效化指定文件的缓存
     * @param file 文件对象
     */
    @ErrorHandled({
        errorMessage: '无效化文件缓存时发生错误',
        category: ErrorCategory.CACHE,
        level: ErrorLevel.WARNING
    })
    invalidateFileCache(file: TFile): void {
        this.cacheManager.invalidateFile(file);
    }
    
    /**
     * 重新处理所有文件的标题
     */
    @ErrorHandled({
        errorMessage: '重新处理所有文件标题时发生错误',
        category: ErrorCategory.DATA,
        level: ErrorLevel.WARNING
    })
    reprocessAllFiles(): void {
        const files = this.app.vault.getMarkdownFiles();
        files.forEach(file => {
            this.processFileTitle(file);
        });
    }
    
    /**
     * 获取所有缓存的标题
     * @returns 文件名到标题的映射
     */
    @ErrorHandled({
        errorMessage: '获取所有标题失败',
        category: ErrorCategory.DATA,
        level: ErrorLevel.WARNING,
        defaultValue: new Map<string, string>()
    })
    getAllTitles(): Map<string, string> {
        return this.cacheManager.getAllTitles();
    }
} 