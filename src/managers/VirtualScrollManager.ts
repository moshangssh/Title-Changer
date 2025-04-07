import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { AbstractManager } from './base/AbstractManager';
import { DOMSelectorService } from '../services/DomSelectorService';
import { logErrorsWithoutThrowing } from '../utils/ErrorHelpers';
import { throttle } from '../utils/ThrottleDebounce';

/**
 * 虚拟滚动管理器
 * 处理虚拟滚动相关逻辑，确保只处理可见或即将可见的文件项
 */
@injectable()
export class VirtualScrollManager extends AbstractManager {
    private static readonly MANAGER_ID = 'virtual-scroll-manager';
    private static readonly VIEWPORT_BUFFER = 800; // 视口缓冲区（像素），增加到800px
    private static readonly SCROLL_THROTTLE = 250; // 滚动节流延迟(ms)，增加到250ms
    
    private observers: MutationObserver[] = [];
    private intersectionObserver: IntersectionObserver | null = null;
    private scrollListeners: { element: Element, listener: EventListener }[] = [];
    private lastKnownItemCount = 0;
    private onItemsChangedCallback: (() => void) | null = null;
    private visibleItems: Set<HTMLElement> = new Set();

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化虚拟滚动管理器
     * @param onItemsChanged 项目变化时的回调函数
     */
    initialize(onItemsChanged: () => void): void {
        this.logInfo(`[${VirtualScrollManager.MANAGER_ID}] 正在初始化...`);
        
        this.onItemsChangedCallback = onItemsChanged;
        
        // 初始化滚动监听
        this.setupScrollListeners();
        
        // 初始化虚拟滚动观察器
        this.setupVirtualScrollObserver();
        
        // 初始化交叉观察器
        this.setupIntersectionObserver();
        
        this.logInfo(`[${VirtualScrollManager.MANAGER_ID}] 初始化完成`);
    }

