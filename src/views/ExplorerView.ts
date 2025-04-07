import { TFile, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { DOMSelectorService } from '../services/DomSelectorService';
import { ExplorerEventsService } from '../services/ExplorerEventsService';
import { FileHandlerService } from '../services/FileHandlerService';
import { UIStateManager } from '../services/UIStateManager';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { 
    measurePerformance,
    logErrorsWithoutThrowing
} from '../utils/ErrorHelpers';
import {
    createDiv,
    createSpan,
    toggleClass,
    querySelector,
    querySelectorAll
} from '../utils/DomHelpers';
import { AbstractView } from './base/abstract-view';
import { UpdateScheduler } from '../services/UpdateSchedulerService';

/**
 * 文件浏览器视图，作为各服务的协调器
 */
@injectable()
export class ExplorerView extends AbstractView {
    private static readonly VIEW_ID = 'explorer-view';
    private virtualScrollIntervalId: number | null = null;
    private virtualScrollObserver: MutationObserver | null = null;
    private viewportReadyTimer: number | null = null;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.ExplorerEventsService) private eventsService: ExplorerEventsService,
        @inject(TYPES.FileHandlerService) private fileHandler: FileHandlerService,
        @inject(TYPES.UIStateManager) private uiStateManager: UIStateManager,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.UpdateScheduler) private updateScheduler: UpdateScheduler
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化视图
     */
    initialize(): void {
        this.logInfo(`[${ExplorerView.VIEW_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                // 设置立即更新函数
                this.eventsService.setImmediateUpdateFn(() => this.immediateUpdate());
                
                // 注册事件监听器
                this.registerEvents();
                
                // 初始更新 - 加快初始响应时间
                this.scheduleInitialUpdate();
                
                // 再次调度一个延迟更新，确保DOM完全加载
                this.scheduleViewportReadyUpdate();
                
                // 立即执行一次更新
                this.immediateUpdate();
                
                // 注册虚拟滚动监视器
                this.setupVirtualScrollMonitor();
            },
            'ExplorerView',
            '初始化文件浏览器视图失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${ExplorerView.VIEW_ID}] 初始化完成`);
    }

    /**
     * 注册所有事件监听器
     */
    private registerEvents(): void {
        this.safeOperation(
            () => {
                // 在初始化时为缓存失效设置回调函数
                const invalidateFileCallback = (file: TFile) => this.cacheManager.invalidateFile(file);
                const updateCallback = () => this.scheduleUpdate();
                
                // 使用统一的注册事件方法
                this.eventsService.registerEvents(updateCallback, invalidateFileCallback);
            },
            'ExplorerView',
            '注册事件处理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'registerEvents' }
        );
    }

    /**
     * 安排初始更新
     */
    private scheduleInitialUpdate(): void {
        this.updateScheduler.scheduleUpdate(
            `${ExplorerView.VIEW_ID}-initial`,
            () => {
                this.safeOperation(
                    () => {
                        const fileExplorers = this.domSelector.getFileExplorers();
                        if (fileExplorers.length > 0) {
                            this.updateView();
                        }
                    },
                    'ExplorerView',
                    '执行初始更新失败',
                    ErrorCategory.UI,
                    ErrorLevel.WARNING,
                    { action: 'scheduleInitialUpdate' }
                );
            },
            500 // 500ms延迟
        );
    }

    /**
     * 安排更新（防抖）
     */
    private scheduleUpdate(): void {
        this.updateScheduler.scheduleUpdate(
            ExplorerView.VIEW_ID,
            () => this.updateView(),
            500 // 使用与原先相同的500ms延迟
        );
    }

    /**
     * 安排视图准备就绪后的更新
     * 确保在Obsidian完全加载后处理所有文件项
     */
    private scheduleViewportReadyUpdate(): void {
        // 清除任何现有的计时器
        if (this.viewportReadyTimer !== null) {
            window.clearTimeout(this.viewportReadyTimer);
        }
        
        // 设置一个更长的延迟，等待Obsidian完全渲染界面
        this.viewportReadyTimer = window.setTimeout(() => {
            this.safeOperation(
                () => {
                    this.logDebug(`[${ExplorerView.VIEW_ID}] 执行视图准备就绪更新`);
                    // 强制执行立即更新
                    this.immediateUpdate();
                    
                    // 监视文件视图DOM变化，以便在懒加载时更新
                    this.monitorFileViewChanges();
                },
                'ExplorerView',
                '执行视图准备就绪更新失败',
                ErrorCategory.UI,
                ErrorLevel.WARNING,
                { action: 'scheduleViewportReadyUpdate' }
            );
        }, 2000); // 等待2秒，确保Obsidian已完全加载
    }
    
    /**
     * 监视文件视图的DOM变化
     * 处理Obsidian延迟加载文件项的情况
     */
    private monitorFileViewChanges(): void {
        this.safeOperation(
            () => {
                const fileExplorers = this.domSelector.getFileExplorers();
                if (fileExplorers.length === 0) return;
                
                // 创建新的变更监视器，特别关注新增文件项的情况
                const observer = new MutationObserver((mutations) => {
                    const hasRelevantChanges = mutations.some(mutation => 
                        mutation.type === 'childList' && 
                        Array.from(mutation.addedNodes).some(node => 
                            node instanceof HTMLElement && 
                            (node.classList.contains('nav-file') || 
                             node.classList.contains('nav-folder'))
                        )
                    );
                    
                    if (hasRelevantChanges) {
                        // 仅当检测到文件项变化时执行更新
                        this.immediateUpdate();
                    }
                });
                
                // 为每个文件浏览器注册观察器
                fileExplorers.forEach(explorer => {
                    observer.observe(explorer, {
                        childList: true,
                        subtree: true,
                        attributes: false
                    });
                });
            },
            'ExplorerView',
            '监视文件视图变化失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'monitorFileViewChanges' }
        );
    }

    /**
     * 立即更新视图，不进行防抖处理
     * 适用于文件重命名等需要立即响应的场景
     */
    immediateUpdate(): void {
        this.logDebug(`[${ExplorerView.VIEW_ID}] 执行立即更新`);
        
        this.safeOperation(
            () => {
                // 取消任何现有的更新计时器
                this.updateScheduler.cancelScheduledUpdate(ExplorerView.VIEW_ID);
                
                // 立即更新视图
                this.updateView();
                
                // 延迟再次更新以确保所有视图元素都被正确更新
                this.updateScheduler.scheduleUpdate(
                    `${ExplorerView.VIEW_ID}-delayed`,
                    () => this.updateView(),
                    100  // 使用较短的延迟提高响应速度
                );
            },
            'ExplorerView',
            '执行立即更新失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'immediateUpdate' }
        );
    }

    /**
     * 更新视图
     */
    updateView(): void {
        this.logDebug(`[${ExplorerView.VIEW_ID}] 正在更新视图...`);
        
        // 使用性能监控工具测量更新过程
        measurePerformance(
            () => {
                const fileExplorers = this.domSelector.getFileExplorers();
                const isEnabled = this.plugin.settings.enabled;
                
                fileExplorers.forEach(explorer => {
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
                                    // 处理每个文本元素
                                    const textElements = this.domSelector.getTextElements(fileItem);
                                    this.fileHandler.processTextElements(textElements, this.cacheManager, this.uiStateManager, isEnabled);

                                    // 处理个别文件项
                                    this.fileHandler.processFileItem(fileItem, this.cacheManager, this.uiStateManager, isEnabled);
                                });
                                
                                // 为防止某些文件项未被正确识别，也处理文本元素
                                if (fileItems.length < 3) { // 如果文件项很少，可能是识别有问题
                                    // 修复从文件项数组获取文本元素的错误
                                    const allTextElements = fileItems.flatMap(item => 
                                        this.domSelector.getTextElements(item)
                                    );
                                    this.fileHandler.processTextElements(allTextElements, this.cacheManager, this.uiStateManager, isEnabled);
                                }
                            }
                        },
                        'ExplorerView',
                        '处理文件浏览器元素失败',
                        ErrorCategory.UI,
                        ErrorLevel.WARNING,
                        { action: 'updateView:processExplorer' }
                    );
                });
            },
            'ExplorerView',
            150, // 性能阈值(ms)
            this.errorManager,
            this.logger
        );
    }

    /**
     * 设置监视虚拟滚动的逻辑
     * 用于处理Obsidian中使用的虚拟滚动导致的DOM变化
     */
    private setupVirtualScrollMonitor(): void {
        logErrorsWithoutThrowing(
            () => {
                // 记录上次看到的文件条目数量
                let lastKnownItemCount = 0;
                
                // 创建虚拟滚动观察器
                const scrollObserver = new MutationObserver((mutations) => {
                    logErrorsWithoutThrowing(
                        () => {
                            // 检查是否有相关DOM变化
                            const hasRelevantChanges = mutations.some(mutation => 
                                mutation.type === 'childList' || 
                                (mutation.type === 'attributes' && 
                                 (mutation.attributeName === 'style' || 
                                  mutation.attributeName === 'class'))
                            );
                            
                            if (!hasRelevantChanges) return true;
                            
                            // 计算当前可见文件条目的数量
                            const explorers = this.domSelector.getFileExplorers();
                            let totalItems = 0;
                            
                            explorers.forEach(explorer => {
                                const fileItems = this.domSelector.getFileItems(explorer);
                                totalItems += fileItems.length;
                            });
                            
                            // 如果文件条目数量变化较大，更新视图
                            if (totalItems !== 0 && Math.abs(totalItems - lastKnownItemCount) > 2) {
                                lastKnownItemCount = totalItems;
                                this.scheduleUpdate();
                            }
                            
                            return true;
                        },
                        'ExplorerView',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '处理虚拟滚动变化失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            defaultValue: false,
                            details: { mutationsCount: mutations.length }
                        }
                    );
                });
                
                // 为所有文件浏览器元素注册观察器
                const explorers = this.domSelector.getFileExplorers();
                explorers.forEach(explorer => {
                    // 同时观察文件浏览器和其可能的虚拟滚动容器
                    scrollObserver.observe(explorer, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class', 'data-path']
                    });
                    
                    // 尝试找到虚拟滚动容器并观察
                    const scrollContainer = explorer.closest('.nav-files-container') || 
                                           explorer.closest('.workspace-leaf-content');
                    if (scrollContainer && scrollContainer !== explorer) {
                        scrollObserver.observe(scrollContainer, {
                            childList: true,
                            attributes: true,
                            attributeFilter: ['style', 'class']
                        });
                    }
                });
                
                // 保存观察器引用，用于卸载时清理
                this.virtualScrollObserver = scrollObserver;
                
                return true;
            },
            'ExplorerView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置虚拟滚动监视器失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                defaultValue: false
            }
        );
    }

    /**
     * 卸载视图
     */
    unload(): void {
        this.logInfo(`[${ExplorerView.VIEW_ID}] 正在卸载...`);
        
        this.safeOperation(
            () => {
                // 取消所有调度的更新
                this.updateScheduler.cancelScheduledUpdate(ExplorerView.VIEW_ID);
                this.updateScheduler.cancelScheduledUpdate(`${ExplorerView.VIEW_ID}-initial`);
                this.updateScheduler.cancelScheduledUpdate(`${ExplorerView.VIEW_ID}-delayed`);
                
                // 卸载事件服务
                if (this.eventsService) {
                    this.eventsService.unregisterAll();
                }
                
                // 清理虚拟滚动观察器
                if (this.virtualScrollObserver) {
                    this.virtualScrollObserver.disconnect();
                    this.virtualScrollObserver = null;
                }
                
                // 清理可能的残留计时器
                if (this.virtualScrollIntervalId !== null) {
                    window.clearInterval(this.virtualScrollIntervalId);
                    this.virtualScrollIntervalId = null;
                }
                
                // 恢复所有原始文件名，使用新的无参数方法
                this.uiStateManager.restoreAllOriginalFilenames();
                
                // 清除视图准备就绪计时器
                if (this.viewportReadyTimer !== null) {
                    window.clearTimeout(this.viewportReadyTimer);
                    this.viewportReadyTimer = null;
                }
            },
            'ExplorerView',
            '卸载文件浏览器视图失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'unload' }
        );
        
        this.logInfo(`[${ExplorerView.VIEW_ID}] 卸载完成`);
    }
} 