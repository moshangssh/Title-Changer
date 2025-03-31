import { injectable, inject } from 'inversify';
import { TitleChangerSettings } from '../settings';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import { TFile } from 'obsidian';

@injectable()
export class LinkTransformerService {
    private settings: TitleChangerSettings;

    constructor(
        @inject(TYPES.CacheManager) private cacheManager: CacheManager
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

        try {
            // 检查是否有正则表达式模式
            if (!this.settings.regexPattern || this.settings.regexPattern.trim() === '') {
                return text;
            }

            // 尝试使用配置的正则表达式进行转换
            try {
                const regex = new RegExp(this.settings.regexPattern);
                const match = text.match(regex);
                
                if (match && match.length > 1) {
                    return match[1]; // 返回第一个捕获组
                }
            } catch (regexError) {
                console.error('Title Changer: 正则表达式错误', regexError);
            }

            // 回退到简单的前缀移除模式
            const transformed = text.replace(/AIGC_\d{4}_\d{2}_\d{2}_(.+)/, '$1');
            
            // 如果没有变化，返回原文本
            if (transformed === text) {
                return text;
            }

            return transformed;
        } catch (error) {
            console.error('Title Changer: 转换链接文本时出错', error);
            return text;
        }
    }

    /**
     * 处理 DOM 中的内部链接
     * @param element 要处理的 DOM 元素
     */
    processInternalLinks(element: HTMLElement): void {
        try {
            const internalLinks = element.querySelectorAll('a.internal-link');
            
            internalLinks.forEach((link: HTMLElement) => {
                // 跳过已处理的链接
                if (link.hasAttribute('data-title-processed')) return;
                
                // 获取原始文件名
                const href = link.getAttribute('href');
                const originalFileName = href?.replace(/^#/, '') || link.getAttribute('data-href');
                if (!originalFileName) return;
                
                // 获取显示标题
                let displayTitle = null;
                
                // 首先尝试从缓存获取
                const baseName = originalFileName.replace(/\.[^.]+$/, '');
                displayTitle = this.cacheManager.getDisplayTitle(baseName);
                
                // 如果缓存中没有，尝试处理链接文本
                if (!displayTitle) {
                    const linkText = link.innerText;
                    const transformedText = this.transformLinkText(linkText);
                    
                    if (transformedText !== linkText) {
                        displayTitle = transformedText;
                    }
                }
                
                // 更新链接显示
                if (displayTitle && displayTitle !== link.innerText) {
                    link.innerText = displayTitle;
                    
                    // 保留原始文本作为 title 属性以便悬停查看
                    link.title = originalFileName;
                    
                    // 标记为已处理
                    link.setAttribute('data-title-processed', 'true');
                }
            });
        } catch (error) {
            console.error('Title Changer: 处理内部链接时发生错误', error);
        }
    }
} 