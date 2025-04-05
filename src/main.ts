import { App, Plugin, Vault } from 'obsidian';
import { Container } from 'inversify';
import { TitleChangerSettings, DEFAULT_SETTINGS, TitleChangerSettingTab, FOLDER_SELECTOR_STYLES } from './settings';
import { ViewManager } from './views/ViewManager';
import { CacheManager } from './CacheManager';
import { TYPES } from './types/Symbols';
import { createContainer } from './InversifyConfig';
import { Logger } from './utils/Logger';
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
        // 加载设置
        await this.loadSettings();

        // 初始化 IoC 容器
        this.initializeContainer();
        
        // 获取Logger服务
        this.logger = this.container.get<Logger>(TYPES.Logger);
        this.logger.info('加载 Title Changer 插件');

        // 初始化事件总线
        this.eventBus = this.container.get<IEventBusService>(TYPES.EventBusService);
        // 桥接Obsidian事件到事件总线
        this.eventBus.bridgeObsidianEvents();

        // 加载样式
        this.loadStyles();

        // 获取服务实例
        this.viewManager = this.container.get<ViewManager>(TYPES.ViewManager);
        this.linkTransformer = this.container.get<LinkTransformerService>(TYPES.LinkTransformerService);
        this.linkTransformer.setSettings(this.settings);
        
        // 初始化标题状态适配器
        this.titleStateAdapter = this.container.get<TitleStateAdapter>(TYPES.TitleStateAdapter);
        this.titleStateAdapter.initialize();

        // 初始化视图
        if (this.container.isBound(TYPES.ExplorerView)) {
            this.explorerView = this.container.get<ExplorerView>(TYPES.ExplorerView);
            this.explorerView.initialize();
        }

        // 添加设置选项卡
        this.addSettingTab(new TitleChangerSettingTab(this.app, this));

        // 根据设置初始化ReadingView状态
        if (!this.settings.enableReadingView) {
            this.viewManager.disableView('reading');
        }
        
        // 根据设置初始化EditorLinkView状态
        if (!this.settings.enableEditorLinkView) {
            this.viewManager.disableView('editor');
        }

        // 初始化视图管理器
        this.viewManager.initialize();

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
        const styleEl = document.getElementById('title-changer-folder-selector-styles');
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

    private initializeContainer(): void {
        this.container = createContainer(this);
    }

    /**
     * 刷新文件浏览器视图
     * 用于在启用/禁用插件时立即更新显示
     */
    refreshExplorerView(): void {
        if (this.explorerView) {
            this.explorerView.immediateUpdate();
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
        // 添加文件夹选择器样式
        document.head.createEl('style', {
            attr: { id: 'title-changer-folder-selector-styles' },
            text: FOLDER_SELECTOR_STYLES
        });
    }
} 