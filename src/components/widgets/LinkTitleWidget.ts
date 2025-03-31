import { WidgetType } from '@codemirror/view';
import { Plugin } from 'obsidian';

/**
 * 插件类型声明
 */
export interface TitleChangerPlugin extends Plugin {
    // 插件特有的属性和方法
}

/**
 * 链接标题小部件
 * 在编辑器中显示自定义标题文本替代原始链接文本
 */
export class LinkTitleWidget extends WidgetType {
    /**
     * 创建一个新的链接标题小部件
     * @param displayTitle 要显示的标题
     * @param originalText 原始链接文本
     * @param plugin 插件实例（可选）
     */
    constructor(
        readonly displayTitle: string, 
        readonly originalText: string,
        readonly plugin?: TitleChangerPlugin
    ) {
        super();
    }

    /**
     * 创建DOM元素
     * @returns 创建的HTML元素
     */
    toDOM(): HTMLElement {
        const span = document.createElement('span');
        
        // 根据是否提供插件实例决定显示格式
        if (this.plugin) {
            // 编辑器视图样式
            span.textContent = this.displayTitle;
            span.className = 'title-changer-link cm-hmd-internal-link';
            span.dataset.linktext = this.originalText;
        } else {
            // 装饰管理器样式
            span.textContent = `[[${this.displayTitle}]]`;
            span.className = 'cm-link cm-internal-link';
            span.setAttribute('data-original-text', this.originalText);
        }
        
        return span;
    }

    /**
     * 比较两个小部件是否相等
     * @param other 另一个小部件
     * @returns 是否相等
     */
    eq(other: LinkTitleWidget): boolean {
        return other.displayTitle === this.displayTitle && 
               other.originalText === this.originalText;
    }

    /**
     * 事件处理（当在编辑器视图中使用时）
     * @returns 是否忽略事件
     */
    ignoreEvent(): boolean {
        // 返回 false 表示我们需要处理事件
        return false;
    }
} 