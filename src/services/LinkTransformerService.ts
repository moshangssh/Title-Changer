import { injectable, inject } from 'inversify';
import { TitleChangerSettings, DEFAULT_SETTINGS } from '../settings';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../CacheManager';
import { TFile } from 'obsidian';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, RegexError, ValidationError } from '../utils/errors';
import { 
    convertToTitleChangerError, 
    logErrorsWithoutThrowing, 
    validateData, 
    tryCatchWithValidation,
    ErrorHandler
} from '../utils/ErrorHelpers';
// 导入新的正则表达式辅助函数
import { createSafeRegex, executeSafeRegex, ErrorType, ErrorSeverity, getRegexErrorDescription, reportError } from '../utils/RegexHelper';
import { Logger } from '../utils/logger';

@injectable()
export class LinkTransformerService {
    private settings: TitleChangerSettings = DEFAULT_SETTINGS;
    // 添加正则表达式缓存
    private cachedRegex: RegExp | null = null;
    private cachedPattern: string = '';

    constructor(
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    /**
     * 设置插件配置
     */
    setSettings(settings: TitleChangerSettings): void {
        tryCatchWithValidation(
            () => {
                validateData(
                    settings,
                    (s) => s !== null && s !== undefined && typeof s === 'object',
                    '设置对象必须是有效的',
                    this.constructor.name
                );
                this.settings = settings;
                // 清除缓存的正则表达式，以便在下次需要时重新创建
                this.cachedRegex = null;
                this.cachedPattern = '';
                return true;
            },
            (result) => result === true,
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '应用设置时出错',
                validationErrorMessage: '无效的设置对象',
                category: ErrorCategory.CONFIG,
                level: ErrorLevel.ERROR,
                details: { settings },
                userVisible: true
            }
        );
    }

    /**
     * 获取缓存的正则表达式或创建新正则表达式
     * @returns 正则表达式对象或null
     */
    private getRegex(): RegExp | null {
        // 如果模式已更改或尚未缓存，则创建新的正则表达式
        if (this.settings.regexPattern !== this.cachedPattern) {
            const result = createSafeRegex(this.settings.regexPattern, '');
            this.cachedRegex = result.regex;
            this.cachedPattern = this.settings.regexPattern;
            
            // 如果正则表达式无效，记录错误但不中断运行
            if (result.error) {
                // 使用新的错误报告机制
                const friendlyError = getRegexErrorDescription(this.settings.regexPattern, result.error);
                
                // 报告错误
                reportError(
                    ErrorType.REGEX_SYNTAX, 
                    `正则表达式语法错误: ${friendlyError}`, 
                    ErrorSeverity.WARNING,
                    { 
                        pattern: this.settings.regexPattern,
                        component: 'LinkTransformerService'
                    }
                );
                
                // 同时保持日志记录
                this.logger.warn('正则表达式无效', { 
                    pattern: this.settings.regexPattern,
                    error: friendlyError
                });
            }
        }
        
        return this.cachedRegex;
    }

    /**
     * 转换链接文本
     * @param text 原始链接文本
     * @returns 转换后的文本
     */
    transformLinkText(text: string): string {
        // 验证输入参数
        if (text === null || text === undefined) {
            this.logger.warn('transformLinkText收到null或undefined参数', { text });
            return '';
        }

        return logErrorsWithoutThrowing(() => {
            // 确保text是字符串类型
            const safeText = String(text);
            if (safeText.trim() === '') {
                return safeText;
            }

            // 检查正则表达式模式
            if (!this.settings.regexPattern || this.settings.regexPattern.trim() === '') {
                return safeText;
            }

            // 使用缓存的正则表达式
            const regex = this.getRegex();
            
            if (regex) {
                // 使用新的安全正则表达式执行函数
                const result = executeSafeRegex(regex, safeText);
                
                // 处理可能的执行错误
                if (result.error) {
                    reportError(
                        ErrorType.REGEX_EXECUTION, 
                        `正则表达式执行错误: ${result.error}`,
                        ErrorSeverity.WARNING, 
                        { 
                            pattern: this.settings.regexPattern,
                            input: safeText.substring(0, 20) // 仅记录前20个字符以防文本过长
                        }
                    );
                    this.logger.warn('正则表达式执行错误', {
                        pattern: this.settings.regexPattern,
                        text: safeText.substring(0, 20),
                        error: result.error
                    });
                }
                
                if (result.matches && result.matches.length > 1) {
                    const matchResult = result.matches[1].trim(); // 返回第一个捕获组并清理空白
                    return matchResult || safeText; // 确保不返回空字符串
                }
            }

            // 回退到简单的前缀移除模式
            const fallbackResult = createSafeRegex('AIGC_\\d{4}_\\d{2}_\\d{2}_(.+)', '');
            const fallbackRegex = fallbackResult.regex;
            
            if (fallbackRegex) {
                const fallbackExecResult = executeSafeRegex(fallbackRegex, safeText);
                
                // 只记录回退模式错误，不影响正常流程
                if (fallbackExecResult.error) {
                    this.logger.debug('回退正则表达式执行错误', {
                        pattern: 'AIGC_\\d{4}_\\d{2}_\\d{2}_(.+)',
                        text: safeText.substring(0, 20),
                        error: fallbackExecResult.error
                    });
                }
                
                if (fallbackExecResult.matches && fallbackExecResult.matches.length > 1) {
                    const result = fallbackExecResult.matches[1].trim();
                    return result || safeText;
                }
            }

            return safeText;
        }, this.constructor.name, this.errorManager, this.logger, {
            errorMessage: '链接文本转换失败',
            category: ErrorCategory.REGEX,
            level: ErrorLevel.WARNING,
            defaultValue: text,
            details: { textLength: text.length, textPreview: text.substring(0, 20) }
        });
    }

