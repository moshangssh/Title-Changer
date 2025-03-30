import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import type { ExplorerView } from './explorer-view';
import type { EditorLinkView } from './editor-view';
import type { ReadingView } from './reading-view';
import type { IViewManager } from '../types/obsidian-extensions';

/**
 * 视图管理器，负责管理和协调所有视图
 */
@injectable()
export class ViewManager implements IViewManager {
    private explorerView: ExplorerView;
    private editorLinkView: EditorLinkView;
    private readingView: ReadingView;

    /**
     * 构造函数
     * @param plugin 插件实例
     */
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.ExplorerView) explorerView: ExplorerView,
        @inject(TYPES.EditorLinkView) editorLinkView: EditorLinkView,
        @inject(TYPES.ReadingView) readingView: ReadingView
    ) {
        this.explorerView = explorerView;
        this.editorLinkView = editorLinkView;
        this.readingView = readingView;
    }

    /**
     * 初始化所有视图
     */
    initialize(): void {
        this.explorerView.initialize();
        this.editorLinkView.initialize();
        this.readingView.initialize();
    }

    /**
     * 卸载所有视图组件
     */
    unload(): void {
        this.explorerView.unload();
        this.editorLinkView.unload();
        this.readingView.unload();
    }

    /**
     * 更新所有视图
     */
    updateAllViews(): void {
        this.explorerView.updateView();
        this.editorLinkView.updateView();
        this.readingView.updateView();
    }

    /**
     * 更新设置后刷新所有视图
     */
    onSettingsChanged(): void {
        this.updateAllViews();
    }
} 