import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { AbstractView } from './base/abstract-view';
import type { IEventBusService } from '../types/ObsidianExtensions';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { TitleService } from '../services/TitleService';
import { tryCatchWrapper } from '../utils/ErrorHelpers';
import type { TitleChangerPlugin } from '../main';
import type { GraphNodeReplacer } from '../utils/GraphNodeReplacer';
import { ErrorCategory } from '../utils/Errors';
import type { TitleChangerSettings } from '../settings';
import { EventType } from '../types/ObsidianExtensions';
import { App } from 'obsidian';

/**
 * 图表视图管理组件
 * 负责在图表视图(Graph View)中显示修改后的文件名
 */
@injectable()
export class GraphView extends AbstractView {
    protected enabled = false;
    
    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.App) private app: App,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService, 
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.EventBusService) private eventBus: IEventBusService,
        @inject(TYPES.GraphNodeReplacer) private nodeReplacer: GraphNodeReplacer,
        @inject(TYPES.Settings) private settings: TitleChangerSettings
    ) {
        super(plugin, logger, errorManager);
    }
    
    /**
     * 初始化图表视图组件
     */
    initialize(): void {
        this.logDebug('初始化图表视图组件');
        
        try {
            // 注册标题变更事件
            this.registerEvents();
            
            // 根据设置决定是否启用
            if (this.settings.enableGraphView) {
                this.enable();
                
                // 延迟检查确保图表视图已经完全加载
                setTimeout(() => {
                    this.logDebug('执行延迟图表视图检查');
                    try {
                        this.updateView();
                    } catch (error) {
                        this.logger.error('延迟更新图表视图失败', { error });
                    }
                }, 2000);
                
                // 添加观察器，监听图表视图的创建
                this.registerGraphViewCreatedObserver();
            } else {
                this.logInfo('图表视图标题替换功能已禁用（设置中）');
            }
        } catch (error) {
            this.logger.error('图表视图初始化失败', { error });
        }
    }
    
    /**
     * 注册相关事件监听
     */
    private registerEvents(): void {
        this.eventBus.subscribe(EventType.TITLE_CHANGED, this.handleTitleChanged);
        this.eventBus.subscribe(EventType.PLUGIN_SETTINGS_CHANGED, this.handleSettingsChanged);
    }
    
    /**
     * 处理标题变更事件
     */
    private handleTitleChanged = (event: any): void => {
        if (!this.enabled) return;
        
        // 获取文件路径
        const path = event.payload?.path;
        if (path) {
            this.updateNodeForPath(path);
        }
    };
    
    /**
     * 处理设置变更事件
     */
    private handleSettingsChanged = (): void => {
        // 根据设置更新启用状态
        if (this.settings.enableGraphView && !this.enabled) {
            this.enable();
        } else if (!this.settings.enableGraphView && this.enabled) {
            this.disable();
        }
        
        if (this.enabled) {
            this.updateView();
        }
    };
    
    /**
     * 为指定路径更新节点
     */
    private updateNodeForPath(path: string): void {
        if (!this.enabled) return;
        
        tryCatchWrapper(
            () => this.nodeReplacer.refreshNode(path),
            'GraphView',
            this.errorManager,
            this.logger,
            {
                errorMessage: `更新节点 ${path} 失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.DEBUG,
                details: { path }
            }
        );
    }
    
    /**
     * 监听图表视图的创建
     * Obsidian可能在插件初始化后创建新图表视图
     */
    private registerGraphViewCreatedObserver(): void {
        if (!this.app || !this.app.workspace) {
            this.logger.error('无法注册图表视图创建监听器：app.workspace未定义');
            return;
        }
        
        try {
            this.plugin.registerEvent(
                this.app.workspace.on('layout-change', () => {
                    if (this.enabled) {
                        // 检查是否有新的图表视图被创建
                        requestAnimationFrame(() => {
                            this.checkAndApplyChanges();
                        });
                    }
                })
            );
            this.logDebug('已注册图表视图创建监听器');
        } catch (error) {
            this.logger.error('注册图表视图创建监听器失败', { error });
        }
    }
    
    /**
     * 启用图表视图组件
     */
    override enable(): void {
        if (this.enabled) return;
        
        this.logInfo('启用图表视图标题替换功能');
        this.nodeReplacer.enable();
        this.enabled = true;
        
        // 立即检查是否可以应用
        this.checkAndApplyChanges();
        
        // 延迟再次检查，确保图表视图已完全加载
        setTimeout(() => {
            this.updateView();
        }, 500);
    }
    
    /**
     * 禁用图表视图组件
     */
    override disable(): void {
        if (!this.enabled) return;
        
        this.logInfo('禁用图表视图标题替换功能');
        this.nodeReplacer.disable();
        this.enabled = false;
    }
    
    /**
     * 更新图表视图
     */
    updateView(): void {
        if (!this.enabled) return;
        
        tryCatchWrapper(
            () => {
                // 检查和应用变更
                this.checkAndApplyChanges();
                
                // 刷新视图
                this.nodeReplacer.refresh();
                this.logDebug('图表视图已更新');
            },
            'GraphView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新图表视图失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { component: 'GraphView' }
            }
        );
    }
    
    /**
     * 卸载组件
     */
    unload(): void {
        this.logInfo('卸载图表视图组件');
        this.disable();
        
        // 取消事件订阅
        // 由于使用箭头函数作为事件处理器，无需显式绑定this
        this.eventBus.unsubscribeAll();
    }
    
    /**
     * 检查并应用变更
     */
    private checkAndApplyChanges(): void {
        if (!this.nodeReplacer.isApplied()) {
            const result = this.nodeReplacer.apply();
            if (result) {
                this.logDebug('已应用图表节点替换');
            }
        }
    }
} 