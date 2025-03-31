import { ErrorManagerService, ErrorLevel } from '../services/error-manager.service';
import { ErrorCategory } from './errors';
import { Logger } from './logger';
import { tryCatchWrapper, logErrorsWithoutThrowing } from './error-helpers';

/**
 * DOM元素扩展属性
 */
export interface ElementAttributes {
    className?: string;
    id?: string;
    textContent?: string;
    innerHTML?: string;
    title?: string;
    style?: Partial<CSSStyleDeclaration>;
    dataset?: Record<string, string>;
    attributes?: Record<string, string>;
    children?: HTMLElement[];
    listeners?: Record<string, EventListenerOrEventListenerObject>;
}

/**
 * 创建DOM元素的选项
 */
export interface CreateElementOptions<T extends HTMLElement = HTMLElement> extends ElementAttributes {
    tag: string;
    parent?: HTMLElement;
    prepend?: boolean;
}

/**
 * 安全创建DOM元素
 * @param options 元素创建选项
 * @param component 组件名称（用于错误报告）
 * @param errorManager 错误管理器
 * @param logger 日志记录器
 * @returns 创建的HTML元素或null（如果创建失败）
 */
export function createEl<T extends HTMLElement = HTMLElement>(
    options: CreateElementOptions<T>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): T | null {
    return tryCatchWrapper(
        () => {
            // 创建基本元素
            const el = document.createElement(options.tag) as T;
            
            // 设置ID
            if (options.id) {
                el.id = options.id;
            }
            
            // 设置类名
            if (options.className) {
                el.className = options.className;
            }
            
            // 设置文本内容
            if (options.textContent !== undefined) {
                el.textContent = options.textContent;
            }
            
            // 设置HTML内容
            if (options.innerHTML !== undefined) {
                el.innerHTML = options.innerHTML;
            }
            
            // 设置title属性
            if (options.title) {
                el.title = options.title;
            }
            
            // 设置样式
            if (options.style) {
                Object.assign(el.style, options.style);
            }
            
            // 设置dataset属性
            if (options.dataset) {
                Object.entries(options.dataset).forEach(([key, value]) => {
                    el.dataset[key] = value;
                });
            }
            
            // 设置其他属性
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    el.setAttribute(key, value);
                });
            }
            
            // 添加子元素
            if (options.children) {
                options.children.forEach(child => {
                    el.appendChild(child);
                });
            }
            
            // 添加事件监听器
            if (options.listeners) {
                Object.entries(options.listeners).forEach(([event, listener]) => {
                    el.addEventListener(event, listener);
                });
            }
            
            // 如果指定了父元素，将当前元素添加到父元素
            if (options.parent) {
                if (options.prepend) {
                    options.parent.prepend(el);
                } else {
                    options.parent.appendChild(el);
                }
            }
            
            return el;
        },
        component,
        errorManager,
        logger,
        {
            errorMessage: `创建DOM元素失败: ${options.tag}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { options }
        }
    );
}

/**
 * 创建div元素
 */
export function createDiv(
    options: Omit<CreateElementOptions<HTMLDivElement>, 'tag'>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): HTMLDivElement | null {
    return createEl<HTMLDivElement>({ ...options, tag: 'div' }, component, errorManager, logger);
}

/**
 * 创建span元素
 */
export function createSpan(
    options: Omit<CreateElementOptions<HTMLSpanElement>, 'tag'>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): HTMLSpanElement | null {
    return createEl<HTMLSpanElement>({ ...options, tag: 'span' }, component, errorManager, logger);
}

/**
 * 创建a元素
 */
export function createLink(
    options: Omit<CreateElementOptions<HTMLAnchorElement>, 'tag'>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): HTMLAnchorElement | null {
    return createEl<HTMLAnchorElement>({ ...options, tag: 'a' }, component, errorManager, logger);
}

/**
 * 创建button元素
 */
export function createButton(
    options: Omit<CreateElementOptions<HTMLButtonElement>, 'tag'>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): HTMLButtonElement | null {
    return createEl<HTMLButtonElement>({ ...options, tag: 'button' }, component, errorManager, logger);
}

/**
 * 创建input元素
 */
export function createInput(
    options: Omit<CreateElementOptions<HTMLInputElement>, 'tag'>,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): HTMLInputElement | null {
    return createEl<HTMLInputElement>({ ...options, tag: 'input' }, component, errorManager, logger);
}

/**
 * 清空元素内容
 */
export function empty(
    el: HTMLElement,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): boolean {
    return !!logErrorsWithoutThrowing(
        () => {
            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }
            return true;
        },
        component,
        errorManager,
        logger,
        {
            errorMessage: '清空元素内容失败',
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { element: el.tagName }
        }
    );
}

/**
 * 安全地添加/移除类
 */
export function toggleClass(
    el: HTMLElement,
    className: string,
    add: boolean,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): boolean {
    return !!logErrorsWithoutThrowing(
        () => {
            if (add) {
                el.classList.add(className);
            } else {
                el.classList.remove(className);
            }
            return true;
        },
        component,
        errorManager,
        logger,
        {
            errorMessage: `${add ? '添加' : '移除'}类名失败: ${className}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { element: el.tagName, className, action: add ? 'add' : 'remove' }
        }
    );
}

/**
 * 安全地设置元素属性
 */
export function setAttribute(
    el: HTMLElement,
    attribute: string,
    value: string,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): boolean {
    return !!logErrorsWithoutThrowing(
        () => {
            el.setAttribute(attribute, value);
            return true;
        },
        component,
        errorManager,
        logger,
        {
            errorMessage: `设置属性失败: ${attribute}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { element: el.tagName, attribute, value }
        }
    );
}

/**
 * 安全地获取元素属性
 */
export function getAttribute(
    el: HTMLElement | null,
    attribute: string,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): string | null {
    return logErrorsWithoutThrowing(
        () => {
            if (!el) return null;
            return el.getAttribute(attribute);
        },
        component,
        errorManager,
        logger,
        {
            errorMessage: `获取属性失败: ${attribute}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { element: el?.tagName, attribute },
            defaultValue: null
        }
    );
}

/**
 * 安全地查找元素
 */
export function querySelector<T extends Element = Element>(
    container: ParentNode,
    selector: string,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): T | null {
    return logErrorsWithoutThrowing(
        () => container.querySelector<T>(selector),
        component,
        errorManager,
        logger,
        {
            errorMessage: `查询元素失败: ${selector}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { selector, containerType: (container as any)?.tagName || 'Document' },
            defaultValue: null
        }
    );
}

/**
 * 安全地查找多个元素
 */
export function querySelectorAll<T extends Element = Element>(
    container: ParentNode,
    selector: string,
    component: string,
    errorManager: ErrorManagerService,
    logger: Logger
): T[] {
    return logErrorsWithoutThrowing(
        () => Array.from(container.querySelectorAll<T>(selector)),
        component,
        errorManager,
        logger,
        {
            errorMessage: `查询多个元素失败: ${selector}`,
            category: ErrorCategory.UI,
            level: ErrorLevel.WARNING,
            details: { selector, containerType: (container as any)?.tagName || 'Document' },
            defaultValue: []
        }
    );
} 