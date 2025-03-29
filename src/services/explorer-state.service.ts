import { DOMSelectorService } from './dom-selector.service';

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
export class ExplorerStateService {
    // 保存原始文件名显示方法
    private originalDisplayText: WeakMap<Element, string> = new WeakMap();

    constructor() {}

    /**
     * 保存原始文本
     */
    saveOriginalText(element: Element, text: string): void {
        if (!this.originalDisplayText.has(element)) {
            this.originalDisplayText.set(element, text);
        }
    }

    /**
     * 获取原始文本
     */
    getOriginalText(element: Element): string | undefined {
        return this.originalDisplayText.get(element);
    }

    /**
     * 恢复所有原始文件名
     */
    restoreAllOriginalFilenames(getElements: () => Element[]): void {
        const elements = getElements();
        
        elements.forEach(element => {
            const originalText = this.originalDisplayText.get(element);
            if (originalText) {
                element.textContent = originalText;
            }
        });

        // 清空原始文本存储
        this.originalDisplayText = new WeakMap();
    }

    /**
     * 恢复单个元素的原始文本
     * @param element 目标元素
     * @returns boolean 是否成功恢复
     */
    public restoreOriginalText(element: Element): boolean {
        const originalText = this.getOriginalText(element);
        if (originalText !== undefined) {
            element.textContent = originalText;
            return true;
        }
        return false;
    }

    /**
     * 检查元素是否有保存的原始文本
     * @param element 目标元素
     * @returns boolean 是否有原始文本
     */
    public hasOriginalText(element: Element): boolean {
        return this.originalDisplayText.has(element);
    }

    /**
     * 清理状态
     * 注意：由于使用WeakMap，通常不需要手动清理
     * 但在需要强制清理的场景下可以使用此方法
     */
    public clear(): void {
        // WeakMap会自动清理失去引用的元素
        // 这里重新创建一个WeakMap来确保完全清理
        this.originalDisplayText = new WeakMap<Element, string>();
    }
} 