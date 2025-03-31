import { TFile } from 'obsidian';
import { injectable } from 'inversify';
import { IDOMSelectorService } from '../types/obsidian-extensions';

/**
 * DOM选择器服务，用于查找和选择文件浏览器中的DOM元素
 */
@injectable()
export class DOMSelectorService implements IDOMSelectorService {
    private readonly logger = console;
    private readonly standardSelectors = {
        fileExplorer: '.nav-files-container',
        alternativeExplorers: [
            '.file-explorer-container',
            '.file-tree-container',
            '.nav-folder-children',
            '.workspace-leaf-content[data-type="file-explorer"] .view-content'
        ],
        fallbackExplorers: [
            '.nav-folder-content',
            '.workspace-leaf[data-type="file-explorer"]',
            '.workspace-leaf-content[data-type="file-explorer"]',
            '.file-explorer'
        ],
        fileItems: [
            '.nav-file',                     // 标准选择器
            '.tree-item[data-path]',         // 新版Obsidian可能使用的选择器
            '[data-path]:not(.nav-folder)',  // 任何带有data-path的非文件夹元素
            '.tree-item:not(.nav-folder)',   // 文件树项目
            '.is-clickable[aria-label]',     // 可点击元素
            '.tree-item',                    // 备用选择器
            '.nav-file-title',               // 文件标题元素
            '.workspace-leaf-content[data-type="file-explorer"] *[data-path]' // 文件浏览器中所有带路径的元素
        ],
        titleElements: [
            '.nav-file-title-content',       // 标准选择器
            '.tree-item-inner',              // 新版可能使用的选择器
            '.tree-item-content',            // 文件内容元素
            '.nav-file-title',               // 文件标题容器
            'div:not([class])',              // 无类的div可能是内容元素
            '[data-path-inner-text]',        // 某些版本可能使用的属性
            '[aria-label]',                  // 带标签的元素
            'span'                           // 回退到简单元素
        ]
    };

    /**
     * 安全地查询DOM元素
     */
    private safeQuerySelector<T extends Element>(
        container: ParentNode,
        selector: string,
        isNodeList = false
    ): T[] {
        try {
            if (isNodeList) {
                return Array.from(container.querySelectorAll(selector)) as T[];
            }
            const element = container.querySelector(selector) as T;
            return element ? [element] : [];
        } catch (error) {
            this.logger.error('Title Changer: DOM查询出错', {
                error,
                selector,
                container
            });
            return [];
        }
    }

    /**
     * 安全地获取元素属性
     */
    private safeGetAttribute(element: Element | null, attribute: string): string | null {
        try {
            if (!element) return null;
            return element.getAttribute(attribute);
        } catch (error) {
            this.logger.error('Title Changer: 获取属性时出错', {
                error,
                element,
                attribute
            });
            return null;
        }
    }

    /**
     * 获取文件浏览器元素
     */
    getFileExplorers(): HTMLElement[] {
        const fileExplorers: HTMLElement[] = [];
        
        try {
            // 1. 查找标准的文件浏览器容器
            const standardExplorers = this.safeQuerySelector<HTMLElement>(
                document,
                this.standardSelectors.fileExplorer
            );
            fileExplorers.push(...standardExplorers);
            
            // 2. 查找可能的替代文件浏览器
            const alternativeExplorers = this.safeQuerySelector<HTMLElement>(
                document,
                this.standardSelectors.alternativeExplorers.join(', '),
                true
            );
            alternativeExplorers.forEach(explorer => {
                if (!fileExplorers.includes(explorer)) {
                    fileExplorers.push(explorer);
                }
            });
            
            // 3. 作为最后的尝试，查找任何可能包含文件项的容器
            if (fileExplorers.length === 0) {
                const fallbackExplorers = this.safeQuerySelector<HTMLElement>(
                    document,
                    this.standardSelectors.fallbackExplorers.join(', '),
                    true
                );
                fileExplorers.push(...fallbackExplorers);
            }
        } catch (error) {
            this.logger.error('Title Changer: 获取文件浏览器时出错', {
                error,
                selectors: this.standardSelectors
            });
        }
        
        return fileExplorers;
    }

    /**
     * 获取文件项元素
     */
    getFileItems(explorer: HTMLElement): HTMLElement[] {
        try {
            // 尝试标准选择器集合
            for (const selector of this.standardSelectors.fileItems) {
                const items = this.safeQuerySelector<HTMLElement>(explorer, selector, true);
                if (items.length > 0) {
                    return items;
                }
            }
            
            // 如果标准方法失败，尝试查找任何可能的文件项
            // 检查具有特定特征的元素：有文本内容、有data属性、可点击等
            const allElements = this.safeQuerySelector<HTMLElement>(explorer, '*', true);
            const potentialFileItems = allElements.filter(el => {
                try {
                    // 检查是否有data-path属性
                    if (el.hasAttribute('data-path')) return true;
                    
                    // 检查是否有内部文本和可点击特性
                    if (el.textContent?.trim() && 
                        (el.classList.contains('is-clickable') || 
                         el.querySelector('.is-clickable'))) {
                        return true;
                    }
                    
                    // 检查是否像文件项的一般特征
                    const hasFileExtension = el.textContent?.includes('.md') || 
                                           el.textContent?.includes('.txt');
                    const isTreeItem = el.classList.contains('tree-item') || 
                                      el.classList.contains('nav-file');
                    
                    return hasFileExtension || isTreeItem;
                } catch (error) {
                    return false;
                }
            });
            
            if (potentialFileItems.length > 0) {
                return potentialFileItems;
            }
        } catch (error) {
            this.logger.error('Title Changer: 获取文件项时出错', {
                error,
                explorerElement: explorer
            });
        }
        
        return [];
    }

