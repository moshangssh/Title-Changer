import { mock } from 'jest-mock-extended';
import { App, TFile, Vault, Workspace } from 'obsidian';
import { LinkTitleWidget } from '../../src/components/widgets/LinkTitleWidget';
import { extractWikiLinks, WikiLink } from '../../src/utils/WikiLinkProcessor';

// 模拟Obsidian的应用程序环境
const createMockApp = () => {
    const mockVault = mock<Vault>();
    const mockWorkspace = mock<Workspace>();
    
    const mockApp = mock<App>({
        vault: mockVault,
        workspace: mockWorkspace
    });
    
    // 模拟文件系统
    const mockFiles: Record<string, TFile> = {};
    
    // 添加一些测试文件
    ['文件1', '测试文档', '重要笔记'].forEach(name => {
        mockFiles[name] = mock<TFile>({
            path: `${name}.md`,
            basename: name,
            extension: 'md',
            name: `${name}.md`
        });
    });
    
    // 模拟Vault方法
    mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
        const name = path.replace('.md', '');
        return mockFiles[name] || null;
    });
    
    mockVault.getFiles.mockImplementation(() => Object.values(mockFiles));
    
    return { app: mockApp, files: mockFiles };
};

describe('Title-Changer 集成测试', () => {
    describe('Wiki链接提取和处理流程', () => {
        it('应能正确提取Wiki链接并创建对应的小部件', () => {
            // 模拟文档内容
            const content = `
            # 测试文档
            
            这里有一些Wiki链接：
            - [[文件1]]
            - [[测试文档]]
            - [[重要笔记]]
            - [[不存在的文件]]
            `;
            
            // 1. 提取Wiki链接
            const links = extractWikiLinks(content);
            
            // 验证提取结果
            expect(links).toHaveLength(4);
            expect(links.map(l => l.fileName)).toEqual(['文件1', '测试文档', '重要笔记', '不存在的文件']);
            
            // 2. 检查链接信息
            links.forEach(link => {
                expect(link).toHaveProperty('fileName');
                expect(link).toHaveProperty('fullMatch');
                expect(link).toHaveProperty('start');
                expect(link).toHaveProperty('end');
            });
            
            // 3. 创建mock应用程序环境
            const { app, files } = createMockApp();
            
            // 4. 为每个链接创建小部件
            const widgets = links.map(link => {
                // 在实际应用中，可能会有额外的标题处理逻辑
                // 这里我们简单地使用文件名作为显示名称
                return new LinkTitleWidget(link.fileName, link.fullMatch, { app } as any);
            });
            
            // 5. 验证小部件创建和渲染
            widgets.forEach((widget, index) => {
                const link = links[index];
                const dom = widget.toDOM();
                
                // 检查基本属性
                expect(dom).toBeInstanceOf(HTMLElement);
                expect(dom.tagName).toBe('SPAN');
                expect(dom.textContent).toBe(link.fileName);
                expect(dom.className).toContain('title-changer-link');
                expect(dom.dataset.linktext).toBe(link.fullMatch);
            });
        });
    });

    describe('Title-Changer 错误处理集成', () => {
        it('应能优雅地处理无效的Wiki链接', () => {
            // 模拟包含无效Wiki链接的内容
            const content = `
            # 测试文档
            
            这里有一些无效的Wiki链接：
            - [[ ]] (空链接)
            - [[有效链接]]
            - [[|只有显示文本]]
            - [[#只有子路径]]
            `;
            
            // 尝试提取链接 - 不应该抛出错误
            const links = extractWikiLinks(content);
            
            // 应该只提取有效的链接
            expect(links.filter(l => l.fileName.trim() !== '')).toHaveLength(1);
            expect(links.find(l => l.fileName === '有效链接')).toBeDefined();
        });
    });
    
    describe('DOM操作与渲染集成', () => {
        it('LinkTitleWidget应能正确渲染和比较', () => {
            // 创建两个相同的小部件
            const widget1 = new LinkTitleWidget('标题', '[[标题]]');
            const widget2 = new LinkTitleWidget('标题', '[[标题]]');
            
            // 创建一个不同的小部件
            const widget3 = new LinkTitleWidget('不同标题', '[[不同标题]]');
            
            // 测试等价性比较
            expect(widget1.eq(widget2)).toBe(true);
            expect(widget1.eq(widget3)).toBe(false);
            
            // 测试DOM渲染
            const dom1 = widget1.toDOM();
            const dom2 = widget2.toDOM();
            const dom3 = widget3.toDOM();
            
            // 检查DOM元素
            expect(dom1.textContent).toBe(dom2.textContent);
            expect(dom1.textContent).not.toBe(dom3.textContent);
            
            // 检查属性
            expect(dom1.className).toBe(dom2.className);
            expect(dom1.getAttribute('data-original-text')).toBe(dom2.getAttribute('data-original-text'));
        });
    });
}); 