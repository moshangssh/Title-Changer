import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import type { ExplorerView } from './ExplorerView';
import type { EditorLinkView } from './EditorView';
import type { ReadingView } from './ReadingView';
import type { GraphView } from './GraphView';
import type { IViewManager } from '../types/ObsidianExtensions';
import { Logger } from '../utils/logger';
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
    private graphView: GraphView;

    /**
     * 构造函数
     * @param plugin 插件实例
     */
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.ExplorerView) explorerView: ExplorerView,
        @inject(TYPES.EditorLinkView) editorLinkView: EditorLinkView,
        @inject(TYPES.ReadingView) readingView: ReadingView,
        @inject(TYPES.GraphView) graphView: GraphView,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        this.explorerView = explorerView;
        this.editorLinkView = editorLinkView;
        this.readingView = readingView;
        this.graphView = graphView;
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
                this.graphView.initialize();
                
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
                this.graphView.unload();
                
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
                
                // 更新阅读视图
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
                
                // 更新图表视图
                tryCatchWrapper(
                    () => this.graphView.updateView(),
                    'ViewManager',
                    this.errorManager,
                    this.logger,
                    {
                        errorMessage: '更新图表视图失败',
                        category: ErrorCategory.UI,
                        level: ErrorLevel.WARNING,
                        details: { component: 'graphView' }
                    }
                );
                
                // 对于可能尚未完全加载的阅读视图内容，延迟再次更新
                requestAnimationFrame(() => {
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
                });
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
                
                requestAnimationFrame(() => {
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
                });
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

    /**
     * 启用指定视图
     * @param viewId 视图ID标识符
     */
    public enableView(viewId: string): void {
        tryCatchWrapper(
            () => {
                const view = this.getViewById(viewId);
                if (view) {
                    view.enable();
                    this.logger.info(`视图 ${viewId} 已启用`);
                }
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: `启用视图 ${viewId} 失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { action: 'enableView', viewId }
            }
        );
    }

    /**
     * 禁用指定视图
     * @param viewId 视图ID标识符
     */
    public disableView(viewId: string): void {
        tryCatchWrapper(
            () => {
                const view = this.getViewById(viewId);
                if (view) {
                    view.disable();
                    this.logger.info(`视图 ${viewId} 已禁用`);
                }
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: `禁用视图 ${viewId} 失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { action: 'disableView', viewId }
            }
        );
    }

    /**
     * 切换指定视图的启用状态
     * @param viewId 视图ID标识符
     */
    public toggleView(viewId: string): void {
        tryCatchWrapper(
            () => {
                const view = this.getViewById(viewId);
                if (view) {
                    view.toggle();
                    this.logger.info(`视图 ${viewId} 状态已切换，当前: ${view.isEnabled() ? '启用' : '禁用'}`);
                }
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: `切换视图 ${viewId} 状态失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { action: 'toggleView', viewId }
            }
        );
    }

    /**
     * 获取视图的启用状态
     * @param viewId 视图ID标识符
     * @returns 如果视图启用则返回true，否则返回false
     */
    public isViewEnabled(viewId: string): boolean {
        return tryCatchWrapper(
            () => {
                const view = this.getViewById(viewId);
                return view ? view.isEnabled() : false;
            },
            'ViewManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: `获取视图 ${viewId} 状态失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.DEBUG,
                details: { action: 'isViewEnabled', viewId }
            }
        ) ?? false;
    }

    /**
     * 根据ID获取视图实例
     * @param viewId 视图ID
     * @returns 对应的视图实例，若不存在则返回null
     */
    private getViewById(viewId: string): any {
        switch (viewId) {
            case 'explorer':
                return this.explorerView;
            case 'editor':
                return this.editorLinkView;
            case 'reading':
                return this.readingView;
            case 'graph':
                return this.graphView;
            default:
                this.logger.debug(`未找到视图 ${viewId}`);
                return null;
        }
    }
} 