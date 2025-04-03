import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { ICacheManager } from '../types/ObsidianExtensions';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { LinkTitleWidget } from '../components/widgets/LinkTitleWidget';
import { extractSimpleWikiLinks, shouldReplaceTitle } from '../utils/WikiLinkProcessor';
import { tryCatchWrapper, logErrorsWithoutThrowing } from '../utils/ErrorHelpers';
import { ErrorCategory, DecorationError } from '../utils/Errors';
import { Logger } from '../utils/Logger';

@injectable()
export class DecorationManager {
    // 使用 WeakMap 避免内存泄漏
    private decorationCache: WeakMap<EditorView, DecorationSet> = new WeakMap();
    
    constructor(
        @inject(TYPES.CacheManager) private cacheManager: ICacheManager,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    /**
     * 创建或更新编辑器装饰
     * @param view 编辑器视图
     * @param update 视图更新事件
     */
    updateDecorations(view: EditorView, update: ViewUpdate): DecorationSet {
        return tryCatchWrapper(
            () => {
                // 检查是否需要更新装饰
                if (!this.shouldUpdateDecorations(update)) {
                    return this.decorationCache.get(view) || Decoration.none;
                }

                const decorations = this.buildDecorations(view);
                this.decorationCache.set(view, decorations);
                return decorations;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '更新编辑器装饰时出错',
                category: ErrorCategory.DECORATION,
                level: ErrorLevel.ERROR,
                details: { 
                    viewportFrom: view.viewport.from,
                    viewportTo: view.viewport.to,
                    docChanged: update.docChanged,
                    viewportChanged: update.viewportChanged
                },
                userVisible: false
            }
        ) || Decoration.none;
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
        // 使用标准的tryCatchWrapper而不是不支持的measurePerformance
        const startTime = performance.now();
        
        const result = tryCatchWrapper(
            () => {
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
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '构建装饰时出错',
                category: ErrorCategory.DECORATION,
                level: ErrorLevel.ERROR,
                details: { 
                    lineCount: view.state.doc.lines, 
                    viewportSize: view.viewport.to - view.viewport.from 
                },
                userVisible: false
            }
        );
        
        const endTime = performance.now();
        this.logger.debug(`${this.constructor.name}.buildDecorations 执行耗时: ${endTime - startTime}ms`, {
            lineCount: view.state.doc.lines,
            viewportSize: view.viewport.to - view.viewport.from
        });
        
        return result || Decoration.none;
    }

    /**
     * 处理单行内容
     */
    private processLine(text: string, lineStart: number, builder: RangeSetBuilder<Decoration>): void {
        // 使用新的工具函数提取Wiki链接
        const wikiLinks = extractSimpleWikiLinks(text, lineStart);
        
        for (const link of wikiLinks) {
            logErrorsWithoutThrowing(
                () => {
                    const displayTitle = this.cacheManager.getDisplayTitle(link.fileName);
                    if (displayTitle && displayTitle !== link.fileName && shouldReplaceTitle(link)) {
                        const decoration = Decoration.replace({
                            widget: new LinkTitleWidget(displayTitle, link.fileName)
                        });
                        builder.add(link.start, link.end, decoration);
                    }
                    return true;
                },
                this.constructor.name,
                this.errorManager,
                this.logger,
                {
                    errorMessage: '处理链接装饰时出错',
                    category: ErrorCategory.DECORATION,
                    level: ErrorLevel.WARNING,
                    defaultValue: true,
                    details: { 
                        linkText: link.fileName,
                        linkStart: link.start,
                        linkEnd: link.end
                    }
                }
            );
        }
    }

    /**
     * 清除编辑器的装饰缓存
     */
    clearCache(view: EditorView): void {
        tryCatchWrapper(
            () => {
                this.decorationCache.delete(view);
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '清除装饰缓存时出错',
                category: ErrorCategory.CACHE,
                level: ErrorLevel.WARNING,
                details: {}, // 移除不存在的view.id属性
                userVisible: false
            }
        );
    }
} 