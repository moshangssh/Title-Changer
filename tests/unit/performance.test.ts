import { extractWikiLinks } from '../../src/utils/wiki-link-processor';
import { LinkTitleWidget } from '../../src/components/widgets/LinkTitleWidget';
import { createSpan, createDiv } from '../../src/utils/dom-helpers';

const mockErrorManager = {
    handleError: jest.fn()
};

const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
};

/**
 * 性能测试工具函数 - 测量函数执行时间
 * @param fn 要测试的函数
 * @param iterations 迭代次数
 * @returns 平均执行时间(毫秒)
 */
function measureExecutionTime<T>(fn: () => T, iterations: number = 1000): number {
    // 预热
    for (let i = 0; i < 10; i++) {
        fn();
    }
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    
    return (end - start) / iterations;
}

describe('性能测试', () => {
    describe('Wiki链接处理', () => {
        it('应快速处理包含多个Wiki链接的文本', () => {
            // 创建测试文本 - 包含100个Wiki链接
            const generateTestText = () => {
                let text = '';
                for (let i = 0; i < 100; i++) {
                    text += `这是第${i}个链接 [[文件${i}]] 和 [[文件${i}|显示文本${i}]] 和 [[文件${i}#章节${i}]] 和普通文本。\n`;
                }
                return text;
            };
            
            const testText = generateTestText();
            
            // 测量extractWikiLinks函数的性能
            const avgTimeMs = measureExecutionTime(() => {
                extractWikiLinks(testText);
            }, 100);
            
            // 设置合理的性能阈值 - 具体值可能需要根据实际情况调整
            // 注意：这个阈值是根据当前硬件和代码效率设置的估计值
            expect(avgTimeMs).toBeLessThan(10); // 小于10毫秒
            
            console.log(`处理100个Wiki链接的平均时间: ${avgTimeMs.toFixed(3)}毫秒`);
        });
    });
    
    describe('DOM操作性能', () => {
        it('创建DOM元素应该高效', () => {
            // 测量创建span的性能
            const spanCreationTime = measureExecutionTime(() => {
                createSpan(
                    {
                        textContent: '测试文本',
                        className: 'test-class', 
                        dataset: { testAttr: 'value' }
                    },
                    'TestComponent',
                    mockErrorManager as any,
                    mockLogger as any
                );
            }, 500);
            
            // 测量创建div的性能
            const divCreationTime = measureExecutionTime(() => {
                createDiv(
                    {
                        textContent: '测试文本',
                        className: 'test-class', 
                        dataset: { testAttr: 'value' },
                        children: [document.createElement('span')]
                    },
                    'TestComponent',
                    mockErrorManager as any,
                    mockLogger as any
                );
            }, 500);
            
            // 手动创建元素的基准性能
            const manualCreationTime = measureExecutionTime(() => {
                const div = document.createElement('div');
                div.textContent = '测试文本';
                div.className = 'test-class';
                div.dataset.testAttr = 'value';
                const span = document.createElement('span');
                div.appendChild(span);
            }, 500);
            
            console.log(`创建span的平均时间: ${spanCreationTime.toFixed(3)}毫秒`);
            console.log(`创建div的平均时间: ${divCreationTime.toFixed(3)}毫秒`);
            console.log(`手动创建DOM的平均时间: ${manualCreationTime.toFixed(3)}毫秒`);
            
            // 我们的工具函数应该不会比手动创建慢太多
            expect(spanCreationTime).toBeLessThan(1.5 * manualCreationTime);
            expect(divCreationTime).toBeLessThan(2 * manualCreationTime);
        });
    });
    
    describe('LinkTitleWidget性能', () => {
        it('创建和渲染LinkTitleWidget应该高效', () => {
            // 测量创建LinkTitleWidget实例的性能
            const creationTime = measureExecutionTime(() => {
                new LinkTitleWidget('显示标题', '原始文本');
            }, 1000);
            
            // 测量渲染DOM的性能
            const widget = new LinkTitleWidget('显示标题', '原始文本');
            const renderTime = measureExecutionTime(() => {
                widget.toDOM();
            }, 1000);
            
            console.log(`创建LinkTitleWidget的平均时间: ${creationTime.toFixed(3)}毫秒`);
            console.log(`渲染LinkTitleWidget的平均时间: ${renderTime.toFixed(3)}毫秒`);
            
            // 设置合理的性能阈值
            expect(creationTime).toBeLessThan(0.5); // 小于0.5毫秒
            expect(renderTime).toBeLessThan(2);    // 小于2毫秒
        });
    });
}); 