import { TFile, Events, Workspace, EventRef, App } from 'obsidian';
import { DOMSelectorService } from './dom-selector.service';

/**
 * 负责处理文件浏览器相关事件的服务
 */
export class ExplorerEventsService {
    private observers: MutationObserver[] = [];
    private eventRefs: EventRef[] = [];

    constructor(
        private app: App,
        private domSelector: DOMSelectorService
    ) {}

    /**
     * 注册所有事件监听器
     * @param callback 事件触发时的回调函数
     */
    public registerEvents(callback: () => void): void {
        this.registerDOMObserver(callback);
        this.registerFileEvents(() => {}, callback);
        this.registerLayoutEvents(callback);
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
                    updateCallback();
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
    }
} 