import { injectable, inject } from 'inversify';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper, logErrorsWithoutThrowing, validateData } from '../utils/ErrorHelpers';
import { Logger } from '../utils/logger';
import { TYPES } from '../types/symbols';
import type { IDOMSelectorService } from '../types/ObsidianExtensions';

/**
 * UI状态管理器服务，负责管理UI元素状态
 * 包括元素原始文本存储、文件浏览器状态维护等
 */
@injectable()
export class UIStateManager {
    // 保存原始文件名显示方法
    private originalDisplayText: WeakMap<Element, string> = new WeakMap();

    constructor(
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.DOMSelectorService) private domSelector: IDOMSelectorService
    ) {}

    /**
     * 保存原始文本
     */
    saveOriginalText(element: Element, text: string): void {
        tryCatchWrapper(
            () => {
                // 验证输入
                validateData(element, (el) => el instanceof Element, '必须提供有效的DOM元素', this.constructor.name);
                validateData(text, (txt) => typeof txt === 'string', '文本必须是字符串类型', this.constructor.name);
                
                if (!this.originalDisplayText.has(element)) {
                    this.originalDisplayText.set(element, text);
                }
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '保存原始文本失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                details: { 
                    elementTagName: element instanceof Element ? element.tagName : typeof element,
                    textPreview: typeof text === 'string' ? text.substring(0, 20) : typeof text
                },
                userVisible: false
            }
        );
    }

    /**
     * 获取原始文本
     */
    getOriginalText(element: Element): string | undefined {
        return logErrorsWithoutThrowing(
            () => {
                // 验证输入
                validateData(element, (el) => el instanceof Element, '必须提供有效的DOM元素', this.constructor.name);
                
                return this.originalDisplayText.get(element);
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取原始文本失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                defaultValue: undefined,
                details: { 
                    elementTagName: element instanceof Element ? element.tagName : typeof element,
                    hasOriginalText: element instanceof Element ? this.originalDisplayText.has(element) : false
                }
            }
        );
    }

    /**
     * 恢复所有原始文件名
     */
    restoreAllOriginalFilenames(): void {
        tryCatchWrapper(
            () => {
                const fileExplorers = this.domSelector.getFileExplorers();
                let restoredCount = 0;
                
                fileExplorers.forEach(explorer => {
                    const fileItems = this.domSelector.getFileItems(explorer);
                    fileItems.forEach(fileItem => {
                        const titleElement = this.domSelector.getTitleElement(fileItem);
                        if (titleElement) {
                            this.restoreOriginalText(titleElement);
                            restoredCount++;
                        }
                    });
                });

                // 清空原始文本存储
                this.originalDisplayText = new WeakMap();
                
                this.logger.debug('恢复完成', { totalExplorers: fileExplorers.length, restoredCount });
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '恢复所有原始文件名失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.ERROR,
                userVisible: true
            }
        );
    }

    /**
     * 恢复单个元素的原始文本
     * @param element 目标元素
     * @returns boolean 是否成功恢复
     */
    public restoreOriginalText(element: Element): boolean {
        return logErrorsWithoutThrowing(
            () => {
                // 验证输入
                validateData(element, (el) => el instanceof Element, '必须提供有效的DOM元素', this.constructor.name);
                
                const originalText = this.getOriginalText(element);
                if (originalText !== undefined) {
                    element.textContent = originalText;
                    return true;
                }
                return false;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '恢复原始文本失败',
                category: ErrorCategory.UI,
                level: ErrorLevel.WARNING,
                defaultValue: false,
                details: { 
                    elementTagName: element instanceof Element ? element.tagName : typeof element
                }
            }
        );
    }

    /**
     * 检查元素是否有保存的原始文本
     * @param element 目标元素
     * @returns boolean 是否有原始文本
     */
    public hasOriginalText(element: Element): boolean {
        return logErrorsWithoutThrowing(
            () => {
                // 验证输入
                validateData(element, (el) => el instanceof Element, '必须提供有效的DOM元素', this.constructor.name);
                
                return this.originalDisplayText.has(element);
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '检查原始文本存在性失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.WARNING,
                defaultValue: false,
                details: { 
                    elementTagName: element instanceof Element ? element.tagName : typeof element
                }
            }
        );
    }

    /**
     * 清理状态
     * 注意：由于使用WeakMap，通常不需要手动清理
     * 但在需要强制清理的场景下可以使用此方法
     */
    public clear(): void {
        tryCatchWrapper(
            () => {
                // WeakMap会自动清理失去引用的元素
                // 这里重新创建一个WeakMap来确保完全清理
                this.originalDisplayText = new WeakMap<Element, string>();
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '清理状态失败',
                category: ErrorCategory.CACHE,
                level: ErrorLevel.WARNING,
                userVisible: false
            }
        );
    }
}