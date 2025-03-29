import { TFile, WorkspaceLeaf, Events } from 'obsidian';
import { TitleChangerPlugin } from '../main';
import { CacheManager } from '../cache-manager';

/**
 * 文件浏览器视图，处理文件浏览器中的文件名显示
 */
export class ExplorerView {
    private plugin: TitleChangerPlugin;
    private cacheManager: CacheManager;
    
    // 保存原始文件名显示方法
    private originalDisplayText: WeakMap<Element, string> = new WeakMap();
    
    // 处理文件浏览器更新的间隔时间（毫秒）
    private static readonly UPDATE_INTERVAL = 500;
    
    // 更新计时器
    private updateTimer: number | null = null;
    
    /**
     * 构造函数
     * @param plugin 插件实例
     */
    constructor(plugin: TitleChangerPlugin) {
        this.plugin = plugin;
        this.cacheManager = new CacheManager(plugin.settings);
        console.log('Title Changer: 初始化完成');
    }
    
    /**
     * 初始化视图
     */
    initialize(): void {
        // 注册事件监听器
        this.registerEvents();
        
        // 初始更新文件浏览器，使用延迟确保文件浏览器已加载
        this.scheduleInitialUpdate();
    }
    
    /**
     * 注册事件监听器
     */
    private registerEvents(): void {
        // 监听文件浏览器变化
        // 使用 DOM 事件代替缺少的特定事件
        this.plugin.registerDomEvent(document, 'click', () => {
            const fileExplorer = document.querySelector('.nav-files-container');
            if (fileExplorer) {
                this.scheduleUpdate();
            }
        });
        
        // 监听DOM变化，当文件浏览器内容发生变化时更新视图
        try {
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                
                // 检查变化是否与文件浏览器相关
                for (const mutation of mutations) {
                    // 检查变化元素是否在文件浏览器内或是文件浏览器本身
                    let targetEl = mutation.target as Element;
                    while (targetEl && !shouldUpdate) {
                        if (targetEl.classList && 
                            (targetEl.classList.contains('nav-files-container') || 
                             targetEl.classList.contains('nav-file') || 
                             targetEl.classList.contains('nav-folder'))) {
                            shouldUpdate = true;
                            break;
                        }
                        
                        const parent = targetEl.parentElement;
                        if (!parent) break;
                        targetEl = parent;
                    }
                    
                    if (shouldUpdate) break;
                }
                
                if (shouldUpdate) {
                    // 移除频繁的日志
                    this.scheduleUpdate();
                }
            });
            
            // 开始观察文档变化
            observer.observe(document.body, { 
                childList: true, 
                subtree: true,
                characterData: true,
                attributeFilter: ['class', 'data-path'] 
            });
            