    /**
     * 处理 DOM 中的内部链接
     * @param element 要处理的 DOM 元素
     */
    @ErrorHandler({
        errorMessage: '处理内部链接失败',
        category: ErrorCategory.UI,
        level: ErrorLevel.ERROR
    })
    processInternalLinks(element: HTMLElement): void {
        // 验证输入参数
        validateData(
            element,
            (el) => el instanceof HTMLElement,
            'element必须是HTMLElement类型',
            this.constructor.name
        );

        if (!element || !element.querySelectorAll) {
            return;
        }
        
        const internalLinks = element.querySelectorAll('a.internal-link');
        if (!internalLinks || internalLinks.length === 0) {
            return; // 没有链接也算成功
        }
        
        internalLinks.forEach((link: Element) => {
            this.processLink(link);
        });
    }

    /**
     * 处理单个链接
     * @param link 链接元素
     */
    @ErrorHandler({
        errorMessage: '处理单个内部链接失败',
        category: ErrorCategory.UI,
        level: ErrorLevel.DEBUG
    })
    private processLink(link: Element): void {
        // 跳过已处理的链接
        if (link.hasAttribute('data-title-processed')) return;
        
        const linkElement = link as HTMLElement;
        // 获取原始文件名
        const href = linkElement.getAttribute('href');
        const originalFileName = href?.replace(/^#/, '') || linkElement.getAttribute('data-href');
        if (!originalFileName) return;
        
        // 获取显示标题
        let displayTitle = null;
        
        // 首先尝试从缓存获取
        const baseName = originalFileName.replace(/\.[^.]+$/, '');
        displayTitle = this.cacheManager.getDisplayTitle(baseName);
        
        // 如果缓存中没有，尝试处理链接文本
        if (!displayTitle) {
            const linkText = linkElement.innerText;
            const transformedText = this.transformLinkText(linkText);
            
            if (transformedText !== linkText) {
                displayTitle = transformedText;
            }
        }
        
        // 更新链接显示
        if (displayTitle && displayTitle !== linkElement.innerText) {
            linkElement.innerText = displayTitle;
            
            // 保留原始文本作为 title 属性以便悬停查看
            linkElement.title = originalFileName;
            
            // 标记为已处理
            linkElement.setAttribute('data-title-processed', 'true');
        }
    }

    private transformFileLink(originalName: string): string | null {
        // 获取缓存的正则表达式
        const regex = this.getRegex();
        if (!regex) {
            // 当无法创建正则表达式时，使用原始文件名
            return originalName;
        }
        
        // 执行正则表达式
        const result = executeSafeRegex(regex, originalName);
        
        // 如果执行出错，记录错误并使用原始名称
        if (result.error) {
            reportError(
                ErrorType.REGEX_EXECUTION, 
                `正则表达式执行错误: ${result.error}`, 
                ErrorSeverity.WARNING, 
                { 
                    pattern: this.settings.regexPattern, 
                    input: originalName,
                    component: 'LinkTransformerService'
                }
            );
            return originalName;
        }
        
        // 如果没有匹配或没有捕获组
        if (!result.matches || result.matches.length <= 1) {
            // 检查是否是没有捕获组的问题
            if (result.matches && result.matches.length === 1) {
                reportError(
                    ErrorType.REGEX_NO_CAPTURE,
                    '正则表达式未包含捕获组，请使用()括号来捕获要显示的部分', 
                    ErrorSeverity.WARNING,
                    { 
                        pattern: this.settings.regexPattern, 
                        input: originalName,
                        component: 'LinkTransformerService'
                    }
                );
            } else {
                // 没有匹配
                reportError(
                    ErrorType.REGEX_NO_MATCH,
                    '正则表达式没有匹配到内容', 
                    ErrorSeverity.INFO,
                    { 
                        pattern: this.settings.regexPattern, 
                        input: originalName,
                        component: 'LinkTransformerService'
                    }
                );
            }
            return originalName;
        }
        
        // 返回第一个捕获组
        return result.matches[1];
    }
} 