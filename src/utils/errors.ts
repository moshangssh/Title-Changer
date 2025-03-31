import { ErrorLevel } from '../services/error-manager.service';

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  CONFIG = 'CONFIG',     // 配置相关错误
  FILE = 'FILE',       // 文件操作错误
  REGEX = 'REGEX',      // 正则表达式错误
  UI = 'UI',         // UI交互错误
  NETWORK = 'NETWORK',    // 网络相关错误
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