import { MarkdownView, TFile, Workspace, WorkspaceLeaf } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, Annotation, Transaction } from '@codemirror/state';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { CacheManager } from '../CacheManager';
import type { TitleChangerPlugin } from '../main';
import type { ExtendedWorkspace, EditorExtensionSymbol, IEditorExtensionManager } from '../types/ObsidianExtensions';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { 
    handleEditorOperation, 
    tryCatchWithValidation,
    tryCatchWrapper
} from '../utils/ErrorHelpers';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';
import { extractWikiLinks, shouldReplaceTitle } from '../utils/WikiLinkProcessor';
import { getAttribute } from '../utils/DomHelpers';
import { AbstractView } from './base/abstract-view';
import { TitleService } from '../services/TitleService';
import { FileService } from '../services/file.service';
import { UpdateScheduler } from '../services/UpdateSchedulerService';

/**
 * 编辑视图组件，负责处理编辑器中的双链标题显示
 */
@injectable()
export class EditorLinkView extends AbstractView {
    public static readonly VIEW_ID = 'editor';
    private registeredExtensions: EditorExtensionSymbol[] = [];

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.EditorExtensionManager) private extensionManager: IEditorExtensionManager,
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.FileService) private fileService: FileService,
        @inject(TYPES.UpdateScheduler) private updateScheduler: UpdateScheduler
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化编辑视图
     */
    initialize(): void {
        this.logInfo(`[${EditorLinkView.VIEW_ID}] 正在初始化...`);
        
        // 注册编辑器扩展
        this.registerEditorExtension();
        
        // 注册全局事件委托
        this.plugin.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            handleEditorOperation(
                () => {
                    const target = evt.target as HTMLElement;
                    if (target.classList.contains('title-changer-link')) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        
                        // 使用DOM助手函数安全地获取属性
                        const linkText = getAttribute(
                            target, 
                            'data-linktext', 
                            'EditorLinkView', 
                            this.errorManager, 
                            this.logger
                        );
                        
                        if (linkText) {
                            this.plugin.app.workspace.openLinkText(linkText, '', false);
                        }
                    }
                },
                'EditorLinkView',
                this.errorManager,
                this.logger,
                {
                    errorMessage: '处理链接点击事件失败',
                    userVisible: false,
                    details: { action: 'handleLinkClick' }
                }
            );
        });
        
        this.logInfo(`[${EditorLinkView.VIEW_ID}] 初始化完成`);
    }

    /**
     * 卸载编辑视图
     */
    unload(): void {
        this.logInfo(`[${EditorLinkView.VIEW_ID}] 正在卸载...`);
        
        // 移除所有注册的扩展
        this.registeredExtensions.forEach(symbol => {
            this.extensionManager.unregisterExtension(symbol);
        });
        this.registeredExtensions = [];
        
        this.logInfo(`[${EditorLinkView.VIEW_ID}] 卸载完成`);
    }

    /**
     * 更新视图
     */
    updateView(): void {
        this.logDebug(`[${EditorLinkView.VIEW_ID}] 正在更新视图...`);
        
        // 如果视图被禁用，跳过更新
        if (!this.isEnabled()) {
            this.logDebug(`[${EditorLinkView.VIEW_ID}] 视图已禁用，跳过更新`);
            return;
        }
        
        // 使用更新调度器来调度更新，避免频繁刷新
        this.updateScheduler.scheduleUpdate(
            EditorLinkView.VIEW_ID,
            () => {
                this.safeOperation(
                    () => this.extensionManager.refreshAll(),
                    'EditorLinkView',
                    '刷新编辑器扩展失败',
                    ErrorCategory.VIEW,
                    ErrorLevel.WARNING,
                    { action: 'refreshExtensions' }
                );
            },
            300 // 300ms的防抖延迟
        );
    }

    /**
     * 当视图被启用时调用
     * 重写基类方法以提供自定义行为
     */
    protected override onEnable(): void {
        super.onEnable();
        
        // 重新注册编辑器扩展（如果之前被禁用）
        if (this.registeredExtensions.length === 0) {
            this.registerEditorExtension();
        }
        
        // 立即刷新视图以显示更新后的文件名
        this.updateView();
        
        // 强制处理：直接在DOM中更新链接显示为自定义标题
        setTimeout(() => {
            this.plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
                if (leaf.view.getViewType() === 'markdown') {
                    try {
                        // 获取编辑器DOM容器
                        if (leaf.view instanceof MarkdownView) {
                            // 获取编辑器DOM元素
                            const editorEl = (leaf.view.editor as any).containerEl || leaf.view.contentEl;
                            
                            // 查找所有可能的Wiki链接元素
                            const wikiLinkElements = editorEl.querySelectorAll('.cm-hmd-internal-link');
                            
                            // 对每个链接元素应用自定义标题
                            wikiLinkElements.forEach((el: HTMLElement) => {
                                // 尝试获取原始文件名
                                let linkText = el.textContent;
                                if (!linkText) return;
                                
                                // 移除可能的管道符及后面的内容
                                if (linkText.includes('|')) {
                                    linkText = linkText.split('|')[0].trim();
                                }
                                
                                // 获取自定义标题
                                const displayTitle = this.titleService.getDisplayTitle(linkText);
                                
                                // 只有当有自定义标题且与原始文件名不同时才替换
                                if (displayTitle && displayTitle !== linkText) {
                                    // 保存原始文件名
                                    el.setAttribute('data-linktext', linkText);
                                    
                                    // 替换显示文本为自定义标题
                                    el.textContent = displayTitle;
                                    
                                    // 添加我们的自定义类
                                    el.classList.add('title-changer-link');
                                }
                            });
                            
                            // 强制更新编辑器视图
                            const editorView = this.getEditorFromLeaf(leaf);
                            if (editorView) {
                                editorView.requestMeasure();
                            }
                        }
                    } catch (e) {
                        this.safeOperation(
                            () => {},
                            'EditorLinkView',
                            `应用自定义标题时出错: ${e}`,
                            ErrorCategory.VIEW,
                            ErrorLevel.ERROR,
                            { error: e instanceof Error ? e.message : String(e) }
                        );
                    }
                }
            });
            
            // 通知用户
            this.logInfo(`[${EditorLinkView.VIEW_ID}] 已应用自定义标题显示`);
        }, 50); // 短暂延迟确保DOM已更新
    }

    /**
     * 当视图被禁用时调用
     * 重写基类方法以提供自定义行为
     */
    protected override onDisable(): void {
        super.onDisable();
        
        // 移除所有已注册的编辑器扩展
        this.registeredExtensions.forEach(symbol => {
            this.extensionManager.unregisterExtension(symbol);
        });
        this.registeredExtensions = [];
        
        // 通知编辑器视图已更新（移除了所有装饰）
        this.extensionManager.refreshAll();
        
        // 强制处理：直接在DOM中恢复原始文件名显示
        setTimeout(() => {
            this.plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
                if (leaf.view.getViewType() === 'markdown') {
                    try {
                        // 获取编辑器DOM容器
                        if (leaf.view instanceof MarkdownView) {
                            // 获取编辑器DOM元素
                            const editorEl = (leaf.view.editor as any).containerEl || leaf.view.contentEl;
                            
                            // 查找所有被我们的插件处理过的链接元素
                            const linkElements = editorEl.querySelectorAll('.title-changer-link');
                            
                            // 对每个链接元素恢复原始显示
                            linkElements.forEach((el: HTMLElement) => {
                                const originalFileName = el.getAttribute('data-linktext');
                                if (originalFileName) {
                                    // 替换显示文本为原始文件名
                                    el.textContent = originalFileName;
                                    
                                    // 移除我们的自定义类，但保留Obsidian的原生链接类
                                    el.classList.remove('title-changer-link');
                                }
                            });
                            
                            // 强制更新编辑器视图
                            const editorView = this.getEditorFromLeaf(leaf);
                            if (editorView) {
                                editorView.requestMeasure();
                            }
                            
                            // 通知Obsidian编辑器内容可能已更改
                            try {
                                leaf.view.editor.refresh();
                            } catch (err) {
                                // 忽略刷新错误
                            }
                        }
                    } catch (e) {
                        this.safeOperation(
                            () => {},
                            'EditorLinkView',
                            `恢复原始文件名时出错: ${e}`,
                            ErrorCategory.VIEW,
                            ErrorLevel.ERROR,
                            { error: e instanceof Error ? e.message : String(e) }
                        );
                    }
                }
            });
            
            // 通知用户
            this.logInfo(`[${EditorLinkView.VIEW_ID}] 已恢复原始文件名显示`);
        }, 50); // 短暂延迟确保DOM已更新
    }

    /**
     * 辅助方法：从叶子获取编辑器实例
     */
    private getEditorFromLeaf(leaf: WorkspaceLeaf): EditorView | null {
        if (leaf.view instanceof MarkdownView) {
            return (leaf.view.editor as any).cm;
        }
        return null;
    }

    /**
     * 注册编辑器扩展
     * @private
     */
    private registerEditorExtension(): void {
        // 如果视图被禁用，不注册任何扩展
        if (!this.isEnabled()) {
            this.logInfo(`[${EditorLinkView.VIEW_ID}] 视图已禁用，跳过扩展注册`);
            return;
        }
        
        const self = this;
        // 创建设置变更注解
        const settingsChangedAnnotation = Annotation.define<null>();

        // 创建插件
        const linkTitlePlugin = ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;

                constructor(view: EditorView) {
                    this.decorations = this.buildDecorations(view);
                }

                update(update: ViewUpdate) {
                    handleEditorOperation(
                        () => {
                            if (update.docChanged || 
                                update.viewportChanged || 
                                update.transactions.some(tr => tr.annotation(settingsChangedAnnotation))) {
                                this.decorations = this.buildDecorations(update.view);
                            }
                        },
                        'EditorLinkView',
                        self.errorManager,
                        self.logger,
                        {
                            errorMessage: '更新编辑器装饰失败',
                            userVisible: false,
                            details: { location: 'update' }
                        }
                    );
                }

                buildDecorations(view: EditorView): DecorationSet {
                    return tryCatchWithValidation(
                        () => {
                            const builder = new RangeSetBuilder<Decoration>();
                            const { doc } = view.state;
                            const { from, to } = view.viewport;
                            
                            // 添加缓冲区以提高滚动性能
                            const bufferSize = 1000;
                            const processFrom = Math.max(0, from - bufferSize);
                            const processTo = Math.min(doc.length, to + bufferSize);
                            
                            let pos = processFrom;
                            while (pos <= processTo) {
                                const line = doc.lineAt(pos);
                                this.processLine(line.text, line.from, builder);
                                pos = line.to + 1;
                            }
                            
                            return builder.finish();
                        },
                        (result) => result !== null && result !== undefined,
                        'EditorLinkView',
                        self.errorManager,
                        self.logger,
                        {
                            errorMessage: '构建装饰失败',
                            validationErrorMessage: '装饰构建结果无效',
                            category: ErrorCategory.DECORATION,
                            level: ErrorLevel.ERROR,
                            details: { location: 'buildDecorations' }
                        }
                    ) || Decoration.none;
                }
                
                /**
                 * 处理单行内容中的Wiki链接
                 */
                processLine(text: string, lineStart: number, builder: RangeSetBuilder<Decoration>): void {
                    // 使用新的工具函数提取Wiki链接
                    const wikiLinks = extractWikiLinks(text, lineStart);
                    
                    for (const link of wikiLinks) {
                        // 如果已有显示文本则跳过
                        if (!shouldReplaceTitle(link)) continue;
                        
                        tryCatchWrapper(
                            () => {
                                // 使用TitleService获取显示标题
                                const displayTitle = self.titleService.getDisplayTitle(link.fileName);
                                
                                if (displayTitle && displayTitle !== link.fileName) {
                                    builder.add(
                                        link.start + 2, // 跳过 [[ 
                                        link.start + 2 + link.fileName.length,
                                        Decoration.replace({
                                            widget: new LinkTitleWidget(displayTitle, link.fileName, self.plugin)
                                        })
                                    );
                                }
                            },
                            'EditorLinkView',
                            self.errorManager,
                            self.logger,
                            {
                                errorMessage: '处理链接失败',
                                category: ErrorCategory.DECORATION,
                                level: ErrorLevel.WARNING,
                                userVisible: false,
                                details: { location: 'processLine', fileName: link.fileName }
                            }
                        );
                    }
                }
            },
            {
                decorations: v => v.decorations
            }
        );

        // 注册扩展
        const symbol = this.extensionManager.registerExtension(linkTitlePlugin);
        this.registeredExtensions.push(symbol);
    }
} 