import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper } from '../utils/error-helpers';

/**
 * 更新调度器 - 处理视图更新的调度和防抖
 */
@injectable()
export class UpdateScheduler {
    /**
     * 存储定时器ID的Map
     * @private
     */
    private updateTimers: Map<string, number> = new Map();
    
    /**
     * 默认防抖间隔（毫秒）
     * @private
     */
    private static readonly DEFAULT_INTERVAL = 500;
    
    constructor(
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}
    
    /**
     * 安排延迟更新（防抖）
     * @param id 更新ID，用于标识不同的更新任务
     * @param callback 更新回调函数
     * @param interval 防抖间隔（毫秒）
     */
    scheduleUpdate(
        id: string, 
        callback: () => void, 
        interval: number = UpdateScheduler.DEFAULT_INTERVAL
    ): void {
        tryCatchWrapper(
            () => {
                // 取消已有计时器
                this.cancelScheduledUpdate(id);
                
                // 设置新计时器
                const timerId = window.setTimeout(() => {
                    tryCatchWrapper(
                        () => {
                            callback();
                            this.updateTimers.delete(id);
                        },
                        'UpdateScheduler',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: `执行 ${id} 的回调函数失败`,
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            details: { updateId: id }
                        }
                    );
                }, interval);
                
                this.updateTimers.set(id, timerId);
                this.logger.debug(`已调度 ${id} 的更新，将在 ${interval}ms 后执行`);
            },
            'UpdateScheduler',
            this.errorManager,
            this.logger,
            {
                errorMessage: `调度 ${id} 的更新失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { updateId: id, interval }
            }
        );
    }
    
    /**
     * 取消已计划的更新
     * @param id 更新ID
     */
    cancelScheduledUpdate(id: string): void {
        tryCatchWrapper(
            () => {
                const timerId = this.updateTimers.get(id);
                if (timerId !== undefined) {
                    window.clearTimeout(timerId);
                    this.updateTimers.delete(id);
                    this.logger.debug(`已取消 ${id} 的调度更新`);
                }
            },
            'UpdateScheduler',
            this.errorManager,
            this.logger,
            {
                errorMessage: `取消 ${id} 的更新失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { updateId: id }
            }
        );
    }
    
    /**
     * 立即执行更新
     * @param id 更新ID
     * @param callback 更新回调函数
     */
    immediateUpdate(id: string, callback: () => void): void {
        tryCatchWrapper(
            () => {
                // 取消已计划的更新
                this.cancelScheduledUpdate(id);
                
                // 立即执行回调
                callback();
                
                this.logger.debug(`已立即执行 ${id} 的更新`);
            },
            'UpdateScheduler',
            this.errorManager,
            this.logger,
            {
                errorMessage: `立即执行 ${id} 的更新失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { updateId: id }
            }
        );
    }
    
    /**
     * 延迟立即更新（先执行一次更新，然后在指定延迟后再次执行）
     * 用于确保UI状态完全更新的场景
     * @param id 更新ID
     * @param callback 更新回调函数
     * @param delay 延迟时间（毫秒）
     */
    immediateAndDelayedUpdate(id: string, callback: () => void, delay: number = 150): void {
        tryCatchWrapper(
            () => {
                // 立即执行一次
                this.immediateUpdate(id, callback);
                
                // 延迟再次执行
                const delayedId = `${id}-delayed`;
                this.scheduleUpdate(delayedId, callback, delay);
            },
            'UpdateScheduler',
            this.errorManager,
            this.logger,
            {
                errorMessage: `延迟立即更新 ${id} 失败`,
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                details: { updateId: id, delay }
            }
        );
    }
    
    /**
     * 清除所有计时器
     */
    clearAll(): void {
        tryCatchWrapper(
            () => {
                for (const [id, timerId] of this.updateTimers.entries()) {
                    window.clearTimeout(timerId);
                    this.logger.debug(`已清除 ${id} 的更新计时器`);
                }
                this.updateTimers.clear();
                this.logger.info(`已清除所有更新计时器`);
            },
            'UpdateScheduler',
            this.errorManager,
            this.logger,
            {
                errorMessage: '清除所有更新计时器失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING
            }
        );
    }
} 