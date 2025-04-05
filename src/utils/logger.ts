import { injectable, inject } from 'inversify';
import { TYPES } from '../types/Symbols';
import { TitleChangerPlugin } from '../main';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5
}

/**
 * 日志记录服务
 */
@injectable()
export class Logger {
  private currentLevel: LogLevel;
  private prefix: string;
  private plugin?: TitleChangerPlugin;
  
  constructor(
    @inject(TYPES.Plugin) plugin?: TitleChangerPlugin,
    prefix: string = 'Title Changer'
  ) {
    this.plugin = plugin;
    this.prefix = prefix;
    
    // 设置默认日志级别
    this.currentLevel = LogLevel.INFO;
    
    // 如果存在本地存储的日志级别设置，则使用该设置
    try {
      const savedLevel = localStorage.getItem('title-changer-log-level');
      if (savedLevel !== null) {
        this.currentLevel = Number(savedLevel);
      }
    } catch (e) {
      // 如果无法访问localStorage，忽略错误
    }
  }
  
  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    // 尝试保存到本地存储
    try {
      localStorage.setItem('title-changer-log-level', level.toString());
    } catch (e) {
      // 忽略错误
    }
  }
  
  /**
   * 记录跟踪日志
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, context);
  }
  
  /**
   * 记录调试日志
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  /**
   * 记录信息日志
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  /**
   * 记录警告日志
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  /**
   * 记录错误日志
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.currentLevel) return;
    
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${this.prefix}] [${LogLevel[level]}] ${message}`;
    
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, context);
        break;
    }
  }
} 