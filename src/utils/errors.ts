import { ErrorLevel } from '../services/ErrorManagerService';

/**
 * 错误类别枚举
 */
export enum ErrorCategory {
  GENERAL = '一般错误',
  DECORATION = '装饰错误',
  VIEW = '视图错误',
  EDITOR = '编辑器错误',
  SERVICE = '服务错误',
  STATE = '状态管理错误',
  DOM = 'DOM操作错误',
  FILE = '文件操作错误',
  CACHE = '缓存错误',
  SETTINGS = '设置错误',
  CONFIG = 'CONFIG',     // 配置相关错误
  REGEX = 'REGEX',      // 正则表达式错误
  UI = 'UI',         // UI交互错误
  NETWORK = 'NETWORK',    // 网络相关错误
  PARSER = 'PARSER',    // 解析错误
  DATA = 'DATA',      // 数据处理错误
  LIFECYCLE = 'LIFECYCLE', // 生命周期错误
  PERFORMANCE = 'PERFORMANCE', // 性能相关错误
  API = 'API',       // API调用错误
  VALIDATION = 'VALIDATION', // 数据验证错误
  EVENT = 'EVENT',     // 事件处理错误
  UNKNOWN = 'UNKNOWN'     // 未知错误
}

/**
 * Title-Changer 基础错误类
 */
export class TitleChangerError extends Error {
  category: ErrorCategory;
  sourceComponent: string;
  details?: Record<string, unknown>;
  userVisible: boolean;
  
  constructor(message: string, options: {
    category: ErrorCategory;
    sourceComponent: string;
    details?: Record<string, unknown>;
    userVisible?: boolean;
  }) {
    super(message);
    this.name = 'TitleChangerError';
    this.category = options.category;
    this.sourceComponent = options.sourceComponent;
    this.details = options.details;
    this.userVisible = options.userVisible ?? false;
  }
}

/**
 * 配置错误
 */
export class ConfigError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.CONFIG
    });
    this.name = 'ConfigError';
  }
}

/**
 * 文件错误
 */
export class FileError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.FILE
    });
    this.name = 'FileError';
  }
}

/**
 * 正则表达式错误
 */
export class RegexError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.REGEX
    });
    this.name = 'RegexError';
  }
}

/**
 * UI错误
 */
export class UIError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.UI
    });
    this.name = 'UIError';
  }
}

/**
 * 视图错误
 */
export class ViewError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.VIEW
    });
    this.name = 'ViewError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.NETWORK
    });
    this.name = 'NetworkError';
  }
}

/**
 * 解析错误
 */
export class ParserError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.PARSER
    });
    this.name = 'ParserError';
  }
}

/**
 * 数据处理错误
 */
export class DataError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.DATA
    });
    this.name = 'DataError';
  }
}

/**
 * 生命周期错误
 */
export class LifecycleError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.LIFECYCLE
    });
    this.name = 'LifecycleError';
  }
}

/**
 * 性能相关错误
 */
export class PerformanceError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.PERFORMANCE
    });
    this.name = 'PerformanceError';
  }
}

/**
 * 编辑器相关错误
 */
export class EditorError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.EDITOR
    });
    this.name = 'EditorError';
  }
}

/**
 * 装饰/渲染相关错误
 */
export class DecorationError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.DECORATION
    });
    this.name = 'DecorationError';
  }
}

/**
 * API调用错误
 */
export class ApiError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.API
    });
    this.name = 'ApiError';
  }
}

/**
 * 数据验证错误
 */
export class ValidationError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.VALIDATION
    });
    this.name = 'ValidationError';
  }
}

/**
 * 缓存相关错误
 */
export class CacheError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.CACHE
    });
    this.name = 'CacheError';
  }
}

/**
 * 事件相关错误
 */
export class EventError extends TitleChangerError {
  constructor(message: string, options: Omit<ConstructorParameters<typeof TitleChangerError>[1], 'category'>) {
    super(message, {
      ...options,
      category: ErrorCategory.EVENT
    });
    this.name = 'EventError';
  }
} 