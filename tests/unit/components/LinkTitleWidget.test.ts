import { LinkTitleWidget } from '../../../src/components/widgets/LinkTitleWidget';

describe('LinkTitleWidget', () => {
    it('应该创建基本小部件并渲染为带有原始文本的装饰管理器样式', () => {
        const displayTitle = '显示标题';
        const originalText = '原始文本';
        const widget = new LinkTitleWidget(displayTitle, originalText);
        
        const dom = widget.toDOM();
        
        expect(dom.tagName).toBe('SPAN');
        expect(dom.textContent).toBe(`[[${displayTitle}]]`);
        expect(dom.className).toBe('cm-link cm-internal-link');
        expect(dom.getAttribute('data-original-text')).toBe(originalText);
    });
    
    it('应该创建编辑器视图样式的小部件（提供插件实例）', () => {
        const displayTitle = '显示标题';
        const originalText = '原始文本';
        const mockPlugin = { app: {} } as any;
        
        const widget = new LinkTitleWidget(displayTitle, originalText, mockPlugin);
        const dom = widget.toDOM();
        
        expect(dom.tagName).toBe('SPAN');
        expect(dom.textContent).toBe(displayTitle);
        expect(dom.className).toBe('title-changer-link cm-hmd-internal-link');
        expect(dom.dataset.linktext).toBe(originalText);
    });
    
    it('应该正确比较两个小部件是否相等', () => {
        const widget1 = new LinkTitleWidget('标题', '原文');
        const widget2 = new LinkTitleWidget('标题', '原文');
        const widget3 = new LinkTitleWidget('不同标题', '原文');
        
        expect(widget1.eq(widget2)).toBe(true);
        expect(widget1.eq(widget3)).toBe(false);
    });
    
    it('ignoreEvent 应该返回 false', () => {
        const widget = new LinkTitleWidget('标题', '原文');
        expect(widget.ignoreEvent()).toBe(false);
    });
}); 