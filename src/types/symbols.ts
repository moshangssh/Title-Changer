export const TYPES = {
  // 核心组件
  Plugin: Symbol.for("Plugin"),
  App: Symbol.for("App"),
  Vault: Symbol.for("Vault"),
  Settings: Symbol.for("Settings"),

  // 管理器
  CacheManager: Symbol.for("CacheManager"),
  ViewManager: Symbol.for("ViewManager"),
  ErrorManager: Symbol.for("ErrorManager"),

  // 视图
  ExplorerView: Symbol.for("ExplorerView"),
  EditorLinkView: Symbol.for("EditorLinkView"),
  ReadingView: Symbol.for("ReadingView"),
  GraphView: Symbol.for("GraphView"),

  // 服务
  FileHandlerService: Symbol.for("FileHandlerService"),
  DOMSelectorService: Symbol.for("DOMSelectorService"),
  UIStateManager: Symbol.for("UIStateManager"),
  ExplorerEventsService: Symbol.for("ExplorerEventsService"),
  Logger: Symbol.for("Logger"),
  EditorExtensionManager: Symbol.for("EditorExtensionManager"),
  LinkTransformerService: Symbol.for('LinkTransformerService'),
  
  // 新增服务
  FileService: Symbol.for("FileService"),
  TitleService: Symbol.for("TitleService"),
  TitleStateService: Symbol.for("TitleStateService"),
  TitleStateAdapter: Symbol.for("TitleStateAdapter"),
  UpdateScheduler: Symbol.for("UpdateScheduler"),
  EventBusService: Symbol.for("EventBusService"),
  
  // 工具
  GraphNodeReplacer: Symbol.for("GraphNodeReplacer"),
  
  // 配置工厂
  SelectorFactory: Symbol.for("SelectorFactory"),
}; 