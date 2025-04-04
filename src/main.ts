import { App, Plugin, Vault } from 'obsidian';
import { Container } from 'inversify';
import { TitleChangerSettings, DEFAULT_SETTINGS, TitleChangerSettingTab } from './settings';
import { ViewManager } from './views/ViewManager';
import { CacheManager } from './CacheManager';
import { TYPES } from './types/Symbols';
import { createContainer } from './InversifyConfig';
import { Logger } from './utils/Logger';
import { ExplorerView } from './views/ExplorerView';
import { EditorLinkView } from './views/EditorView';
import { FileHandlerService } from './services/FileHandlerService';
import { DOMSelectorService } from './services/DomSelectorService';
import { ExplorerStateService } from './services/explorer-state.service';
import { ExplorerEventsService } from './services/ExplorerEventsService';
import { LinkTransformerService } from './services/LinkTransformerService';

export class TitleChangerPlugin extends Plugin {
    settings!: TitleChangerSettings;
    private container!: Container;
    private viewManager!: ViewManager;
    private linkTransformer!: LinkTransformerService;
    private explorerView!: ExplorerView;

    async onload() {
        console.log('加载 Title Changer 插件');

        // 加载设置
        await this.loadSettings();

        // 初始化 IoC 容器
        this.initializeContainer();

        // 获取服务实例
        this.viewManager = this.container.get<ViewManager>(TYPES.ViewManager);
        this.linkTransformer = this.container.get<LinkTransformerService>(TYPES.LinkTransformerService);
        this.linkTransformer.setSettings(this.settings);

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
            
            // 延迟处理以确保动态加载的内容也能正确显示
            setTimeout(() => {
                this.linkTransformer.processInternalLinks(element);
            }, 200);
        });
    }

    onunload() {
        console.log('卸载 Title Changer 插件');
        
        // 卸载视图管理器
        if (this.viewManager) {
            this.viewManager.unload();
        }

        // 卸载文件浏览器视图
        if (this.explorerView) {
            this.explorerView.unload();
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
} 