import { App, EventRef } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { 
    EventType, 
    IEvent, 
    EventCallback, 
    IEventBusService 
} from '../types/ObsidianExtensions';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, EventError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface Subscription {
    id: string;
    type: EventType;
    callback: EventCallback;
}

/**
 * 事件总线服务
 * 负责应用内事件的发布与订阅，解耦系统组件
 */
@injectable()
export class EventBusService implements IEventBusService {
    private subscriptions: Map<string, Subscription> = new Map();
    private subscriptionsByType: Map<EventType, Set<string>> = new Map();
    private obsidianEventRefs: EventRef[] = [];

    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {
        this.initializeEventTypes();
    }

    /**
     * 初始化所有事件类型
     */
    private initializeEventTypes(): void {
        Object.values(EventType).forEach(type => {
            this.subscriptionsByType.set(type as EventType, new Set<string>());
        });
    }

    /**
     * 发布事件
     * @param event 事件对象
     */
    public publish<T extends IEvent>(event: T): void {
        try {
            // 添加时间戳（如果没有）
            if (!event.timestamp) {
                event.timestamp = Date.now();
            }

            // 获取该类型的所有订阅
            const subscriptionIds = this.subscriptionsByType.get(event.type);
            if (!subscriptionIds || subscriptionIds.size === 0) {
                this.logger.debug(`事件 ${event.type} 没有订阅者`);
                return;
            }

            // 通知所有订阅者
            this.logger.debug(`发布事件: ${event.type} to ${subscriptionIds.size} 订阅者`);
            subscriptionIds.forEach(id => {
                const subscription = this.subscriptions.get(id);
                if (subscription) {
                    try {
                        subscription.callback(event);
                    } catch (error) {
                        this.errorManager.handleError(
                            new EventError(`处理事件订阅回调时出错: ${event.type}`, {
                                sourceComponent: this.constructor.name,
                                details: {
                                    eventType: event.type,
                                    subscriptionId: id,
                                    error
                                },
                                userVisible: false
                            }),
                            ErrorLevel.WARNING
                        );
                    }
                }
            });
        } catch (error) {
            this.errorManager.handleError(
                new EventError(`发布事件时出错: ${event.type}`, {
                    sourceComponent: this.constructor.name,
                    details: {
                        eventType: event.type,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
        }
    }

    /**
     * 订阅事件
     * @param type 事件类型
     * @param callback 回调函数
     * @returns 订阅ID
     */
    public subscribe<T extends IEvent>(type: EventType, callback: EventCallback<T>): string {
        try {
            const id = uuidv4();
            const subscription: Subscription = {
                id,
                type,
                callback: callback as EventCallback
            };

            // 保存订阅
            this.subscriptions.set(id, subscription);
            
            // 添加到类型索引
            const typeSubscriptions = this.subscriptionsByType.get(type) || new Set<string>();
            typeSubscriptions.add(id);
            this.subscriptionsByType.set(type, typeSubscriptions);
            
            this.logger.debug(`新订阅注册: ${type}, ID: ${id}`);
            return id;
        } catch (error) {
            this.errorManager.handleError(
                new EventError(`订阅事件时出错: ${type}`, {
                    sourceComponent: this.constructor.name,
                    details: {
                        eventType: type,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
            return '';
        }
    }

    /**
     * 取消订阅
     * @param subscriptionId 订阅ID
     * @returns 是否成功取消
     */
    public unsubscribe(subscriptionId: string): boolean {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription) {
                this.logger.debug(`未找到订阅: ${subscriptionId}`);
                return false;
            }

            // 从类型索引中移除
            const typeSubscriptions = this.subscriptionsByType.get(subscription.type);
            if (typeSubscriptions) {
                typeSubscriptions.delete(subscriptionId);
            }

            // 从主索引中移除
            this.subscriptions.delete(subscriptionId);
            
            this.logger.debug(`取消订阅: ${subscriptionId}, 类型: ${subscription.type}`);
            return true;
        } catch (error) {
            this.errorManager.handleError(
                new EventError(`取消订阅时出错: ${subscriptionId}`, {
                    sourceComponent: this.constructor.name,
                    details: {
                        subscriptionId,
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.WARNING
            );
            return false;
        }
    }

    /**
     * 取消所有订阅
     */
    public unsubscribeAll(): void {
        try {
            this.subscriptions.clear();
            
            // 清空所有类型订阅
            this.subscriptionsByType.forEach((subscriptions, type) => {
                subscriptions.clear();
            });
            
            // 取消所有Obsidian事件监听
            this.obsidianEventRefs.forEach(ref => {
                this.app.workspace.offref(ref);
            });
            this.obsidianEventRefs = [];
            
            this.logger.debug('已取消所有订阅');
        } catch (error) {
            this.errorManager.handleError(
                new EventError('取消所有订阅时出错', {
                    sourceComponent: this.constructor.name,
                    details: {
                        error
                    },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
        }
    }

    /**
     * 桥接Obsidian事件到事件总线
     * 将Obsidian的内置事件转发到事件总线系统
     */
    public bridgeObsidianEvents(): void {
        // 注册文件事件
        const fileCreatedRef = this.app.vault.on('create', (file) => {
            this.publish({
                type: EventType.FILE_CREATED,
                payload: { file },
                source: 'obsidian.vault'
            });
        });
        this.obsidianEventRefs.push(fileCreatedRef);

        const fileRenamedRef = this.app.vault.on('rename', (file, oldPath) => {
            this.publish({
                type: EventType.FILE_RENAMED,
                payload: { file, oldPath },
                source: 'obsidian.vault'
            });
        });
        this.obsidianEventRefs.push(fileRenamedRef);

        const fileDeletedRef = this.app.vault.on('delete', (file) => {
            this.publish({
                type: EventType.FILE_DELETED,
                payload: { file },
                source: 'obsidian.vault'
            });
        });
        this.obsidianEventRefs.push(fileDeletedRef);

        const fileModifiedRef = this.app.vault.on('modify', (file) => {
            this.publish({
                type: EventType.FILE_MODIFIED,
                payload: { file },
                source: 'obsidian.vault'
            });
        });
        this.obsidianEventRefs.push(fileModifiedRef);

        // 监听工作区布局变化
        const layoutChangedRef = this.app.workspace.on('layout-change', () => {
            this.publish({
                type: EventType.UI_REFRESH,
                source: 'obsidian.workspace'
            });
        });
        this.obsidianEventRefs.push(layoutChangedRef);

        // 监听活动叶子变化
        const activeLeafChangedRef = this.app.workspace.on('active-leaf-change', () => {
            this.publish({
                type: EventType.UI_REFRESH,
                source: 'obsidian.workspace'
            });
        });
        this.obsidianEventRefs.push(activeLeafChangedRef);

        this.logger.debug('已桥接Obsidian事件到事件总线');
    }
} 