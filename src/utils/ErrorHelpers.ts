import { ErrorCategory, TitleChangerError, DataError, EditorError, ValidationError } from './errors';
import { ErrorLevel, ErrorManagerService } from '../services/ErrorManagerService';
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

/**
 * 检测并处理潜在性能问题
 * @param operation 要执行的操作
 * @param component 组件名称
 * @param thresholdMs 性能阈值(毫秒)
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @returns 操作结果
 */
export function measurePerformance<T>(
  operation: () => T,
  component: string,
  thresholdMs: number,
  errorManager: ErrorManagerService,
  logger: Logger
): T {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;
  
  if (duration > thresholdMs) {
    logger.warn(`性能警告: ${component} 操作耗时 ${duration.toFixed(2)}ms，超过阈值 ${thresholdMs}ms`);
    errorManager.handleError(
      new TitleChangerError(`操作执行时间过长`, {
        sourceComponent: component,
        category: ErrorCategory.PERFORMANCE,
        details: { duration, thresholdMs, component },
        userVisible: false
      }),
      ErrorLevel.WARNING
    );
  }
  
  return result;
}

/**
 * 检测并处理潜在性能问题（异步版本）
 * @param promise 要执行的异步操作
 * @param component 组件名称
 * @param thresholdMs 性能阈值(毫秒)
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @returns 操作结果的Promise
 */
export async function measureAsyncPerformance<T>(
  promise: Promise<T>,
  component: string,
  thresholdMs: number,
  errorManager: ErrorManagerService,
  logger: Logger
): Promise<T> {
  const start = performance.now();
  const result = await promise;
  const duration = performance.now() - start;
  
  if (duration > thresholdMs) {
    logger.warn(`性能警告: ${component} 异步操作耗时 ${duration.toFixed(2)}ms，超过阈值 ${thresholdMs}ms`);
    errorManager.handleError(
      new TitleChangerError(`异步操作执行时间过长`, {
        sourceComponent: component,
        category: ErrorCategory.PERFORMANCE,
        details: { duration, thresholdMs, component },
        userVisible: false
      }),
      ErrorLevel.WARNING
    );
  }
  
  return result;
}

/**
 * 验证数据并在无效时抛出错误
 * @param data 要验证的数据
 * @param validator 验证函数
 * @param errorMessage 错误消息
 * @throws {ValidationError} 如果数据无效
 */
export function validateData<T>(
  data: T,
  validator: (data: T) => boolean,
  errorMessage: string,
  component: string
): T {
  if (!validator(data)) {
    throw new ValidationError(errorMessage, {
      sourceComponent: component,
      details: { invalidData: data }
    });
  }
  return data;
}

/**
 * 带数据验证的Try-Catch包装器
 * @param operation 要执行的操作
 * @param validator 结果验证函数
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @param options 选项
 * @returns 验证通过的结果或null
 */
export function tryCatchWithValidation<T>(
  operation: () => T,
  validator: (result: T) => boolean,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    validationErrorMessage?: string;
    category?: ErrorCategory;
    level?: ErrorLevel;
    userVisible?: boolean;
    details?: Record<string, unknown>;
  }
): T | null {
  try {
    const result = operation();
    if (!validator(result)) {
      throw new ValidationError(
        options?.validationErrorMessage || '数据验证失败',
        {
          sourceComponent: component,
          details: { invalidResult: result, ...options?.details }
        }
      );
    }
    return result;
  } catch (error) {
    if (error instanceof ValidationError) {
      errorManager.handleError(error, options?.level || ErrorLevel.WARNING);
    } else {
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
    }
    return null;
  }
}

/**
 * 编辑器特定错误处理包装器
 * @param operation 要执行的编辑器相关操作
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @param options 选项
 * @returns 操作结果或null
 */
export function handleEditorOperation<T>(
  operation: () => T,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    userVisible?: boolean;
    details?: Record<string, unknown>;
  }
): T | null {
  try {
    return operation();
  } catch (error) {
    const errorObj = new EditorError(
      options?.errorMessage || '编辑器操作失败',
      {
        sourceComponent: component,
        details: { ...options?.details, originalError: error },
        userVisible: options?.userVisible ?? true
      }
    );
    
    errorManager.handleError(errorObj, ErrorLevel.ERROR);
    return null;
  }
}

/**
 * 数据处理错误处理包装器
 * @param operation 要执行的数据处理操作
 * @param component 组件名称
 * @param errorManager 错误管理服务
 * @param logger 日志服务
 * @param options 选项
 * @returns 操作结果或null
 */
export function handleDataOperation<T>(
  operation: () => T,
  component: string,
  errorManager: ErrorManagerService,
  logger: Logger,
  options?: {
    errorMessage?: string;
    userVisible?: boolean;
    details?: Record<string, unknown>;
  }
): T | null {
  try {
    return operation();
  } catch (error) {
    const errorObj = new DataError(
      options?.errorMessage || '数据处理操作失败',
      {
        sourceComponent: component,
        details: { ...options?.details, originalError: error },
        userVisible: options?.userVisible ?? false
      }
    );
    
    errorManager.handleError(errorObj, ErrorLevel.WARNING);
    return null;
  }
}

/**
 * 错误处理装饰器 - 用于类方法
 * 自动包装方法并进行错误处理
 * 
 * @param component 组件名称，如果不提供则使用类名
 * @param options 错误处理选项
 */
export function ErrorHandler(
    options?: {
        errorMessage?: string;
        category?: ErrorCategory;
        level?: ErrorLevel;
        userVisible?: boolean;
    }
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const className = target.constructor.name;
        const component = options?.errorMessage ? className : className + '.' + propertyKey;

        descriptor.value = function(...args: any[]) {
            try {
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        // 检查是否有errorManager和logger
                        const hasErrorManager = this && 'errorManager' in this;
                        const hasLogger = this && 'logger' in this;
                        
                        if (hasErrorManager && hasLogger) {
                            const errorObj = convertToTitleChangerError(
                                error,
                                component,
                                options?.category || ErrorCategory.UNKNOWN,
                                options?.userVisible ?? false
                            );
                            (this as any).errorManager.handleError(
                                errorObj,
                                options?.level || ErrorLevel.ERROR
                            );
                            (this as any).logger.error(
                                options?.errorMessage || `${propertyKey} 方法执行失败`,
                                { error: extractErrorDetails(error), args }
                            );
                        } else {
                            console.error(`${component}: ${options?.errorMessage || `${propertyKey} 方法执行失败`}`, error);
                        }
                        return null;
                    });
                }
                return result;
            } catch (error) {
                // 检查是否有errorManager和logger
                const hasErrorManager = this && 'errorManager' in this;
                const hasLogger = this && 'logger' in this;
                
                if (hasErrorManager && hasLogger) {
                    const errorObj = convertToTitleChangerError(
                        error,
                        component,
                        options?.category || ErrorCategory.UNKNOWN,
                        options?.userVisible ?? false
                    );
                    (this as any).errorManager.handleError(
                        errorObj,
                        options?.level || ErrorLevel.ERROR
                    );
                    (this as any).logger.error(
                        options?.errorMessage || `${propertyKey} 方法执行失败`,
                        { error: extractErrorDetails(error), args }
                    );
                } else {
                    console.error(`${component}: ${options?.errorMessage || `${propertyKey} 方法执行失败`}`, error);
                }
                return null;
            }
        };

        return descriptor;
    };
} 