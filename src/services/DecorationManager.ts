import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { ICacheManager } from '../types/obsidian-extensions';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';

@injectable()
export class DecorationManager {
    // 使用 WeakMap 避免内存泄漏
    private decorationCache: WeakMap<EditorView, DecorationSet> = new WeakMap();
    
    constructor(
        @inject(TYPES.CacheManager) private cacheManager: ICacheManager,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
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
            this.errorManager.handleError(
                error instanceof Error ? error : new Error(String(error)), 
                ErrorLevel.ERROR, 
                { location: 'DecorationManager.updateDecorations' }
            );
            return Decoration.none;
        }
    }

    /**
     * 判断是否需要更新装饰
     */
    private shouldUpdateDecorations(update: ViewUpdate): boolean {
        return update.docChanged || update.viewportChanged;
    }

    /**
     * 构建装饰集合
     */
    private buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const { from, to } = view.viewport;
        const { doc } = view.state;

        // 动态计算缓冲区大小
        const lineCount = doc.lines;
        const dynamicBufferSize = Math.min(
            1000, // 最大缓冲区大小
            Math.max(100, Math.floor(lineCount * 0.1)) // 至少 100 字符，最多文档长度的 10%
        );

        const processFrom = Math.max(0, from - dynamicBufferSize);
        const processTo = Math.min(doc.length, to + dynamicBufferSize);

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
            try {
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
            } catch (error) {
                this.errorManager.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    ErrorLevel.WARNING,
                    { location: 'DecorationManager.processLine' }
                );
                continue;
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