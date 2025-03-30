import { EditorView, ViewUpdate } from '@codemirror/view';
import { TitleChangerPlugin } from '../main';
import { ICacheManager } from '../types/obsidian-extensions';

export class ViewportManager {
  private readonly plugin: TitleChangerPlugin;
  private readonly cacheManager: ICacheManager;

  constructor(plugin: TitleChangerPlugin, cacheManager: ICacheManager) {
    this.plugin = plugin;
    this.cacheManager = cacheManager;
  }

  /**
   * 处理视口内的文档更新
   * @param update 编辑器视图更新事件
   */
  handleViewportUpdate(update: ViewUpdate): void {
    try {
      const { view, docChanged, viewportChanged } = update;
      
      // 仅在文档变更或视口变更时处理
      if (!docChanged && !viewportChanged) {
        return;
      }

      this.processVisibleContent(view);
    } catch (error) {
      console.error('处理视口更新时出错:', error);
    }
  }

  /**
   * 处理当前视口中可见的内容
   * @param view 编辑器视图
   */
  private processVisibleContent(view: EditorView): void {
    const { from, to } = view.viewport;
    const { doc } = view.state;
    
    // 添加缓冲区以提高滚动性能
    const bufferSize = 1000; // 1000个字符的缓冲区
    const processFrom = Math.max(0, from - bufferSize);
    const processTo = Math.min(doc.length, to + bufferSize);

    let pos = processFrom;
    while (pos <= processTo) {
      const line = doc.lineAt(pos);
      this.processLine(line.text, line.from);
      pos = line.to + 1;
    }
  }

  /**
   * 处理单行内容
   * @param lineText 行文本
   * @param lineStart 行起始位置
   */
  private processLine(lineText: string, lineStart: number): void {
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
  }
} 