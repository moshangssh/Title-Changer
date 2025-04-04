import { TFile, Vault } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { CacheManager } from '../CacheManager';
import { ExplorerStateService } from './explorer-state.service';
import { DOMSelectorService } from './DomSelectorService';
import { Logger } from '../utils/Logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';
import { tryCatchWrapper, handleDataOperation, validateData, tryCatchWithValidation } from '../utils/ErrorHelpers';

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
    findFileByBasename(basename: string): TFile | null {
        return handleDataOperation(
            () => {
                const files = this.vault.getMarkdownFiles();
                return files.find(file => file.basename === basename) || null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '查找文件时出错',
                details: { basename },
                userVisible: false
            }
        );
    }

    /**
     * 安全地设置文本内容
     */
    private safeSetTextContent(element: Element | null, text: string | null): void {
        tryCatchWithValidation(
            () => {
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
            },
            (result) => result === true || result === null, // 验证函数
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置文本内容时出错',
                validationErrorMessage: '文本内容设置验证失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { elementTag: element?.tagName, textLength: text?.length },
                userVisible: false
            }
        );
    }

    /**
     * 安全地获取文本内容
     */
    private safeGetTextContent(element: Element | null): string | null {
        return tryCatchWrapper(
            () => {
                if (!element) return null;
                return element.textContent?.trim() || null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文本内容时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { elementTag: element?.tagName },
                userVisible: false
            }
        );
    }

    /**
     * 处理文件项
     */
    processFileItem(
        fileItem: HTMLElement,
        cacheManager: CacheManager,
        stateService: ExplorerStateService,
        enabled: boolean = true
    ): void {
        handleDataOperation(
            () => {
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
                const originalText = this.safeGetTextContent(titleEl) || file.basename;
                stateService.saveOriginalText(titleEl, originalText);

                // 如果禁用插件，则恢复原始文件名
                if (!enabled) {
                    // 恢复原始文件名
                    const savedText = stateService.getOriginalText(titleEl);
                    if (savedText && this.safeGetTextContent(titleEl) !== savedText) {
                        this.safeSetTextContent(titleEl, savedText);
                    }
                    return true;
                }

                // 获取显示标题
                const displayTitle = cacheManager.processFile(file);

                // 如果有自定义显示标题，更新显示
                if (displayTitle) {
                    this.safeSetTextContent(titleEl, displayTitle);
                } else {
                    // 恢复原始文件名
                    const savedText = stateService.getOriginalText(titleEl);
                    if (this.safeGetTextContent(titleEl) !== savedText) {
                        this.safeSetTextContent(titleEl, savedText !== undefined ? savedText : file.basename);
                    }
                }
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '处理文件项时出错',
                details: { fileItemClass: fileItem.className },
                userVisible: false
            }
        );
    }

    /**
     * 处理文本元素
     */
    processTextElements(
        elements: Element[],
        cacheManager: CacheManager,
        stateService: ExplorerStateService,
        enabled: boolean = true
    ): void {
        // 验证输入参数
        validateData(elements, 
            (items) => Array.isArray(items) && items.every(item => item instanceof Element), 
            '元素必须是Element类型数组', 
            this.constructor.name);
            
        elements.forEach(element => {
            handleDataOperation(
                () => {
                    const text = this.safeGetTextContent(element);
                    if (!text) return null;

                    // 查找匹配的文件
                    const matchingFile = this.findFileByBasename(text);
                    if (!matchingFile) return null;

                    // 保存原始文本
                    stateService.saveOriginalText(element, text);

                    // 如果禁用插件，则恢复原始文件名
                    if (!enabled) {
                        const savedText = stateService.getOriginalText(element);
                        if (savedText && this.safeGetTextContent(element) !== savedText) {
                            this.safeSetTextContent(element, savedText);
                        }
                        return true;
                    }

                    // 获取显示标题
                    const displayTitle = cacheManager.processFile(matchingFile);

                    // 如果有自定义显示标题，更新显示
                    if (displayTitle) {
                        this.safeSetTextContent(element, displayTitle);
                    }
                    
                    return true;
                },
                this.constructor.name,
                this.errorManager,
                this.logger,
                {
                    errorMessage: '处理文本元素时出错',
                    details: { elementTag: element.tagName },
                    userVisible: false
                }
            );
        });
    }
} 