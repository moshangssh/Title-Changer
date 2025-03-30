import { injectable } from 'inversify';

/**
 * 日志记录服务
 */
@injectable()
export class Logger {
    /**
     * 记录错误日志
     */
    error(message: string, context?: Record<string, unknown>): void {
        console.error(`Title Changer: ${message}`, context);
    }

    /**
     * 记录警告日志
     */
    warn(message: string, context?: Record<string, unknown>): void {
        console.warn(`Title Changer: ${message}`, context);
    }

    /**
     * 记录信息日志
     */
    info(message: string, context?: Record<string, unknown>): void {
        console.info(`Title Changer: ${message}`, context);
    }

    /**
     * 记录调试日志
     */
    debug(message: string, context?: Record<string, unknown>): void {
        console.debug(`Title Changer: ${message}`, context);
    }
} 