    /**
     * 获取文本元素
     */
    getTextElements(container: HTMLElement): Element[] {
        try {
            const elements = this.safeQuerySelector<Element>(container, '*', true);
            return elements.filter(el => {
                try {
                    const text = el.textContent?.trim();
                    return text && 
                           !this.safeGetAttribute(el, 'contenteditable') &&
                           !(el instanceof HTMLButtonElement) &&
                           !(el instanceof HTMLInputElement) &&
                           !(el instanceof HTMLTextAreaElement);
                } catch (error) {
                    this.logger.error('Title Changer: 过滤文本元素时出错', {
                        error,
                        element: el
                    });
                    return false;
                }
            });
        } catch (error) {
            this.logger.error('Title Changer: 获取文本元素时出错', {
                error,
                containerElement: container
            });
            return [];
        }
    }

    /**
     * 获取标题元素
     */
    getTitleElement(fileItem: HTMLElement): Element | null {
        try {
            // 首先通过标准选择器尝试
            for (const selector of this.standardSelectors.titleElements) {
                const elements = this.safeQuerySelector<Element>(fileItem, selector);
                if (elements.length > 0) {
                    return elements[0];
                }
            }
            
            // 如果上面的方法没找到，尝试检查所有子元素
            const allChildElements = fileItem.querySelectorAll('*');
            for (const child of Array.from(allChildElements)) {
                // 检查是否有文本内容的元素
                if (child.textContent && 
                    child.textContent.trim() && 
                    !child.children.length &&
                    !(child instanceof HTMLInputElement) &&
                    !(child instanceof HTMLButtonElement)) {
                    return child;
                }
            }
        } catch (error) {
            this.logger.error('Title Changer: 获取标题元素时出错', {
                error,
                fileItemElement: fileItem
            });
        }
        
        return null;
    }

    /**
     * 获取文件路径
     */
    getFilePath(fileItem: HTMLElement): string | null {
        try {
            // 1. 直接从当前元素获取
            let filePath = this.safeGetAttribute(fileItem, 'data-path');
            
            // 2. 如果当前元素没有，尝试从父元素获取
            if (!filePath) {
                filePath = this.getFilePathFromParent(fileItem);
            }
            
            // 3. 尝试从子元素获取
            if (!filePath) {
                filePath = this.getFilePathFromChild(fileItem);
            }
            
            // 4. 尝试从链接元素获取
            if (!filePath) {
                filePath = this.getFilePathFromLink(fileItem);
            }
            
            // 5. 尝试使用title或aria-label属性
            if (!filePath) {
                filePath = this.safeGetAttribute(fileItem, 'title') || 
                          this.safeGetAttribute(fileItem, 'aria-label');
            }
            
            return filePath;
        } catch (error) {
            this.logger.error('Title Changer: 获取文件路径时出错', {
                error,
                fileItemElement: fileItem
            });
            return null;
        }
    }

    /**
     * 从父元素获取文件路径
     */
    private getFilePathFromParent(element: HTMLElement): string | null {
        try {
            let parent = element.parentElement;
            let searchDepth = 0;
            const maxSearchDepth = 3;
            
            while (parent && searchDepth < maxSearchDepth) {
                const path = this.safeGetAttribute(parent, 'data-path');
                if (path) return path;
                parent = parent.parentElement;
                searchDepth++;
            }
        } catch (error) {
            this.logger.error('Title Changer: 从父元素获取文件路径时出错', {
                error,
                element
            });
        }
        
        return null;
    }

    /**
     * 从子元素获取文件路径
     */
    private getFilePathFromChild(element: HTMLElement): string | null {
        try {
            const childWithPath = this.safeQuerySelector<Element>(element, '[data-path]')[0];
            return this.safeGetAttribute(childWithPath, 'data-path');
        } catch (error) {
            this.logger.error('Title Changer: 从子元素获取文件路径时出错', {
                error,
                element
            });
            return null;
        }
    }

    /**
     * 从链接元素获取文件路径
     */
    private getFilePathFromLink(element: HTMLElement): string | null {
        try {
            const linkEl = this.safeQuerySelector<Element>(element, 'a.internal-link')[0];
            const href = this.safeGetAttribute(linkEl, 'href');
            return href ? decodeURIComponent(href).replace(/^\//, '') : null;
        } catch (error) {
            this.logger.error('Title Changer: 从链接获取文件路径时出错', {
                error,
                element
            });
            return null;
        }
    }
} 