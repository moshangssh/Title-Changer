import { App, Notice } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { TitleChangerPlugin } from '../main';

export enum ErrorLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
    CRITICAL = 4
}

export interface ErrorContext {
    message: string;
    context?: Record<string, any>;
    stack?: string;
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
    handleError(error: Error | string, level: ErrorLevel, context?: Record<string, any>): void {
        const errorContext: ErrorContext = {
            message: error instanceof Error ? error.message : error,
            context,
            stack: error instanceof Error ? error.stack : undefined
        };

        // 记录错误
        this.logError(level, errorContext);

        // 对于错误和严重错误，显示给用户
        if (level >= ErrorLevel.ERROR) {
            this.notifyUser(errorContext);
        }
    }

    /**
     * 记录错误
     */
    private logError(level: ErrorLevel, context: ErrorContext): void {
        const timestamp = new Date().toISOString();
        const levelName = ErrorLevel[level];
        
        console.group(`[Title Changer] ${levelName} - ${timestamp}`);
        console.error(context.message);
        
        if (context.context) {
            console.error('Context:', context.context);
        }
        
        if (context.stack) {
            console.error('Stack:', context.stack);
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