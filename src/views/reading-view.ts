import { MarkdownView, TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { CacheManager } from '../cache-manager';

/**
 * 阅读视图组件，负责处理预览模式中的标题显示
 */
@injectable()
export class ReadingView {
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.CacheManager) private cacheManager: CacheManager
    ) {}

    /**
     * 初始化阅读视图
     */
    initialize(): void {
        // 注册文件打开事件监听器
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                this.updateView();
            })
        );
        
        // 注册活动叶子变更事件
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', () => {
                this.updateView();
            })
        );
        
        // 注册预览模式渲染完成事件
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('layout-change', () => {
                setTimeout(() => this.updateView(), 100);
            })
        );
        
        // 注册文件修改事件
        this.plugin.registerEvent(
            this.plugin.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    // 更新缓存
                    this.cacheManager.invalidateFile(file);
                    // 更新当前打开的文件的视图
                    const activeFile = this.plugin.app.workspace.getActiveFile();
                    if (activeFile && activeFile.path === file.path) {
                        this.updateView();
                    }
                }
            })
        );

        // 初始化时更新一次
        this.updateView();
    }

    /**
     * 卸载阅读视图
     */
    unload(): void {
        // 可以在这里进行清理工作
    }

    /**
     * 更新阅读视图中的链接标题
     */
    updateView(): void {
        // 获取当前活动叶子
        const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeLeaf) return;
        
        // 检查是否处于阅读模式
        if (activeLeaf.getMode() !== 'preview') return;

        // 获取预览模式下的DOM元素
        const previewEl = activeLeaf.previewMode.containerEl;
        if (!previewEl) return;

        // 处理预览模式中的所有链接
        this.processPreviewLinks(previewEl);
    }

    /**
     * 处理预览模式中的所有链接
     */
    private processPreviewLinks(containerEl: HTMLElement): void {
        try {
            // 查找预览模式中的所有内部链接
            const internalLinks = containerEl.querySelectorAll('.internal-link');
            
            internalLinks.forEach(linkEl => {
                // 获取链接的原始文件名
                const originalFileName = linkEl.getAttribute('data-href');
                if (!originalFileName) return;
                
                // 跳过已有自定义显示文本的链接
                if (linkEl.hasAttribute('data-link-text')) return;
                
                // 跳过已处理过的链接
                if (linkEl.hasAttribute('data-title-processed')) return;
                
                // 从缓存获取显示标题
                const displayTitle = this.getDisplayTitle(originalFileName);
                
                if (displayTitle && displayTitle !== originalFileName) {
                    // 更新链接显示文本
                    linkEl.textContent = displayTitle;
                    
                    // 保留原始文本作为提示
                    (linkEl as HTMLElement).title = originalFileName;
                    
                    // 标记为已处理
                    linkEl.setAttribute('data-title-processed', 'true');
                }
            });
        } catch (error) {
            console.error('Title Changer: 处理阅读视图链接时发生错误', error);
        }
    }

    /**
     * 从缓存获取显示标题
     */
    private getDisplayTitle(fileName: string): string | null {
        try {
            // 移除文件扩展名
            const baseName = fileName.replace(/\.[^.]+$/, '');
            
            // 尝试从缓存获取标题
            let displayTitle = this.cacheManager.getDisplayTitle(baseName);
            
            // 如果缓存中没有找到，尝试处理文件
            if (!displayTitle) {
                // 查找匹配的文件
                const file = this.findFile(baseName);
                if (file) {
                    displayTitle = this.cacheManager.processFile(file);
                }
            }
            
            return displayTitle;
        } catch (error) {
            console.error('Title Changer: 获取显示标题时发生错误', error);
            return null;
        }
    }
    
    /**
     * 查找匹配的文件
     */
    private findFile(fileName: string): TFile | null {
        try {
            const files = this.plugin.app.vault.getMarkdownFiles();
            return files.find(file => 
                file.basename === fileName || 
                file.path === fileName || 
                file.path === `${fileName}.md`
            ) || null;
        } catch (error) {
            console.error('Title Changer: 查找文件时发生错误', error);
            return null;
        }
    }
} 