            // 注册清理函数
            this.plugin.register(() => observer.disconnect());
        } catch (error) {
            console.error('Title Changer: 注册DOM变化观察器失败', error);
        }
        
        // 监听文件重命名
        this.plugin.registerEvent(
            this.plugin.app.vault.on('rename', (file) => {
                if (file instanceof TFile) {
                    this.cacheManager.invalidateFile(file);
                    this.scheduleUpdate();
                }
            })
        );
        
        // 监听文件创建
        this.plugin.registerEvent(
            this.plugin.app.vault.on('create', (file) => {
                if (file instanceof TFile) {
                    this.scheduleUpdate();
                }
            })
        );
        
        // 监听文件删除
        this.plugin.registerEvent(
            this.plugin.app.vault.on('delete', (file) => {
                if (file instanceof TFile) {
                    this.cacheManager.invalidateFile(file);
                    this.scheduleUpdate();
                }
            })
        );
        
        // 监听布局变化
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('layout-change', () => {
                this.scheduleUpdate();
            })
        );
        
        // 添加活动叶子变化事件监听
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && leaf.view && leaf.view.getViewType() === 'file-explorer') {
                    this.scheduleUpdate();
                }
            })
        );
    }
    
    /**
     * 安排初始更新（带有重试机制）
     * @param retryCount 当前重试次数
     */
    private scheduleInitialUpdate(retryCount: number = 0): void {
        const maxRetries = 5; // 最大重试次数
        const initialDelay = 500; // 初始延迟时间（毫秒）
        
        window.setTimeout(() => {
            // 尝试获取文件浏览器
            const fileExplorers = this.getFileExplorers();
            
            if (!fileExplorers || fileExplorers.length === 0) {
                if (retryCount < maxRetries) {
                    // 如果未找到文件浏览器且未达到最大重试次数，则继续重试
                    const nextDelay = initialDelay * (retryCount + 1); // 递增延迟
                    if (retryCount === 0) {
                        console.log(`Title Changer: 等待文件浏览器加载...`);
                    }
                    this.scheduleInitialUpdate(retryCount + 1);
                } else {
                    console.log(`Title Changer: 等待布局变化事件以检测文件浏览器`);
                    // 注册一个一次性的布局变化事件监听器，以便在布局变化时尝试更新
                    const layoutChangeHandler = () => {
                        this.updateView();
                        this.plugin.app.workspace.off('layout-change', layoutChangeHandler);
                    };
                    this.plugin.registerEvent(
                        this.plugin.app.workspace.on('layout-change', layoutChangeHandler)
                    );
                }
            } else {
                this.updateView();
            }
        }, initialDelay);
    }
    
    /**
     * 安排更新视图（防抖处理）
     */
    private scheduleUpdate(): void {
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = window.setTimeout(() => {
            this.updateView();
            this.updateTimer = null;
        }, ExplorerView.UPDATE_INTERVAL);
    }
    
    /**
     * 打印文件浏览器DOM结构，用于调试
     * @param force 是否强制打印（即使在非调试模式下）
     */
    private debugPrintFileExplorerStructure(force: boolean = false): void {
        // 如果设置中没有启用调试模式且force为false，则跳过
        // 注意：我们暂时总是打印，因为需要调试问题
        // if (!this.plugin.settings.debugMode && !force) return;
        
        console.log('Title Changer: ===== 文件浏览器DOM结构分析 =====');
        
        const fileExplorers = this.getFileExplorers();
        if (!fileExplorers || fileExplorers.length === 0) {
            console.log('Title Changer: 未找到文件浏览器视图');
            return;
        }
        
        console.log(`Title Changer: 找到 ${fileExplorers.length} 个文件浏览器`);
        
        fileExplorers.forEach((explorer, index) => {
            console.log(`Title Changer: 文件浏览器 #${index + 1}:`);
            console.log(`Title Changer: - 类名: ${explorer.className}`);
            console.log(`Title Changer: - 子元素数量: ${explorer.children.length}`);
            
            // 检查常见的文件项选择器
            const selectors = [
                '.nav-file',
                '.tree-item',
                '[data-path]',
                '.nav-folder',
                '.nav-file-title',
                '.nav-file-title-content',
                '.tree-item-inner'
            ];
            
            selectors.forEach(selector => {
                const elements = explorer.querySelectorAll(selector);
                console.log(`Title Changer: - 选择器 "${selector}": ${elements.length} 个元素`);
                
                if (elements.length > 0) {
                    // 打印前5个元素的详细信息
                    const sampleSize = Math.min(elements.length, 5);
                    console.log(`Title Changer: - 样本 (${sampleSize}/${elements.length}):`);
                    
                    for (let i = 0; i < sampleSize; i++) {
                        const element = elements[i];
                        console.log(`Title Changer:   - 元素 #${i + 1}:`);
                        console.log(`Title Changer:     - 类名: ${element.className}`);
                        console.log(`Title Changer:     - 标签: ${element.tagName}`);
                        console.log(`Title Changer:     - data-path: ${element.getAttribute('data-path')}`);
                        console.log(`Title Changer:     - 内容: ${element.textContent?.slice(0, 50) || '(无)'}`);
                    }
                }
            });
        });
        
        console.log('Title Changer: ===== DOM结构分析结束 =====');
    }
    
    /**
     * 更新文件浏览器视图中的文件名显示
     */
    updateView(): void {
        // 查找文件浏览器
        const fileExplorers = this.getFileExplorers();
        if (!fileExplorers || fileExplorers.length === 0) {
            return;
        }
        
        // 处理每个文件浏览器
        fileExplorers.forEach(fileExplorer => {
            this.processFileItems(fileExplorer);
        });
    }
    
    /**
     * 获取文件浏览器元素
     * @returns 文件浏览器元素数组
     */
    private getFileExplorers(): HTMLElement[] {
        // 存储找到的文件浏览器
        const fileExplorers: HTMLElement[] = [];
        
        // 尝试查找文件浏览器元素
        try {
            // 1. 查找标准的文件浏览器容器
            const standardExplorer = document.querySelector('.nav-files-container') as HTMLElement;
            if (standardExplorer) {
                fileExplorers.push(standardExplorer);
            }
            
            // 2. 查找可能的替代文件浏览器
            const alternativeExplorers = document.querySelectorAll('.file-explorer-container, .file-tree-container, .nav-folder-children') as NodeListOf<HTMLElement>;
            alternativeExplorers.forEach(explorer => {
                if (!fileExplorers.includes(explorer)) {
                    fileExplorers.push(explorer);
                }
            });
            
            // 3. 作为最后的尝试，查找任何可能包含文件项的容器
            if (fileExplorers.length === 0) {
                const fallbackExplorers = document.querySelectorAll('.nav-folder-content, .workspace-leaf[data-type="file-explorer"]') as NodeListOf<HTMLElement>;
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
     * 处理文件浏览器中的文件项
     * @param fileExplorer 文件浏览器DOM元素
     */
    private processFileItems(fileExplorer: HTMLElement): void {
        // 获取所有文件项 - 支持多种可能的文件项选择器
        const selectors = [
            '.nav-file',                     // 标准选择器
            '.tree-item[data-path]',         // 新版Obsidian可能使用的选择器
            '[data-path]:not(.nav-folder)',  // 任何带有data-path的非文件夹元素
            '.tree-item'                     // 备用选择器
        ];
        
        let fileItems: NodeListOf<Element> = document.createDocumentFragment().querySelectorAll('*'); // 空NodeList
        
        // 尝试不同的选择器
        for (const selector of selectors) {
            const items = fileExplorer.querySelectorAll(selector);
            if (items.length > 0) {
                fileItems = items;
                break;
            }
        }
        
        // 如果没有找到文件项，尝试处理所有具有文本的元素
        if (fileItems.length === 0) {
            // 查找所有可能包含文件名的文本元素
            const textElements = Array.from(fileExplorer.querySelectorAll('*')).filter(el => {
                // 只保留有文本内容且不是按钮/输入框等控件的元素
                return el.textContent?.trim() && 
                       !el.hasAttribute('contenteditable') &&
                       !(el instanceof HTMLButtonElement) &&
                       !(el instanceof HTMLInputElement) &&
                       !(el instanceof HTMLTextAreaElement);
            });
            
            // 处理这些文本元素
            this.processTextElements(textElements);
            return;
        }
        
        // 处理找到的所有文件项
        fileItems.forEach(fileItem => {
            if (fileItem instanceof HTMLElement) {
                this.processFileItem(fileItem);
            }
        });
    }
    
    /**
     * 处理文本元素
     * @param elements 要处理的文本元素数组
     */
    private processTextElements(elements: Element[]): void {
        let matchCount = 0;
        
        // 遍历每个文本元素
        elements.forEach(element => {
            const text = element.textContent?.trim();
            if (!text) return;
            
            // 查找匹配的文件
            const matchingFile = this.findFileByBasename(text);
            
            if (matchingFile) {
                matchCount++;
                
                // 记录原始文本
                if (!this.originalDisplayText.has(element)) {
                    this.originalDisplayText.set(element, text);
                }
                
                // 获取显示标题
                const displayTitle = this.cacheManager.processFile(matchingFile);
                
                // 如果有自定义显示标题，更新显示
                if (displayTitle) {
                    element.textContent = displayTitle;
                }
            }
        });
    }
    
    /**
     * 处理单个文件项
     * @param fileItem 文件项的 DOM 元素
     */
    private processFileItem(fileItem: HTMLElement): void {
        // 获取文件标题元素 - 支持多种可能的标题元素选择器
        const titleSelectors = [
            '.nav-file-title-content',       // 标准选择器
            '.tree-item-inner',              // 新版可能使用的选择器
            'div:not([class])',              // 无类的div可能是内容元素
            '[data-path-inner-text]',        // 某些版本可能使用的属性
            'span'                          // 回退到简单元素
        ];
        
        let titleEl: Element | null = null;
        
        // 尝试不同的选择器
        for (const selector of titleSelectors) {
            const el = fileItem.querySelector(selector);
            if (el) {
                titleEl = el;
                break;
            }
        }
        
        if (!titleEl) {
            return;
        }
        
        // 获取文件路径 - 尝试多种方式
        let filePath: string | null = null;
        
        // 1. 直接从当前元素获取
        filePath = fileItem.getAttribute('data-path');
        
        // 2. 如果当前元素没有，尝试从父元素获取
        if (!filePath) {
            let parent = fileItem.parentElement;
            let searchDepth = 0;
            const maxSearchDepth = 3; // 限制向上搜索的层数
            
            while (!filePath && parent && searchDepth < maxSearchDepth) {
                filePath = parent.getAttribute('data-path');
                if (filePath) {
                    break;
                }
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
                // 从内部链接获取路径
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
        
        // 6. 尝试从titleEl的内容推断
        if (!filePath && titleEl.textContent) {
            // 这是一个备用方法，通过标题内容在文件系统中搜索匹配的文件
            const titleText = titleEl.textContent.trim();
            // 在所有文件中查找匹配的basename
            const matchingFile = this.findFileByBasename(titleText);
            if (matchingFile) {
                filePath = matchingFile.path;
            }
        }
        
        // 如果所有方法都失败，返回
        if (!filePath) {
            return;
        }
        
        // 获取文件
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            return;
        }
        
        // 获取原始显示文本
        if (!this.originalDisplayText.has(titleEl)) {
            this.originalDisplayText.set(titleEl, titleEl.textContent || file.basename);
        }
        
        // 获取显示标题
        const displayTitle = this.cacheManager.processFile(file);
        
        // 如果有自定义显示标题，更新显示
        if (displayTitle) {
            titleEl.textContent = displayTitle;
        } else {
            // 恢复原始文件名
            const originalText = this.originalDisplayText.get(titleEl);
            if (titleEl.textContent !== originalText) {
                titleEl.textContent = originalText !== undefined ? originalText : file.basename;
            }
        }
    }
    
    /**
     * 通过文件基本名称查找文件
     * @param basename 文件基本名称
     * @returns 找到的文件，如果未找到则返回null
     */
    private findFileByBasename(basename: string): TFile | null {
        const files = this.plugin.app.vault.getMarkdownFiles();
        return files.find(file => file.basename === basename) || null;
    }
    
    /**
     * 卸载视图组件
     */
    unload(): void {
        // 取消更新计时器
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 恢复所有原始文件名
        this.restoreOriginalFilenames();
    }
    
    /**
     * 恢复所有原始文件名
     */
    private restoreOriginalFilenames(): void {
        // 记录恢复数量
        let restoreCount = 0;
        
        // 由于我们不再使用类来标记修改过的元素，
        // 我们需要手动遍历originalDisplayText中的所有元素
        // 注意：WeakMap不可迭代，但我们可以在DOM中查找所有可能的元素
        
        // 查找所有文件浏览器
        const fileExplorers = this.getFileExplorers();
        if (fileExplorers && fileExplorers.length > 0) {
            fileExplorers.forEach(explorer => {
                // 查找所有可能包含文件名的元素
                const elements = explorer.querySelectorAll('.nav-file-title-content, .tree-item-inner, [data-path-inner-text], span, div');
                
                elements.forEach(element => {
                    const originalText = this.originalDisplayText.get(element);
                    if (originalText) {
                        element.textContent = originalText;
                        restoreCount++;
                    }
                });
            });
        }
        
        // 清空原始文本存储
        this.originalDisplayText = new WeakMap();
    }
} 