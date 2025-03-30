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
            '.nav-folder-children'
        ],
        fallbackExplorers: [
            '.nav-folder-content',
            '.workspace-leaf[data-type="file-explorer"]'
        ],
        fileItems: [
            '.nav-file',                     // 标准选择器
            '.tree-item[data-path]',         // 新版Obsidian可能使用的选择器
            '[data-path]:not(.nav-folder)',  // 任何带有data-path的非文件夹元素
            '.tree-item'                     // 备用选择器
        ],
        titleElements: [
            '.nav-file-title-content',       // 标准选择器
            '.tree-item-inner',              // 新版可能使用的选择器
            'div:not([class])',              // 无类的div可能是内容元素
            '[data-path-inner-text]',        // 某些版本可能使用的属性
            'span'                           // 回退到简单元素
        ]
    };

    /**
     * 获取文件浏览器元素
     */
    getFileExplorers(): HTMLElement[] {
        const fileExplorers: HTMLElement[] = [];
        
        try {
            // 1. 查找标准的文件浏览器容器
            const standardExplorer = document.querySelector(this.standardSelectors.fileExplorer) as HTMLElement;
            if (standardExplorer) {
                fileExplorers.push(standardExplorer);
            }
            
            // 2. 查找可能的替代文件浏览器
            const alternativeExplorers = document.querySelectorAll(
                this.standardSelectors.alternativeExplorers.join(', ')
            ) as NodeListOf<HTMLElement>;
            
            alternativeExplorers.forEach(explorer => {
                if (!fileExplorers.includes(explorer)) {
                    fileExplorers.push(explorer);
                }
            });
            
            // 3. 作为最后的尝试，查找任何可能包含文件项的容器
            if (fileExplorers.length === 0) {
                const fallbackExplorers = document.querySelectorAll(
                    this.standardSelectors.fallbackExplorers.join(', ')
                ) as NodeListOf<HTMLElement>;
                
                fallbackExplorers.forEach(explorer => {
                    fileExplorers.push(explorer);
                });
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
            for (const selector of this.standardSelectors.fileItems) {
                const items = Array.from(explorer.querySelectorAll(selector)) as HTMLElement[];
                if (items.length > 0) {
                    return items;
                }
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
            return Array.from(container.querySelectorAll('*')).filter(el => {
                return el.textContent?.trim() && 
                       !el.hasAttribute('contenteditable') &&
                       !(el instanceof HTMLButtonElement) &&
                       !(el instanceof HTMLInputElement) &&
                       !(el instanceof HTMLTextAreaElement);
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
            for (const selector of this.standardSelectors.titleElements) {
                const el = fileItem.querySelector(selector);
                if (el) {
                    return el;
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
            let filePath = fileItem.getAttribute('data-path');
            
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
                filePath = fileItem.getAttribute('title') || fileItem.getAttribute('aria-label');
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
        let parent = element.parentElement;
        let searchDepth = 0;
        const maxSearchDepth = 3;
        
        while (parent && searchDepth < maxSearchDepth) {
            const path = parent.getAttribute('data-path');
            if (path) return path;
            parent = parent.parentElement;
            searchDepth++;
        }
        
        return null;
    }

    /**
     * 从子元素获取文件路径
     */
    private getFilePathFromChild(element: HTMLElement): string | null {
        const childWithPath = element.querySelector('[data-path]');
        return childWithPath?.getAttribute('data-path') ?? null;
    }

    /**
     * 从链接元素获取文件路径
     */
    private getFilePathFromLink(element: HTMLElement): string | null {
        const linkEl = element.querySelector('a.internal-link');
        if (!linkEl) return null;
        
        const href = linkEl.getAttribute('href');
        return href ? decodeURIComponent(href).replace(/^\//, '') : null;
    }
} 