import { MarkdownView, Plugin, TFile, Workspace } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, Annotation } from '@codemirror/state';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import type { TitleChangerPlugin } from '../main';
import type { ExtendedWorkspace, EditorExtensionSymbol, IEditorExtensionManager } from '../types/obsidian-extensions';

/**
 * 编辑视图组件，负责处理编辑器中的双链标题显示
 */
@injectable()
export class EditorLinkView {
    private registeredExtensions: EditorExtensionSymbol[] = [];

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.EditorExtensionManager) private extensionManager: IEditorExtensionManager
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
                        console.error('更新装饰时发生错误:', error);
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
                        
                        // 定义双链正则表达式
                        const wikiLinkRegex = /\[\[([^\]|#]+)(?:\|([^\]#]+))?(?:#([^\]|]+))?\]\]/g;
                        
                        let pos = processFrom;
                        while (pos <= processTo) {
                            const line = doc.lineAt(pos);
                            const lineText = line.text;
                            
                            let match;
                            while ((match = wikiLinkRegex.exec(lineText)) !== null) {
                                const originalFileName = match[1];
                                // 如果已有显示文本则跳过
                                if (match[2]) continue;
                                
                                try {
                                    // 从缓存获取显示标题
                                    const displayTitle = this.getDisplayTitle(originalFileName);
                                    
                                    if (displayTitle && displayTitle !== originalFileName) {
                                        const matchStart = line.from + match.index;
                                        const linkTextStart = matchStart + 2; // 跳过 [[ 
                                        const linkTextEnd = linkTextStart + originalFileName.length;
                                        
                                        builder.add(
                                            linkTextStart, 
                                            linkTextEnd, 
                                            Decoration.replace({
                                                widget: new LinkTitleWidget(displayTitle, originalFileName, self.plugin)
                                            })
                                        );
                                    }
                                } catch (error) {
                                    console.error(`处理链接 "${originalFileName}" 时发生错误:`, error);
                                    continue;
                                }
                            }
                            pos = line.to + 1;
                        }
                        
                        return builder.finish();
                    } catch (error) {
                        console.error('构建装饰时发生错误:', error);
                        return Decoration.none;
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
                        console.error(`获取显示标题时发生错误: ${error.message}`, error);
                        return fileName;
                    }
                }

                findFile(fileName: string): TFile | null {
                    try {
                        const files = self.plugin.app.vault.getMarkdownFiles();
                        return files.find(file => file.basename === fileName || file.path === fileName) || null;
                    } catch (error) {
                        console.error(`查找文件时发生错误: ${error.message}`, error);
                        return null;
                    }
                }

                getCachedDisplayTitle(file: TFile): string | null {
                    try {
                        return self.cacheManager.processFile(file);
                    } catch (error) {
                        console.error(`获取缓存标题时发生错误: ${error.message}`, error);
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

/**
 * 链接标题小部件
 */
class LinkTitleWidget extends WidgetType {
    constructor(
        readonly title: string, 
        readonly originalFileName: string,
        readonly plugin: TitleChangerPlugin
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.textContent = this.title;
        span.className = 'title-changer-link cm-hmd-internal-link';
        
        // 使用 data 属性存储链接信息
        span.dataset.linktext = this.originalFileName;
        
        return span;
    }

    ignoreEvent() {
        // 返回 false 表示我们需要处理事件
        return false;
    }
} 