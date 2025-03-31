import { ErrorCategory, TitleChangerError } from './errors';
import { ErrorLevel, ErrorManagerService } from '../services/error-manager.service';
import { Logger } from './logger';

/**
 * 同步操作的错误处理包装器
 * @param operation 要执行的操作
 * @param component 操作所属组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志记录服务
 * @param options 可选配置
 * @returns 操作结果或null（出错时）
 */
export function tryCatchWrapper<T>(
  operation: () => T,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    category?: ErrorCategory;
    level?: ErrorLevel;
    userVisible?: boolean;
    details?: Record<string, unknown>;
  }
): T | null {
  try {
    return operation();
  } catch (error) {
    const errorObj = new TitleChangerError(
      options?.errorMessage || '操作失败',
      {
        sourceComponent: component,
        category: options?.category || ErrorCategory.UNKNOWN,
        details: { ...options?.details, originalError: error },
        userVisible: options?.userVisible ?? false
      }
    );
    
    errorManager.handleError(errorObj, options?.level || ErrorLevel.ERROR);
    return null;
  }
}

/**
 * 异步操作的错误处理包装器
 * @param promise 要执行的异步操作
 * @param component 操作所属组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志记录服务
 * @param options 可选配置
 * @returns 异步操作结果或null（出错时）
 */
export async function asyncTryCatch<T>(
  promise: Promise<T>,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    category?: ErrorCategory;
    level?: ErrorLevel;
    userVisible?: boolean;
    details?: Record<string, unknown>;
  }
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    const errorObj = new TitleChangerError(
      options?.errorMessage || '异步操作失败',
      {
        sourceComponent: component,
        category: options?.category || ErrorCategory.UNKNOWN,
        details: { ...options?.details, originalError: error },
        userVisible: options?.userVisible ?? false
      }
    );
    
    errorManager.handleError(errorObj, options?.level || ErrorLevel.ERROR);
    return null;
  }
}

/**
 * 类型守卫：检查对象是否为Error类型
 * @param obj 要检查的对象
 * @returns 是否为Error类型
 */
export function isError(obj: unknown): obj is Error {
  return obj instanceof Error;
}

/**
 * 将任意错误对象转换为TitleChangerError
 * @param error 原始错误对象
 * @param component 组件名称
 * @param category 错误分类
 * @param userVisible 是否应向用户显示
 * @returns TitleChangerError实例
 */
export function convertToTitleChangerError(
  error: unknown,
  component: string,
  category: ErrorCategory = ErrorCategory.UNKNOWN,
  userVisible: boolean = false
): TitleChangerError {
  if (error instanceof TitleChangerError) {
    return error;
  }
  
  const message = isError(error) 
    ? error.message 
    : (typeof error === 'string' ? error : '未知错误');
  
  return new TitleChangerError(message, {
    sourceComponent: component,
    category,
    details: { originalError: error },
    userVisible
  });
}

/**
 * 提取错误的详细信息
 * @param error 错误对象
 * @returns 结构化的错误信息
 */
export function extractErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof TitleChangerError) {
    return {
      name: error.name,
      message: error.message,
      category: error.category,
      sourceComponent: error.sourceComponent,
      details: error.details,
      stack: error.stack
    };
  } else if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  } else if (typeof error === 'string') {
    return { message: error };
  } else {
    return { unknown: String(error) };
  }
}

/**
 * 处理特定类型的错误
 * @param error 错误对象
 * @param handlers 错误处理器映射
 * @param defaultHandler 默认处理器
 */
export function handleSpecificErrors<T>(
  error: unknown,
  handlers: Partial<Record<ErrorCategory, (e: TitleChangerError) => T>>,
  defaultHandler?: (e: unknown) => T
): T | undefined {
  if (error instanceof TitleChangerError) {
    const handler = handlers[error.category];
    if (handler) {
      return handler(error);
    }
  }
  
  if (defaultHandler) {
    return defaultHandler(error);
  }
  
  return undefined;
}

/**
 * 记录错误但不抛出异常
 * @param fn 要执行的函数
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @param options 选项
 * @returns 原始函数的返回值或默认值
 */
export function logErrorsWithoutThrowing<T>(
  fn: () => T,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    category?: ErrorCategory;
    level?: ErrorLevel;
    defaultValue?: T;
    details?: Record<string, unknown>;
  }
): T {
  try {
    return fn();
  } catch (error) {
    const errorObj = convertToTitleChangerError(
      error,
      component,
      options?.category,
      false // 不通知用户
    );
    
    errorManager.handleError(
      errorObj, 
      options?.level || ErrorLevel.WARNING,
      { suppressNotification: true, ...options?.details }
    );
    
    logger.warn(
      options?.errorMessage || '操作失败但已被安全处理',
      { error: extractErrorDetails(error), ...options?.details }
    );
    
    // 返回默认值或类型的默认值
    return options?.defaultValue !== undefined ? options.defaultValue : (undefined as unknown as T);
  }
}

/**
 * 安全创建正则表达式，捕获并处理语法错误
 * @param pattern 正则表达式模式
 * @param flags 正则表达式标志
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @returns 正则表达式对象或null
 */
export function safeRegexCreation(
  pattern: string,
  flags: string,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger
): RegExp | null {
  return tryCatchWrapper(
    () => new RegExp(pattern, flags),
    component,
    errorManager,
    logger,
    {
      errorMessage: `无效的正则表达式: ${pattern}`,
      category: ErrorCategory.REGEX,
      level: ErrorLevel.WARNING,
      userVisible: true,
      details: { pattern, flags }
    }
  );
}

/**
 * 安全执行正则表达式匹配操作
 * @param regex 正则表达式
 * @param input 输入字符串
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @returns 匹配结果或null
 */
export function safeRegexExecution(
  regex: RegExp,
  input: string,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger
): RegExpExecArray | null {
  return tryCatchWrapper(
    () => regex.exec(input),
    component,
    errorManager,
    logger,
    {
      errorMessage: `正则表达式执行失败: ${regex}`,
      category: ErrorCategory.REGEX,
      level: ErrorLevel.WARNING,
      details: { regex: regex.toString(), input }
    }
  );
} 