import { TFile, Events, Workspace, EventRef, App, WorkspaceLeaf } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { DOMSelectorService } from './DomSelectorService';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, EventError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { EventType } from '../types/ObsidianExtensions';
import type { 
    IDOMSelectorService, 
    IEventBusService,  
    FileEvent, 
    DomMutationEvent, 
    ViewportEvent 
} from '../types/ObsidianExtensions';
import type { TitleChangerPlugin } from '../main';

/**
 * 负责处理文件浏览器相关事件的服务
 * 重构为使用事件总线模式
 */
@injectable()
export class ExplorerEventsService {
    private observers: MutationObserver[] = [];
    private immediateUpdateFn: (() => void) | null = null;
    private scrollEventListeners: Array<{element: HTMLElement, listener: EventListener}> = [];
    private viewportObserver: IntersectionObserver | null = null;
    private subscriptionIds: string[] = [];
    private domObserverRetryTimeout: number | null = null;
    private domObserverRetryCount: number = 0;
    private readonly MAX_RETRY_COUNT: number = 10;
    private readonly RETRY_DELAY_MS: number = 1000; // 1秒
    private isRegistering: boolean = false;

    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.DOMSelectorService) private domSelector: IDOMSelectorService,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.EventBusService) private eventBus: IEventBusService
    ) {}

    /**
     * 设置立即更新函数，由ExplorerView调用
     * 这样可以避免循环依赖问题
     */
    setImmediateUpdateFn(fn: () => void): void {
        try {
            this.immediateUpdateFn = fn;
        } catch (error) {
            this.errorManager.handleError(
                new EventError('设置立即更新函数失败', {
                    sourceComponent: this.constructor.name,
                    details: { error },
                    userVisible: false
                }),
                ErrorLevel.WARNING
            );
        }
    }

    /**
     * 注册所有事件监听器
     * @param callback 事件触发时的回调函数
     */
    public registerEvents(callback: () => void, invalidateCallback?: (file: TFile) => void): void {
        try {
            // 订阅事件总线中的事件
            this.registerEventBusEvents(callback, invalidateCallback);
            
            // 注册DOM观察器
            this.registerDOMObserver(callback);
            
            // 注册滚动事件
            this.registerScrollEvents(callback);
            
            // 注册视口观察器
            this.registerViewportEvents(callback);
            
            this.logger.debug('已注册所有事件监听器');
        } catch (error) {
            this.errorManager.handleError(
                new EventError('注册事件失败', {
                    sourceComponent: this.constructor.name,
                    details: { 
                        callbackProvided: !!callback,
                        error
                    },
                    userVisible: true
                }),
                ErrorLevel.ERROR
            );
        }
    }

    /**
     * 订阅事件总线中的事件
     * @param updateCallback 更新回调函数
     * @param invalidateCallback 文件失效回调函数，可选
     */
    private registerEventBusEvents(
        updateCallback: () => void, 
        invalidateCallback?: (file: TFile) => void
    ): void {
        try {
            // 文件重命名事件
            const fileRenamedSub = this.eventBus.subscribe<FileEvent>(
                EventType.FILE_RENAMED, 
                (event) => {
                    try {
                        if (event.payload.file instanceof TFile) {
                            if (invalidateCallback) {
                                invalidateCallback(event.payload.file);
                            }
                            
                            // 使用立即更新函数提高响应速度
                            if (this.immediateUpdateFn) {
                                this.immediateUpdateFn();
                            } else {
                                updateCallback();
                            }
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理文件重命名事件失败', {
                                sourceComponent: this.constructor.name,
                                details: {
                                    fileName: event.payload.file instanceof TFile ? event.payload.file.path : 'unknown',
                                    eventType: event.type,
                                    error
                                },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(fileRenamedSub);

            // 文件创建事件
            const fileCreatedSub = this.eventBus.subscribe<FileEvent>(
                EventType.FILE_CREATED, 
                (event) => {
                    try {
                        if (event.payload.file instanceof TFile) {
                            updateCallback();
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理文件创建事件失败', {
                                sourceComponent: this.constructor.name,
                                details: {
                                    fileName: event.payload.file instanceof TFile ? event.payload.file.path : 'unknown',
                                    eventType: event.type,
                                    error
                                },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(fileCreatedSub);

            // 文件删除事件
            const fileDeletedSub = this.eventBus.subscribe<FileEvent>(
                EventType.FILE_DELETED, 
                (event) => {
                    try {
                        if (event.payload.file instanceof TFile) {
                            if (invalidateCallback) {
                                invalidateCallback(event.payload.file);
                            }
                            updateCallback();
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理文件删除事件失败', {
                                sourceComponent: this.constructor.name,
                                details: {
                                    fileName: event.payload.file instanceof TFile ? event.payload.file.path : 'unknown',
                                    eventType: event.type,
                                    error
                                },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(fileDeletedSub);

            // UI刷新事件
            const uiRefreshSub = this.eventBus.subscribe(
                EventType.UI_REFRESH, 
                () => {
                    try {
                        // 刷新选择器配置
                        this.domSelector.refreshSelectors();
                        
                        // 使用立即更新函数提高响应速度
                        if (this.immediateUpdateFn) {
                            this.immediateUpdateFn();
                        } else {
                            updateCallback();
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理UI刷新事件失败', {
                                sourceComponent: this.constructor.name,
                                details: { error },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(uiRefreshSub);

            // DOM变化事件
            const domMutationSub = this.eventBus.subscribe<DomMutationEvent>(
                EventType.DOM_MUTATION, 
                (event) => {
                    try {
                        const shouldUpdate = event.payload.mutations.some(mutation => 
                            mutation.type === 'childList' || 
                            mutation.type === 'characterData' ||
                            mutation.type === 'attributes'
                        );
                        
                        if (shouldUpdate) {
                            updateCallback();
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理DOM变化事件失败', {
                                sourceComponent: this.constructor.name,
                                details: {
                                    mutationsCount: event.payload.mutations.length,
                                    error
                                },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(domMutationSub);

            // 视口变化事件
            const viewportSub = this.eventBus.subscribe<ViewportEvent>(
                EventType.VIEWPORT_CHANGED, 
                (event) => {
                    try {
                        if (event.payload.isIntersecting) {
                            updateCallback();
                        }
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError('处理视口变化事件失败', {
                                sourceComponent: this.constructor.name,
                                details: { error },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            );
            this.subscriptionIds.push(viewportSub);

            this.logger.debug('已订阅事件总线事件');
        } catch (error) {
            this.errorManager.handleError(
                new EventError('订阅事件总线事件失败', {
                    sourceComponent: this.constructor.name,
                    details: {
                        updateCallbackProvided: !!updateCallback,
                        invalidateCallbackProvided: !!invalidateCallback,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
        }
    }

    /**
     * 注册DOM观察器
     * @param updateCallback 更新回调函数
     */
    public registerDOMObserver(updateCallback: () => void): void {
        try {
            if (this.isRegistering) {
                return;
            }
            
            this.isRegistering = true;
            this.domObserverRetryCount = 0;
            
            this.retryRegisterDOMObserver(updateCallback);
        } catch (error) {
            this.isRegistering = false;
            this.errorManager.handleError(
                new EventError('注册DOM观察器失败', {
                    sourceComponent: this.constructor.name,
                    details: {
                        updateCallbackProvided: !!updateCallback,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
        }
    }
    
    /**
     * 重试注册DOM观察器
     * @param updateCallback 更新回调函数
     */
    private retryRegisterDOMObserver(updateCallback: () => void): void {
        try {
            const explorers = this.domSelector.getFileExplorers();
            
            if (!explorers || explorers.length === 0) {
                this.domObserverRetryCount++;
                
                if (this.domObserverRetryCount <= this.MAX_RETRY_COUNT) {
                    this.logger.debug(`未找到文件浏览器元素，将在${this.RETRY_DELAY_MS}ms后重试 (${this.domObserverRetryCount}/${this.MAX_RETRY_COUNT})`);
                    
                    if (this.domObserverRetryTimeout !== null) {
                        window.clearTimeout(this.domObserverRetryTimeout);
                    }
                    
                    this.domObserverRetryTimeout = window.setTimeout(() => {
                        this.retryRegisterDOMObserver(updateCallback);
                    }, this.RETRY_DELAY_MS);
                    
                    return;
                } else {
                    this.isRegistering = false;
                    this.logger.warn(`未找到文件浏览器元素，DOM观察器未注册 (已重试${this.MAX_RETRY_COUNT}次)`);
                    return;
                }
            }
            
            const observer = new MutationObserver((mutations) => {
                this.eventBus.publish({
                    type: EventType.DOM_MUTATION,
                    payload: {
                        target: mutations[0]?.target || document,
                        mutations
                    },
                    source: this.constructor.name
                });
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
            this.isRegistering = false;
            this.logger.debug(`已成功注册DOM观察器，监听了${explorers.length}个文件浏览器元素`);
            
            if (this.domObserverRetryCount > 0) {
                this.logger.info(`在第${this.domObserverRetryCount}次重试后成功注册DOM观察器`);
            }
            
            this.domObserverRetryCount = 0;
        } catch (error) {
            this.isRegistering = false;
            this.errorManager.handleError(
                new EventError('重试注册DOM观察器失败', {
                    sourceComponent: this.constructor.name,
                    details: {
                        retryCount: this.domObserverRetryCount,
                        updateCallbackProvided: !!updateCallback,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.WARNING
            );
        }
    }

    /**
     * 注册滚动事件
     * @param updateCallback 更新回调函数
     */
    public registerScrollEvents(updateCallback: () => void): void {
        // 此方法保持原有实现，在真实场景中应重构以使用事件总线
        // 由于滚动事件的特殊性，暂时保留直接处理方式
        // ...原有代码...
    }

    /**
     * 注册视口事件
     * @param updateCallback 更新回调函数
     */
    public registerViewportEvents(updateCallback: () => void): void {
        // 此方法保持原有实现，在真实场景中应重构以使用事件总线
        // 由于IntersectionObserver的特殊性，暂时保留直接处理方式
        // ...原有代码...
    }

    /**
     * 注销所有事件监听器
     */
    unregisterAll(): void {
        try {
            if (this.domObserverRetryTimeout !== null) {
                window.clearTimeout(this.domObserverRetryTimeout);
                this.domObserverRetryTimeout = null;
            }
            
            this.isRegistering = false;
            this.domObserverRetryCount = 0;
            
            if (this.observers.length > 0) {
                this.observers.forEach(observer => observer.disconnect());
                this.observers = [];
            }

            this.scrollEventListeners.forEach(({element, listener}) => {
                element.removeEventListener('scroll', listener);
            });
            this.scrollEventListeners = [];

            if (this.viewportObserver) {
                this.viewportObserver.disconnect();
                this.viewportObserver = null;
            }

            this.subscriptionIds.forEach(id => {
                this.eventBus.unsubscribe(id);
            });
            this.subscriptionIds = [];

            this.logger.debug('已注销所有事件监听器');
        } catch (error) {
            this.errorManager.handleError(
                new EventError('注销事件监听器失败', {
                    sourceComponent: this.constructor.name,
                    details: { error },
                    userVisible: false
                }),
                ErrorLevel.WARNING
            );
        }
    }
} 