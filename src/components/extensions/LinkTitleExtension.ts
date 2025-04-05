/**
 * 链接标题扩展 - 通过CodeMirror装饰API处理内部链接显示
 */
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, Annotation, Extension } from '@codemirror/state';
import { LinkTitleWidget } from '../widgets/LinkTitleWidget';
import { extractWikiLinks, shouldReplaceTitle } from '../../utils/WikiLinkProcessor';
import { handleEditorOperation, tryCatchWithValidation, tryCatchWrapper } from '../../utils/ErrorHelpers';
import { ErrorManagerService, ErrorLevel } from '../../services/ErrorManagerService';
import { Logger } from '../../utils/logger';
import { ErrorCategory } from '../../utils/Errors';
import { TitleService } from '../../services/TitleService';
import type { TitleChangerPlugin } from '../../main';

/**
 * 创建链接标题扩展
 * @param plugin 插件实例
 * @param titleService 标题服务
 * @param errorManager 错误管理器
 * @param logger 日志记录器
 * @returns CodeMirror扩展
 */
export function createLinkTitleExtension(
    plugin: TitleChangerPlugin,
    titleService: TitleService,
    errorManager: ErrorManagerService,
    logger: Logger
): Extension {
    // 创建设置变更注解
    const settingsChangedAnnotation = Annotation.define<null>();
    
    /**
     * 处理内部链接，创建带有自定义标题的部件
     * @param fileName 文件名
     * @param displayTitle 显示标题
     * @returns 链接标题小部件
     */
    function createLinkWidget(fileName: string, displayTitle: string): LinkTitleWidget {
        return new LinkTitleWidget(
            displayTitle,
            fileName,
            plugin
        );
    }
    
    /**
     * 创建链接标题视图插件
     */
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
                    'LinkTitleExtension',
                    errorManager,
                    logger,
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
                    'LinkTitleExtension',
                    errorManager,
                    logger,
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
                // 使用工具函数提取Wiki链接
                const wikiLinks = extractWikiLinks(text, lineStart);
                
                for (const link of wikiLinks) {
                    // 如果已有显示文本则跳过
                    if (!shouldReplaceTitle(link)) continue;
                    
                    tryCatchWrapper(
                        () => {
                            // 使用TitleService获取显示标题
                            const displayTitle = titleService.getDisplayTitle(link.fileName);
                            
                            if (displayTitle && displayTitle !== link.fileName) {
                                builder.add(
                                    link.start + 2, // 跳过 [[ 
                                    link.start + 2 + link.fileName.length,
                                    Decoration.replace({
                                        widget: createLinkWidget(link.fileName, displayTitle)
                                    })
                                );
                            }
                        },
                        'LinkTitleExtension',
                        errorManager,
                        logger,
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
    
    return linkTitlePlugin;
} 