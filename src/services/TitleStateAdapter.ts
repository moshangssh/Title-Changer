/**
 * 标题状态适配器 - 连接标题服务与编辑器状态系统
 */
import { App, TFile, MarkdownView, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { EditorState, StateEffect } from '@codemirror/state';
import { TYPES } from '../types/symbols';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { tryCatchWrapper } from '../utils/ErrorHelpers';
import { createTitleStateExtension, TitleStateField, TitleChangeInfo } from '../components/extensions/TitleStateExtension';
import { getEditorView } from '../utils/EditorUtils';
import type { TitleChangerPlugin } from '../main';
import { TitleService } from './TitleService';
import { CacheManager } from '../CacheManager';
import { TitleChangedEvent } from '../types/ObsidianExtensions';

/**
 * 标题状态适配器 - 将标题服务与CodeMirror状态系统整合
 */
@injectable()
export class TitleStateAdapter {
    private titleStateField: TitleStateField;
    
    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {
        this.titleStateField = createTitleStateExtension(errorManager, logger);
        this.logger.info('标题状态适配器已初始化');
    }
    
    /**
     * 初始化状态适配器
     */
    initialize(): void {
        tryCatchWrapper(
            () => {
                // 尝试注册状态字段扩展
                (this.app.workspace as any).registerEditorExtension(this.titleStateField);
                this.logger.info('标题状态字段已注册');
                
                // 初始化现有缓存映射
                this.syncCacheToState();
                
                // 注册文件打开事件，确保状态同步
                this.registerEvents();
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '初始化标题状态适配器失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'initialize' }
            }
        );
    }
    
    /**
     * 注册必要的事件监听器
     */
    private registerEvents(): void {
        tryCatchWrapper(
            () => {
                // 监听文件打开事件
                this.plugin.registerEvent(
                    this.app.workspace.on('file-open', (file) => {
                        if (file instanceof TFile) {
                            // 文件打开时，确保标题状态同步
                            const title = this.titleService.processFileTitle(file);
                            if (title) {
                                this.updateStateForAllEditors(file.basename, title);
                            }
                        }
                    })
                );
                
                // 监听活动编辑器变更事件
                this.plugin.registerEvent(
                    this.app.workspace.on('active-leaf-change', (leaf) => {
                        if (leaf && leaf.view instanceof MarkdownView) {
                            // 编辑器激活时，同步当前文件的标题状态
                            const file = leaf.view.file;
                            if (file) {
                                const title = this.titleService.processFileTitle(file);
                                if (title) {
                                    this.updateStateForAllEditors(file.basename, title);
                                }
                            }
                        }
                    })
                );
                
                // 监听标题变更事件
                this.plugin.registerEvent(
                    this.app.workspace.on('title-changed', (data: TitleChangedEvent) => {
                        // 更新所有编辑器中的标题
                        this.updateStateForAllEditors(data.oldTitle, data.newTitle);
                    })
                );
                
                this.logger.info('标题状态适配器事件已注册');
                return true;
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册标题状态事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                details: { action: 'registerEvents' }
            }
        );
    }
    
    /**
     * 卸载状态适配器
     */
    unload(): void {
        tryCatchWrapper(
            () => {
                // 在这里清理资源，但状态扩展会由Obsidian自动卸载
                this.logger.info('标题状态适配器已卸载');
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '卸载标题状态适配器失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'unload' }
            }
        );
    }
    
    /**
     * 同步缓存到状态系统
     */
    syncCacheToState(): void {
        tryCatchWrapper(
            () => {
                // 获取活动编辑器视图
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeView) return;
                
                const editorView = getEditorView(activeView.leaf);
                if (!editorView) return;
                
                // 获取当前缓存的所有标题
                const titleMapping = this.cacheManager.getAllTitles();
                
                // 创建批量更新事务
                const effects: StateEffect<TitleChangeInfo>[] = [];
                
                // 转换映射为效果数组
                titleMapping.forEach((title, file) => {
                    effects.push(this.titleStateField.createTitleChangeEffect(file, title));
                });
                
                if (effects.length > 0) {
                    // 应用事务
                    editorView.dispatch({ effects });
                    this.logger.info(`已同步 ${effects.length} 个标题到状态系统`);
                }
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '同步缓存到状态失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'syncCacheToState' }
            }
        );
    }
    
    /**
     * 更新特定文件的标题状态
     * @param fileName 文件名
     * @param title 标题
     */
    updateFileTitle(fileName: string, title: string): void {
        tryCatchWrapper(
            () => {
                // 更新状态系统
                this.updateStateForAllEditors(fileName, title);
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新文件标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'updateFileTitle', fileName, title }
            }
        );
    }
    
    /**
     * 更新所有编辑器的状态
     * @param fileName 文件名
     * @param title 标题
     */
    private updateStateForAllEditors(fileName: string, title: string): void {
        tryCatchWrapper(
            () => {
                // 遍历所有叶子节点
                this.app.workspace.iterateAllLeaves(leaf => {
                    if (leaf.view instanceof MarkdownView) {
                        const editorView = getEditorView(leaf);
                        if (editorView) {
                            // 创建状态更新效果
                            const effect = this.titleStateField.createTitleChangeEffect(fileName, title);
                            
                            // 应用效果
                            editorView.dispatch({ effects: [effect] });
                        }
                    }
                });
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新所有编辑器状态失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'updateStateForAllEditors', fileName, title }
            }
        );
    }
    
    /**
     * 获取编辑器状态中的文件标题
     * @param state 编辑器状态
     * @param fileName 文件名
     * @returns 标题或undefined
     */
    getTitleFromState(state: EditorState, fileName: string): string | undefined {
        const result = tryCatchWrapper(
            () => {
                return this.titleStateField.getTitle(state, fileName);
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '从状态获取标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'getTitleFromState', fileName }
            }
        );
        
        // 确保返回类型为 string | undefined
        return typeof result === 'string' ? result : undefined;
    }
    
    /**
     * 创建移除标题的效果
     * @param fileName 要移除的文件名
     * @returns 移除标题的状态效果
     */
    private createTitleRemoveEffect(fileName: string): StateEffect<TitleChangeInfo> {
        // 通过传递空字符串作为标题值来表示移除
        return this.titleStateField.createTitleChangeEffect(fileName, '');
    }
    
    /**
     * 从状态系统中移除标题
     * @param fileName 文件名
     */
    invalidateStateTitle(fileName: string): void {
        tryCatchWrapper(
            () => {
                // 获取活动编辑器视图
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeView) return;
                
                const editorView = getEditorView(activeView.leaf);
                if (!editorView) return;
                
                // 创建移除标题的效果
                const effect = this.createTitleRemoveEffect(fileName);
                
                // 应用效果
                editorView.dispatch({ effects: [effect] });
            },
            'TitleStateAdapter',
            this.errorManager,
            this.logger,
            {
                errorMessage: '无效化状态标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'invalidateStateTitle', fileName }
            }
        );
    }
} 