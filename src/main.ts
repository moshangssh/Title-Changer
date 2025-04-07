import { App, Plugin, Vault } from 'obsidian';
import { Container } from 'inversify';
import { TitleChangerSettings, DEFAULT_SETTINGS } from './settings/TitleChangerSettings';
import { TitleChangerSettingTab } from './settings/SettingTab';
import { ViewManager } from './views/ViewManager';
import { CacheManager } from './CacheManager';
import { TYPES } from './types/symbols';
import { createContainer } from './InversifyConfig';
import { Logger } from './utils/logger';
import { ExplorerView } from './views/ExplorerView';
import { EditorLinkView } from './views/EditorView';
import { FileHandlerService } from './services/FileHandlerService';
import { DOMSelectorService } from './services/DomSelectorService';
import { UIStateManager } from './services/UIStateManager';
import { ExplorerEventsService } from './services/ExplorerEventsService';
import { LinkTransformerService } from './services/LinkTransformerService';
import { UpdateScheduler } from './services/UpdateSchedulerService';
import { ErrorManagerService } from './services/ErrorManagerService';
import { TitleStateAdapter } from './services/TitleStateAdapter';
import { EventBusService } from './services/EventBusService';
import { IEventBusService } from './types/ObsidianExtensions';
import { GraphView } from './views/GraphView';

export class TitleChangerPlugin extends Plugin {
    settings!: TitleChangerSettings;
    private container!: Container;
    private viewManager!: ViewManager;
    private linkTransformer!: LinkTransformerService;
    private explorerView!: ExplorerView;
    private logger!: Logger;
    private titleStateAdapter!: TitleStateAdapter;
    private eventBus!: IEventBusService;

    async onload() {
        // 创建Logger实例，不传递插件实例避免循环依赖
        this.logger = new Logger(undefined, 'Title Changer');
        this.logger.info('加载 Title Changer 插件');

        // 加载用户设置
        await this.loadSettings();

        // 在初始化容器前，创建一个包含常量值的预定义绑定映射
        const bindings = new Map<symbol, any>();
        bindings.set(TYPES.Logger, this.logger);

        // 初始化IOC容器，传入预定义绑定
        this.initializeContainer(bindings);

        // 获取主要服务实例
        this.viewManager = this.container.get<ViewManager>(TYPES.ViewManager);
        this.explorerView = this.container.get<ExplorerView>(TYPES.ExplorerView);
        this.linkTransformer = this.container.get<LinkTransformerService>(TYPES.LinkTransformerService);
        this.titleStateAdapter = this.container.get<TitleStateAdapter>(TYPES.TitleStateAdapter);
        this.eventBus = this.container.get<IEventBusService>(TYPES.EventBusService);

        // 确保设置在容器初始化后立即应用到服务中
        this.linkTransformer.setSettings(this.settings);

        // 加载样式
        this.loadStyles();

        // 添加设置标签
        this.addSettingTab(new TitleChangerSettingTab(this.app, this));

        // 初始化数据管理和事件监听
        this.titleStateAdapter.initialize();
        
        // 初始化视图管理器 - 延迟一些组件初始化以确保Obsidian完全加载
        try {
            // 立即初始化基本视图
            this.viewManager.initialize();
            
            // 获取GraphView实例，保存到本地变量以避免重复获取
            let graphViewRef: GraphView | null = null;
            try {
                graphViewRef = this.container.get<GraphView>(TYPES.GraphView);
            } catch (error) {
                this.logger.error('无法获取GraphView实例', { error });
            }
            
            // 在应用程序完全加载后，特别是图表视图的初始化和重新应用节点替换
            this.app.workspace.onLayoutReady(() => {
                this.logger.info('Obsidian布局已准备完成，执行延迟初始化任务');
                
                // 重新初始化图表视图确保正确应用替换
                if (graphViewRef) {
                    setTimeout(() => {
                        try {
                            graphViewRef?.updateView();
                            this.logger.info('已成功更新图表视图');
                        } catch (error) {
                            this.logger.error('延迟初始化图表视图失败', { error });
                        }
                    }, 500);
                } else {
                    this.logger.warn('无法更新图表视图：实例不存在');
                }
            });
        } catch (error) {
            this.logger.error('初始化视图管理器失败', { error });
        }

        // 根据设置初始化ReadingView状态
        if (!this.settings.enableReadingView) {
            this.viewManager.disableView('reading');
        }
        
        // 根据设置初始化EditorLinkView状态
        if (!this.settings.enableEditorLinkView) {
            this.viewManager.disableView('editor');
        }

        // 添加命令，刷新所有视图
        this.addCommand({
            id: 'refresh-title-changer-views',
            name: '刷新文件名显示',
            callback: () => {
                this.viewManager.updateAllViews();
            }
        });

        // 注册后处理器，确保阅读视图中的链接得到处理
        this.registerMarkdownPostProcessor((element, context) => {
            // 处理渲染后的Markdown内容中的内部链接
            this.linkTransformer.processInternalLinks(element);
            
            // 使用requestAnimationFrame替代setTimeout进行延迟处理
            // 确保动态加载的内容也能正确显示
            requestAnimationFrame(() => {
                this.linkTransformer.processInternalLinks(element);
            });
        });
    }

