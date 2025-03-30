import { MarkdownView, Plugin, TFile, Workspace } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import type { TitleChangerPlugin } from '../main';

/**
 * 编辑视图组件，负责处理编辑器中的双链标题显示
 */
@injectable()
export class EditorLinkView {
    // 存储注册的编辑器扩展，用于卸载
    private registeredExtensions: Symbol[] = [];
    private plugin: TitleChangerPlugin;
    private cacheManager: CacheManager;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.CacheManager) cacheManager: CacheManager
    ) {
        this.plugin = plugin;
        this.cacheManager = cacheManager;
    }

    /**
     * 初始化编辑视图
     */
    initialize(): void {
        // 注册编辑器扩展
        this.registerEditorExtension();
    }

    /**
     * 卸载编辑视图
     */
    unload(): void {
        // 移除所有注册的扩展
        this.registeredExtensions.forEach(extension => {
            (this.plugin.app.workspace as any).unregisterEditorExtension(extension);
        });
        this.registeredExtensions = [];
    }

    /**
     * 更新视图
     */
    updateView(): void {
        // 触发编辑器刷新
        this.plugin.app.workspace.updateOptions();
    }

    /**
     * 注册编辑器扩展
     * @private
     */
    private registerEditorExtension(): void {
        const self = this;
        // 创建插件
        const linkTitlePlugin = ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;

                constructor(view: EditorView) {
                    this.decorations = this.buildDecorations(view);
                }

                update(update: ViewUpdate) {
                    if (update.docChanged || update.viewportChanged) {
                        this.decorations = this.buildDecorations(update.view);
                    }
                }

                buildDecorations(view: EditorView): DecorationSet {
                    const builder = new RangeSetBuilder<Decoration>();
                    const { doc } = view.state;
                    
                    // 定义双链正则表达式
                    const wikiLinkRegex = /\[\[([^\]|#]+)(?:\|([^\]#]+))?(?:#([^\]|]+))?\]\]/g;
                    
                    // 遍历文档中的所有匹配项
                    for (let i = 0; i < doc.lines; i++) {
                        const line = doc.line(i + 1);
                        const lineText = line.text;
                        
                        let match;
                        while ((match = wikiLinkRegex.exec(lineText)) !== null) {
                            const originalFileName = match[1];
                            // 如果已有显示文本 (例如 [[文件名|显示文本]]) 则跳过
                            if (match[2]) continue;
                            
                            // 从缓存获取显示标题
                            const displayTitle = this.getDisplayTitle(originalFileName);
                            
                            if (displayTitle && displayTitle !== originalFileName) {
                                const fullMatch = match[0];
                                const matchStart = line.from + match.index;
                                const linkTextStart = matchStart + 2; // 跳过 [[ 
                                const linkTextEnd = linkTextStart + originalFileName.length;
                                
                                // 创建装饰，替换原文件名为显示标题，但保留点击功能
                                builder.add(
                                    linkTextStart, 
                                    linkTextEnd, 
                                    Decoration.replace({
                                        widget: new LinkTitleWidget(displayTitle, originalFileName, self.plugin)
                                    })
                                );
                            }
                        }
                    }
                    
                    return builder.finish();
                }

                getDisplayTitle(fileName: string): string {
                    // 尝试查找对应的文件
                    const file = this.findFile(fileName);
                    if (!file) return fileName;
                    
                    // 使用缓存管理器获取显示标题
                    return this.getCachedDisplayTitle(file) || fileName;
                }

                findFile(fileName: string): TFile | null {
                    // 查找文件
                    const files = self.plugin.app.vault.getMarkdownFiles();
                    return files.find(file => file.basename === fileName || file.path === fileName) || null;
                }

                getCachedDisplayTitle(file: TFile): string | null {
                    return self.cacheManager.processFile(file);
                }
            },
            {
                decorations: v => v.decorations
            }
        );

        // 注册扩展
        const extension = (this.plugin.app.workspace as any).registerEditorExtension([linkTitlePlugin]);
        this.registeredExtensions.push(extension);
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
        
        // 添加原始文件名作为属性，便于点击处理
        span.dataset.originalLink = this.originalFileName;
        
        // 添加点击事件代理
        span.addEventListener('click', (event) => {
            // 阻止当前事件，避免重复处理
            event.preventDefault();
            event.stopPropagation();
            
            // 模拟原始链接点击，让 Obsidian 处理跳转
            this.dispatchLinkClick(this.originalFileName);
        });
        
        return span;
    }
    
    // 触发 Obsidian 的内部链接点击
    private dispatchLinkClick(linkText: string) {
        // 查找对应的文件
        const file = this.plugin.app.vault.getMarkdownFiles().find(f => 
            f.basename === linkText || f.path === linkText
        );
        
        if (file) {
            // 打开文件
            this.plugin.app.workspace.openLinkText(file.path, '', false);
        }
    }

    ignoreEvent() {
        // 返回 false 表示我们需要处理事件
        return false;
    }
} 