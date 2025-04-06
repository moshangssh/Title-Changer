import { App, MarkdownView, Events } from 'obsidian';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols';
import { AbstractView } from './base/abstract-view';
import { TitleService } from '../services/TitleService';
import type { Logger } from '../utils/logger';
import type { TitleChangerSettings } from '../settings';
import type { IEventBusService } from '../types/ObsidianExtensions';
import { EventType } from '../types/ObsidianExtensions';
import type { ErrorManagerService } from '../services/ErrorManagerService';
import { ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/Errors';

/**
 * Markdown视图管理器 - 负责管理Markdown文件标题显示
 */
@injectable()
export class MarkdownViewManager extends AbstractView {
    private static readonly VIEW_ID = 'markdown-view';
    private titleElements: Map<string, HTMLElement> = new Map();
    
    constructor(
        @inject(TYPES.Plugin) plugin: any,
        @inject(TYPES.App) private app: App,
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.Settings) private settings: TitleChangerSettings,
        @inject(TYPES.EventBusService) private eventBus: IEventBusService,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService
    ) {
        super(plugin, logger, errorManager);
    }
    
    /**
     * 初始化视图
     */
    initialize(): void {
        this.logInfo(`[${MarkdownViewManager.VIEW_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                // 注册布局变化事件监听器
                this.plugin.registerEvent(
                    this.app.workspace.on("layout-change", this.updateView.bind(this))
                );
                
                // 注册标题变更事件监听器
                this.eventBus.subscribe(EventType.TITLE_CHANGED, this.onTitleChanged.bind(this));
                
                // 立即执行一次更新
                this.updateView();
            },
            'MarkdownViewManager',
            '初始化Markdown视图管理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${MarkdownViewManager.VIEW_ID}] 初始化完成`);
    }
    
    /**
     * 卸载视图
     */
    unload(): void {
        this.safeOperation(
            () => {
                // 恢复所有已修改的标题
                this.resetAllTitles();
                
                this.logInfo(`[${MarkdownViewManager.VIEW_ID}] 已卸载`);
            },
            'MarkdownViewManager',
            '卸载Markdown视图管理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'unload' }
        );
    }
    
    /**
     * 启用视图
     */
    protected onEnable(): void {
        super.onEnable();
        this.updateView();
    }
    
    /**
     * 禁用视图
     */
    protected onDisable(): void {
        this.resetAllTitles();
        super.onDisable();
    }
    
    /**
     * 更新视图
     */
    updateView(): void {
        if (!this.enabled || !this.settings.enableMarkdownView) {
            return;
        }
        
        this.safeOperation(
            () => {
                // 获取所有打开的Markdown视图
                const mdViews = this.app.workspace.getLeavesOfType("markdown");
                
                mdViews.forEach(leaf => {
                    const view = leaf.view as MarkdownView;
                    if (view && view.file) {
                        // 获取文件的自定义标题
                        const title = this.titleService.getDisplayTitle(view.file.basename, false);
                        
                        if (title) {
                            this.setCustomTitle(view, title);
                        } else {
                            this.resetTitle(view);
                        }
                    }
                });
            },
            'MarkdownViewManager',
            '更新Markdown视图标题失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'updateView' }
        );
    }
    
    // 当标题变更时更新视图
    private onTitleChanged(): void {
        this.updateView();
    }
    
    // 设置自定义标题
    private setCustomTitle(view: MarkdownView, title: string): void {
        if (!view.file) return;
        
        this.safeOperation(
            () => {
                const container = view.containerEl.querySelector('.view-header-title-container') as HTMLElement;
                if (!container) return;
                
                const fileId = view.file!.path;
                
                // 查找是否已存在自定义标题元素
                let titleEl = this.findCustomTitleElement(container);
                
                // 如果标题相同且已显示，则不做任何更改
                if (titleEl && titleEl.innerText === title && !titleEl.hidden) {
                    return;
                }
                
                // 创建或更新标题元素
                titleEl = titleEl || this.createCustomTitleElement(view, container);
                titleEl.innerText = title;
                titleEl.hidden = false;
                
                // 隐藏原始标题
                const originalTitle = container.querySelector('.view-header-title:not([data-title-changer])');
                if (originalTitle) {
                    originalTitle.setAttribute('hidden', 'true');
                }
                
                // 保存到映射表中
                this.titleElements.set(fileId, titleEl);
            },
            'MarkdownViewManager',
            '设置自定义标题失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'setCustomTitle', title, file: view.file.path }
        );
    }
    
    // 重置单个视图的标题
    private resetTitle(view: MarkdownView): void {
        if (!view.file) return;
        
        this.safeOperation(
            () => {
                const container = view.containerEl.querySelector('.view-header-title-container') as HTMLElement;
                if (!container) return;
                
                const titleEl = this.findCustomTitleElement(container);
                
                if (titleEl) {
                    container.removeChild(titleEl);
                    this.titleElements.delete(view.file!.path);
                }
                
                // 显示原始标题
                const originalTitle = container.querySelector('.view-header-title:not([data-title-changer])');
                if (originalTitle) {
                    originalTitle.removeAttribute('hidden');
                }
            },
            'MarkdownViewManager',
            '重置标题失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'resetTitle', file: view.file.path }
        );
    }
    
    // 重置所有标题
    private resetAllTitles(): void {
        this.safeOperation(
            () => {
                const mdViews = this.app.workspace.getLeavesOfType("markdown");
                
                mdViews.forEach(leaf => {
                    const view = leaf.view as MarkdownView;
                    if (view) {
                        this.resetTitle(view);
                    }
                });
                
                this.titleElements.clear();
            },
            'MarkdownViewManager',
            '重置所有标题失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'resetAllTitles' }
        );
    }
    
    // 查找自定义标题元素
    private findCustomTitleElement(container: HTMLElement): HTMLDivElement | null {
        for (const child of Array.from(container.children)) {
            if (child.hasAttribute("data-title-changer") && child instanceof HTMLDivElement) {
                return child;
            }
        }
        return null;
    }
    
    // 创建自定义标题元素
    private createCustomTitleElement(view: MarkdownView, container: HTMLElement): HTMLDivElement {
        return this.safeOperation(
            () => {
                const el = document.createElement("div");
                el.className = "view-header-title";
                el.dataset.titleChanger = "true";
                
                // 添加点击事件，点击后可以编辑原始标题
                el.onclick = () => {
                    el.hidden = true;
                    
                    // 显示原始标题
                    const originalTitle = container.querySelector('.view-header-title:not([data-title-changer])');
                    if (originalTitle) {
                        originalTitle.removeAttribute('hidden');
                        (originalTitle as HTMLElement).focus();
                        
                        // 当失去焦点时恢复自定义标题
                        (originalTitle as HTMLElement).onblur = () => {
                            originalTitle.setAttribute('hidden', 'true');
                            el.hidden = false;
                            // 重置onblur事件
                            (originalTitle as HTMLElement).onblur = null;
                        };
                    }
                };
                
                container.appendChild(el);
                return el;
            },
            'MarkdownViewManager',
            '创建自定义标题元素失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'createCustomTitleElement' }
        ) || document.createElement("div");
    }
} 