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