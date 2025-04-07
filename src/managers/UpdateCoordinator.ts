import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { UpdateScheduler } from '../services/UpdateSchedulerService';
import { ErrorCategory } from '../utils/errors';
import { AbstractManager } from './base/AbstractManager';
import { ExplorerEventsService } from '../services/ExplorerEventsService';
import { EventBusService } from '../services/EventBusService';
import type { TFile } from 'obsidian';
import type { ICacheManager } from '../types/ObsidianExtensions';
import { EventType } from '../types/ObsidianExtensions';
import { throttle, debounce } from '../utils/ThrottleDebounce';

/**
 * 更新协调器
 * 负责管理和协调视图更新操作，实现更新调度和防抖
 */
@injectable()
export class UpdateCoordinator extends AbstractManager {
    private static readonly MANAGER_ID = 'update-coordinator';
    
    // 更新延迟配置
    private static readonly UPDATE_DELAY = 300; // 普通更新延迟(ms)，增加到300ms
    private static readonly IMMEDIATE_UPDATE_DELAY = 100; // 立即更新延迟(ms)，增加到100ms
    private static readonly INITIAL_UPDATE_DELAY = 1500; // 初始更新延迟(ms)，增加到1500ms
    private static readonly VIEWPORT_READY_DELAY = 2500; // 视口就绪更新延迟(ms)，增加到2500ms
    
    private viewportReadyTimer: number | null = null;
    private updateCallback: (() => void) | null = null;
    private updateTimeoutId: number | null = null;
    private isUpdating = false;
    
