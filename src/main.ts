import { App, Plugin, Vault } from 'obsidian';
import { Container } from 'inversify';
import { TitleChangerSettings, DEFAULT_SETTINGS, TitleChangerSettingTab } from './settings';
import { ViewManager } from './views/view-manager';
import { CacheManager } from './cache-manager';
import { TYPES } from './types/symbols';
import { createContainer } from './inversify.config';
import { Logger } from './utils/logger';
import { ExplorerView } from './views/explorer-view';
import { EditorLinkView } from './views/editor-view';
import { FileHandlerService } from './services/file-handler.service';
import { DOMSelectorService } from './services/dom-selector.service';
import { ExplorerStateService } from './services/explorer-state.service';
import { ExplorerEventsService } from './services/explorer-events.service';
import { LinkTransformerService } from './services/link-transformer.service';

export class TitleChangerPlugin extends Plugin {
    settings!: TitleChangerSettings;
    private container!: Container;
    private viewManager!: ViewManager;
    private linkTransformer!: LinkTransformerService;

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

        // 添加设置选项卡
        this.addSettingTab(new TitleChangerSettingTab(this.app, this));

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
} 