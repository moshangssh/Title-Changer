import { MarkdownView, Plugin, TFile, Workspace } from 'obsidian';
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
    isError, 
    convertToTitleChangerError, 
    handleEditorOperation, 
    tryCatchWithValidation,
    tryCatchWrapper,
    logErrorsWithoutThrowing
} from '../utils/error-helpers';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';
import { extractWikiLinks, shouldReplaceTitle } from '../utils/wiki-link-processor';
import { 
    getAttribute, 
    createLink, 
    createSpan, 
    createDiv, 
    toggleClass, 
    querySelector, 
    querySelectorAll 
} from '../utils/dom-helpers';

/**
 * 编辑视图组件，负责处理编辑器中的双链标题显示
 */
@injectable()
export class EditorLinkView {
    private registeredExtensions: EditorExtensionSymbol[] = [];

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.EditorExtensionManager) private extensionManager: IEditorExtensionManager,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}

    /**
     * 初始化编辑视图
     */
    initialize(): void {
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
    }

    /**
     * 卸载编辑视图
     */
    unload(): void {
        // 移除所有注册的扩展
        this.registeredExtensions.forEach(symbol => {
            this.extensionManager.unregisterExtension(symbol);
        });
        this.registeredExtensions = [];
    }

    /**
     * 更新视图
     */
    updateView(): void {
        this.extensionManager.refreshAll();
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
                                // 从缓存获取显示标题
                                const displayTitle = this.getDisplayTitle(link.fileName);
                                
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

                getDisplayTitle(fileName: string): string {
                    return tryCatchWrapper(
                        () => {
                            // 尝试查找对应的文件
                            const file = this.findFile(fileName);
                            if (!file) return fileName;
                            
                            // 使用缓存管理器获取显示标题
                            return this.getCachedDisplayTitle(file) || fileName;
                        },
                        'EditorLinkView',
                        self.errorManager,
                        self.logger,
                        {
                            errorMessage: '获取显示标题失败',
                            category: ErrorCategory.DATA,
                            level: ErrorLevel.WARNING,
                            details: { location: 'getDisplayTitle', fileName }
                        }
                    ) || fileName;
                }

                findFile(fileName: string): TFile | null {
                    return tryCatchWrapper(
                        () => {
                            const files = self.plugin.app.vault.getMarkdownFiles();
                            return files.find(file => file.basename === fileName || file.path === fileName) || null;
                        },
                        'EditorLinkView',
                        self.errorManager,
                        self.logger,
                        {
                            errorMessage: '查找文件失败',
                            category: ErrorCategory.FILE,
                            level: ErrorLevel.WARNING,
                            details: { location: 'findFile', fileName }
                        }
                    );
                }

                getCachedDisplayTitle(file: TFile): string | null {
                    return tryCatchWrapper(
                        () => {
                            return self.cacheManager.processFile(file);
                        },
                        'EditorLinkView',
                        self.errorManager,
                        self.logger,
                        {
                            errorMessage: '获取缓存标题失败',
                            category: ErrorCategory.CACHE,
                            level: ErrorLevel.WARNING,
                            details: { location: 'getCachedDisplayTitle', filePath: file.path }
                        }
                    );
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