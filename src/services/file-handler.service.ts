import { TFile, Vault } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { CacheManager } from '../cache-manager';
import { ExplorerStateService } from './explorer-state.service';
import { DOMSelectorService } from './dom-selector.service';

/**
 * 文件处理服务，负责处理文件相关操作
 */
@injectable()
export class FileHandlerService {
    constructor(
        @inject(TYPES.Vault) private vault: Vault,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService
    ) {}

    /**
     * 通过基本名称查找文件
     */
    findFileByBasename(basename: string): TFile | null {
        const files = this.vault.getMarkdownFiles();
        return files.find(file => file.basename === basename) || null;
    }

    /**
     * 处理文件项
     */
    processFileItem(
        fileItem: HTMLElement,
        cacheManager: CacheManager,
        stateService: ExplorerStateService
    ): void {
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
        const originalText = titleEl.textContent || file.basename;
        stateService.saveOriginalText(titleEl, originalText);

        // 获取显示标题
        const displayTitle = cacheManager.processFile(file);

        // 如果有自定义显示标题，更新显示
        if (displayTitle) {
            titleEl.textContent = displayTitle;
        } else {
            // 恢复原始文件名
            const savedText = stateService.getOriginalText(titleEl);
            if (titleEl.textContent !== savedText) {
                titleEl.textContent = savedText !== undefined ? savedText : file.basename;
            }
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
            const text = element.textContent?.trim();
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
                element.textContent = displayTitle;
            }
        });
    }
} 