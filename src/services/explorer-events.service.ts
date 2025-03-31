import { TFile, Events, Workspace, EventRef, App } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { DOMSelectorService } from './dom-selector.service';

/**
 * 负责处理文件浏览器相关事件的服务
 */
@injectable()
export class ExplorerEventsService {
    private observers: MutationObserver[] = [];
    private eventRefs: EventRef[] = [];
    private immediateUpdateFn: (() => void) | null = null;
    private scrollEventListeners: Array<{element: HTMLElement, listener: EventListener}> = [];

    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService
    ) {}

    /**
     * 设置立即更新函数，由ExplorerView调用
     * 这样可以避免循环依赖问题
     */
    setImmediateUpdateFn(fn: () => void): void {
        this.immediateUpdateFn = fn;
    }

    /**
     * 注册所有事件监听器
     * @param callback 事件触发时的回调函数
     */
    public registerEvents(callback: () => void): void {
        this.registerDOMObserver(callback);
        this.registerFileEvents(() => {}, callback);
        this.registerLayoutEvents(callback);
        this.registerScrollEvents(callback);
    }

    /**
     * 注册DOM观察器
     * @param updateCallback 更新回调函数
     */
    public registerDOMObserver(updateCallback: () => void): void {
        const explorers = this.domSelector.getFileExplorers();
        
        const observer = new MutationObserver((mutations) => {
            const shouldUpdate = mutations.some(mutation => 
                mutation.type === 'childList' || 
                mutation.type === 'characterData' ||
                mutation.type === 'attributes'
            );
            
            if (shouldUpdate) {
                updateCallback();
            }
        });

        explorers.forEach(explorer => {
            observer.observe(explorer, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['data-path']
            });
        });

        this.observers.push(observer);
    }

    /**
     * 注册文件事件
     * @param invalidateCallback 文件失效时的回调
     * @param updateCallback 更新回调函数
     */
    public registerFileEvents(
        invalidateCallback: (file: TFile) => void,
        updateCallback: () => void
    ): void {
        // 监听文件重命名
        this.eventRefs.push(
            this.app.vault.on('rename', (file) => {
                if (file instanceof TFile) {
                    invalidateCallback(file);
                    
                    // 使用立即更新函数，避免循环依赖
                    if (this.immediateUpdateFn) {
                        this.immediateUpdateFn();
                    } else {
                        // 回退到普通更新
                        updateCallback();
                        setTimeout(() => updateCallback(), 100);
                    }
                }
            })
        );

        // 监听文件创建
        this.eventRefs.push(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile) {
                    updateCallback();
                }
            })
        );

        // 监听文件删除
        this.eventRefs.push(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile) {
                    invalidateCallback(file);
                    updateCallback();
                }
            })
        );
        
        // 监听文件修改
        this.eventRefs.push(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    invalidateCallback(file);
                    updateCallback();
                }
            })
        );
    }

    /**
     * 注册布局事件
     * @param updateCallback 更新回调函数
     */
    public registerLayoutEvents(updateCallback: () => void): void {
        // 监听布局变化
        this.eventRefs.push(
            this.app.workspace.on('layout-change', () => {
                updateCallback();
            })
        );

        // 监听活动叶子变化
        this.eventRefs.push(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && leaf.view && leaf.view.getViewType() === 'file-explorer') {
                    updateCallback();
                }
            })
        );
    }

    /**
     * 注册滚动事件监听器
     * @param updateCallback 更新回调函数
     */
    public registerScrollEvents(updateCallback: () => void): void {
        // 获取文件浏览器元素
        const explorers = this.domSelector.getFileExplorers();
        
        // 找到可能的滚动容器
        const scrollContainers = this.findScrollContainers(explorers);
        
        // 为每个滚动容器添加事件监听
        scrollContainers.forEach(container => {
            // 使用防抖处理滚动事件
            let scrollTimeout: number | null = null;
            
            const handleScroll = () => {
                if (scrollTimeout !== null) {
                    window.clearTimeout(scrollTimeout);
                }
                
                scrollTimeout = window.setTimeout(() => {
                    updateCallback();
                    scrollTimeout = null;
                }, 100); // 100ms的防抖延迟
            };
            
            // 添加滚动事件监听器
            container.addEventListener('scroll', handleScroll, { passive: true });
            
            // 保存引用以便后续移除
            this.scrollEventListeners.push({
                element: container,
                listener: handleScroll
            });
        });
    }

    /**
     * 找到所有可能的滚动容器
     * @param explorers 文件浏览器元素
     * @returns 滚动容器元素数组
     */
    private findScrollContainers(explorers: HTMLElement[]): HTMLElement[] {
        const containers: HTMLElement[] = [];
        
        // 直接使用文件浏览器元素本身
        containers.push(...explorers);
        
        // 查找文件浏览器的父级滚动容器
        explorers.forEach(explorer => {
            let parent = explorer.parentElement;
            const maxDepth = 5; // 最大向上查找深度
            let depth = 0;
            
            while (parent && depth < maxDepth) {
                // 判断元素是否可能是滚动容器
                const style = window.getComputedStyle(parent);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    containers.push(parent as HTMLElement);
                }
                parent = parent.parentElement;
                depth++;
            }
        });
        
        // 查找工作区容器（一般是滚动的主容器）
        const workspaceContainer = document.querySelector('.workspace-leaf-content[data-type="file-explorer"]');
        if (workspaceContainer instanceof HTMLElement) {
            containers.push(workspaceContainer);
        }
        
        return Array.from(new Set(containers)); // 去重
    }

    /**
     * 注销所有事件
     */
    unregisterAll(): void {
        // 断开所有观察器
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];

        // 注销所有事件引用
        this.eventRefs.forEach(ref => {
            if (ref) {
                this.app.workspace.offref(ref);
            }
        });
        this.eventRefs = [];
        
        // 移除所有滚动事件监听器
        this.scrollEventListeners.forEach(({element, listener}) => {
            element.removeEventListener('scroll', listener);
        });
        this.scrollEventListeners = [];
    }
} 