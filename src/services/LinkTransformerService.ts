import { injectable, inject } from 'inversify';
import { TitleChangerSettings } from '../settings';
import { TYPES } from '../types/Symbols';
import { CacheManager } from '../CacheManager';
import { TFile } from 'obsidian';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory, RegexError, ValidationError } from '../utils/Errors';
import { convertToTitleChangerError, logErrorsWithoutThrowing, safeRegexCreation, safeRegexExecution, validateData, tryCatchWithValidation } from '../utils/ErrorHelpers';
import { Logger } from '../utils/Logger';

@injectable()
export class LinkTransformerService {
    private settings!: TitleChangerSettings;

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

            // 检查设置是否已初始化
            if (!this.settings) {
                this.logger.warn('设置尚未初始化', { text: safeText });
                return safeText;
            }

            // 检查是否有正则表达式模式
            if (!this.settings.regexPattern || this.settings.regexPattern.trim() === '') {
                return safeText;
            }

            // 使用安全的正则表达式创建
            const regex = safeRegexCreation(
                this.settings.regexPattern,
                '',
                this.constructor.name,
                this.errorManager,
                this.logger
            );
            
            if (regex) {
                // 使用安全的正则表达式执行
                const match = safeRegexExecution(
                    regex,
                    safeText,
                    this.constructor.name,
                    this.errorManager,
                    this.logger
                );
                
                if (match && match.length > 1) {
                    const result = match[1].trim(); // 返回第一个捕获组并清理空白
                    return result || safeText; // 确保不返回空字符串
                }
            }

            // 回退到简单的前缀移除模式
            const fallbackRegex = safeRegexCreation(
                'AIGC_\\d{4}_\\d{2}_\\d{2}_(.+)',
                '',
                this.constructor.name,
                this.errorManager,
                this.logger
            );
            
            if (fallbackRegex) {
                const fallbackMatch = safeRegexExecution(
                    fallbackRegex,
                    safeText,
                    this.constructor.name,
                    this.errorManager,
                    this.logger
                );
                
                if (fallbackMatch && fallbackMatch.length > 1) {
                    const result = fallbackMatch[1].trim();
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
    processInternalLinks(element: HTMLElement): void {
        // 验证输入参数
        try {
            validateData(
                element,
                (el) => el instanceof HTMLElement,
                'element必须是HTMLElement类型',
                this.constructor.name
            );
        } catch (error) {
            this.errorManager.handleError(
                error instanceof Error ? error : new ValidationError('无效的DOM元素参数', {
                    sourceComponent: this.constructor.name,
                    details: { element },
                    userVisible: false
                }),
                ErrorLevel.ERROR
            );
            return;
        }

        logErrorsWithoutThrowing(() => {
            if (!element || !element.querySelectorAll) {
                return false;
            }
            
            const internalLinks = element.querySelectorAll('a.internal-link');
            if (!internalLinks || internalLinks.length === 0) {
                return true; // 没有链接也算成功
            }
            
            internalLinks.forEach((link: Element) => {
                logErrorsWithoutThrowing(() => {
                    // 跳过已处理的链接
                    if (link.hasAttribute('data-title-processed')) return true;
                    
                    const linkElement = link as HTMLElement;
                    // 获取原始文件名
                    const href = linkElement.getAttribute('href');
                    const originalFileName = href?.replace(/^#/, '') || linkElement.getAttribute('data-href');
                    if (!originalFileName) return true;
                    
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
                    
                    return true;
                }, this.constructor.name, this.errorManager, this.logger, {
                    errorMessage: '处理单个内部链接失败',
                    category: ErrorCategory.UI,
                    level: ErrorLevel.DEBUG,
                    defaultValue: false,
                    details: { 
                        linkHref: link.getAttribute('href'),
                        linkText: link.textContent
                    }
                });
            });
            
            return true;
        }, this.constructor.name, this.errorManager, this.logger, {
            errorMessage: '处理内部链接失败',
            category: ErrorCategory.UI,
            level: ErrorLevel.ERROR,
            defaultValue: false,
            details: { 
                element: element.tagName,
                linkCount: element.querySelectorAll?.('a.internal-link')?.length || 0
            }
        });
    }
} 