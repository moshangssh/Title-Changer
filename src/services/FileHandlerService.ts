import { TFile, Vault } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../CacheManager';
import type { UIStateManager } from './UIStateManager';
import { DOMSelectorService } from './DomSelectorService';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper, handleDataOperation, validateData, tryCatchWithValidation } from '../utils/ErrorHelpers';
import { ErrorHandled, AsyncErrorHandled } from '../utils/ErrorDecorators';

// 定义一个通用接口，包含两个服务共同的方法
export interface IStateService {
    saveOriginalText(element: Element, text: string): void;
    getOriginalText(element: Element): string | undefined;
    hasOriginalText(element: Element): boolean;
    restoreOriginalText(element: Element): boolean;
}

/**
 * 文件处理服务，负责处理文件相关操作
 */
@injectable()
export class FileHandlerService {
    constructor(
        @inject(TYPES.Vault) private vault: Vault,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}

    /**
     * 通过基本名称查找文件
     */
    @ErrorHandled({
        errorMessage: '查找文件时出错',
        category: ErrorCategory.FILE,
        level: ErrorLevel.WARNING
    })
    findFileByBasename(basename: string): TFile | null {
        const files = this.vault.getMarkdownFiles();
        return files.find(file => file.basename === basename) || null;
    }

    /**
     * 安全地设置文本内容
     */
    @ErrorHandled({
        errorMessage: '设置文本内容时出错',
        category: ErrorCategory.UI,
        level: ErrorLevel.WARNING
    })
    private safeSetTextContent(element: Element | null, text: string | null): boolean | null {
        if (!element || !text) return null;
        
        // 对文本内容进行 HTML 转义
        const safeText = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        element.textContent = safeText;
        return true;
    }

    /**
     * 安全地获取文本内容
     */
    @ErrorHandled({
        errorMessage: '获取文本内容时出错',
        category: ErrorCategory.UI,
        level: ErrorLevel.WARNING
    })
    private safeGetTextContent(element: Element | null): string | null {
        if (!element) return null;
        return element.textContent?.trim() || null;
    }

    /**
     * 处理文件项
     */
    @ErrorHandled({
        errorMessage: '处理文件项时出错',
        category: ErrorCategory.UI,
        level: ErrorLevel.WARNING
    })
    processFileItem(
        fileItem: HTMLElement,
        cacheManager: CacheManager,
        stateService: IStateService,
        enabled: boolean = true
    ): boolean | null {
        // 验证输入参数
        validateData(fileItem, 
            (item) => item instanceof HTMLElement, 
            '文件项必须是HTMLElement类型', 
            this.constructor.name);
        
        // 获取标题元素
        const titleEl = this.domSelector.getTitleElement(fileItem);
        if (!titleEl) return null;

        // 获取文件路径
        const filePath = this.domSelector.getFilePath(fileItem);
        if (!filePath) return null;

        // 获取文件
        const file = this.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return null;

        // 保存原始显示文本
        const currentText = this.safeGetTextContent(titleEl);
        const originalText = file.basename;
        
        // 总是保存原始文本，确保我们有正确的基准
        stateService.saveOriginalText(titleEl, originalText);

        // 如果禁用插件，则恢复原始文件名
        if (!enabled) {
            // 恢复原始文件名
            if (currentText !== originalText) {
                this.safeSetTextContent(titleEl, originalText);
            }
            return true;
        }

        // 获取显示标题 - 强制重新处理文件确保最新状态
        const displayTitle = cacheManager.processFile(file);

        // 如果有自定义显示标题，更新显示
        if (displayTitle) {
            // 仅当当前显示的文本与目标显示标题不同时才更新
            if (currentText !== displayTitle) {
                this.safeSetTextContent(titleEl, displayTitle);
            }
        } else {
            // 如果没有自定义标题，显示原始文件名
            if (currentText !== originalText) {
                this.safeSetTextContent(titleEl, originalText);
            }
        }
        
        return true;
    }

    /**
     * 处理文本元素
     */
    @ErrorHandled({
        errorMessage: '处理文本元素时出错',
        category: ErrorCategory.UI,
        level: ErrorLevel.WARNING
    })
    processTextElements(
        elements: Element[],
        cacheManager: CacheManager,
        stateService: IStateService,
        enabled: boolean = true
    ): void {
        // 验证输入参数
        validateData(elements, 
            (items) => Array.isArray(items) && items.every(item => item instanceof Element), 
            '元素必须是Element类型数组', 
            this.constructor.name);
            
        elements.forEach(element => {
            this.processTextElement(element, cacheManager, stateService, enabled);
        });
    }
    
    /**
     * 处理单个文本元素
     */
    @ErrorHandled({
        errorMessage: '处理单个文本元素时出错',
        category: ErrorCategory.UI,
        level: ErrorLevel.WARNING
    })
    private processTextElement(
        element: Element,
        cacheManager: CacheManager,
        stateService: IStateService,
        enabled: boolean = true
    ): boolean | null {
        const text = this.safeGetTextContent(element);
        if (!text) return null;

        // 获取文件名（可能需要从文本中提取）
        const fileName = this.extractFileName(text);
        if (!fileName) return null;

        // 保存原始文本作为回退选项
        if (!stateService.hasOriginalText(element)) {
            stateService.saveOriginalText(element, text);
        }

        // 如果禁用插件，恢复原始文本
        if (!enabled) {
            stateService.restoreOriginalText(element);
            return true;
        }

        // 尝试查找对应的文件
        const file = this.findFileByBasename(fileName);
        if (!file) return null;

        // 获取显示标题
        const displayTitle = cacheManager.getDisplayTitle(fileName);
        if (!displayTitle || displayTitle === fileName) return true;

        // 替换文本中的文件名为显示标题
        const newText = text.replace(fileName, displayTitle);
        if (newText !== text) {
            this.safeSetTextContent(element, newText);
        }

        return true;
    }
    
    /**
     * 从文本中提取文件名
     */
    @ErrorHandled({
        errorMessage: '从文本中提取文件名失败',
        category: ErrorCategory.PARSER,
        level: ErrorLevel.WARNING
    })
    private extractFileName(text: string): string | null {
        // 简单的提取逻辑，可以根据实际情况扩展
        const match = text.match(/\[\[(.*?)\]\]/);
        if (match && match[1]) {
            // 从 [[文件名]] 格式中提取
            return match[1];
        }
        
        // 从路径或链接中提取
        const pathMatch = text.match(/([^/\\]+)(?:\.\w+)?$/);
        if (pathMatch && pathMatch[1]) {
            return pathMatch[1];
        }
        
        return null;
    }
} 