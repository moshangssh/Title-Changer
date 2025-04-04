import { WidgetType } from '@codemirror/view';
import { Plugin } from 'obsidian';
import { createSpan } from '../../utils/DomHelpers';
import { ErrorManagerService } from '../../services/ErrorManagerService';
import { Logger } from '../../utils/Logger';

/**
 * 插件类型声明
 * 注意：此处仅定义组件需要使用的插件属性
 */
export interface TitleChangerPlugin extends Plugin {
    // 使用可选属性，适配主插件类
    getErrorManager?(): ErrorManagerService;
    getLogger?(): Logger;
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
        // 检查是否有错误管理器和日志记录器
        const errorManager = this.plugin?.getErrorManager?.();
        const logger = this.plugin?.getLogger?.();
        
        // 如果有错误管理器和日志记录器，使用DOM助手函数
        if (errorManager && logger) {
            if (this.plugin) {
                // 编辑器视图样式
                return createSpan(
                    {
                        textContent: this.displayTitle,
                        className: 'title-changer-link cm-hmd-internal-link',
                        dataset: { linktext: this.originalText }
                    },
                    'LinkTitleWidget',
                    errorManager,
                    logger
                ) || this.createSpanManually();
            } else {
                // 装饰管理器样式
                return createSpan(
                    {
                        textContent: `[[${this.displayTitle}]]`,
                        className: 'cm-link cm-internal-link',
                        attributes: { 'data-original-text': this.originalText }
                    },
                    'LinkTitleWidget',
                    errorManager,
                    logger
                ) || this.createSpanManually();
            }
        }
        
        // 如果没有错误管理器或日志记录器，回退到手动创建
        return this.createSpanManually();
    }
    
    /**
     * 手动创建span元素（作为备选方法）
     * @returns 创建的HTML元素
     */
    private createSpanManually(): HTMLElement {
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