    /**
     * 设置滚动监听器
     */
    private setupScrollListeners(): void {
        try {
            // 为文件浏览器和文档添加滚动事件监听
            const explorers = this.domSelector.getFileExplorers();
            
            // 为每个文件浏览器添加滚动监听
            explorers.forEach(explorer => {
                // 使用节流函数包装滚动处理程序
                const scrollHandler = throttle(this.handleScroll.bind(this), VirtualScrollManager.SCROLL_THROTTLE);
                explorer.addEventListener('scroll', scrollHandler);
                
                // 记录监听器以便后续清理
                this.scrollListeners.push({
                    element: explorer,
                    listener: scrollHandler
                });
            });
            
            // 为文档添加滚动监听
            const docScrollHandler = throttle(this.handleScroll.bind(this), VirtualScrollManager.SCROLL_THROTTLE);
            document.addEventListener('scroll', docScrollHandler);
            this.scrollListeners.push({
                element: document as unknown as Element,
                listener: docScrollHandler
            });
            
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 已设置 ${this.scrollListeners.length} 个滚动监听器`);
        } catch (error) {
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 设置滚动监听器失败: ${error}`);
        }
    }

    /**
     * 设置虚拟滚动观察器
     * 监控文件浏览器的DOM变化，实现滚动时的动态更新
     */
    private setupVirtualScrollObserver(): void {
        logErrorsWithoutThrowing(
            () => {
                // 创建虚拟滚动观察器
                const scrollObserver = new MutationObserver((mutations) => {
                    logErrorsWithoutThrowing(
                        () => {
                            // 检查是否有相关DOM变化
                            const hasRelevantChanges = mutations.some(mutation => 
                                mutation.type === 'childList' || 
                                (mutation.type === 'attributes' && 
                                 (mutation.attributeName === 'style' || 
                                  mutation.attributeName === 'class'))
                            );
                            
                            if (!hasRelevantChanges) return true;
                            
                            // 计算当前可见文件条目的数量
                            const explorers = this.domSelector.getFileExplorers();
                            let totalItems = 0;
                            
                            explorers.forEach(explorer => {
                                const fileItems = this.domSelector.getFileItems(explorer);
                                totalItems += fileItems.length;
                            });
                            
                            // 如果文件条目数量变化较大，触发回调
                            if (totalItems !== 0 && Math.abs(totalItems - this.lastKnownItemCount) > 2) {
                                this.lastKnownItemCount = totalItems;
                                if (this.onItemsChangedCallback) {
                                    this.onItemsChangedCallback();
                                }
                            }
                            
                            // 更新可见项追踪
                            this.updateVisibleItems();
                            
                            return true;
                        },
                        'VirtualScrollManager',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '处理虚拟滚动变更时出错',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            details: { mutations: mutations.length }
                        }
                    );
                });
                
                // 观察所有文件浏览器
                const explorers = this.domSelector.getFileExplorers();
                explorers.forEach(explorer => {
                    scrollObserver.observe(explorer, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                });
                
                this.observers.push(scrollObserver);
                
                this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 已设置虚拟滚动观察器，监控 ${explorers.length} 个文件浏览器`);
                
                return true;
            },
            'VirtualScrollManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置虚拟滚动观察器失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { error: 'Failed to setup observer' }
            }
        );
    }
    
    /**
     * 设置交叉观察器
     * 监测文件项的可见性，只处理可见或即将可见的文件项
     */
    private setupIntersectionObserver(): void {
        try {
            // 创建交叉观察器
            this.intersectionObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        const element = entry.target as HTMLElement;
                        
                        if (entry.isIntersecting) {
                            // 文件项进入视口
                            this.visibleItems.add(element);
                        } else {
                            // 文件项离开视口
                            this.visibleItems.delete(element);
                        }
                    });
                    
                    // 如果可见性发生变化，触发回调
                    if (entries.some(entry => entry.isIntersecting) && this.onItemsChangedCallback) {
                        this.onItemsChangedCallback();
                    }
                },
                {
                    root: null, // 使用视口作为根
                    rootMargin: `${VirtualScrollManager.VIEWPORT_BUFFER}px`, // 添加缓冲区
                    threshold: 0 // 只要有一部分可见就算
                }
            );
            
            // 初始化观察所有文件项
            this.updateVisibleItems();
            
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 已设置交叉观察器`);
        } catch (error) {
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 设置交叉观察器失败: ${error}`);
        }
    }
    
    /**
     * 更新可见文件项
     */
    private updateVisibleItems(): void {
        try {
            if (!this.intersectionObserver) return;
            
            // 获取所有文件浏览器
            const explorers = this.domSelector.getFileExplorers();
            
            // 获取所有文件项
            const allFileItems: HTMLElement[] = [];
            explorers.forEach(explorer => {
                const fileItems = this.domSelector.getFileItems(explorer);
                allFileItems.push(...fileItems);
            });
            
            // 观察所有文件项
            allFileItems.forEach(item => {
                this.intersectionObserver?.observe(item);
            });
            
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 更新可见项追踪，当前追踪 ${allFileItems.length} 个文件项`);
        } catch (error) {
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 更新可见项失败: ${error}`);
        }
    }
    
    /**
     * 处理滚动事件
     */
    private handleScroll(): void {
        try {
            // 更新可见项追踪
            this.updateVisibleItems();
            
            // 通知需要更新
            if (this.onItemsChangedCallback) {
                this.onItemsChangedCallback();
            }
        } catch (error) {
            this.logDebug(`[${VirtualScrollManager.MANAGER_ID}] 处理滚动事件失败: ${error}`);
        }
    }
    
    /**
     * 获取当前可见的文件项
     * @returns 可见的文件项数组
     */
    getVisibleItems(): HTMLElement[] {
        return Array.from(this.visibleItems);
    }
    
    /**
     * 卸载虚拟滚动管理器
     */
    unload(): void {
        this.logInfo(`[${VirtualScrollManager.MANAGER_ID}] 正在卸载...`);
        
        // 移除所有观察器
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        // 移除交叉观察器
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        // 移除所有滚动监听器
        this.scrollListeners.forEach(({ element, listener }) => {
            element.removeEventListener('scroll', listener);
        });
        this.scrollListeners = [];
        
        // 清空可见项集合
        this.visibleItems.clear();
        
        this.logInfo(`[${VirtualScrollManager.MANAGER_ID}] 卸载完成`);
    }
} 