import { TFile, Vault } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import { ExplorerStateService } from './explorer-state.service';
import { DOMSelectorService } from './dom-selector.service';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper } from '../utils/error-helpers';

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
        return tryCatchWrapper(
            () => {
                const files = this.vault.getMarkdownFiles();
                return files.find(file => file.basename === basename) || null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '查找文件时出错',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { basename },
                userVisible: false
            }
        );
    }

    /**
     * 安全地设置文本内容
     */
    private safeSetTextContent(element: Element | null, text: string | null): void {
        tryCatchWrapper(
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
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置文本内容时出错',
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
        stateService: ExplorerStateService
    ): void {
        tryCatchWrapper(
            () => {
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
                category: ErrorCategory.FILE,
                level: ErrorLevel.ERROR,
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
        stateService: ExplorerStateService
    ): void {
        elements.forEach(element => {
            tryCatchWrapper(
                () => {
                    const text = this.safeGetTextContent(element);
                    if (!text) return null;

                    // 查找匹配的文件
                    const matchingFile = this.findFileByBasename(text);
                    if (!matchingFile) return null;

                    // 保存原始文本
                    stateService.saveOriginalText(element, text);

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
                    category: ErrorCategory.UI,
                    level: ErrorLevel.WARNING,
                    details: { elementTag: element.tagName },
                    userVisible: false
                }
            );
        });
    }
} 