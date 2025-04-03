import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import type { TitleChangerPlugin } from '../main';
import type { ExplorerView } from './ExplorerView';
import type { EditorLinkView } from './EditorView';
import type { ReadingView } from './ReadingView';
import type { IViewManager } from '../types/ObsidianExtensions';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { 
    tryCatchWrapper, 
    handleEditorOperation,
    logErrorsWithoutThrowing,
    measurePerformance
} from '../utils/ErrorHelpers';

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
        tryCatchWrapper(
            () => {
                // 初始化所有视图组件
                this.explorerView.initialize();
                this.editorLinkView.initialize();
                this.readingView.initialize();
                
                this.logger.info('视图管理器初始化完成');
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: '初始化视图管理器失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                userVisible: true,
                details: { action: 'initialize' }
            }
        );
    }

    /**
     * 卸载所有视图
     */
    unload(): void {
        logErrorsWithoutThrowing(
            () => {
                // 卸载所有视图组件
                this.explorerView.unload();
                this.editorLinkView.unload();
                this.readingView.unload();
                
                this.logger.info('视图管理器已卸载');
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: '卸载视图管理器时发生错误',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                details: { action: 'unload' }
            }
        );
    }

    /**
     * 更新所有视图
     */
    updateAllViews(): void {
        measurePerformance(
            () => {
                // 首先更新文件浏览器视图
                tryCatchWrapper(
                    () => this.explorerView.updateView(),
                    'ViewManager',
                    this.errorManager,
                    this.logger,
                    {
                        errorMessage: '更新文件浏览器视图失败',
                        category: ErrorCategory.UI,
                        level: ErrorLevel.WARNING,
                        details: { component: 'explorerView' }
                    }
                );
                
                // 更新编辑器视图
                tryCatchWrapper(
                    () => this.editorLinkView.updateView(),
                    'ViewManager',
                    this.errorManager,
                    this.logger,
                    {
                        errorMessage: '更新编辑器视图失败',
                        category: ErrorCategory.UI,
                        level: ErrorLevel.WARNING,
                        details: { component: 'editorLinkView' }
                    }
                );
                
                // 最后更新阅读视图
                tryCatchWrapper(
                    () => this.readingView.updateView(),
                    'ViewManager',
                    this.errorManager,
                    this.logger,
                    {
                        errorMessage: '更新阅读视图失败',
                        category: ErrorCategory.UI,
                        level: ErrorLevel.WARNING,
                        details: { component: 'readingView' }
                    }
                );
                
                // 对于可能尚未完全加载的阅读视图内容，延迟再次更新
                setTimeout(() => {
                    logErrorsWithoutThrowing(
                        () => this.readingView.updateView(),
                        'ViewManager',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '延迟更新阅读视图失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG,
                            details: { component: 'readingView', action: 'delayed' }
                        }
                    );
                }, 300);
            },
            'ViewManager',
            200, // 性能阈值(ms)
            this.errorManager,
            this.logger
        );
    }

    /**
     * 更新设置后刷新所有视图
     */
    onSettingsChanged(): void {
        // 优先更新阅读视图，因为它最可能受到设置变化的影响
        handleEditorOperation(
            () => {
                tryCatchWrapper(
                    () => this.readingView.updateView(),
                    'ViewManager',
                    this.errorManager,
                    this.logger,
                    {
                        errorMessage: '设置更新后刷新阅读视图失败',
                        category: ErrorCategory.UI,
                        level: ErrorLevel.WARNING,
                        details: { action: 'onSettingsChanged', component: 'readingView' }
                    }
                );
                
                setTimeout(() => {
                    logErrorsWithoutThrowing(
                        () => this.updateAllViews(),
                        'ViewManager',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '设置更新后延迟刷新所有视图失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            details: { action: 'onSettingsChanged:delayed' }
                        }
                    );
                }, 100);
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置更新后刷新视图失败',
                userVisible: true,
                details: { category: ErrorCategory.UI }
            }
        );
    }
} 