    // 使用节流函数包装更新方法
    private throttledUpdate: () => void;
    private debouncedUpdate: () => Promise<any>;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.UpdateScheduler) private updateScheduler: UpdateScheduler,
        @inject(TYPES.ExplorerEventsService) private eventsService: ExplorerEventsService,
        @inject(TYPES.EventBusService) private eventBus: EventBusService,
        @inject(TYPES.CacheManager) private cacheManager: ICacheManager
    ) {
        super(plugin, logger, errorManager);
        
        // 初始化节流更新函数
        this.throttledUpdate = throttle(() => {
            if (this.updateCallback) {
                this.updateCallback();
            }
        }, UpdateCoordinator.UPDATE_DELAY);
        
        // 初始化防抖更新函数
        this.debouncedUpdate = debounce(() => {
            if (this.updateCallback) {
                this.updateCallback();
            }
            return Promise.resolve();
        }, UpdateCoordinator.UPDATE_DELAY, false);
    }

    /**
     * 初始化更新协调器
     * @param updateCallback 更新回调函数
     */
    initialize(updateCallback: () => void): void {
        this.logInfo(`[${UpdateCoordinator.MANAGER_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                this.updateCallback = updateCallback;
                
                // 设置立即更新函数
                this.eventsService.setImmediateUpdateFn(() => this.immediateUpdate());
                
                // 订阅必要的事件
                this.subscribeToEvents();
            },
            'UpdateCoordinator',
            '初始化更新协调器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${UpdateCoordinator.MANAGER_ID}] 初始化完成`);
    }
    
    /**
     * 注册所有事件监听器
     */
    registerEvents(): void {
        this.safeOperation(
            () => {
                // 在初始化时为缓存失效设置回调函数
                const invalidateFileCallback = (file: TFile) => this.cacheManager.invalidateFile(file);
                const updateCallback = () => this.scheduleUpdate();
                
                // 使用统一的注册事件方法
                this.eventsService.registerEvents(updateCallback, invalidateFileCallback);
            },
            'UpdateCoordinator',
            '注册事件处理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'registerEvents' }
        );
    }
    
    /**
     * 订阅内部事件
     */
    private subscribeToEvents(): void {
        // 订阅文件修改事件
        this.eventBus.subscribe(EventType.FILE_MODIFIED, () => {
            this.logDebug(`[${UpdateCoordinator.MANAGER_ID}] 文件修改事件触发更新`);
            this.scheduleUpdate();
        });
        
        // 订阅UI状态变化事件
        this.eventBus.subscribe(EventType.UI_REFRESH, () => {
            this.logDebug(`[${UpdateCoordinator.MANAGER_ID}] UI状态变化事件触发更新`);
            this.scheduleUpdate();
        });
        
        // 订阅视图可见性变化事件
        this.eventBus.subscribe(EventType.VIEWPORT_CHANGED, () => {
            this.logDebug(`[${UpdateCoordinator.MANAGER_ID}] 视图可见性变化事件触发更新`);
            this.scheduleViewportReadyUpdate();
        });
    }

    /**
     * 调度更新
     * 使用节流函数执行更新，避免频繁调用
     */
    scheduleUpdate(): void {
        this.throttledUpdate();
    }
    
    /**
     * 使用防抖函数调度更新
     * 等待一段时间后执行更新，合并多次调用
     */
    scheduleDebounceUpdate(): void {
        this.debouncedUpdate().catch(error => {
            this.logDebug(`[${UpdateCoordinator.MANAGER_ID}] 防抖更新失败: ${error}`);
        });
    }
    
    /**
     * 调度初始更新
     * 在插件加载后延迟执行
     */
    scheduleInitialUpdate(): void {
        this.updateScheduler.scheduleUpdate(
            `${UpdateCoordinator.MANAGER_ID}-initial`,
            () => {
                this.safeOperation(
                    () => {
                        if (this.updateCallback) {
                            this.updateCallback();
                        }
                    },
                    'UpdateCoordinator',
                    '执行初始更新失败',
                    ErrorCategory.UI,
                    ErrorLevel.WARNING,
                    { action: 'scheduleInitialUpdate' }
                );
            },
            UpdateCoordinator.INITIAL_UPDATE_DELAY
        );
    }

    /**
     * 调度视口就绪更新
     * 在DOM完全加载后执行
     */
    scheduleViewportReadyUpdate(): void {
        // 清除任何现有的计时器
        if (this.viewportReadyTimer !== null) {
            window.clearTimeout(this.viewportReadyTimer);
        }
        
        // 设置一个更长的延迟，等待Obsidian完全渲染界面
        this.viewportReadyTimer = window.setTimeout(() => {
            this.safeOperation(
                () => {
                    this.logDebug(`[${UpdateCoordinator.MANAGER_ID}] 执行视图准备就绪更新`);
                    // 强制执行立即更新
                    this.immediateUpdate();
                },
                'UpdateCoordinator',
                '执行视图准备就绪更新失败',
                ErrorCategory.UI,
                ErrorLevel.WARNING,
                { action: 'scheduleViewportReadyUpdate' }
            );
        }, UpdateCoordinator.VIEWPORT_READY_DELAY);
    }
    
    /**
     * 立即更新
     * 使用最小延迟执行更新
     */
    immediateUpdate(): void {
        if (this.isUpdating) return;
        
        this.safeOperation(
            () => {
                if (this.updateTimeoutId !== null) {
                    window.clearTimeout(this.updateTimeoutId);
                    this.updateTimeoutId = null;
                }
                
                this.isUpdating = true;
                
                // 使用最小延迟执行更新，避免DOM更新尚未完成的问题
                this.updateTimeoutId = window.setTimeout(() => {
                    if (this.updateCallback) {
                        this.updateCallback();
                    }
                    this.isUpdating = false;
                }, UpdateCoordinator.IMMEDIATE_UPDATE_DELAY);
            },
            'UpdateCoordinator',
            '立即更新失败',
            ErrorCategory.UI,
            ErrorLevel.WARNING,
            { action: 'immediateUpdate' }
        );
    }

    /**
     * 取消所有计划的更新
     */
    cancelScheduledUpdates(): void {
        this.updateScheduler.cancelScheduledUpdate(UpdateCoordinator.MANAGER_ID);
        this.updateScheduler.cancelScheduledUpdate(`${UpdateCoordinator.MANAGER_ID}-initial`);
        
        if (this.viewportReadyTimer !== null) {
            window.clearTimeout(this.viewportReadyTimer);
            this.viewportReadyTimer = null;
        }
    }

    /**
     * 卸载更新协调器
     */
    unload(): void {
        this.logInfo(`[${UpdateCoordinator.MANAGER_ID}] 正在卸载...`);
        
        this.safeOperation(
            () => {
                // 取消所有计划的更新
                this.cancelScheduledUpdates();
                
                // 取消事件订阅
                this.eventBus.unsubscribeAll();
                
                // 清理回调
                this.updateCallback = null;
                this.isUpdating = false;
            },
            'UpdateCoordinator',
            '卸载更新协调器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'unload' }
        );
        
        this.logInfo(`[${UpdateCoordinator.MANAGER_ID}] 卸载完成`);
    }
}