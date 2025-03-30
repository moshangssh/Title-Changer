export const TYPES = {
  // 核心组件
  Plugin: Symbol.for("Plugin"),
  App: Symbol.for("App"),
  Vault: Symbol.for("Vault"),
  Settings: Symbol.for("Settings"),

  // 管理器
  CacheManager: Symbol.for("CacheManager"),
  ViewManager: Symbol.for("ViewManager"),

  // 视图
  ExplorerView: Symbol.for("ExplorerView"),
  EditorLinkView: Symbol.for("EditorLinkView"),

  // 服务
  FileHandlerService: Symbol.for("FileHandlerService"),
  DOMSelectorService: Symbol.for("DOMSelectorService"),
  ExplorerStateService: Symbol.for("ExplorerStateService"),
  ExplorerEventsService: Symbol.for("ExplorerEventsService"),
  Logger: Symbol.for("Logger"),
  EditorExtensionManager: Symbol.for("EditorExtensionManager"),
  LinkTransformerService: Symbol.for('LinkTransformerService'),
}; 