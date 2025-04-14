import { EditorView, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { ViewPlugin, PluginValue } from '@codemirror/view';
import { Workspace, WorkspaceLeaf, MarkdownView, TFile } from 'obsidian';

/**
 * 扩展的 Workspace 接口，包含编辑器扩展相关方法
 */
export interface ExtendedWorkspace extends Workspace {
    registerEditorExtension(extension: Extension | Extension[]): Symbol;
    unregisterEditorExtension(extension: Symbol): void;
}

/**
 * 编辑器视图更新事件
 */
export interface EditorViewUpdate extends ViewUpdate {
    docChanged: boolean;
    viewportChanged: boolean;
}

/**
 * 标题变更事件
 */
export interface TitleChangedEvent {
    oldTitle: string;
    newTitle: string;
}

// 扩展 Workspace 事件定义，添加自定义事件
declare module 'obsidian' {
    interface Workspace {
        on(name: 'title-changed', callback: (data: TitleChangedEvent) => any): EventRef;
    }
}

/**
 * 链接标题变更事件
 */
export interface LinkTitleChangeEvent {
    file: TFile;
    oldTitle: string;
    newTitle: string;
}

/**
 * 编辑器装饰配置
 */
export interface EditorDecorationConfig {
    markClass: string;
    inclusiveStart: boolean;
    inclusiveEnd: boolean;
}

/**
 * 视图管理器接口
 */
export interface IViewManager {
    initialize(): void;
    unload(): void;
    updateAllViews(): void;
    onSettingsChanged(): void;
    /**
     * 启用指定视图
     * @param viewId 视图ID标识符
     */
    enableView(viewId: string): void;
    /**
     * 禁用指定视图
     * @param viewId 视图ID标识符
     */
    disableView(viewId: string): void;
    /**
     * 切换指定视图的启用状态
     * @param viewId 视图ID标识符
     */
    toggleView(viewId: string): void;
    /**
     * 获取视图的启用状态
     * @param viewId 视图ID标识符
     * @returns 如果视图启用则返回true，否则返回false
     */
    isViewEnabled(viewId: string): boolean;
}

/**
 * 缓存管理器接口
 */
export interface ICacheManager {
    processFile(file: TFile): string | null;
    invalidateFile(file: TFile): void;
    clearCache(): void;
    /**
     * 获取文件的显示标题
     * @param fileName 文件名
     */
    getDisplayTitle(fileName: string): string | null;
    /**
     * 更新标题缓存
     * @param fileName 文件名
     * @param displayTitle 显示标题
     */
    updateTitleCache(fileName: string, displayTitle: string): void;
    /**
     * 获取所有缓存的标题
     */
    getAllTitles(): Map<string, string>;
    /**
     * 释放资源
     */
    dispose(): void;
}

/**
 * DOM 选择器服务接口
 */
export interface IDOMSelectorService {
    getFileExplorers(): HTMLElement[];
    getFileItems(explorer: HTMLElement): HTMLElement[];
    getTextElements(container: HTMLElement): Element[];
    getTitleElement(fileItem: HTMLElement): Element | null;
    getFilePath(fileItem: HTMLElement): string | null;
    /**
     * 刷新选择器配置
     * 在Obsidian更新或UI变化时调用
     */
    refreshSelectors(): void;
}

/**
 * 编辑器扩展类型
 */
export type EditorExtensionType = ViewPlugin<PluginValue> | Extension;

/**
 * 编辑器扩展标识符
 */
export type EditorExtensionSymbol = Symbol;

/**
 * 编辑器扩展管理器接口
 */
export interface IEditorExtensionManager {
    /**
     * 注册编辑器扩展
     * @param extension 要注册的扩展
     * @returns 扩展标识符
     */
    registerExtension(extension: EditorExtensionType): EditorExtensionSymbol;

    /**
     * 注销编辑器扩展
     * @param symbol 扩展标识符
     */
    unregisterExtension(symbol: EditorExtensionSymbol): void;

    /**
     * 注销所有扩展
     */
    unregisterAll(): void;

    /**
     * 刷新所有扩展
     */
    refreshAll(): void;
}

/**
 * 事件类型定义
 */
export enum EventType {
  // 文件事件
  FILE_CREATED = 'file-created',
  FILE_RENAMED = 'file-renamed',
  FILE_DELETED = 'file-deleted',
  FILE_MODIFIED = 'file-modified',
  
  // 标题事件
  TITLE_CHANGED = 'title-changed',
  LINK_TITLE_CHANGED = 'link-title-changed',
  
  // UI事件
  UI_REFRESH = 'ui-refresh',
  EXPLORER_CHANGED = 'explorer-changed',
  DOM_MUTATION = 'dom-mutation',
  VIEWPORT_CHANGED = 'viewport-changed',
  
  // 其他
  PLUGIN_SETTINGS_CHANGED = 'plugin-settings-changed',
  EDITOR_CHANGE = 'editor-change'
}

/**
 * 通用事件接口
 */
export interface IEvent {
  type: EventType;
  payload?: any;
  source?: string;
  timestamp?: number;
}

/**
 * 文件事件接口
 */
export interface FileEvent extends IEvent {
  type: EventType.FILE_CREATED | EventType.FILE_RENAMED | EventType.FILE_DELETED | EventType.FILE_MODIFIED;
  payload: {
    file: TFile;
    oldPath?: string;
  };
}

/**
 * DOM变化事件接口
 */
export interface DomMutationEvent extends IEvent {
  type: EventType.DOM_MUTATION;
  payload: {
    target: Node;
    mutations: MutationRecord[];
  };
}

/**
 * 视口变化事件接口
 */
export interface ViewportEvent extends IEvent {
  type: EventType.VIEWPORT_CHANGED;
  payload: {
    element: Element;
    isIntersecting: boolean;
  };
}

/**
 * 事件回调函数类型
 */
export type EventCallback<T extends IEvent = IEvent> = (event: T) => void;

/**
 * 事件总线服务接口
 */
export interface IEventBusService {
  /**
   * 发布事件
   * @param event 事件对象
   */
  publish<T extends IEvent>(event: T): void;
  
  /**
   * 订阅事件
   * @param type 事件类型
   * @param callback 回调函数
   * @returns 订阅引用，用于取消订阅
   */
  subscribe<T extends IEvent>(type: EventType, callback: EventCallback<T>): string;
  
  /**
   * 取消订阅
   * @param subscriptionId 订阅ID
   */
  unsubscribe(subscriptionId: string): boolean;
  
  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void;

  /**
   * 桥接Obsidian事件到事件总线
   * 将Obsidian的内置事件转发到事件总线系统
   */
  bridgeObsidianEvents(): void;
} 