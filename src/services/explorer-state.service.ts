import { injectable, inject } from 'inversify';
import { ErrorManagerService, ErrorLevel } from './error-manager.service';
import { ErrorCategory, DataError } from '../utils/errors';
import { tryCatchWrapper, logErrorsWithoutThrowing, validateData } from '../utils/error-helpers';
import { Logger } from '../utils/logger';
import { TYPES } from '../types/symbols';

/**
 * 用于存储原始文本的WeakMap键值对
 */
interface ElementTextPair {
    element: Element;
    text: string;
}

/**
 * 文件浏览器状态服务，负责管理文件浏览器的状态
 */
@injectable()
export class ExplorerStateService {
    // 保存原始文件名显示方法
    private originalDisplayText: WeakMap<Element, string> = new WeakMap();

    constructor(
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
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
    restoreAllOriginalFilenames(getElements: () => Element[]): void {
        tryCatchWrapper(
            () => {
                // 验证输入
                validateData(getElements, (fn) => typeof fn === 'function', 'getElements必须是函数', this.constructor.name);
                
                const elements = getElements();
                if (!Array.isArray(elements)) {
                    this.logger.warn('getElements未返回数组', { result: typeof elements });
                    return null;
                }
                
                let restoredCount = 0;
                elements.forEach(element => {
                    logErrorsWithoutThrowing(
                        () => {
                            if (!(element instanceof Element)) {
                                return false;
                            }
                            
                            const originalText = this.originalDisplayText.get(element);
                            if (originalText) {
                                element.textContent = originalText;
                                restoredCount++;
                            }
                            return true;
                        },
                        this.constructor.name,
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '恢复单个元素文本失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG,
                            defaultValue: false,
                            details: { 
                                elementTagName: element instanceof Element ? element.tagName : typeof element
                            }
                        }
                    );
                });

                // 清空原始文本存储
                this.originalDisplayText = new WeakMap();
                
                this.logger.debug('恢复完成', { totalElements: elements.length, restoredCount });
                return true;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '恢复所有原始文件名失败',
                category: ErrorCategory.DATA,
                level: ErrorLevel.ERROR,
                details: { getElementsProvided: !!getElements },
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