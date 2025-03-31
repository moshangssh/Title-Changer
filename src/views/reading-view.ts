import { MarkdownView, TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { CacheManager } from '../cache-manager';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { 
    tryCatchWrapper, 
    logErrorsWithoutThrowing, 
    measurePerformance,
    handleEditorOperation 
} from '../utils/error-helpers';
import { 
    querySelector, 
    querySelectorAll, 
    getAttribute, 
    setAttribute 
} from '../utils/dom-helpers';

/**
 * 阅读视图组件，负责处理预览模式中的标题显示
 */
@injectable()
export class ReadingView {
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}

    /**
     * 初始化阅读视图
     */
    initialize(): void {
        tryCatchWrapper(
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
                        setTimeout(() => this.updateView(), 100);
                    })
                );
                
                // 注册文件修改事件
                this.plugin.registerEvent(
                    this.plugin.app.vault.on('modify', (file) => {
                        logErrorsWithoutThrowing(
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
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件修改事件失败',
                                category: ErrorCategory.FILE,
                                level: ErrorLevel.WARNING,
                                details: { filePath: file instanceof TFile ? file.path : 'unknown' }
                            }
                        );
                    })
                );

                // 初始化时更新一次
                this.updateView();
            },
            'ReadingView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '初始化阅读视图失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                userVisible: true,
                details: { action: 'initialize' }
            }
        );
    }

    /**
     * 卸载阅读视图
     */
    unload(): void {
        tryCatchWrapper(
            () => {
                // 可以在这里进行清理工作
                this.logger.debug('阅读视图已卸载');
            },
            'ReadingView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '卸载阅读视图失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                userVisible: false,
                details: { action: 'unload' }
            }
        );
    }

    /**
     * 更新阅读视图中的链接标题
     */
    updateView(): void {
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
    }

    /**
     * 处理预览模式中的所有链接
     */
    private processPreviewLinks(containerEl: HTMLElement): void {
        tryCatchWrapper(
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
                            
                            // 从缓存获取显示标题
                            const displayTitle = this.getDisplayTitle(originalFileName);
                            
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
            this.errorManager,
            this.logger,
            {
                errorMessage: '处理阅读视图链接时发生错误',
                category: ErrorCategory.UI,
                level: ErrorLevel.ERROR,
                userVisible: false
            }
        );
    }

    /**
     * 从缓存获取显示标题
     */
    private getDisplayTitle(fileName: string): string | null {
        return tryCatchWrapper(
            () => {
                // 移除文件扩展名
                const baseName = fileName.replace(/\.[^.]+$/, '');
                
                // 尝试从缓存获取标题
                let displayTitle = this.cacheManager.getDisplayTitle(baseName);
                
                // 如果缓存中没有找到，尝试处理文件
                if (!displayTitle) {
                    // 查找匹配的文件
                    const file = this.findFile(baseName);
                    if (file) {
                        displayTitle = this.cacheManager.processFile(file);
                    }
                }
                
                return displayTitle;
            },
            'ReadingView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取显示标题时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName },
                userVisible: false
            }
        );
    }
    
    /**
     * 查找匹配的文件
     */
    private findFile(fileName: string): TFile | null {
        return tryCatchWrapper(
            () => {
                const files = this.plugin.app.vault.getMarkdownFiles();
                return files.find(file => 
                    file.basename === fileName || 
                    file.path === fileName || 
                    file.path === `${fileName}.md`
                ) || null;
            },
            'ReadingView',
            this.errorManager,
            this.logger,
            {
                errorMessage: '查找文件时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName },
                userVisible: false
            }
        );
    }
} 