import { TFile, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { DOMSelectorService } from '../services/dom-selector.service';
import { ExplorerEventsService } from '../services/explorer-events.service';
import { FileHandlerService } from '../services/file-handler.service';
import { ExplorerStateService } from '../services/explorer-state.service';
import { CacheManager } from '../cache-manager';

/**
 * 文件浏览器视图，作为各服务的协调器
 */
@injectable()
export class ExplorerView {
    // 更新计时器
    private updateTimer: number | null = null;
    private static readonly UPDATE_INTERVAL = 500;

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.ExplorerEventsService) private eventsService: ExplorerEventsService,
        @inject(TYPES.FileHandlerService) private fileHandler: FileHandlerService,
        @inject(TYPES.ExplorerStateService) private stateService: ExplorerStateService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager
    ) {}

    /**
     * 初始化视图
     */
    initialize(): void {
        // 设置立即更新函数
        this.eventsService.setImmediateUpdateFn(() => this.immediateUpdate());
        
        // 注册事件监听器
        this.registerEvents();
        
        // 初始更新
        this.scheduleInitialUpdate();
        
        // 注册虚拟滚动监视器
        this.setupVirtualScrollMonitor();
    }

    /**
     * 注册所有事件监听器
     */
    private registerEvents(): void {
        // 注册DOM观察器
        this.eventsService.registerDOMObserver(() => this.scheduleUpdate());
        
        // 注册文件事件
        this.eventsService.registerFileEvents(
            (file) => this.cacheManager.invalidateFile(file),
            () => this.scheduleUpdate()
        );
        
        // 注册布局事件
        this.eventsService.registerLayoutEvents(() => this.scheduleUpdate());
    }

    /**
     * 安排初始更新
     */
    private scheduleInitialUpdate(): void {
        window.setTimeout(() => {
            const fileExplorers = this.domSelector.getFileExplorers();
            if (fileExplorers.length > 0) {
                this.updateView();
            }
        }, 500);
    }

    /**
     * 安排更新（防抖）
     */
    private scheduleUpdate(): void {
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = window.setTimeout(() => {
            this.updateView();
            this.updateTimer = null;
        }, ExplorerView.UPDATE_INTERVAL);
    }

    /**
     * 立即更新视图，不进行防抖处理
     * 适用于文件重命名等需要立即响应的场景
     */
    immediateUpdate(): void {
        // 清除任何现有的更新计时器
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 立即更新视图
        this.updateView();
        
        // 延迟再次更新以确保所有视图元素都被正确更新
        setTimeout(() => {
            this.updateView();
        }, 150);
    }

    /**
     * 更新视图
     */
    updateView(): void {
        const fileExplorers = this.domSelector.getFileExplorers();
        
        fileExplorers.forEach(explorer => {
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
        });
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
        }, checkInterval);
        
        // 保存间隔ID以便在卸载时清除
        this.virtualScrollIntervalId = intervalId;
    }

    // 添加新的成员变量
    private virtualScrollIntervalId: number | null = null;

    /**
     * 卸载视图
     */
    unload(): void {
        // 取消更新计时器
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 清除虚拟滚动监视器
        if (this.virtualScrollIntervalId !== null) {
            window.clearInterval(this.virtualScrollIntervalId);
            this.virtualScrollIntervalId = null;
        }
        
        // 清理所有事件
        this.eventsService.unregisterAll();
        
        // 恢复所有原始文件名
        this.stateService.restoreAllOriginalFilenames(() => this.domSelector.getTextElements(document.body));
    }
} 