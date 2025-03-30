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
        // 注册事件监听器
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                this.updateView();
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
        const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeLeaf || activeLeaf.getMode() !== 'preview') return;

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
        // 查找预览模式中的所有内部链接
        const internalLinks = containerEl.querySelectorAll('.internal-link');
        
        internalLinks.forEach(linkEl => {
            const originalFileName = linkEl.getAttribute('data-href');
            if (!originalFileName) return;
            
            // 如果链接已经有显示文本，不做处理
            if (linkEl.hasAttribute('data-link-text')) return;
            
            // 从缓存获取显示标题
            const displayTitle = this.getDisplayTitle(originalFileName);
            
            if (displayTitle && displayTitle !== originalFileName) {
                // 更新链接显示文本
                linkEl.textContent = displayTitle;
            }
        });
    }

    /**
     * 从缓存获取显示标题
     */
    private getDisplayTitle(fileName: string): string | null {
        // 移除文件扩展名
        const baseName = fileName.replace(/\.[^.]+$/, '');
        return this.cacheManager.getDisplayTitle(baseName);
    }
} 