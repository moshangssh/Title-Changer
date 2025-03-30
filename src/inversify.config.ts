import { Container } from "inversify";
import "reflect-metadata";
import { TYPES } from "./types/symbols";
import { App, Vault } from "obsidian";
import { TitleChangerPlugin } from "./main";
import { TitleChangerSettings } from "./settings";
import { CacheManager } from "./cache-manager";
import { ViewManager } from "./views/view-manager";
import { ExplorerView } from "./views/explorer-view";
import { EditorLinkView } from "./views/editor-view";
import { FileHandlerService } from "./services/file-handler.service";
import { DOMSelectorService } from "./services/dom-selector.service";
import { ExplorerStateService } from "./services/explorer-state.service";
import { ExplorerEventsService } from "./services/explorer-events.service";
import { Logger } from "./utils/logger";
import { EditorExtensionManager } from "./services/EditorExtensionManager";
import type { ICacheManager, IViewManager, IDOMSelectorService, IEditorExtensionManager } from "./types/obsidian-extensions";

/**
 * 创建并配置 InversifyJS 容器
 * @param plugin TitleChanger 插件实例
 * @returns 配置好的容器实例
 */
export function createContainer(plugin: TitleChangerPlugin): Container {
    const container = new Container();
    
    // 注册插件核心组件
    container.bind<TitleChangerPlugin>(TYPES.Plugin).toConstantValue(plugin);
    container.bind<App>(TYPES.App).toConstantValue(plugin.app);
    container.bind<Vault>(TYPES.Vault).toConstantValue(plugin.app.vault);
    container.bind<TitleChangerSettings>(TYPES.Settings).toConstantValue(plugin.settings);
    
    // 注册管理器（单例）
    container.bind<ICacheManager>(TYPES.CacheManager).to(CacheManager).inSingletonScope();
    container.bind<IViewManager>(TYPES.ViewManager).to(ViewManager).inSingletonScope();
    
    // 注册视图（单例）
    container.bind(TYPES.ExplorerView).to(ExplorerView).inSingletonScope();
    container.bind(TYPES.EditorLinkView).to(EditorLinkView).inSingletonScope();
    
    // 注册服务（单例）
    container.bind(TYPES.FileHandlerService).to(FileHandlerService).inSingletonScope();
    container.bind<IDOMSelectorService>(TYPES.DOMSelectorService).to(DOMSelectorService).inSingletonScope();
    container.bind(TYPES.ExplorerStateService).to(ExplorerStateService).inSingletonScope();
    container.bind(TYPES.ExplorerEventsService).to(ExplorerEventsService).inSingletonScope();
    container.bind(TYPES.Logger).to(Logger).inSingletonScope();
    container.bind<IEditorExtensionManager>(TYPES.EditorExtensionManager).to(EditorExtensionManager).inSingletonScope();
    
    return container;
} 