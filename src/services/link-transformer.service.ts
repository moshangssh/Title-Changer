import { injectable, inject } from 'inversify';
import { TitleChangerSettings } from '../settings';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import { TFile } from 'obsidian';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { ErrorCategory, RegexError } from '../utils/errors';
import { convertToTitleChangerError, logErrorsWithoutThrowing, safeRegexCreation, safeRegexExecution } from '../utils/error-helpers';
import { Logger } from '../utils/logger';

@injectable()
export class LinkTransformerService {
    private settings!: TitleChangerSettings;

    constructor(
        @inject(TYPES.CacheManager) private cacheManager: CacheManager,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    setSettings(settings: TitleChangerSettings) {
        this.settings = settings;
    }

    /**
     * 转换链接文本
     * @param text 原始链接文本
     * @returns 转换后的文本
     */
    transformLinkText(text: string): string {
        if (!text) return text;

        return logErrorsWithoutThrowing(() => {
            // 检查是否有正则表达式模式
            if (!this.settings.regexPattern || this.settings.regexPattern.trim() === '') {
                return text;
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
                    text,
                    this.constructor.name,
                    this.errorManager,
                    this.logger
                );
                
                if (match && match.length > 1) {
                    return match[1]; // 返回第一个捕获组
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
                    text,
                    this.constructor.name,
                    this.errorManager,
                    this.logger
                );
                
                if (fallbackMatch && fallbackMatch.length > 1) {
                    return fallbackMatch[1];
                }
            }

            return text;
        }, this.constructor.name, this.errorManager, this.logger, {
            errorMessage: '链接文本转换失败',
            category: ErrorCategory.REGEX,
            level: ErrorLevel.WARNING,
            defaultValue: text
        });
    }

    /**
     * 处理 DOM 中的内部链接
     * @param element 要处理的 DOM 元素
     */
    processInternalLinks(element: HTMLElement): void {
        logErrorsWithoutThrowing(() => {
            const internalLinks = element.querySelectorAll('a.internal-link');
            
            internalLinks.forEach((link: Element) => {
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
            });
        }, this.constructor.name, this.errorManager, this.logger, {
            errorMessage: '处理内部链接失败',
            category: ErrorCategory.UI,
            level: ErrorLevel.ERROR,
            details: { element: element.tagName }
        });
    }
} 