    onunload() {
        this.logger.info('卸载 Title Changer 插件');
        
        // 移除样式
        const styleEl = document.getElementById('title-changer-styles');
        if (styleEl) styleEl.remove();
        
        // 取消所有事件订阅
        if (this.eventBus) {
            this.eventBus.unsubscribeAll();
        }
        
        // 卸载视图管理器
        if (this.viewManager) {
            this.viewManager.unload();
        }

        // 卸载文件浏览器视图
        if (this.explorerView) {
            this.explorerView.unload();
        }
        
        // 卸载标题状态适配器
        if (this.titleStateAdapter) {
            this.titleStateAdapter.unload();
        }
        
        // 清理所有计时器
        const updateScheduler = this.container.get<UpdateScheduler>(TYPES.UpdateScheduler);
        if (updateScheduler) {
            updateScheduler.clearAll();
        }

        // 释放容器资源
        if (this.container) {
            this.container.unbindAll();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // 更新链接转换器的设置
        this.linkTransformer.setSettings(this.settings);
        
        // 设置变更时更新视图
        if (this.viewManager) {
            this.viewManager.onSettingsChanged();
        }
    }

    private initializeContainer(bindings: Map<symbol, any>): void {
        this.container = createContainer(this, bindings);
    }

    /**
     * 刷新文件浏览器视图
     * 用于在启用/禁用插件时立即更新显示
     */
    refreshExplorerView(): void {
        if (this.explorerView) {
            this.explorerView.updateView();
        }
    }

    /**
     * 获取视图管理器实例
     * @returns 视图管理器实例
     */
    getViewManager(): ViewManager {
        return this.viewManager;
    }

    /**
     * 获取日志记录器实例
     * @returns 日志记录器实例
     */
    getLogger(): Logger {
        return this.logger;
    }

    /**
     * 获取错误管理器实例
     * @returns 错误管理器实例
     */
    getErrorManager(): ErrorManagerService {
        return this.container.get<ErrorManagerService>(TYPES.ErrorManager);
    }

    /**
     * 获取事件总线实例
     * @returns 事件总线实例
     */
    getEventBus(): IEventBusService {
        return this.eventBus;
    }

    // 添加样式
    private loadStyles() {
        // 添加样式元素
        const styleEl = document.head.createEl('style', {
            attr: { id: 'title-changer-styles' }
        });
        
        // 设置CSS内容
        styleEl.textContent = `
        .title-changer-folder-selector {
            margin-top: 8px;
            margin-bottom: 24px;
            width: 100%;
        }
        
        .title-changer-folder-selector .search-container {
            position: relative;
            margin-bottom: 12px;
        }
        
        .title-changer-folder-selector .search-container input {
            width: 100%;
            padding: 8px 12px 8px 32px;
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
            background-color: var(--background-primary);
        }
        
        .title-changer-folder-selector .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
        }
        
        .title-changer-folder-selector .suggestions-container {
            position: absolute;
            width: 100%;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background-color: var(--background-primary);
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .title-changer-folder-selector .suggestion-item {
            padding: 8px 12px;
            cursor: pointer;
        }
        
        .title-changer-folder-selector .suggestion-item:hover {
            background-color: var(--background-secondary);
        }
        
        .title-changer-folder-selector .suggestion-item.custom {
            font-style: italic;
            color: var(--text-accent);
        }
        
        .title-changer-folder-selector .no-suggestions {
            padding: 8px 12px;
            color: var(--text-muted);
            font-style: italic;
        }
        
        .title-changer-folder-selector .folder-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }
        
        .title-changer-folder-selector .folder-item {
            display: flex;
            align-items: center;
            background-color: var(--background-secondary);
            border-radius: 4px;
            padding: 4px 8px;
        }
        
        .title-changer-folder-selector .folder-name {
            margin-right: 4px;
        }
        
        .title-changer-folder-selector .remove-button {
            cursor: pointer;
            color: var(--text-muted);
            font-weight: bold;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .title-changer-folder-selector .remove-button:hover {
            color: var(--text-error);
        }
        
        .title-changer-folder-selector .empty-message {
            color: var(--text-muted);
            font-style: italic;
        }`;
    }
} 