import { EditorView, ViewUpdate } from '@codemirror/view';
import { Workspace, WorkspaceLeaf, MarkdownView, TFile } from 'obsidian';
import { ViewPlugin } from '@codemirror/view';

/**
 * 扩展的 Workspace 接口，包含编辑器扩展相关方法
 */
export interface ExtendedWorkspace extends Workspace {
    registerEditorExtension(extension: any): Symbol;
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
}

/**
 * 编辑器扩展类型
 */
export type EditorExtensionType = ViewPlugin<any> | any;

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