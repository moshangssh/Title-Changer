import { MarkdownView, TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { CacheManager } from '../CacheManager';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { 
    tryCatchWrapper, 
    logErrorsWithoutThrowing, 
    measurePerformance
} from '../utils/ErrorHelpers';
import { 
    querySelector, 
    querySelectorAll, 
    getAttribute, 
    setAttribute 
} from '../utils/DomHelpers';
import { AbstractView } from './base/abstract-view';
import { TitleService } from '../services/TitleService';
import { FileService } from '../services/FileService';
import { UpdateScheduler } from '../services/UpdateSchedulerService';

/**
 * 阅读视图组件，负责处理预览模式中的标题显示
 */
@injectable()
export class ReadingView extends AbstractView {
    private static readonly VIEW_ID = 'reading-view';
    private updateTimer: number | null = null;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.FileService) private fileService: FileService,
        @inject(TYPES.UpdateScheduler) private updateScheduler: UpdateScheduler
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化阅读视图
     */
    initialize(): void {
        this.logInfo(`[${ReadingView.VIEW_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                // 注册文件打开事件监听器
                this.plugin.registerEvent(
                    this.plugin.app.workspace.on('file-open', () => {
                        this.updateView();
                    })
                );
                
                // 注册活动叶子变更事件
                this.plugin.registerEvent(
                    this.plugin.app.workspace.on('active-leaf-change', () => {
                        this.updateView();
                    })
                );
                
                // 注册预览模式渲染完成事件
                this.plugin.registerEvent(
                    this.plugin.app.workspace.on('layout-change', () => {
                        // 使用更新调度器延迟处理，确保DOM已完全渲染
                        this.updateScheduler.scheduleUpdate(
                            `${ReadingView.VIEW_ID}-layout`,
                            () => this.updateView(),
                            100
                        );
                    })
                );
                
                // 注册文件修改事件
                this.plugin.registerEvent(
                    this.plugin.app.vault.on('modify', (file) => {
                        this.safeOperation(
                            () => {
                                if (file instanceof TFile && file.extension === 'md') {
                                    // 更新缓存
                                    this.cacheManager.invalidateFile(file);
                                    
                                    // 更新当前打开的文件的视图
                                    const activeFile = this.plugin.app.workspace.getActiveFile();
                                    if (activeFile && activeFile.path === file.path) {
                                        this.updateView();
                                    }
                                }
                            },
                            'ReadingView',
                            '处理文件修改事件失败',
                            ErrorCategory.FILE,
                            ErrorLevel.WARNING,
                            { filePath: file instanceof TFile ? file.path : 'unknown' }
                        );
                    })
                );

                // 初始化时更新一次
                this.updateView();
            },
            'ReadingView',
            '初始化阅读视图失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${ReadingView.VIEW_ID}] 初始化完成`);
    }

    /**
     * 卸载阅读视图
     */
    unload(): void {
        this.logInfo(`[${ReadingView.VIEW_ID}] 正在卸载...`);
        
        // 取消所有调度的更新
        this.updateScheduler.cancelScheduledUpdate(`${ReadingView.VIEW_ID}-layout`);
        this.updateScheduler.cancelScheduledUpdate(ReadingView.VIEW_ID);
        
        this.logInfo(`[${ReadingView.VIEW_ID}] 卸载完成`);
    }

    /**
     * 更新阅读视图中的链接标题
     */
    updateView(): void {
        // 检查视图是否启用，如果未启用则直接返回
        if (!this.enabled) {
            this.logDebug(`[${ReadingView.VIEW_ID}] 视图已禁用，跳过更新`);
            return;
        }
        
        this.logDebug(`[${ReadingView.VIEW_ID}] 正在更新视图...`);
        
        // 使用更新调度器进行防抖处理
        this.updateScheduler.scheduleUpdate(
            ReadingView.VIEW_ID,
            () => {
                measurePerformance(
                    () => {
                        // 获取当前活动叶子
                        const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
                        if (!activeLeaf) return;
                        
                        // 检查是否处于阅读模式
                        if (activeLeaf.getMode() !== 'preview') return;

                        // 获取预览模式下的DOM元素
                        const previewEl = activeLeaf.previewMode.containerEl;
                        if (!previewEl) return;

                        // 处理预览模式中的所有链接
                        this.processPreviewLinks(previewEl);
                    },
                    'ReadingView',
                    100, // 性能阈值(ms)
                    this.errorManager,
                    this.logger
                );
            },
            250 // 250ms防抖延迟
        );
    }

    /**
     * 处理预览模式中的所有链接
     */
    private processPreviewLinks(containerEl: HTMLElement): void {
        this.safeOperation(
            () => {
                // 使用DOM助手函数查找所有内部链接
                const internalLinks = querySelectorAll(
                    containerEl,
                    '.internal-link',
                    'ReadingView',
                    this.errorManager,
                    this.logger
                );
                
                internalLinks.forEach(linkEl => {
                    logErrorsWithoutThrowing(
                        () => {
                            // 使用DOM助手函数获取链接属性
                            const originalFileName = getAttribute(
                                linkEl as HTMLElement,
                                'data-href',
                                'ReadingView',
                                this.errorManager,
                                this.logger
                            );
                            
                            if (!originalFileName) return;
                            
                            // 检查是否已有自定义显示文本
                            const hasLinkText = getAttribute(
                                linkEl as HTMLElement,
                                'data-link-text',
                                'ReadingView',
                                this.errorManager,
                                this.logger
                            ) !== null;
                            
                            if (hasLinkText) return;
                            
                            // 检查是否已处理过
                            const isProcessed = getAttribute(
                                linkEl as HTMLElement,
                                'data-title-processed',
                                'ReadingView',
                                this.errorManager,
                                this.logger
                            ) !== null;
                            
                            if (isProcessed) return;
                            
                            // 使用TitleService获取显示标题
                            const displayTitle = this.titleService.getDisplayTitle(originalFileName);
                            
                            if (displayTitle && displayTitle !== originalFileName) {
                                // 更新链接显示文本
                                (linkEl as HTMLElement).textContent = displayTitle;
                                
                                // 保留原始文本作为提示
                                (linkEl as HTMLElement).title = originalFileName;
                                
                                // 标记为已处理
                                setAttribute(
                                    linkEl as HTMLElement,
                                    'data-title-processed',
                                    'true',
                                    'ReadingView',
                                    this.errorManager,
                                    this.logger
                                );
                            }
                        },
                        'ReadingView',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '处理单个预览链接失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG,
                            details: { 
                                linkHref: getAttribute(
                                    linkEl as HTMLElement,
                                    'data-href',
                                    'ReadingView',
                                    this.errorManager,
                                    this.logger
                                ) || 'unknown' 
                            }
                        }
                    );
                });
                
                return true;
            },
            'ReadingView',
            '处理阅读视图链接时发生错误',
            ErrorCategory.UI,
            ErrorLevel.ERROR
        );
    }

    /**
     * 重写onEnable方法，在启用时立即刷新视图
     */
    protected override onEnable(): void {
        super.onEnable();
        this.logInfo(`[${ReadingView.VIEW_ID}] 视图已启用，立即刷新`);
        
        // 立即刷新视图以显示自定义标题
        this.updateView();
    }

    /**
     * 重写onDisable方法，在禁用时恢复原始文件名
     */
    protected override onDisable(): void {
        super.onDisable();
        this.logInfo(`[${ReadingView.VIEW_ID}] 视图已禁用，恢复原始文件名`);
        
        // 恢复原始文件名的逻辑
        this.restoreOriginalTitles();
    }

    /**
     * 恢复所有修改过的标题为原始文件名
     */
    private restoreOriginalTitles(): void {
        this.safeOperation(
            () => {
                // 获取当前活动叶子
                const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeLeaf) return;
                
                // 检查是否处于阅读模式
                if (activeLeaf.getMode() !== 'preview') return;

                // 获取预览模式下的DOM元素
                const previewEl = activeLeaf.previewMode.containerEl;
                if (!previewEl) return;

                // 查找所有已处理过的链接
                const processedLinks = querySelectorAll(
                    previewEl,
                    '.internal-link[data-title-processed="true"]',
                    'ReadingView',
                    this.errorManager,
                    this.logger
                );
                
                // 恢复原始文件名
                processedLinks.forEach(linkEl => {
                    logErrorsWithoutThrowing(
                        () => {
                            const originalFileName = getAttribute(
                                linkEl as HTMLElement,
                                'title',
                                'ReadingView',
                                this.errorManager,
                                this.logger
                            );
                            
                            if (originalFileName) {
                                // 恢复原始文件名作为显示文本
                                (linkEl as HTMLElement).textContent = originalFileName;
                                
                                // 移除已处理标记
                                (linkEl as HTMLElement).removeAttribute('data-title-processed');
                            }
                        },
                        'ReadingView',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '恢复原始标题失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG
                        }
                    );
                });
                
                return true;
            },
            'ReadingView',
            '恢复原始标题时发生错误',
            ErrorCategory.UI,
            ErrorLevel.ERROR
        );
    }
} 