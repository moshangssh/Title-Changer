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
    }
    
    /**
     * 初始化视图
     */
    initialize(): void {
        // 注册事件监听器
        this.registerEvents();
        
        // 初始更新文件浏览器
        this.updateView();
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
        
        // 监听布局变化
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('layout-change', () => this.scheduleUpdate())
        );
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
     * 更新文件浏览器视图中的文件名显示
     */
    updateView(): void {
        // 更新缓存管理器的设置
        this.cacheManager.updateSettings(this.plugin.settings);
        
        // 获取文件浏览器视图
        const fileExplorers = this.getFileExplorers();
        
        if (!fileExplorers || fileExplorers.length === 0) {
            return;
        }
        
        // 处理每个文件浏览器中的文件项
        fileExplorers.forEach(explorer => {
            this.processFileItems(explorer);
        });
    }
    
    /**
     * 获取所有文件浏览器视图
     * @returns 文件浏览器视图的 DOM 元素数组
     */
    private getFileExplorers(): HTMLElement[] {
        const fileExplorers: HTMLElement[] = [];
        
        // 获取文件浏览器视图
        const fileExplorerLeaves = this.plugin.app.workspace.getLeavesOfType('file-explorer');
        
        fileExplorerLeaves.forEach(leaf => {
            const view = (leaf as WorkspaceLeaf).view;
            if (view && view.containerEl) {
                const fileExplorer = view.containerEl.querySelector('.nav-files-container');
                if (fileExplorer instanceof HTMLElement) {
                    fileExplorers.push(fileExplorer);
                }
            }
        });
        
        return fileExplorers;
    }
    
    /**
     * 处理文件浏览器中的文件项
     * @param fileExplorer 文件浏览器的 DOM 元素
     */
    private processFileItems(fileExplorer: HTMLElement): void {
        // 获取所有文件项
        const fileItems = fileExplorer.querySelectorAll('.nav-file');
        
        fileItems.forEach(fileItem => {
            if (fileItem instanceof HTMLElement) {
                this.processFileItem(fileItem);
            }
        });
    }
    
    /**
     * 处理单个文件项
     * @param fileItem 文件项的 DOM 元素
     */
    private processFileItem(fileItem: HTMLElement): void {
        // 获取文件标题元素
        const titleEl = fileItem.querySelector('.nav-file-title-content');
        if (!titleEl) return;
        
        // 获取文件路径
        const filePath = fileItem.getAttribute('data-path');
        if (!filePath) return;
        
        // 获取文件
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return;
        
        // 获取原始显示文本
        if (!this.originalDisplayText.has(titleEl)) {
            this.originalDisplayText.set(titleEl, titleEl.textContent || file.basename);
        }
        
        // 获取显示标题
        const displayTitle = this.cacheManager.getDisplayTitle(file);
        
        // 如果有自定义显示标题，更新显示
        if (displayTitle) {
            titleEl.textContent = displayTitle;
            titleEl.classList.add('title-changer-modified');
        } else {
            // 恢复原始文件名
            const originalText = this.originalDisplayText.get(titleEl);
            titleEl.textContent = originalText !== undefined ? originalText : file.basename;
            titleEl.classList.remove('title-changer-modified');
        }
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
        // 获取文件浏览器视图
        const fileExplorers = this.getFileExplorers();
        
        if (!fileExplorers || fileExplorers.length === 0) {
            return;
        }
        
        // 处理每个文件浏览器中的文件项
        fileExplorers.forEach(explorer => {
            // 获取所有文件项
            const fileItems = explorer.querySelectorAll('.nav-file');
            
            fileItems.forEach(fileItem => {
                // 获取文件标题元素
                const titleEl = fileItem.querySelector('.nav-file-title-content');
                if (!titleEl) return;
                
                // 恢复原始文件名
                if (this.originalDisplayText.has(titleEl)) {
                    const originalText = this.originalDisplayText.get(titleEl);
                    if (originalText !== undefined) {
                        titleEl.textContent = originalText;
                    }
                }
            });
        });
    }
} 