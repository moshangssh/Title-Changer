/**
 * DOMRecycler
 * 元素池机制，重用DOM元素，减少频繁创建销毁，提升性能
 * @author Title-Changer
 */

export class DomRecycler {
    private elementPool: HTMLElement[] = [];

    /**
     * 获取一个可用的DOM元素（div），优先复用池中元素
     */
    getElement(): HTMLElement {
        if (this.elementPool.length > 0) {
            return this.elementPool.pop()!;
        }
        return document.createElement('div');
    }

    /**
     * 回收一个DOM元素，清理内容和事件后放回池中
     * @param element 需要回收的元素
     */
    recycleElement(element: HTMLElement): void {
        // BUG: 频繁创建/销毁DOM元素导致性能下降
        // Affects: VirtualScrollManager.ts, FileItemProcessor.ts
        // 清理内容
        element.innerHTML = '';
        // 移除所有事件监听（仅移除匿名/已知事件，复杂场景需扩展）
        const clone = element.cloneNode(false) as HTMLElement;
        element.replaceWith(clone);
        // 移除自身
        clone.remove();
        // 放回池中
        this.elementPool.push(clone);
    }

    /**
     * 当前池中可复用元素数量
     */
    getPoolSize(): number {
        return this.elementPool.length;
    }
}
