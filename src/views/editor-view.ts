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
import { isError, convertToTitleChangerError } from '../utils/error-helpers';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';
import { extractWikiLinks, shouldReplaceTitle } from '../utils/wiki-link-processor';

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
            const target = evt.target as HTMLElement;
            if (target.classList.contains('title-changer-link')) {
                evt.preventDefault();
                evt.stopPropagation();
                
                const linkText = target.dataset.linktext;
                if (linkText) {
                    this.plugin.app.workspace.openLinkText(linkText, '', false);
                }
            }
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
                    try {
                        if (update.docChanged || 
                            update.viewportChanged || 
                            update.transactions.some(tr => tr.annotation(settingsChangedAnnotation))) {
                            this.decorations = this.buildDecorations(update.view);
                        }
                    } catch (error) {
                        self.errorManager.handleError(
                            convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.UI),
                            ErrorLevel.ERROR,
                            { location: 'update' }
                        );
                        // 保持现有装饰，避免视图崩溃
                        return;
                    }
                }

                buildDecorations(view: EditorView): DecorationSet {
                    try {
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
                    } catch (error) {
                        self.errorManager.handleError(
                            convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.UI),
                            ErrorLevel.ERROR,
                            { location: 'buildDecorations' }
                        );
                        return Decoration.none;
                    }
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
                        
                        try {
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
                        } catch (error) {
                            self.errorManager.handleError(
                                convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.UI),
                                ErrorLevel.WARNING,
                                { location: 'processLine', details: { fileName: link.fileName } }
                            );
                            continue;
                        }
                    }
                }

                getDisplayTitle(fileName: string): string {
                    try {
                        // 尝试查找对应的文件
                        const file = this.findFile(fileName);
                        if (!file) return fileName;
                        
                        // 使用缓存管理器获取显示标题
                        return this.getCachedDisplayTitle(file) || fileName;
                    } catch (error) {
                        self.errorManager.handleError(
                            convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.UI),
                            ErrorLevel.WARNING,
                            { location: 'getDisplayTitle', details: { fileName } }
                        );
                        return fileName;
                    }
                }

                findFile(fileName: string): TFile | null {
                    try {
                        const files = self.plugin.app.vault.getMarkdownFiles();
                        return files.find(file => file.basename === fileName || file.path === fileName) || null;
                    } catch (error) {
                        self.errorManager.handleError(
                            convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.FILE),
                            ErrorLevel.WARNING,
                            { location: 'findFile', details: { fileName } }
                        );
                        return null;
                    }
                }

                getCachedDisplayTitle(file: TFile): string | null {
                    try {
                        return self.cacheManager.processFile(file);
                    } catch (error) {
                        self.errorManager.handleError(
                            convertToTitleChangerError(error, 'EditorLinkView', ErrorCategory.FILE),
                            ErrorLevel.WARNING,
                            { location: 'getCachedDisplayTitle', details: { filePath: file.path } }
                        );
                        return null;
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