import { TFile, WorkspaceLeaf, View } from 'obsidian';
import { injectable, inject } from 'inversify';
import { IDOMSelectorService } from '../types/ObsidianExtensions';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, UIError } from '../utils/Errors';
import { tryCatchWrapper, handleSpecificErrors, convertToTitleChangerError, logErrorsWithoutThrowing } from '../utils/ErrorHelpers';
import { Logger } from '../utils/Logger';
import { TYPES } from '../types/Symbols';
import { SelectorFactory, SelectorConfig } from '../config/selectors';

/**
 * DOM选择器服务，用于查找和选择文件浏览器中的DOM元素
 * 使用选择器工厂提供的配置来适应不同版本的Obsidian
 */
@injectable()
export class DOMSelectorService implements IDOMSelectorService {
    private selectorConfig: SelectorConfig;
    
    constructor(
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.SelectorFactory) private selectorFactory: SelectorFactory,
        @inject(TYPES.App) private app: any
    ) {
        // 初始化选择器配置
        this.selectorConfig = this.selectorFactory.detectAndConfigure();
        this.logger.debug('DOM选择器服务初始化完成', { selectors: this.selectorConfig });
    }

    /**
     * 安全地查询DOM元素
     */
    private safeQuerySelector<T extends Element>(
        container: ParentNode,
        selector: string,
        isNodeList = false
    ): T[] {
        return tryCatchWrapper(
            () => {
                if (isNodeList) {
                    return Array.from(container.querySelectorAll(selector)) as T[];
                }
                const element = container.querySelector(selector) as T;
                return element ? [element] : [];
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: `DOM查询出错: ${selector}`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { selector, containerTagName: (container as Element)?.tagName || 'Document' },
                userVisible: false
            }
        ) || [];
    }

    /**
     * 安全地获取元素属性
     */
    private safeGetAttribute(element: Element | null, attribute: string): string | null {
        return tryCatchWrapper(
            () => {
                if (!element) return null;
                return element.getAttribute(attribute);
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: `获取属性时出错: ${attribute}`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { element: element?.tagName, attribute },
                userVisible: false
            }
        );
    }

    /**
     * 尝试通过Obsidian API获取文件浏览器
     * 如果API不可用，则回退到DOM查询
     */
    private getFileExplorersFromAPI(): HTMLElement[] {
        return tryCatchWrapper(
            () => {
                const fileExplorers: HTMLElement[] = [];
                
                // 尝试使用Obsidian API找到文件浏览器
                this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
                    try {
                        if (leaf.getViewState().type === 'file-explorer') {
                            const containerEl = leaf.view.containerEl;
                            if (containerEl && !fileExplorers.includes(containerEl)) {
                                fileExplorers.push(containerEl);
                            }
                        }
                    } catch (error) {
                        // 忽略单个叶子的错误，继续检查其他叶子
                        this.logger.debug('获取文件浏览器叶子时出错', { error });
                    }
                });
                
                return fileExplorers;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '通过API获取文件浏览器时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.DEBUG,
                details: {},
                userVisible: false
            }
        ) || [];
    }

    /**
     * 获取文件浏览器元素
     */
    getFileExplorers(): HTMLElement[] {
        return tryCatchWrapper(
            () => {
                let fileExplorers: HTMLElement[] = [];
                
                // 首先尝试使用Obsidian API
                fileExplorers = this.getFileExplorersFromAPI();
                
                // 如果API方法失败，回退到DOM选择器
                if (fileExplorers.length === 0) {
                    // 使用主选择器
                    fileExplorers = this.safeQuerySelector<HTMLElement>(
                        document,
                        this.selectorConfig.fileExplorer.primary
                    );
                    
                    // 如果主选择器没有找到，尝试替代选择器
                    if (fileExplorers.length === 0) {
                        fileExplorers = this.safeQuerySelector<HTMLElement>(
                            document,
                            this.selectorConfig.fileExplorer.alternatives.join(', '),
                            true
                        );
                    }
                    
                    // 如果替代选择器也没有找到，尝试回退选择器
                    if (fileExplorers.length === 0) {
                        fileExplorers = this.safeQuerySelector<HTMLElement>(
                            document,
                            this.selectorConfig.fileExplorer.fallbacks.join(', '),
                            true
                        );
                    }
                }
                
                return fileExplorers;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文件浏览器时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { selectors: this.selectorConfig.fileExplorer },
                userVisible: false
            }
        ) || [];
    }

    /**
     * 获取文件项元素
     */
    getFileItems(explorer: HTMLElement): HTMLElement[] {
        return tryCatchWrapper(
            () => {
                // 尝试主选择器
                let items = this.safeQuerySelector<HTMLElement>(
                    explorer, 
                    this.selectorConfig.fileItems.primary, 
                    true
                );
                
                // 如果主选择器没有找到，尝试替代选择器
                if (items.length === 0) {
                    items = this.safeQuerySelector<HTMLElement>(
                        explorer,
                        this.selectorConfig.fileItems.alternatives.join(', '),
                        true
                    );
                }
                
                // 如果替代选择器也没有找到，尝试回退选择器
                if (items.length === 0) {
                    items = this.safeQuerySelector<HTMLElement>(
                        explorer,
                        this.selectorConfig.fileItems.fallbacks.join(', '),
                        true
                    );
                }
                
                return items;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文件项时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { explorerElement: explorer.tagName, selectors: this.selectorConfig.fileItems },
                userVisible: false
            }
        ) || [];
    }

    /**
     * 获取文本元素
     */
    getTextElements(container: HTMLElement): Element[] {
        return tryCatchWrapper(
            () => {
                const elements = this.safeQuerySelector<Element>(container, '*', true);
                return elements.filter(el => 
                    logErrorsWithoutThrowing(
                        () => {
                            const text = el.textContent?.trim();
                            return text && 
                                !this.safeGetAttribute(el, 'contenteditable') &&
                                !(el instanceof HTMLButtonElement) &&
                                !(el instanceof HTMLInputElement) &&
                                !(el instanceof HTMLTextAreaElement);
                        },
                        this.constructor.name,
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '过滤文本元素时出错',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG,
                            defaultValue: false
                        }
                    )
                );
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文本元素时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { containerElement: container.tagName },
                userVisible: false
            }
        ) || [];
    }

    /**
     * 获取标题元素
     */
    getTitleElement(fileItem: HTMLElement): Element | null {
        return tryCatchWrapper(
            () => {
                // 首先通过主选择器尝试
                let titleElement = this.safeQuerySelector<Element>(
                    fileItem, 
                    this.selectorConfig.titleElements.primary
                )[0];
                
                // 如果主选择器没有找到，尝试替代选择器
                if (!titleElement) {
                    for (const selector of this.selectorConfig.titleElements.alternatives) {
                        const elements = this.safeQuerySelector<Element>(fileItem, selector);
                        if (elements.length > 0) {
                            titleElement = elements[0];
                            break;
                        }
                    }
                }
                
                // 如果标准选择器没找到，尝试查找有文本内容的子元素
                if (!titleElement) {
                    const allChildElements = fileItem.querySelectorAll('*');
                    for (const child of Array.from(allChildElements)) {
                        if (child.textContent && 
                            child.textContent.trim() && 
                            !child.children.length &&
                            !(child instanceof HTMLInputElement) &&
                            !(child instanceof HTMLButtonElement)) {
                            titleElement = child;
                            break;
                        }
                    }
                }
                
                return titleElement || null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取标题元素时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { fileItemElement: fileItem.tagName, selectors: this.selectorConfig.titleElements },
                userVisible: false
            }
        );
    }

    /**
     * 获取文件路径
     */
    getFilePath(fileItem: HTMLElement): string | null {
        return tryCatchWrapper(
            () => {
                const pathAttr = this.selectorConfig.attributes.path;
                
                // 1. 直接从当前元素获取
                let filePath = this.safeGetAttribute(fileItem, pathAttr);
                
                // 2. 如果当前元素没有，尝试从父元素获取
                if (!filePath) {
                    filePath = this.getFilePathFromParent(fileItem, pathAttr);
                }
                
                // 3. 尝试从子元素获取
                if (!filePath) {
                    filePath = this.getFilePathFromChild(fileItem, pathAttr);
                }
                
                // 4. 尝试从链接元素获取
                if (!filePath) {
                    filePath = this.getFilePathFromLink(fileItem);
                }
                
                // 5. 尝试使用title或aria-label属性
                if (!filePath) {
                    filePath = this.safeGetAttribute(fileItem, this.selectorConfig.attributes.title) || 
                              this.safeGetAttribute(fileItem, this.selectorConfig.attributes.ariaLabel);
                }
                
                return filePath;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文件路径时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { fileItemElement: fileItem.tagName },
                userVisible: false
            }
        );
    }

    /**
     * 从父元素获取文件路径
     */
    private getFilePathFromParent(element: HTMLElement, pathAttr: string): string | null {
        return tryCatchWrapper(
            () => {
                let parent = element.parentElement;
                let searchDepth = 0;
                const maxSearchDepth = 3;
                
                while (parent && searchDepth < maxSearchDepth) {
                    const path = this.safeGetAttribute(parent, pathAttr);
                    if (path) return path;
                    parent = parent.parentElement;
                    searchDepth++;
                }
                
                return null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '从父元素获取文件路径时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { element: element.tagName },
                userVisible: false
            }
        );
    }

    /**
     * 从子元素获取文件路径
     */
    private getFilePathFromChild(element: HTMLElement, pathAttr: string): string | null {
        return tryCatchWrapper(
            () => {
                const childWithPath = this.safeQuerySelector<Element>(element, `[${pathAttr}]`)[0];
                return this.safeGetAttribute(childWithPath, pathAttr);
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '从子元素获取文件路径时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { element: element.tagName },
                userVisible: false
            }
        );
    }

    /**
     * 从链接元素获取文件路径
     */
    private getFilePathFromLink(element: HTMLElement): string | null {
        return tryCatchWrapper(
            () => {
                const linkEl = this.safeQuerySelector<Element>(element, 'a.internal-link')[0];
                const href = this.safeGetAttribute(linkEl, this.selectorConfig.attributes.href);
                return href ? decodeURIComponent(href).replace(/^\//, '') : null;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '从链接获取文件路径时出错',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { element: element.tagName },
                userVisible: false
            }
        );
    }

    /**
     * 刷新选择器配置
     * 在Obsidian更新或UI变化时调用
     */
    refreshSelectors(): void {
        this.logger.debug('刷新选择器配置');
        this.selectorConfig = this.selectorFactory.refreshSelectors();
    }
} 