import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { 
    measurePerformance
} from '../utils/ErrorHelpers';
import { AbstractView } from './base/abstract-view';
import { VirtualScrollManager } from '../managers/VirtualScrollManager';
import { DOMObserverManager } from '../managers/DOMObserverManager';
import { UpdateCoordinator } from '../managers/UpdateCoordinator';
import { FileItemProcessor } from '../managers/FileItemProcessor';

/**
 * 文件浏览器视图，作为各服务的协调器
 */
@injectable()
export class ExplorerView extends AbstractView {
    private static readonly VIEW_ID = 'explorer-view';
    private static readonly BASE_PERFORMANCE_THRESHOLD = 200; // 基础性能阈值(ms)
    private static readonly ITEM_THRESHOLD_FACTOR = 0.8; // 每个文件项增加的阈值因子(ms)
    private static readonly MAX_PERFORMANCE_THRESHOLD = 800; // 最大性能阈值(ms)

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.VirtualScrollManager) private virtualScrollManager: VirtualScrollManager,
        @inject(TYPES.DOMObserverManager) private domObserverManager: DOMObserverManager,
        @inject(TYPES.UpdateCoordinator) private updateCoordinator: UpdateCoordinator,
        @inject(TYPES.FileItemProcessor) private fileItemProcessor: FileItemProcessor
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
                // 初始化更新协调器
                this.updateCoordinator.initialize(() => this.updateView());
                
                // 注册事件监听器
                this.updateCoordinator.registerEvents();
                
                // 调度初始更新和视图准备就绪更新
                this.updateCoordinator.scheduleInitialUpdate();
                this.updateCoordinator.scheduleViewportReadyUpdate();
                
                // 初始化虚拟滚动管理器
                this.virtualScrollManager.initialize(() => this.updateCoordinator.scheduleUpdate());
                
                // 初始化DOM观察管理器
                this.domObserverManager.initialize(() => this.updateCoordinator.immediateUpdate());
                
                // 初始化文件项处理器
                this.fileItemProcessor.initialize();
                
                // 立即执行一次更新
                this.updateCoordinator.immediateUpdate();
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
     * 计算性能阈值
     * 根据文件浏览器中文件项的数量动态调整阈值
     * @returns 计算后的性能阈值(ms)
     */
    private calculatePerformanceThreshold(): number {
        try {
            const fileExplorers = this.fileItemProcessor['domSelector'].getFileExplorers();
            let totalItems = 0;
            
            fileExplorers.forEach(explorer => {
                const fileItems = this.fileItemProcessor['domSelector'].getFileItems(explorer);
                totalItems += fileItems.length;
            });
            
            // 根据文件项数量计算性能阈值
            const calculatedThreshold = ExplorerView.BASE_PERFORMANCE_THRESHOLD + 
                totalItems * ExplorerView.ITEM_THRESHOLD_FACTOR;
                
            // 确保阈值不超过最大值
            return Math.min(calculatedThreshold, ExplorerView.MAX_PERFORMANCE_THRESHOLD);
        } catch (error) {
            // 如果计算失败，返回基础阈值
            this.logDebug(`[${ExplorerView.VIEW_ID}] 计算性能阈值失败: ${error}，使用基础阈值`);
            return ExplorerView.BASE_PERFORMANCE_THRESHOLD;
        }
    }

    /**
     * 更新视图
     */
    updateView(): void {
        this.logDebug(`[${ExplorerView.VIEW_ID}] 正在更新视图...`);
        
        // 计算动态性能阈值
        const performanceThreshold = this.calculatePerformanceThreshold();
        
        // 使用性能监控工具测量更新过程
        measurePerformance(
            () => {
                // 将更新逻辑委托给 FileItemProcessor
                this.fileItemProcessor.processAllExplorers(this.plugin.settings.enabled);
                
                this.logDebug(`[${ExplorerView.VIEW_ID}] 视图更新完成`);
            },
            'ExplorerView',
            performanceThreshold, // 使用动态计算的性能阈值
            this.errorManager,
            this.logger
        );
    }

    /**
     * 卸载视图
     */
    unload(): void {
        this.logInfo(`[${ExplorerView.VIEW_ID}] 正在卸载...`);
        
        this.safeOperation(
            () => {
                // 清理更新协调器
                this.updateCoordinator.unload();
                
                // 清理虚拟滚动管理器
                this.virtualScrollManager.unload();
                
                // 清理DOM观察管理器
                this.domObserverManager.unload();
                
                // 清理文件项处理器
                this.fileItemProcessor.unload();
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