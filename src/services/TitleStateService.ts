/**
 * 标题状态服务 - 整合CodeMirror状态系统和现有缓存管理
 */
import { App, TFile, MarkdownView, Events } from 'obsidian';
import { injectable, inject } from 'inversify';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { TYPES } from '../types/Symbols';
import { TitleService } from './TitleService';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { tryCatchWrapper } from '../utils/ErrorHelpers';
import { createTitleStateExtension, TitleStateField } from '../components/extensions/TitleStateExtension';
import { getEditorView } from '../utils/EditorUtils';
import type { TitleChangerPlugin } from '../main';

/**
 * 标题状态服务 - 将传统缓存管理与CodeMirror状态系统整合
 */
@injectable()
export class TitleStateService {
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
        this.logger.info('标题状态服务已初始化');
    }
    
    /**
     * 初始化状态服务
     */
    initialize(): void {
        // 注册编辑器扩展
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
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '初始化标题状态服务失败',
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
                            const title = this.cacheManager.processFile(file);
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
                                const title = this.cacheManager.processFile(file);
                                if (title) {
                                    this.updateStateForAllEditors(file.basename, title);
                                }
                            }
                        }
                    })
                );
                
                this.logger.info('标题状态服务事件已注册');
                return true;
            },
            'TitleStateService',
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
     * 卸载状态服务
     */
    unload(): void {
        tryCatchWrapper(
            () => {
                // 在这里清理资源，但状态扩展会由Obsidian自动卸载
                this.logger.info('标题状态服务已卸载');
            },
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '卸载标题状态服务失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'unload' }
            }
        );
    }
    
    /**
     * 将当前缓存同步到状态系统
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
                const effects = Array.from(titleMapping.entries()).map(([file, title]) => 
                    this.titleStateField.createTitleChangeEffect(file, title)
                );
                
                if (effects.length > 0) {
                    // 应用事务
                    editorView.dispatch({ effects });
                    this.logger.info(`已同步 ${effects.length} 个标题到状态系统`);
                }
            },
            'TitleStateService',
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
     * 更新特定文件的标题
     * @param file 文件对象
     * @param title 标题
     */
    updateFileTitle(file: TFile, title: string): void {
        tryCatchWrapper(
            () => {
                // 更新缓存
                this.cacheManager.updateTitleCache(file.basename, title);
                
                // 更新状态系统
                this.updateStateForAllEditors(file.basename, title);
            },
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新文件标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'updateFileTitle', file: file.path, title }
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
            'TitleStateService',
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
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '从状态获取标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'getTitleFromState', fileName }
            }
        );
        // 确保返回类型正确
        return result === null ? undefined : result;
    }
    
    /**
     * 使状态中的标题无效
     * @param fileName 文件名
     */
    invalidateStateTitle(fileName: string): void {
        tryCatchWrapper(
            () => {
                // 遍历所有叶子节点
                this.app.workspace.iterateAllLeaves(leaf => {
                    if (leaf.view instanceof MarkdownView) {
                        const editorView = getEditorView(leaf);
                        if (editorView) {
                            // 创建空标题效果（移除标题）
                            const effect = this.titleStateField.createTitleChangeEffect(fileName, '');
                            
                            // 应用效果
                            editorView.dispatch({ effects: [effect] });
                        }
                    }
                });
            },
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '使状态标题无效失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'invalidateStateTitle', fileName }
            }
        );
    }
    
    /**
     * 获取文件标题，优先从状态获取，回退到缓存
     * @param fileName 文件名
     * @param fallbackToOriginal 如果没有找到标题是否返回原始文件名
     */
    getTitle(fileName: string, fallbackToOriginal = true): string | undefined {
        const result = tryCatchWrapper(
            () => {
                // 先获取活动编辑器视图
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    const editorView = getEditorView(activeView.leaf);
                    if (editorView) {
                        // 尝试从编辑器状态获取标题
                        const state = editorView.state;
                        const title = this.getTitleFromState(state, fileName);
                        if (title) {
                            return title;
                        }
                    }
                }
                
                // 回退到缓存获取
                const cachedTitle = this.titleService.getDisplayTitle(fileName, false);
                if (cachedTitle) {
                    return cachedTitle;
                }
                
                // 如果设置了回退，则返回原始文件名
                return fallbackToOriginal ? fileName : undefined;
            },
            'TitleStateService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'getTitle', fileName, fallbackToOriginal }
            }
        );
        
        // 确保返回类型正确
        return result === null ? (fallbackToOriginal ? fileName : undefined) : result;
    }
} 