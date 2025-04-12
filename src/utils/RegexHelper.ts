/**
 * 正则表达式辅助函数
 * 提供安全的正则表达式创建和执行功能
 */

/**
 * 安全创建正则表达式
 * @param pattern 正则表达式模式
 * @param flags 正则表达式标志
 * @returns 包含正则表达式对象或错误信息的结果对象
 */
export function createSafeRegex(pattern: string, flags: string): { 
  regex: RegExp | null; 
  error: string | null;
} {
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { regex: null, error: errorMessage };
  }
}

/**
 * 安全执行正则表达式
 * @param regex 正则表达式对象
 * @param text 要匹配的文本
 * @returns 包含匹配结果或错误信息的结果对象
 */
export function executeSafeRegex(
  regex: RegExp, 
  text: string
): { matches: RegExpMatchArray | null; error: string | null; } {
  try {
    return { matches: text.match(regex), error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { matches: null, error: errorMessage };
  }
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  REGEX_SYNTAX = 'REGEX_SYNTAX',      // 正则表达式语法错误
  REGEX_EXECUTION = 'REGEX_EXECUTION', // 正则表达式执行错误
  REGEX_NO_MATCH = 'REGEX_NO_MATCH',   // 正则表达式没有匹配
  REGEX_NO_CAPTURE = 'REGEX_NO_CAPTURE', // 正则表达式没有捕获组
  GENERAL = 'GENERAL'                // 一般错误
}

/**
 * 错误处理级别
 */
export enum ErrorSeverity {
  INFO = 'INFO',        // 信息，不影响功能
  WARNING = 'WARNING',  // 警告，功能可能受影响
  ERROR = 'ERROR'       // 错误，功能不可用
}

/**
 * 错误上下文接口
 */
export interface RegexErrorContext {
  pattern?: string;     // 正则表达式模式
  input?: string;       // 输入文本
  flags?: string;       // 正则表达式标志
  component?: string;   // 相关组件名称
  [key: string]: unknown; // 其他上下文信息
}

/**
 * 统一的错误报告函数
 * @param type 错误类型
 * @param message 错误消息
 * @param severity 错误严重程度
 * @param context 错误上下文
 */
export function reportError(
  type: ErrorType, 
  message: string, 
  severity: ErrorSeverity = ErrorSeverity.WARNING,
  context?: RegexErrorContext
): void {
  // 构建错误消息前缀
  const prefix = `[${type}] [${severity}]`;
  
  // 根据错误类型和严重程度处理
  switch (severity) {
    case ErrorSeverity.INFO:
      console.info(`${prefix} ${message}`, context);
      break;
    case ErrorSeverity.WARNING:
      console.warn(`${prefix} ${message}`, context);
      break;
    case ErrorSeverity.ERROR:
      console.error(`${prefix} ${message}`, context);
      break;
  }
  
  // 针对UI界面显示处理特殊错误类型
  if (type === ErrorType.REGEX_SYNTAX) {
    // 语法错误特殊处理，通常需要用户修复
    // 这里保留给UI层调用和显示
  } else if (type === ErrorType.REGEX_NO_CAPTURE) {
    // 没有捕获组特殊处理，通常需要提示用户添加捕获组
    // 这里保留给UI层调用和显示
  }
}

/**
 * 检测正则表达式是否有捕获组
 * @param regex 正则表达式
 * @returns 是否存在捕获组
 */
export function hasCapturingGroups(regex: RegExp): boolean {
  // 一个简单的方法是测试一个样本文本，看是否产生捕获组
  const testString = 'test_sample_123';
  const matches = testString.match(regex);
  
  // 如果有匹配并且匹配数组长度大于1，说明有捕获组
  return !!(matches && matches.length > 1);
}

/**
 * 分析正则表达式问题并提供用户友好的错误消息
 * @param pattern 正则表达式模式字符串
 * @param error 错误消息
 * @returns 用户友好的错误描述
 */
export function getRegexErrorDescription(pattern: string, error: string): string {
  // 常见正则表达式错误模式及其用户友好描述
  const commonErrors = [
    { check: /未终止的字符类/, message: '字符类 [] 未正确关闭' },
    { check: /无效的量词/, message: '数量限定符 (+, *, ?) 使用错误' },
    { check: /括号/, message: '括号 () 不匹配或使用错误' },
    { check: /反斜杠/, message: '反斜杠 \\ 使用错误，请正确转义' },
    { check: /无效的范围/, message: '字符范围指定错误，如 [z-a]' }
  ];
  
  // 尝试匹配常见错误
  for (const { check, message } of commonErrors) {
    if (check.test(error)) {
      return `${message}：${error}`;
    }
  }
  
  // 默认返回原始错误
  return error;
} 