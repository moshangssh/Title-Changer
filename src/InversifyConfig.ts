import { Container } from "inversify";
import "reflect-metadata";
import { TYPES } from "./types/Symbols";
import { App, Vault } from "obsidian";
import { TitleChangerPlugin } from "./main";
import { TitleChangerSettings } from "./settings";
import { CacheManager } from "./CacheManager";
import { ViewManager } from "./views/ViewManager";
import { FileHandlerService } from "./services/FileHandlerService";
import { ExplorerView } from "./views/ExplorerView";
import { ExplorerEventsService } from "./services/ExplorerEventsService";
import { DOMSelectorService } from "./services/DomSelectorService";
import { ExplorerStateService } from "./services/ExplorerStateService";
import { EditorLinkView } from "./views/EditorView";
import { ReadingView } from "./views/ReadingView";
import { ErrorManagerService } from "./services/ErrorManagerService";
import { Logger } from "./utils/Logger";
import { EditorExtensionManager } from "./services/EditorExtensionManager";
import type { ICacheManager, IViewManager, IDOMSelectorService, IEditorExtensionManager } from "./types/ObsidianExtensions";
import { LinkTransformerService } from "./services/LinkTransformerService";
import { FileService } from "./services/FileService";
import { TitleService } from "./services/TitleService";
import { UpdateScheduler } from "./services/UpdateSchedulerService";
import { SelectorFactory } from "./config/selectors";
import { TitleStateAdapter } from "./services/TitleStateAdapter";

/**
 * 创建并配置IOC容器
 */
export function createContainer(plugin: TitleChangerPlugin): Container {
    const container = new Container();

    // 注册核心组件
    container.bind(TYPES.Plugin).toConstantValue(plugin);
    container.bind(TYPES.App).toConstantValue(plugin.app);
    container.bind(TYPES.Vault).toConstantValue(plugin.app.vault);
    container.bind(TYPES.Settings).toConstantValue(plugin.settings);

    // 注册管理器
    container.bind<ICacheManager>(TYPES.CacheManager).to(CacheManager).inSingletonScope();
    container.bind<IViewManager>(TYPES.ViewManager).to(ViewManager).inSingletonScope();
    container.bind(TYPES.ErrorManager).to(ErrorManagerService).inSingletonScope();

    // 注册视图
    container.bind(TYPES.ExplorerView).to(ExplorerView).inSingletonScope();
    container.bind(TYPES.EditorLinkView).to(EditorLinkView).inSingletonScope();
    container.bind(TYPES.ReadingView).to(ReadingView).inSingletonScope();

    // 注册服务
    container.bind(TYPES.Logger).to(Logger).inSingletonScope();
    container.bind<IDOMSelectorService>(TYPES.DOMSelectorService).to(DOMSelectorService).inSingletonScope();
    container.bind(TYPES.FileHandlerService).to(FileHandlerService).inSingletonScope();
    container.bind(TYPES.ExplorerStateService).to(ExplorerStateService).inSingletonScope();
    container.bind(TYPES.ExplorerEventsService).to(ExplorerEventsService).inSingletonScope();
    container.bind<IEditorExtensionManager>(TYPES.EditorExtensionManager).to(EditorExtensionManager).inSingletonScope();
    container.bind(TYPES.LinkTransformerService).to(LinkTransformerService).inSingletonScope();
    container.bind(TYPES.FileService).to(FileService).inSingletonScope();
    container.bind(TYPES.TitleService).to(TitleService).inSingletonScope();
    container.bind(TYPES.TitleStateAdapter).to(TitleStateAdapter).inSingletonScope();
    container.bind(TYPES.UpdateScheduler).to(UpdateScheduler).inSingletonScope();
    
    // 注册配置工厂
    container.bind(TYPES.SelectorFactory).to(SelectorFactory).inSingletonScope();
    
    return container;
} 