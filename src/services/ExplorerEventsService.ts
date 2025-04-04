import { TFile, Events, Workspace, EventRef, App, WorkspaceLeaf } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { DOMSelectorService } from './DomSelectorService';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, LifecycleError } from '../utils/Errors';
import { tryCatchWrapper, logErrorsWithoutThrowing } from '../utils/ErrorHelpers';
import { Logger } from '../utils/Logger';
import type { IDOMSelectorService } from '../types/ObsidianExtensions';
import type { TitleChangerPlugin } from '../main';

/**
 * 负责处理文件浏览器相关事件的服务
 */
@injectable()
export class ExplorerEventsService {
    private observers: MutationObserver[] = [];
    private immediateUpdateFn: (() => void) | null = null;
    private scrollEventListeners: Array<{element: HTMLElement, listener: EventListener}> = [];
    private viewportObserver: IntersectionObserver | null = null;

    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.DOMSelectorService) private domSelector: IDOMSelectorService,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    /**
     * 设置立即更新函数，由ExplorerView调用
     * 这样可以避免循环依赖问题
     */
    setImmediateUpdateFn(fn: () => void): void {
        tryCatchWrapper(
            () => {
                this.immediateUpdateFn = fn;
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置立即更新函数失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                userVisible: false
            }
        );
    }

    /**
     * 注册所有事件监听器
     * @param callback 事件触发时的回调函数
     */
    public registerEvents(callback: () => void): void {
        tryCatchWrapper(
            () => {
                this.registerDOMObserver(callback);
                this.registerFileEvents(() => {}, callback);
                this.registerLayoutEvents(callback);
                this.registerScrollEvents(callback);
                this.registerViewportEvents(callback);
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                userVisible: true,
                details: { callbackProvided: !!callback }
            }
        );
    }

    /**
     * 注册DOM观察器
     * @param updateCallback 更新回调函数
     */
    public registerDOMObserver(updateCallback: () => void): void {
        logErrorsWithoutThrowing(
            () => {
                const explorers = this.domSelector.getFileExplorers();
                if (!explorers || explorers.length === 0) {
                    this.logger.warn('未找到文件浏览器元素，DOM观察器未注册');
                    return false;
                }
                
                const observer = new MutationObserver((mutations) => {
                    logErrorsWithoutThrowing(
                        () => {
                            const shouldUpdate = mutations.some(mutation => 
                                mutation.type === 'childList' || 
                                mutation.type === 'characterData' ||
                                mutation.type === 'attributes'
                            );
                            
                            if (shouldUpdate && updateCallback) {
                                updateCallback();
                            }
                            return true;
                        },
                        this.constructor.name,
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '处理DOM变化失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            defaultValue: false,
                            details: { mutationsCount: mutations.length }
                        }
                    );
                });

                // 为每个浏览器元素注册观察器
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
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册DOM观察器失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                defaultValue: false,
                details: { updateCallbackProvided: !!updateCallback }
            }
        );
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
        logErrorsWithoutThrowing(
            () => {
                // 使用Obsidian的registerEvent方法注册文件事件
                
                // 监听文件重命名
                this.plugin.registerEvent(
                    this.app.vault.on('rename', (file) => {
                        logErrorsWithoutThrowing(
                            () => {
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
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件重命名事件失败',
                                category: ErrorCategory.FILE,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { 
                                    fileName: file instanceof TFile ? file.path : 'unknown',
                                    eventType: 'rename'
                                }
                            }
                        );
                    })
                );

                // 监听文件创建
                this.plugin.registerEvent(
                    this.app.vault.on('create', (file) => {
                        logErrorsWithoutThrowing(
                            () => {
                                if (file instanceof TFile) {
                                    updateCallback();
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件创建事件失败',
                                category: ErrorCategory.FILE,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { 
                                    fileName: file instanceof TFile ? file.path : 'unknown',
                                    eventType: 'create'
                                }
                            }
                        );
                    })
                );

                // 监听文件删除
                this.plugin.registerEvent(
                    this.app.vault.on('delete', (file) => {
                        logErrorsWithoutThrowing(
                            () => {
                                if (file instanceof TFile) {
                                    invalidateCallback(file);
                                    updateCallback();
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件删除事件失败',
                                category: ErrorCategory.FILE,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { 
                                    fileName: file instanceof TFile ? file.path : 'unknown',
                                    eventType: 'delete'
                                }
                            }
                        );
                    })
                );
                
                // 监听文件修改
                this.plugin.registerEvent(
                    this.app.vault.on('modify', (file) => {
                        logErrorsWithoutThrowing(
                            () => {
                                if (file instanceof TFile) {
                                    invalidateCallback(file);
                                    updateCallback();
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件修改事件失败',
                                category: ErrorCategory.FILE,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { 
                                    fileName: file instanceof TFile ? file.path : 'unknown',
                                    eventType: 'modify'
                                }
                            }
                        );
                    })
                );
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册文件事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                defaultValue: false,
                details: {
                    invalidateCallbackProvided: !!invalidateCallback,
                    updateCallbackProvided: !!updateCallback
                }
            }
        );
    }

    /**
     * 注册布局相关事件
     * @param updateCallback 更新回调函数
     */
    public registerLayoutEvents(updateCallback: () => void): void {
        logErrorsWithoutThrowing(
            () => {
                // 监听布局变化
                this.plugin.registerEvent(
                    this.app.workspace.on('layout-change', () => {
                        logErrorsWithoutThrowing(
                            () => {
                                // 刷新选择器配置
                                this.domSelector.refreshSelectors();
                                
                                // 使用立即更新以提高响应速度
                                if (this.immediateUpdateFn) {
                                    this.immediateUpdateFn();
                                } else {
                                    // 执行更新回调
                                    updateCallback();
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理布局变更事件失败',
                                category: ErrorCategory.UI,
                                level: ErrorLevel.WARNING,
                                defaultValue: false
                            }
                        );
                    })
                );

                // 监听活动叶子变化
                this.plugin.registerEvent(
                    this.app.workspace.on('active-leaf-change', (leaf) => {
                        logErrorsWithoutThrowing(
                            () => {
                                // 如果切换到文件浏览器或文件相关视图，刷新选择器并立即更新
                                const viewType = leaf?.view?.getViewType();
                                if (leaf && leaf.view && (
                                    viewType === 'file-explorer' || 
                                    viewType === 'markdown' || 
                                    viewType === 'empty'
                                )) {
                                    this.domSelector.refreshSelectors();
                                    
                                    // 使用立即更新函数进行快速更新
                                    if (this.immediateUpdateFn) {
                                        this.immediateUpdateFn();
                                    } else {
                                        updateCallback();
                                    }
                                    
                                    // 如果是文件浏览器视图，在200ms后再次更新以确保所有内容都被处理
                                    if (viewType === 'file-explorer') {
                                        setTimeout(() => {
                                            if (this.immediateUpdateFn) {
                                                this.immediateUpdateFn();
                                            } else {
                                                updateCallback();
                                            }
                                        }, 200);
                                    }
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理活动叶子变更事件失败',
                                category: ErrorCategory.UI,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { leafViewType: leaf?.view?.getViewType() }
                            }
                        );
                    })
                );
                
                // 监听文件打开事件
                this.plugin.registerEvent(
                    this.app.workspace.on('file-open', (file) => {
                        logErrorsWithoutThrowing(
                            () => {
                                if (file) {
                                    // 文件打开时更新文件浏览器视图，确保标题显示正确
                                    if (this.immediateUpdateFn) {
                                        this.immediateUpdateFn();
                                    } else {
                                        updateCallback();
                                    }
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理文件打开事件失败',
                                category: ErrorCategory.UI,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { fileName: file?.path || 'unknown' }
                            }
                        );
                    })
                );
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册布局事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                defaultValue: false,
                details: { updateCallbackProvided: !!updateCallback }
            }
        );
    }

    /**
     * 注册滚动事件监听器
     * @param updateCallback 更新回调函数
     */
    public registerScrollEvents(updateCallback: () => void): void {
        logErrorsWithoutThrowing(
            () => {
                // 获取文件浏览器元素
                const explorers = this.domSelector.getFileExplorers();
                if (!explorers || explorers.length === 0) {
                    this.logger.warn('未找到文件浏览器元素，滚动事件未注册');
                    return false;
                }
                
                // 找到可能的滚动容器
                const scrollContainers = this.findScrollContainers(explorers);
                if (scrollContainers.length === 0) {
                    this.logger.warn('未找到滚动容器，滚动事件未注册');
                    return false;
                }
                
                // 为每个滚动容器添加事件监听
                scrollContainers.forEach(container => {
                    // 使用防抖处理滚动事件
                    let scrollTimeout: number | null = null;
                    
                    const handleScroll = (event: Event) => {
                        logErrorsWithoutThrowing(
                            () => {
                                if (scrollTimeout !== null) {
                                    window.clearTimeout(scrollTimeout);
                                }
                                
                                scrollTimeout = window.setTimeout(() => {
                                    updateCallback();
                                    scrollTimeout = null;
                                }, 100); // 100ms的防抖延迟
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理滚动事件失败',
                                category: ErrorCategory.UI,
                                level: ErrorLevel.DEBUG,
                                defaultValue: false,
                                details: { containerTag: container.tagName }
                            }
                        );
                    };
                    
                    // 添加滚动事件监听器
                    container.addEventListener('scroll', handleScroll, { passive: true });
                    
                    // 保存引用以便后续移除
                    this.scrollEventListeners.push({
                        element: container,
                        listener: handleScroll
                    });
                });
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册滚动事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                defaultValue: false,
                details: { updateCallbackProvided: !!updateCallback }
            }
        );
    }

    /**
     * 找到所有可能的滚动容器
     * @param explorers 文件浏览器元素
     * @returns 滚动容器元素数组
     */
    private findScrollContainers(explorers: HTMLElement[]): HTMLElement[] {
        return tryCatchWrapper(
            () => {
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
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '寻找滚动容器失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { explorersCount: explorers.length },
                userVisible: false
            }
        ) || [];
    }

    /**
     * 注册视口变化观察器，以便在文件项可见性变化时更新标题
     * @param updateCallback 更新回调函数
     */
    public registerViewportEvents(updateCallback: () => void): void {
        logErrorsWithoutThrowing(
            () => {
                // 如果已经存在视口观察器，先清理
                if (this.viewportObserver) {
                    this.viewportObserver.disconnect();
                    this.viewportObserver = null;
                }
                
                // 创建新的视口观察器
                this.viewportObserver = new IntersectionObserver(
                    (entries) => {
                        logErrorsWithoutThrowing(
                            () => {
                                // 检测到至少一个文件项进入视口
                                const hasVisibleEntries = entries.some(entry => entry.isIntersecting);
                                if (hasVisibleEntries) {
                                    // 检查是否有文件项缺少处理的标题
                                    const explorers = this.domSelector.getFileExplorers();
                                    if (explorers && explorers.length > 0) {
                                        // 使用立即更新函数，避免延迟
                                        if (this.immediateUpdateFn) {
                                            this.immediateUpdateFn();
                                        } else {
                                            updateCallback();
                                        }
                                    }
                                }
                                return true;
                            },
                            this.constructor.name,
                            this.errorManager,
                            this.logger,
                            {
                                errorMessage: '处理视口观察事件失败',
                                category: ErrorCategory.UI,
                                level: ErrorLevel.WARNING,
                                defaultValue: false,
                                details: { entriesCount: entries.length }
                            }
                        );
                    },
                    {
                        // 配置为文件项进入视口后立即触发
                        threshold: 0.1,
                        // 仅观察可见区域内的变化
                        rootMargin: "0px"
                    }
                );
                
                // 延迟配置观察器，等待DOM完全加载
                setTimeout(() => {
                    logErrorsWithoutThrowing(
                        () => {
                            // 获取文件浏览器元素
                            const explorers = this.domSelector.getFileExplorers();
                            if (!explorers || explorers.length === 0) {
                                this.logger.warn('未找到文件浏览器元素，视口观察器未配置');
                                return false;
                            }
                            
                            // 为每个浏览器中的文件项注册观察器
                            explorers.forEach(explorer => {
                                const fileItems = this.domSelector.getFileItems(explorer);
                                fileItems.forEach(item => {
                                    this.viewportObserver?.observe(item);
                                });
                                
                                // 也观察整个文件浏览器容器
                                this.viewportObserver?.observe(explorer);
                            });
                            
                            return true;
                        },
                        this.constructor.name,
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '配置视口观察器失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            defaultValue: false
                        }
                    );
                }, 1000); // 1秒延迟确保DOM已加载
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册视口事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                defaultValue: false,
                details: { updateCallbackProvided: !!updateCallback }
            }
        );
    }

    /**
     * 注销所有事件
     */
    unregisterAll(): void {
        tryCatchWrapper(
            () => {
                // 断开所有观察器
                this.observers.forEach(observer => {
                    try {
                        observer.disconnect();
                    } catch (e) {
                        this.logger.debug('断开观察器时出错', { error: e });
                    }
                });
                this.observers = [];

                // 注：Obsidian的插件系统会自动处理通过registerEvent注册的事件引用
                // 不再需要手动注销事件引用
                
                // 移除所有滚动事件监听器
                this.scrollEventListeners.forEach(({element, listener}) => {
                    try {
                        element.removeEventListener('scroll', listener);
                    } catch (e) {
                        this.logger.debug('移除滚动事件监听器时出错', { error: e });
                    }
                });
                this.scrollEventListeners = [];
                
                // 清理视口观察器
                if (this.viewportObserver) {
                    this.viewportObserver.disconnect();
                    this.viewportObserver = null;
                }
                
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注销事件失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.ERROR,
                details: { 
                    observersCount: this.observers.length,
                    scrollListenersCount: this.scrollEventListeners.length
                },
                userVisible: true
            }
        );
    }
} 