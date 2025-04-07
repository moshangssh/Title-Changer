import { Container } from "inversify";
import "reflect-metadata";
import { TYPES } from "./types/symbols";
import { App, Vault } from "obsidian";
import { TitleChangerPlugin } from "./main";
import { TitleChangerSettings, DEFAULT_SETTINGS } from "./settings/TitleChangerSettings";
import { CacheManager } from "./CacheManager";
import { ViewManager } from "./views/ViewManager";
import { FileHandlerService } from "./services/FileHandlerService";
import { ExplorerView } from "./views/ExplorerView";
import { ExplorerEventsService } from "./services/ExplorerEventsService";
import { DOMSelectorService } from "./services/DomSelectorService";
import { UIStateManager } from "./services/UIStateManager";
import { EditorLinkView } from "./views/EditorView";
import { ReadingView } from "./views/ReadingView";
import { GraphView } from "./views/GraphView";
import { MarkdownViewManager } from "./views/MarkdownViewManager";
import { GraphNodeReplacer } from "./utils/GraphNodeReplacer";
import { ErrorManagerService } from "./services/ErrorManagerService";
import { Logger } from "./utils/logger";
import { EditorExtensionManager } from "./services/EditorExtensionManager";
import type { ICacheManager, IViewManager, IDOMSelectorService, IEditorExtensionManager, IEventBusService } from "./types/ObsidianExtensions";
import { LinkTransformerService } from "./services/LinkTransformerService";
import { FileService } from "./services/FileService";
import { TitleService } from "./services/TitleService";
import { UpdateScheduler } from "./services/UpdateSchedulerService";
import { SelectorFactory } from "./config/selectors";
import { TitleStateAdapter } from "./services/TitleStateAdapter";
import { EventBusService } from "./services/EventBusService";
import { SettingsManager } from "./settings/SettingsManager";
import { VirtualScrollManager } from "./managers/VirtualScrollManager";
import { DOMObserverManager } from "./managers/DOMObserverManager";
import { UpdateCoordinator } from "./managers/UpdateCoordinator";
import { FileItemProcessor } from "./managers/FileItemProcessor";

/**
 * 创建并配置IOC容器
 * @param plugin 插件实例
 * @param predefinedBindings 预定义的绑定映射表
 * @returns 已配置的IOC容器
 */
export function createContainer(
    plugin: TitleChangerPlugin, 
    predefinedBindings?: Map<symbol, any>
): Container {
    const container = new Container();

    // 注册核心组件
    container.bind(TYPES.Plugin).toConstantValue(plugin);
    container.bind(TYPES.App).toConstantValue(plugin.app);
    container.bind(TYPES.Vault).toConstantValue(plugin.app.vault);
    
    // 确保设置总是可用，即使是默认值
    // 先检查是否已绑定，避免多次绑定
    if (!container.isBound(TYPES.Settings)) {
        container.bind(TYPES.Settings).toConstantValue(plugin.settings || DEFAULT_SETTINGS);
    }
    
    // 应用预定义绑定（如果有）
    if (predefinedBindings) {
        predefinedBindings.forEach((value, key) => {
            // 如果已经有绑定，先解绑
            if (container.isBound(key)) {
                container.unbind(key);
            }
            container.bind(key).toConstantValue(value);
        });
    } else {
        // 注册Logger服务（只有在没有预定义时）
        container.bind(TYPES.Logger).to(Logger).inSingletonScope();
    }

    // 注册管理器
    container.bind<ICacheManager>(TYPES.CacheManager).to(CacheManager).inSingletonScope();
    container.bind<IViewManager>(TYPES.ViewManager).to(ViewManager).inSingletonScope();
    container.bind(TYPES.ErrorManager).to(ErrorManagerService).inSingletonScope();
    container.bind(TYPES.SettingsManager).to(SettingsManager).inSingletonScope();
    container.bind(TYPES.VirtualScrollManager).to(VirtualScrollManager).inSingletonScope();
    container.bind(TYPES.DOMObserverManager).to(DOMObserverManager).inSingletonScope();
    container.bind(TYPES.UpdateCoordinator).to(UpdateCoordinator).inSingletonScope();
    container.bind(TYPES.FileItemProcessor).to(FileItemProcessor).inSingletonScope();

    // 注册视图
    container.bind(TYPES.ExplorerView).to(ExplorerView).inSingletonScope();
    container.bind(TYPES.EditorLinkView).to(EditorLinkView).inSingletonScope();
    container.bind(TYPES.ReadingView).to(ReadingView).inSingletonScope();
    container.bind(TYPES.GraphView).to(GraphView).inSingletonScope();
    container.bind(TYPES.MarkdownViewManager).to(MarkdownViewManager).inSingletonScope();

    // 注册服务
    container.bind<IDOMSelectorService>(TYPES.DOMSelectorService).to(DOMSelectorService).inSingletonScope();
    container.bind(TYPES.FileHandlerService).to(FileHandlerService).inSingletonScope();
    container.bind(TYPES.UIStateManager).to(UIStateManager).inSingletonScope();
    container.bind(TYPES.ExplorerEventsService).to(ExplorerEventsService).inSingletonScope();
    container.bind<IEditorExtensionManager>(TYPES.EditorExtensionManager).to(EditorExtensionManager).inSingletonScope();
    container.bind(TYPES.LinkTransformerService).to(LinkTransformerService).inSingletonScope();
    container.bind(TYPES.FileService).to(FileService).inSingletonScope();
    container.bind(TYPES.TitleService).to(TitleService).inSingletonScope();
    container.bind(TYPES.TitleStateAdapter).to(TitleStateAdapter).inSingletonScope();
    container.bind(TYPES.UpdateScheduler).to(UpdateScheduler).inSingletonScope();
    container.bind<IEventBusService>(TYPES.EventBusService).to(EventBusService).inSingletonScope();
    
    // 注册工具
    container.bind(TYPES.GraphNodeReplacer).to(GraphNodeReplacer).inSingletonScope();
    
    // 注册配置工厂
    container.bind(TYPES.SelectorFactory).to(SelectorFactory).inSingletonScope();
    
    return container;
} 