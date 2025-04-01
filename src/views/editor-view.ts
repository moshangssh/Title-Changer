import { MarkdownView, TFile, Workspace } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, Annotation } from '@codemirror/state';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import type { TitleChangerPlugin } from '../main';
import type { ExtendedWorkspace, EditorExtensionSymbol, IEditorExtensionManager } from '../types/obsidian-extensions';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { 
    handleEditorOperation, 
    tryCatchWithValidation,
    tryCatchWrapper
} from '../utils/error-helpers';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';
import { extractWikiLinks, shouldReplaceTitle } from '../utils/wiki-link-processor';
import { getAttribute } from '../utils/dom-helpers';
import { AbstractView } from './base/abstract-view';
import { TitleService } from '../services/title.service';
import { FileService } from '../services/file.service';
import { UpdateScheduler } from '../services/update-scheduler.service';

/**
 * 编辑视图组件，负责处理编辑器中的双链标题显示
 */
@injectable()
export class EditorLinkView extends AbstractView {
    private static readonly VIEW_ID = 'editor-view';
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
     * 注册编辑器扩展
     * @private
     */
    private registerEditorExtension(): void {
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