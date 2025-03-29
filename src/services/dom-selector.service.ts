import { TFile } from 'obsidian';

/**
 * DOM选择器服务，用于查找和选择文件浏览器中的DOM元素
 */
export class DOMSelectorService {
    /**
     * 获取文件浏览器元素
     */
    getFileExplorers(): HTMLElement[] {
        const fileExplorers: HTMLElement[] = [];
        
        try {
            // 1. 查找标准的文件浏览器容器
            const standardExplorer = document.querySelector('.nav-files-container') as HTMLElement;
            if (standardExplorer) {
                fileExplorers.push(standardExplorer);
            }
            
            // 2. 查找可能的替代文件浏览器
            const alternativeExplorers = document.querySelectorAll(
                '.file-explorer-container, .file-tree-container, .nav-folder-children'
            ) as NodeListOf<HTMLElement>;
            
            alternativeExplorers.forEach(explorer => {
                if (!fileExplorers.includes(explorer)) {
                    fileExplorers.push(explorer);
                }
            });
            
            // 3. 作为最后的尝试，查找任何可能包含文件项的容器
            if (fileExplorers.length === 0) {
                const fallbackExplorers = document.querySelectorAll(
                    '.nav-folder-content, .workspace-leaf[data-type="file-explorer"]'
                ) as NodeListOf<HTMLElement>;
                
                fallbackExplorers.forEach(explorer => {
                    fileExplorers.push(explorer);
                });
            }
        } catch (error) {
            console.error('Title Changer: 获取文件浏览器时出错', error);
        }
        
        return fileExplorers;
    }

    /**
     * 获取文件项元素
     */
    getFileItems(explorer: HTMLElement): HTMLElement[] {
        const selectors = [
            '.nav-file',                     // 标准选择器
            '.tree-item[data-path]',         // 新版Obsidian可能使用的选择器
            '[data-path]:not(.nav-folder)',  // 任何带有data-path的非文件夹元素
            '.tree-item'                     // 备用选择器
        ];
        
        for (const selector of selectors) {
            const items = Array.from(explorer.querySelectorAll(selector)) as HTMLElement[];
            if (items.length > 0) {
                return items;
            }
        }
        
        return [];
    }

    /**
     * 获取文本元素
     */
    getTextElements(container: HTMLElement): Element[] {
        return Array.from(container.querySelectorAll('*')).filter(el => {
            // 只保留有文本内容且不是按钮/输入框等控件的元素
            return el.textContent?.trim() && 
                   !el.hasAttribute('contenteditable') &&
                   !(el instanceof HTMLButtonElement) &&
                   !(el instanceof HTMLInputElement) &&
                   !(el instanceof HTMLTextAreaElement);
        });
    }

    /**
     * 获取标题元素
     */
    getTitleElement(fileItem: HTMLElement): Element | null {
        const titleSelectors = [
            '.nav-file-title-content',       // 标准选择器
            '.tree-item-inner',              // 新版可能使用的选择器
            'div:not([class])',              // 无类的div可能是内容元素
            '[data-path-inner-text]',        // 某些版本可能使用的属性
            'span'                           // 回退到简单元素
        ];
        
        for (const selector of titleSelectors) {
            const el = fileItem.querySelector(selector);
            if (el) {
                return el;
            }
        }
        
        return null;
    }

    /**
     * 获取文件路径
     */
    getFilePath(fileItem: HTMLElement): string | null {
        // 1. 直接从当前元素获取
        let filePath = fileItem.getAttribute('data-path');
        
        // 2. 如果当前元素没有，尝试从父元素获取
        if (!filePath) {
            let parent = fileItem.parentElement;
            let searchDepth = 0;
            const maxSearchDepth = 3; // 限制向上搜索的层数
            
            while (!filePath && parent && searchDepth < maxSearchDepth) {
                filePath = parent.getAttribute('data-path');
                if (filePath) break;
                parent = parent.parentElement;
                searchDepth++;
            }
        }
        
        // 3. 尝试从子元素获取
        if (!filePath) {
            const childWithPath = fileItem.querySelector('[data-path]');
            if (childWithPath) {
                filePath = childWithPath.getAttribute('data-path');
            }
        }
        
        // 4. 尝试从链接元素获取
        if (!filePath) {
            const linkEl = fileItem.querySelector('a.internal-link');
            if (linkEl) {
                const href = linkEl.getAttribute('href');
                if (href) {
                    filePath = decodeURIComponent(href).replace(/^\//, '');
                }
            }
        }
        
        // 5. 尝试使用title或aria-label属性
        if (!filePath) {
            filePath = fileItem.getAttribute('title') || fileItem.getAttribute('aria-label');
        }
        
        return filePath;
    }
} 