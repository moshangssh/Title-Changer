import { ErrorCategory, TitleChangerError } from './errors';
import { ErrorLevel, ErrorManagerService } from '../services/ErrorManagerService';
import { Logger } from './logger';
import { convertToTitleChangerError, extractErrorDetails } from './ErrorHelpers';

/**
 * 错误处理配置接口
 */
export interface ErrorHandlerOptions {
  // 错误消息
  errorMessage?: string;
  // 错误分类
  category?: ErrorCategory;
  // 错误级别
  level?: ErrorLevel;
  // 是否应向用户显示
  userVisible?: boolean;
  // 错误详情
  details?: Record<string, unknown>;
  // 是否在控制台输出错误
  consoleOutput?: boolean;
  // 默认返回值（在错误发生时）
  defaultValue?: any;
  // 是否重新抛出错误（不推荐）
  rethrow?: boolean;
}

/**
 * 错误处理装饰器
 * 用于包装同步方法，自动处理错误
 * 
 * @example
 * ```typescript
 * @ErrorHandled({
 *   errorMessage: '处理文件标题时发生错误',
 *   category: ErrorCategory.DATA,
 *   level: ErrorLevel.WARNING
 * })
 * processFileTitle(file: TFile): string | null {
 *   // 业务逻辑
 *   return this.cacheManager.processFile(file);
 * }
 * ```
 */
export function ErrorHandled(options?: ErrorHandlerOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const component = className + '.' + propertyKey;

    descriptor.value = function(...args: any[]) {
      try {
        return originalMethod.apply(this, args);
      } catch (error) {
        // 处理错误
        handleMethodError.call(
          this, 
          error, 
          component, 
          options || {}, 
          propertyKey, 
          args
        );
        
        // 默认返回值或null
        if (options?.defaultValue !== undefined) {
          return options.defaultValue;
        }
        return null;
      }
    };

    return descriptor;
  };
}

/**
 * 异步错误处理装饰器
 * 用于包装异步方法，自动处理错误
 * 
 * @example
 * ```typescript
 * @AsyncErrorHandled({
 *   errorMessage: '加载文件数据时发生错误',
 *   category: ErrorCategory.IO,
 *   level: ErrorLevel.ERROR
 * })
 * async loadFileData(path: string): Promise<FileData | null> {
 *   // 异步业务逻辑
 *   const data = await this.fileService.readFile(path);
 *   return this.processData(data);
 * }
 * ```
 */
export function AsyncErrorHandled(options?: ErrorHandlerOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const component = className + '.' + propertyKey;

    descriptor.value = async function(...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        // 处理错误
        handleMethodError.call(
          this, 
          error, 
          component, 
          options || {}, 
          propertyKey, 
          args
        );
        
        // 默认返回值或null
        if (options?.defaultValue !== undefined) {
          return options.defaultValue;
        }
        return null;
      }
    };

    return descriptor;
  };
}

/**
 * 内部辅助方法：处理方法错误
 */
function handleMethodError(
  this: any,
  error: unknown,
  component: string,
  options: ErrorHandlerOptions,
  propertyKey: string,
  args: any[]
) {
  // 检查是否有errorManager和logger
  const hasErrorManager = this && 'errorManager' in this;
  const hasLogger = this && 'logger' in this;
  
  // 创建错误对象
  const errorObj = convertToTitleChangerError(
    error,
    component,
    options.category || ErrorCategory.UNKNOWN,
    options.userVisible ?? false
  );
  
  // 添加详细信息
  if (options.details) {
    errorObj.details = { ...errorObj.details, ...options.details };
  }
  
  // 使用errorManager处理错误
  if (hasErrorManager) {
    this.errorManager.handleError(
      errorObj,
      options.level || ErrorLevel.ERROR
    );
  }
  
  // 日志记录
  if (hasLogger) {
    this.logger.error(
      options.errorMessage || `${propertyKey} 方法执行失败`,
      { error: extractErrorDetails(error), args, ...options.details }
    );
  }
  
  // 控制台输出（如果配置或没有logger）
  if (options.consoleOutput || !hasLogger) {
    console.error(`${component}: ${options.errorMessage || `${propertyKey} 方法执行失败`}`, error);
  }
  
  // 重新抛出错误（如果配置）
  if (options.rethrow) {
    throw errorObj;
  }
}

/**
 * 类方法错误处理装饰器
 * 用于装饰整个类，给类中所有方法添加错误处理
 * 
 * @example
 * ```typescript
 * @ClassErrorHandled({
 *   errorMessage: '标题服务操作错误',
 *   category: ErrorCategory.SERVICE,
 *   level: ErrorLevel.ERROR
 * })
 * export class TitleService {
 *   // 所有方法都会自动处理错误
 *   processTitle(title: string): string {
 *     // 业务逻辑
 *   }
 * }
 * ```
 */
export function ClassErrorHandled(options?: ErrorHandlerOptions) {
  return function<T extends { new (...args: any[]): {} }>(constructor: T) {
    // 获取类的原型
    const prototype = constructor.prototype;
    
    // 遍历所有原型属性
    const propertyNames = Object.getOwnPropertyNames(prototype);
    for (const name of propertyNames) {
      // 跳过构造函数和非函数属性
      if (name === 'constructor' || typeof prototype[name] !== 'function') {
        continue;
      }
      
      // 获取属性描述符
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (!descriptor || !descriptor.value) {
        continue;
      }
      
      // 检查方法是否为异步函数
      const isAsync = descriptor.value.constructor.name === 'AsyncFunction';
      
      // 应用适当的装饰器
      if (isAsync) {
        AsyncErrorHandled(options)(prototype, name, descriptor);
      } else {
        ErrorHandled(options)(prototype, name, descriptor);
      }
      
      // 重新定义属性描述符
      Object.defineProperty(prototype, name, descriptor);
    }
    
    return constructor;
  };
}

/**
 * 兼容旧版错误处理装饰器
 * 为了兼容性保留，但建议使用新的 ErrorHandled 装饰器
 * @deprecated 请使用 ErrorHandled 或 AsyncErrorHandled
 */
export function ErrorHandler(options?: Omit<ErrorHandlerOptions, 'details' | 'consoleOutput' | 'defaultValue' | 'rethrow'>) {
  return ErrorHandled({
    ...options,
    consoleOutput: true // 旧版默认在控制台输出
  });
} 