import { injectable, inject } from 'inversify';
import { TYPES } from '../../types/Symbols';
import type { TitleChangerPlugin } from '../../main';
import { Logger } from '../../utils/Logger';
import { ErrorManagerService, ErrorLevel } from '../../services/ErrorManagerService';
import { tryCatchWrapper } from '../../utils/ErrorHelpers';
import { ErrorCategory } from '../../utils/Errors';

/**
 * 视图组件的抽象基类
 * 提供所有视图组件共享的基本结构和方法
 */
@injectable()
export abstract class AbstractView {
    /**
     * 视图启用状态标志
     */
    protected enabled: boolean = true;

    /**
     * 构造函数
     * @param plugin TitleChanger插件实例
     * @param logger 日志服务
     * @param errorManager 错误管理服务
     */
    constructor(
        @inject(TYPES.Plugin) protected plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) protected logger: Logger,
        @inject(TYPES.ErrorManager) protected errorManager: ErrorManagerService
    ) {}

    /**
     * 初始化视图
     * 子类必须实现此方法以注册事件监听器和初始化视图
     */
    abstract initialize(): void;

    /**
     * 更新视图
     * 子类必须实现此方法以根据当前状态更新视图
     */
    abstract updateView(): void;

    /**
     * 卸载视图
     * 子类必须实现此方法以进行清理工作
     */
    abstract unload(): void;
    
    /**
     * 检查视图是否启用
     * @returns 如果视图启用则返回true，否则返回false
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 启用视图
     */
    public enable(): void {
        if (!this.enabled) {
            this.enabled = true;
            this.onEnable();
        }
    }

    /**
     * 禁用视图
     */
    public disable(): void {
        if (this.enabled) {
            this.enabled = false;
            this.onDisable();
        }
    }

    /**
     * 切换视图启用状态
     */
    public toggle(): void {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * 当视图被启用时调用
     * 子类可重写此方法以提供特定行为
     */
    protected onEnable(): void {
        this.logInfo(`${this.constructor.name} 已启用`);
    }

    /**
     * 当视图被禁用时调用
     * 子类可重写此方法以提供特定行为
     */
    protected onDisable(): void {
        this.logInfo(`${this.constructor.name} 已禁用`);
    }
    
    /**
     * 记录信息日志
     * @param message 日志消息
     */
    protected logInfo(message: string): void {
        this.logger.info(message);
    }
    
    /**
     * 记录调试日志
     * @param message 日志消息
     * @param data 可选的调试数据
     */
    protected logDebug(message: string, data?: any): void {
        this.logger.debug(message, data);
    }
    
    /**
     * 安全执行操作，包装异常处理
     * @param operation 要执行的操作函数
     * @param context 操作上下文名称
     * @param errorMessage 错误消息
     * @param category 错误类别
     * @param level 错误级别
     * @param details 错误详情
     * @returns 操作结果，如果操作失败则返回null
     */
    protected safeOperation<T>(
        operation: () => T,
        context: string,
        errorMessage: string,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        level: ErrorLevel = ErrorLevel.WARNING,
        details?: Record<string, any>
    ): T | null {
        return tryCatchWrapper(
            operation,
            context,
            this.errorManager,
            this.logger,
            {
                errorMessage,
                category,
                level,
                details
            }
        );
    }
} 