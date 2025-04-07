import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { AbstractManager } from './base/AbstractManager';
import { DOMSelectorService } from '../services/DomSelectorService';
import { FileHandlerService } from '../services/FileHandlerService';
import { UIStateManager } from '../services/UIStateManager';
import { CacheManager } from '../CacheManager';
import { ICacheManager } from '../types/ObsidianExtensions';

/**
 * 文件项处理器
 * 负责处理文件浏览器中的文件项和文本元素
 */
@injectable()
export class FileItemProcessor extends AbstractManager {
    private static readonly MANAGER_ID = 'file-item-processor';
    
    // 批处理配置
    private static readonly BATCH_SIZE = 30; // 每批处理的最大文件项数，增加到30
    private static readonly BATCH_DELAY = 20; // 批次间延迟(ms)，增加到20ms
    
    // 节流配置
    private static readonly THROTTLE_DELAY = 200; // 节流延迟(ms)，增加到200ms
    
    // 处理队列
    private processingQueue: HTMLElement[] = [];
    private isProcessing = false;
    private processingTimeout: number | null = null;
    private lastProcessTime = 0;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.FileHandlerService) private fileHandler: FileHandlerService,
        @inject(TYPES.UIStateManager) private uiStateManager: UIStateManager,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化文件项处理器
     */
    initialize(): void {
        this.logInfo(`[${FileItemProcessor.MANAGER_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                // 初始化时的逻辑
                // 目前没有特殊的初始化需求
            },
            'FileItemProcessor',
            '初始化文件项处理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${FileItemProcessor.MANAGER_ID}] 初始化完成`);
    }

    /**
     * 处理所有文件浏览器
     * @param isEnabled 插件启用状态
     * @returns 处理的文件浏览器数量
     */
    processAllExplorers(isEnabled: boolean): number {
        return this.safeOperation(
            () => {
                const fileExplorers = this.domSelector.getFileExplorers();
                
                // 检查是否需要节流
                const now = performance.now();
                const timeSinceLastProcess = now - this.lastProcessTime;
                
                if (timeSinceLastProcess < FileItemProcessor.THROTTLE_DELAY) {
                    this.logDebug(`[${FileItemProcessor.MANAGER_ID}] 节流处理，上次处理距今 ${timeSinceLastProcess.toFixed(2)}ms`);
                    return fileExplorers.length;
                }
                
                this.lastProcessTime = now;
                
                // 清空当前队列
                this.resetProcessingQueue();
                
                // 收集所有需要处理的文件项
                const allFileItems: HTMLElement[] = [];
                
                fileExplorers.forEach(explorer => {
                    const fileItems = this.domSelector.getFileItems(explorer);
                    
                    if (fileItems.length === 0) {
                        // 如果没有找到文件项，直接处理文本元素
                        const textElements = this.domSelector.getTextElements(explorer);
                        this.fileHandler.processTextElements(textElements, this.cacheManager, this.uiStateManager, isEnabled);
                    } else {
                        // 将文件项添加到队列
                        allFileItems.push(...fileItems);
                    }
                });
                
                // 按照可见性排序，优先处理可见的文件项
                this.sortFileItemsByVisibility(allFileItems);
                
                // 将排序后的文件项添加到处理队列
                this.processingQueue.push(...allFileItems);
                
                // 开始批量处理
                this.processBatch(isEnabled);
                
                this.logDebug(`[${FileItemProcessor.MANAGER_ID}] 已添加 ${allFileItems.length} 个文件项到处理队列`);
                return fileExplorers.length;
            },
            'FileItemProcessor',
            '处理所有文件浏览器失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'processAllExplorers' }
        ) || 0;
    }
    
    /**
     * 根据可见性排序文件项
     * @param fileItems 文件项数组
     */
    private sortFileItemsByVisibility(fileItems: HTMLElement[]): void {
        // 使用 IntersectionObserver API 检查元素是否在视口中会比较复杂
        // 这里使用一个简单的启发式方法：检查元素的 getBoundingClientRect()
        try {
            fileItems.sort((a, b) => {
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                
                // 计算元素与视口顶部的距离
                const distanceA = Math.abs(rectA.top);
                const distanceB = Math.abs(rectB.top);
                
                // 距离越小（越靠近视口顶部）优先级越高
                return distanceA - distanceB;
            });
        } catch (error) {
            this.logDebug(`[${FileItemProcessor.MANAGER_ID}] 文件项排序失败: ${error}`);
        }
    }
    
    /**
     * 处理下一批文件项
     * @param isEnabled 插件启用状态
     */
    private processBatch(isEnabled: boolean): void {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // 取出当前批次要处理的文件项
            const currentBatch = this.processingQueue.splice(0, FileItemProcessor.BATCH_SIZE);
            
            // 处理当前批次
            currentBatch.forEach(fileItem => {
                this.processFileItem(fileItem, isEnabled);
            });
            
            this.logDebug(`[${FileItemProcessor.MANAGER_ID}] 已处理批次中的 ${currentBatch.length} 个文件项，剩余 ${this.processingQueue.length} 个`);
            
            // 如果队列中还有项目，安排处理下一批
            if (this.processingQueue.length > 0) {
                if (this.processingTimeout !== null) {
                    window.clearTimeout(this.processingTimeout);
                }
                
                this.processingTimeout = window.setTimeout(() => {
                    this.isProcessing = false;
                    this.processBatch(isEnabled);
                }, FileItemProcessor.BATCH_DELAY);
            } else {
                this.isProcessing = false;
            }
        } catch (error) {
            this.isProcessing = false;
            this.logInfo(`[${FileItemProcessor.MANAGER_ID}] 批处理失败: ${error}`);
        }
    }
    
    /**
     * 重置处理队列
     */
    private resetProcessingQueue(): void {
        this.processingQueue = [];
        
        if (this.processingTimeout !== null) {
            window.clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }
        
        this.isProcessing = false;
    }

    /**
     * 处理文件浏览器中的所有文件项
     * @param explorer 文件浏览器元素
     * @param isEnabled 插件启用状态
     */
    processExplorer(explorer: HTMLElement, isEnabled: boolean): void {
        this.safeOperation(
            () => {
                const fileItems = this.domSelector.getFileItems(explorer);
                
                if (fileItems.length === 0) {
                    // 如果没有找到文件项，尝试处理所有文本元素
                    const textElements = this.domSelector.getTextElements(explorer);
                    this.fileHandler.processTextElements(textElements, this.cacheManager, this.uiStateManager, isEnabled);
                } else {
                    // 处理找到的文件项
                    fileItems.forEach(fileItem => {
                        this.processFileItem(fileItem, isEnabled);
                    });
                    
                    // 为防止某些文件项未被正确识别，也处理文本元素
                    if (fileItems.length < 3) { // 如果文件项很少，可能是识别有问题
                        // 处理文件项中的文本元素
                        const allTextElements = fileItems.flatMap(item => 
                            this.domSelector.getTextElements(item)
                        );
                        this.fileHandler.processTextElements(allTextElements, this.cacheManager, this.uiStateManager, isEnabled);
                    }
                }
            },
            'FileItemProcessor',
            `处理文件浏览器失败: ${explorer.className}`,
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'processExplorer', explorer: explorer.className }
        );
    }

    /**
     * 处理单个文件项
     * @param fileItem 文件项元素
     * @param isEnabled 插件启用状态
     */
    processFileItem(fileItem: HTMLElement, isEnabled: boolean): void {
        this.safeOperation(
            () => {
                // 处理每个文本元素
                const textElements = this.domSelector.getTextElements(fileItem);
                this.fileHandler.processTextElements(textElements, this.cacheManager, this.uiStateManager, isEnabled);

                // 处理个别文件项
                this.fileHandler.processFileItem(fileItem, this.cacheManager, this.uiStateManager, isEnabled);
            },
            'FileItemProcessor',
            '处理文件项失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'processFileItem' }
        );
    }

    /**
     * 卸载文件项处理器
     */
    unload(): void {
        this.logInfo(`[${FileItemProcessor.MANAGER_ID}] 正在卸载...`);
        
        this.safeOperation(
            () => {
                // 目前没有需要清理的资源
            },
            'FileItemProcessor',
            '卸载文件项处理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'unload' }
        );
        
        this.logInfo(`[${FileItemProcessor.MANAGER_ID}] 卸载完成`);
        this.resetProcessingQueue();
    }
}