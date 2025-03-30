import { injectable } from 'inversify';
import { TitleChangerSettings } from '../settings';

@injectable()
export class LinkTransformerService {
    private settings: TitleChangerSettings;

    setSettings(settings: TitleChangerSettings) {
        this.settings = settings;
    }

    /**
     * 转换链接文本
     * @param text 原始链接文本
     * @returns 转换后的文本
     */
    transformLinkText(text: string): string {
        // 移除 AIGC_YYYY_MM_DD_ 格式的前缀
        const transformed = text.replace(/AIGC_\d{4}_\d{2}_\d{2}_(.+)/, '$1');
        
        // 如果没有变化，返回原文本
        if (transformed === text) {
            return text;
        }

        return transformed;
    }

    /**
     * 处理 DOM 中的内部链接
     * @param element 要处理的 DOM 元素
     */
    processInternalLinks(element: HTMLElement): void {
        const internalLinks = element.querySelectorAll('a.internal-link');
        
        internalLinks.forEach((link: HTMLElement) => {
            const originalText = link.innerText;
            const newText = this.transformLinkText(originalText);
            
            if (originalText !== newText) {
                link.innerText = newText;
                // 保留原始文本作为 title 属性以便悬停查看
                link.title = originalText;
            }
        });
    }
} 