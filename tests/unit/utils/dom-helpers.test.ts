import { 
    createEl, 
    createDiv, 
    createSpan, 
    createLink, 
    createButton, 
    createInput,
    empty,
    toggleClass,
    setAttribute,
    getAttribute,
    querySelector,
    querySelectorAll
} from '../../../src/utils/DomHelpers';
import { ErrorManagerService } from '../../../src/services/ErrorManagerService';
import { Logger } from '../../../src/utils/Logger';

// 模拟错误管理器和日志记录器
const mockErrorManager = {
    logError: jest.fn(),
    reportError: jest.fn()
} as unknown as ErrorManagerService;

const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
} as unknown as Logger;

describe('DOM助手函数', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('createEl', () => {
        it('应该创建具有给定标签的基本元素', () => {
            const el = createEl(
                { tag: 'div' }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(el).not.toBeNull();
            expect(el?.tagName).toBe('DIV');
        });

        it('应该设置所有提供的属性', () => {
            const el = createEl(
                { 
                    tag: 'div',
                    id: 'test-id',
                    className: 'test-class',
                    textContent: 'Test content',
                    title: 'Test title',
                    style: { color: 'red', fontSize: '14px' },
                    dataset: { testKey: 'test-value' },
                    attributes: { 'data-custom': 'custom-value' }
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(el?.id).toBe('test-id');
            expect(el?.className).toBe('test-class');
            expect(el?.textContent).toBe('Test content');
            expect(el?.title).toBe('Test title');
            expect(el?.style.color).toBe('red');
            expect(el?.style.fontSize).toBe('14px');
            expect(el?.dataset.testKey).toBe('test-value');
            expect(el?.getAttribute('data-custom')).toBe('custom-value');
        });

        it('应该添加子元素', () => {
            const child1 = document.createElement('span');
            const child2 = document.createElement('a');
            
            const el = createEl(
                { 
                    tag: 'div',
                    children: [child1, child2]
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(el?.children.length).toBe(2);
            expect(el?.children[0]).toBe(child1);
            expect(el?.children[1]).toBe(child2);
        });

        it('应该添加事件监听器', () => {
            const mockClickHandler = jest.fn();
            const mockMouseoverHandler = jest.fn();
            
            const el = createEl(
                { 
                    tag: 'button',
                    listeners: {
                        click: mockClickHandler,
                        mouseover: mockMouseoverHandler
                    }
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            // 触发事件
            el?.click();
            expect(mockClickHandler).toHaveBeenCalledTimes(1);
            
            // 模拟mouseover事件
            const mouseoverEvent = new MouseEvent('mouseover');
            el?.dispatchEvent(mouseoverEvent);
            expect(mockMouseoverHandler).toHaveBeenCalledTimes(1);
        });

        it('应该追加到父元素（默认是append）', () => {
            const parent = document.createElement('div');
            document.body.appendChild(parent);
            
            const el = createEl(
                { 
                    tag: 'span',
                    textContent: 'Child element',
                    parent
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(parent.children.length).toBe(1);
            expect(parent.children[0]).toBe(el);
        });

        it('应该在父元素的开头添加元素（prepend）', () => {
            const parent = document.createElement('div');
            const existingChild = document.createElement('div');
            parent.appendChild(existingChild);
            document.body.appendChild(parent);
            
            const el = createEl(
                { 
                    tag: 'span',
                    textContent: 'Prepended element',
                    parent,
                    prepend: true
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(parent.children.length).toBe(2);
            expect(parent.children[0]).toBe(el);
            expect(parent.children[1]).toBe(existingChild);
        });
    });

    describe('特定元素创建函数', () => {
        it('createDiv 应该创建 div 元素', () => {
            const div = createDiv(
                { className: 'test-div' }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(div?.tagName).toBe('DIV');
            expect(div?.className).toBe('test-div');
        });

        it('createSpan 应该创建 span 元素', () => {
            const span = createSpan(
                { textContent: 'Test span' }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(span?.tagName).toBe('SPAN');
            expect(span?.textContent).toBe('Test span');
        });

        it('createLink 应该创建 a 元素', () => {
            const link = createLink(
                { 
                    attributes: { href: 'https://example.com' },
                    textContent: 'Test link'
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(link?.tagName).toBe('A');
            expect(link?.getAttribute('href')).toBe('https://example.com');
            expect(link?.textContent).toBe('Test link');
        });

        it('createButton 应该创建 button 元素', () => {
            const button = createButton(
                { textContent: 'Click me' }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(button?.tagName).toBe('BUTTON');
            expect(button?.textContent).toBe('Click me');
        });

        it('createInput 应该创建 input 元素', () => {
            const input = createInput(
                { 
                    attributes: { type: 'text', placeholder: 'Enter text' }
                }, 
                'TestComponent', 
                mockErrorManager, 
                mockLogger
            );
            
            expect(input?.tagName).toBe('INPUT');
            expect(input?.getAttribute('type')).toBe('text');
            expect(input?.getAttribute('placeholder')).toBe('Enter text');
        });
    });

    describe('元素操作函数', () => {
        it('empty 应该清空元素内容', () => {
            const container = document.createElement('div');
            const child1 = document.createElement('span');
            const child2 = document.createElement('a');
            container.appendChild(child1);
            container.appendChild(child2);
            
            expect(container.children.length).toBe(2);
            
            const result = empty(container, 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBe(true);
            expect(container.children.length).toBe(0);
        });

        it('toggleClass 应该添加类名', () => {
            const el = document.createElement('div');
            
            const result = toggleClass(el, 'test-class', true, 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBe(true);
            expect(el.classList.contains('test-class')).toBe(true);
        });

        it('toggleClass 应该移除类名', () => {
            const el = document.createElement('div');
            el.classList.add('test-class');
            
            const result = toggleClass(el, 'test-class', false, 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBe(true);
            expect(el.classList.contains('test-class')).toBe(false);
        });

        it('setAttribute 应该设置属性', () => {
            const el = document.createElement('div');
            
            const result = setAttribute(el, 'data-test', 'test-value', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBe(true);
            expect(el.getAttribute('data-test')).toBe('test-value');
        });

        it('getAttribute 应该获取属性', () => {
            const el = document.createElement('div');
            el.setAttribute('data-test', 'test-value');
            
            const result = getAttribute(el, 'data-test', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBe('test-value');
        });

        it('getAttribute 在元素为 null 时应该返回 null', () => {
            const result = getAttribute(null, 'data-test', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBeNull();
        });
    });

    describe('查询函数', () => {
        beforeEach(() => {
            // 设置测试 DOM
            document.body.innerHTML = `
                <div class="container">
                    <div class="item" id="item-1">Item 1</div>
                    <div class="item" id="item-2">Item 2</div>
                    <span class="label">Label 1</span>
                    <span class="label">Label 2</span>
                </div>
            `;
        });

        it('querySelector 应该返回匹配的第一个元素', () => {
            const container = document.querySelector('.container') as HTMLElement;
            
            const result = querySelector(container, '.item', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).not.toBeNull();
            expect(result?.id).toBe('item-1');
        });

        it('querySelector 在没有匹配时应该返回 null', () => {
            const container = document.querySelector('.container') as HTMLElement;
            
            const result = querySelector(container, '.non-existent', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(result).toBeNull();
        });

        it('querySelectorAll 应该返回所有匹配的元素', () => {
            const container = document.querySelector('.container') as HTMLElement;
            
            const results = querySelectorAll(container, '.item', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(results.length).toBe(2);
            expect(results[0].id).toBe('item-1');
            expect(results[1].id).toBe('item-2');
        });

        it('querySelectorAll 在没有匹配时应该返回空数组', () => {
            const container = document.querySelector('.container') as HTMLElement;
            
            const results = querySelectorAll(container, '.non-existent', 'TestComponent', mockErrorManager, mockLogger);
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });
}); 