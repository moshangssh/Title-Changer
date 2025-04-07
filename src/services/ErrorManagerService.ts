import { App, Notice } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { TitleChangerPlugin } from '../main';
import { ErrorCategory, TitleChangerError } from '../utils/errors';

export enum ErrorLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
    CRITICAL = 4
}

export interface ErrorContext {
    message: string;
    category: ErrorCategory;
    sourceComponent: string;
    details?: Record<string, unknown>; // 使用 unknown 代替 any
    stack?: string;
    userVisible?: boolean; // 是否需要通知用户
}

@injectable()
export class ErrorManagerService {
    private readonly app: App;

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.App) app: App
    ) {
        this.app = app;
    }

    /**
     * 处理错误
     * @param error 错误对象
     * @param level 错误级别
     * @param context 错误上下文
     */
    handleError(error: Error | TitleChangerError | string, level?: ErrorLevel, context?: Record<string, unknown>): void {
        let errorObj: ErrorContext;
        
        if (error instanceof TitleChangerError) {
            errorObj = {
                message: error.message,
                category: error.category,
                sourceComponent: error.sourceComponent,
                details: error.details,
                stack: error.stack,
                userVisible: error.userVisible
            };
        } else {
            // 处理普通错误或字符串
            const defaultContext: ErrorContext = {
                message: error instanceof Error ? error.message : String(error),
                category: ErrorCategory.UNKNOWN,
                sourceComponent: typeof context?.sourceComponent === 'string' ? context.sourceComponent : 'unknown',
                stack: error instanceof Error ? error.stack : undefined,
                userVisible: level !== undefined && level >= ErrorLevel.ERROR
            };
            
            errorObj = { 
                ...defaultContext, 
                ...(context ? { details: context } : {}) 
            };
        }
        
        // 记录错误
        this.logError(level || ErrorLevel.ERROR, errorObj);
        
        // 用户通知
        // 检查是否需要抑制通知
        const suppressNotification = context?.suppressNotification === true;
        if (errorObj.userVisible && !suppressNotification) {
            this.notifyUser(errorObj);
        }
    }

    /**
     * 记录错误
     */
    private logError(level: ErrorLevel, context: ErrorContext): void {
        const timestamp = new Date().toISOString();
        const levelName = ErrorLevel[level];
        
        console.group(`[Title Changer] [${levelName}] [${context.category}] - ${timestamp}`);
        console.error(`${context.message} (来源: ${context.sourceComponent})`);
        
        if (context.details) {
            console.error('详情:', context.details);
        }
        
        if (context.stack) {
            console.error('堆栈:', context.stack);
        }
        
        console.groupEnd();
    }

    /**
     * 通知用户
     */
    private notifyUser(context: ErrorContext): void {
        const message = `Title Changer 错误: ${context.message}`;
        new Notice(message, 5000);
    }
} 