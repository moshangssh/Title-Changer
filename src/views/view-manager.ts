import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import type { ExplorerView } from './explorer-view';
import type { EditorLinkView } from './editor-view';
import type { ReadingView } from './reading-view';
import type { IViewManager } from '../types/obsidian-extensions';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper } from '../utils/error-helpers';

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
        @inject(TYPES.ReadingView) readingView: ReadingView,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        this.explorerView = explorerView;
        this.editorLinkView = editorLinkView;
        this.readingView = readingView;
    }

    /**
     * 初始化所有视图
     */
    initialize(): void {
        // 初始化所有视图组件
        this.explorerView.initialize();
        this.editorLinkView.initialize();
        this.readingView.initialize();
        
        this.logger.info('视图管理器初始化完成');
    }

    /**
     * 卸载所有视图
     */
    unload(): void {
        // 卸载所有视图组件
        this.explorerView.unload();
        this.editorLinkView.unload();
        this.readingView.unload();
    }

    /**
     * 更新所有视图
     */
    updateAllViews(): void {
        tryCatchWrapper(
            () => {
                // 首先更新文件浏览器视图
                this.explorerView.updateView();
                
                // 更新编辑器视图
                this.editorLinkView.updateView();
                
                // 最后更新阅读视图
                this.readingView.updateView();
                
                // 对于可能尚未完全加载的阅读视图内容，延迟再次更新
                setTimeout(() => {
                    this.readingView.updateView();
                }, 300);
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新视图时发生错误',
                category: ErrorCategory.UI,
                level: ErrorLevel.ERROR,
                userVisible: true
            }
        );
    }

    /**
     * 更新设置后刷新所有视图
     */
    onSettingsChanged(): void {
        // 优先更新阅读视图，因为它最可能受到设置变化的影响
        tryCatchWrapper(
            () => {
                this.readingView.updateView();
                setTimeout(() => this.updateAllViews(), 100);
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置更新后刷新视图时发生错误',
                category: ErrorCategory.UI,
                level: ErrorLevel.ERROR,
                userVisible: true
            }
        );
    }
} 