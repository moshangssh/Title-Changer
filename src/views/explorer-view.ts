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
        // 注册事件监听器
        this.registerEvents();
        
        // 初始更新
        this.scheduleInitialUpdate();
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
            }
        });
    }

    /**
     * 卸载视图
     */
    unload(): void {
        // 取消更新计时器
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 清理所有事件
        this.eventsService.unregisterAll();
        
        // 恢复所有原始文件名
        this.stateService.restoreAllOriginalFilenames(() => this.domSelector.getTextElements(document.body));
    }
} 