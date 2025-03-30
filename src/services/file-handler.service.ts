import { TFile, Vault } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import { ExplorerStateService } from './explorer-state.service';
import { DOMSelectorService } from './dom-selector.service';
import { Logger } from '../utils/logger';

/**
 * 文件处理服务，负责处理文件相关操作
 */
@injectable()
export class FileHandlerService {
    constructor(
        @inject(TYPES.Vault) private vault: Vault,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    /**
     * 通过基本名称查找文件
     */
    findFileByBasename(basename: string): TFile | null {
        const files = this.vault.getMarkdownFiles();
        return files.find(file => file.basename === basename) || null;
    }

    /**
     * 安全地设置文本内容
     */
    private safeSetTextContent(element: Element | null, text: string | null): void {
        try {
            if (!element || !text) return;
            // 对文本内容进行 HTML 转义
            const safeText = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            element.textContent = safeText;
        } catch (error) {
            this.logger.error('Title Changer: 设置文本内容时出错', {
                error,
                element,
                text
            });
        }
    }

    /**
     * 安全地获取文本内容
     */
    private safeGetTextContent(element: Element | null): string | null {
        try {
            if (!element) return null;
            return element.textContent?.trim() || null;
        } catch (error) {
            this.logger.error('Title Changer: 获取文本内容时出错', {
                error,
                element
            });
            return null;
        }
    }

    /**
     * 处理文件项
     */
    processFileItem(
        fileItem: HTMLElement,
        cacheManager: CacheManager,
        stateService: ExplorerStateService
    ): void {
        try {
            // 获取标题元素
            const titleEl = this.domSelector.getTitleElement(fileItem);
            if (!titleEl) return;

            // 获取文件路径
            const filePath = this.domSelector.getFilePath(fileItem);
            if (!filePath) return;

            // 获取文件
            const file = this.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile)) return;

            // 保存原始显示文本
            const originalText = this.safeGetTextContent(titleEl) || file.basename;
            stateService.saveOriginalText(titleEl, originalText);

            // 获取显示标题
            const displayTitle = cacheManager.processFile(file);

            // 如果有自定义显示标题，更新显示
            if (displayTitle) {
                this.safeSetTextContent(titleEl, displayTitle);
            } else {
                // 恢复原始文件名
                const savedText = stateService.getOriginalText(titleEl);
                if (this.safeGetTextContent(titleEl) !== savedText) {
                    this.safeSetTextContent(titleEl, savedText !== undefined ? savedText : file.basename);
                }
            }
        } catch (error) {
            this.logger.error('Title Changer: 处理文件项时出错', {
                error,
                fileItem
            });
        }
    }

    /**
     * 处理文本元素
     */
    processTextElements(
        elements: Element[],
        cacheManager: CacheManager,
        stateService: ExplorerStateService
    ): void {
        elements.forEach(element => {
            try {
                const text = this.safeGetTextContent(element);
                if (!text) return;

                // 查找匹配的文件
                const matchingFile = this.findFileByBasename(text);
                if (!matchingFile) return;

                // 保存原始文本
                stateService.saveOriginalText(element, text);

                // 获取显示标题
                const displayTitle = cacheManager.processFile(matchingFile);

                // 如果有自定义显示标题，更新显示
                if (displayTitle) {
                    this.safeSetTextContent(element, displayTitle);
                }
            } catch (error) {
                this.logger.error('Title Changer: 处理文本元素时出错', {
                    error,
                    element
                });
            }
        });
    }
} 