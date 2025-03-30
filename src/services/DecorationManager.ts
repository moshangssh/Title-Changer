import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { ICacheManager } from '../types/obsidian-extensions';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';

@injectable()
export class DecorationManager {
    // 存储每个编辑器的装饰缓存
    private decorationCache: Map<EditorView, DecorationSet> = new Map();
    
    constructor(
        @inject(TYPES.CacheManager) private cacheManager: ICacheManager
    ) {}

    /**
     * 创建或更新编辑器装饰
     * @param view 编辑器视图
     * @param update 视图更新事件
     */
    updateDecorations(view: EditorView, update: ViewUpdate): DecorationSet {
        try {
            // 检查是否需要更新装饰
            if (!this.shouldUpdateDecorations(update)) {
                return this.decorationCache.get(view) || Decoration.none;
            }

            const decorations = this.buildDecorations(view);
            this.decorationCache.set(view, decorations);
            return decorations;
        } catch (error) {
            console.error('更新装饰时发生错误:', error);
            return Decoration.none;
        }
    }

    /**
     * 判断是否需要更新装饰
     */
    private shouldUpdateDecorations(update: ViewUpdate): boolean {
        return update.docChanged || 
               update.viewportChanged ||
               update.selectionSet;
    }

    /**
     * 构建装饰集合
     */
    private buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const { from, to } = view.viewport;
        const { doc } = view.state;

        // 添加缓冲区
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
    }

    /**
     * 处理单行内容
     */
    private processLine(text: string, lineStart: number, builder: RangeSetBuilder<Decoration>): void {
        const linkRegex = /\[\[(.*?)\]\]/g;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            const [fullMatch, linkText] = match;
            const from = lineStart + match.index;
            const to = from + fullMatch.length;

            const displayTitle = this.cacheManager.getDisplayTitle(linkText);
            if (displayTitle && displayTitle !== linkText) {
                const decoration = Decoration.replace({
                    widget: new LinkTitleWidget(displayTitle, linkText)
                });
                builder.add(from, to, decoration);
            }
        }
    }

    /**
     * 清除编辑器的装饰缓存
     */
    clearCache(view: EditorView): void {
        this.decorationCache.delete(view);
    }
}

/**
 * 链接标题装饰器组件
 */
class LinkTitleWidget extends WidgetType {
    constructor(
        private displayTitle: string,
        private originalText: string
    ) {
        super();
    }

    eq(other: LinkTitleWidget): boolean {
        return other.displayTitle === this.displayTitle &&
               other.originalText === this.originalText;
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'title-changer-link cm-hmd-internal-link';
        span.textContent = `[[${this.displayTitle}]]`;
        span.dataset.originalText = this.originalText;
        return span;
    }

    updateDOM(dom: HTMLElement): boolean {
        dom.textContent = `[[${this.displayTitle}]]`;
        dom.dataset.originalText = this.originalText;
        return true;
    }

    get estimatedHeight(): number {
        return 1;
    }

    ignoreEvent(): boolean {
        return false;
    }
} 