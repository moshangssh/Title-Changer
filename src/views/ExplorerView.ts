import { TFile, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import type { TitleChangerPlugin } from '../main';
import { DOMSelectorService } from '../services/DomSelectorService';
import { ExplorerEventsService } from '../services/ExplorerEventsService';
import { FileHandlerService } from '../services/FileHandlerService';
import { ExplorerStateService } from '../services/explorer-state.service';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
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

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.ExplorerEventsService) private eventsService: ExplorerEventsService,
        @inject(TYPES.FileHandlerService) private fileHandler: FileHandlerService,
        @inject(TYPES.ExplorerStateService) private stateService: ExplorerStateService,
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
                
                // 初始更新
                this.scheduleInitialUpdate();
                
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
                // 注册DOM观察器
                this.eventsService.registerDOMObserver(() => this.scheduleUpdate());
                
                // 注册文件事件
                this.eventsService.registerFileEvents(
                    (file) => this.cacheManager.invalidateFile(file),
                    () => this.scheduleUpdate()
                );
                
                // 注册布局事件
                this.eventsService.registerLayoutEvents(() => this.scheduleUpdate());
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
                    150
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
                
                fileExplorers.forEach(explorer => {
                    this.safeOperation(
                        () => {
                            const fileItems = this.domSelector.getFileItems(explorer);
                            
                            if (fileItems.length === 0) {
                                // 如果没有找到文件项，尝试处理所有文本元素
                                const textElements = this.domSelector.getTextElements(explorer);
                                this.fileHandler.processTextElements(textElements, this.cacheManager, this.stateService);
                            } else {
                                // 处理找到的文件项
                                fileItems.forEach(fileItem => {
                                    this.fileHandler.processFileItem(fileItem, this.cacheManager, this.stateService);
                                });
                                
                                // 为防止某些文件项未被正确识别，也处理文本元素
                                if (fileItems.length < 3) { // 如果文件项很少，可能是识别有问题
                                    const textElements = this.domSelector.getTextElements(explorer);
                                    this.fileHandler.processTextElements(textElements, this.cacheManager, this.stateService);
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
     * 用于处理Obsidian中使用的虚拟滚动导致的视图变化
     */
    private setupVirtualScrollMonitor(): void {
        // 使用长轮询来检测因虚拟滚动导致的DOM变化
        const checkInterval = 1000; // 每秒检查一次
        
        // 记录上次看到的文件条目数量
        let lastKnownItemCount = 0;
        
        // 定期检查文件条目数量是否变化
        const intervalId = window.setInterval(() => {
            logErrorsWithoutThrowing(
                () => {
                    const explorers = this.domSelector.getFileExplorers();
                    let totalItems = 0;
                    
                    explorers.forEach(explorer => {
                        const fileItems = this.domSelector.getFileItems(explorer);
                        totalItems += fileItems.length;
                    });
                    
                    // 如果文件条目数量变化，可能是由于虚拟滚动加载了新内容
                    if (totalItems !== 0 && Math.abs(totalItems - lastKnownItemCount) > 2) {
                        lastKnownItemCount = totalItems;
                        this.scheduleUpdate();
                    }
                },
                'ExplorerView',
                this.errorManager,
                this.logger,
                {
                    errorMessage: '监视虚拟滚动失败',
                    category: ErrorCategory.UI,
                    level: ErrorLevel.DEBUG,
                    details: { action: 'virtualScrollMonitor' }
                }
            );
        }, checkInterval);
        
        // 保存间隔ID以便在卸载时清除
        this.virtualScrollIntervalId = intervalId;
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
                
                // 清除虚拟滚动监视器
                if (this.virtualScrollIntervalId !== null) {
                    window.clearInterval(this.virtualScrollIntervalId);
                    this.virtualScrollIntervalId = null;
                }
                
                // 清理所有事件
                this.eventsService.unregisterAll();
                
                // 恢复所有原始文件名
                this.stateService.restoreAllOriginalFilenames(() => this.domSelector.getTextElements(document.body));
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