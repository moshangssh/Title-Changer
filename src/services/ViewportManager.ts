import { EditorView, ViewUpdate } from '@codemirror/view';
import type { TitleChangerPlugin } from '../main';
import type { ICacheManager } from '../types/obsidian-extensions';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { ErrorManagerService } from './error-manager.service';
import { ErrorLevel } from './error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { 
  convertToTitleChangerError, 
  tryCatchWrapper, 
  handleEditorOperation, 
  tryCatchWithValidation 
} from '../utils/error-helpers';
import { Logger } from '../utils/logger';

@injectable()
export class ViewportManager {
  private readonly plugin: TitleChangerPlugin;
  private readonly cacheManager: ICacheManager;
  private readonly errorManager: ErrorManagerService;
  private readonly logger: Logger;

  // 使用 WeakMap 存储每个编辑器视图的处理状态
  private readonly processedRanges: WeakMap<EditorView, { from: number; to: number }> = new WeakMap();

  constructor(
    @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
    @inject(TYPES.CacheManager) cacheManager: ICacheManager,
    @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
    @inject(TYPES.Logger) logger: Logger
  ) {
    this.plugin = plugin;
    this.cacheManager = cacheManager;
    this.errorManager = errorManager;
    this.logger = logger;
  }

  /**
   * 处理视口内的文档更新
   * @param update 编辑器视图更新事件
   */
  handleViewportUpdate(update: ViewUpdate): void {
    handleEditorOperation(
      () => {
        const { view, docChanged, viewportChanged } = update;
        
        // 仅在文档变更或视口变更时处理
        if (!docChanged && !viewportChanged) {
          return;
        }

        // 检查是否需要处理当前范围
        const currentRange = this.processedRanges.get(view);
        const { from, to } = view.viewport;
        
        if (currentRange && !docChanged) {
          // 如果当前范围完全包含视口，且文档未变更，则跳过处理
          if (currentRange.from <= from && currentRange.to >= to) {
            return;
          }
        }

        this.processVisibleContent(view);
      },
      this.constructor.name,
      this.errorManager,
      this.logger,
      {
        errorMessage: '处理视口更新失败',
        userVisible: true,
        details: { location: 'handleViewportUpdate' }
      }
    );
  }

  /**
   * 处理当前视口中可见的内容
   * @param view 编辑器视图
   */
  private processVisibleContent(view: EditorView): void {
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

    handleEditorOperation(
      () => {
        let pos = processFrom;
        while (pos <= processTo) {
          const line = doc.lineAt(pos);
          this.processLine(line.text, line.from);
          pos = line.to + 1;
        }

        // 更新已处理范围
        this.processedRanges.set(view, { from: processFrom, to: processTo });
      },
      this.constructor.name,
      this.errorManager,
      this.logger,
      {
        errorMessage: '处理可见内容失败',
        userVisible: false,
        details: { location: 'processVisibleContent', range: { from: processFrom, to: processTo } }
      }
    );
  }

  /**
   * 处理单行内容
   * @param lineText 行文本
   * @param lineStart 行起始位置
   */
  private processLine(lineText: string, lineStart: number): void {
    tryCatchWrapper(
      () => {
        // 使用正则表达式匹配内部链接
        const linkRegex = /\[\[(.*?)\]\]/g;
        let match;

        while ((match = linkRegex.exec(lineText)) !== null) {
          const linkText = match[1];
          const displayTitle = this.cacheManager.getDisplayTitle(linkText);
          
          if (displayTitle && displayTitle !== linkText) {
            // 更新缓存
            this.cacheManager.updateTitleCache(linkText, displayTitle);
          }
        }
      },
      this.constructor.name,
      this.errorManager,
      this.logger,
      {
        errorMessage: '处理行内容失败',
        category: ErrorCategory.REGEX,
        level: ErrorLevel.WARNING,
        userVisible: false,
        details: { location: 'processLine', lineText, lineStart }
      }
    );
  }
} 