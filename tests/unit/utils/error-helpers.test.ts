import { 
    tryCatchWrapper, 
    asyncTryCatch, 
    isError, 
    convertToTitleChangerError,
    extractErrorDetails,
    handleSpecificErrors,
    logErrorsWithoutThrowing,
    safeRegexCreation,
    safeRegexExecution,
    measurePerformance,
    validateData,
    tryCatchWithValidation,
    handleEditorOperation,
    handleDataOperation
} from '../../../src/utils/ErrorHelpers';
import { ErrorCategory, TitleChangerError } from '../../../src/utils/errors';
import { ErrorLevel } from '../../../src/services/ErrorManagerService';

// 模拟依赖
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

describe('错误处理工具', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('tryCatchWrapper', () => {
        it('成功情况下应返回操作结果', () => {
            const result = tryCatchWrapper(
                () => 'success',
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBe('success');
            expect(mockErrorManager.handleError).not.toHaveBeenCalled();
        });
        
        it('失败情况下应处理错误并返回null', () => {
            const error = new Error('测试错误');
            const result = tryCatchWrapper(
                () => { throw error; },
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBeNull();
            expect(mockErrorManager.handleError).toHaveBeenCalled();
        });
    });
    
    describe('asyncTryCatch', () => {
        it('成功情况下应返回Promise结果', async () => {
            const result = await asyncTryCatch(
                Promise.resolve('async success'),
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBe('async success');
            expect(mockErrorManager.handleError).not.toHaveBeenCalled();
        });
        
        it('失败情况下应处理错误并返回null', async () => {
            const error = new Error('异步测试错误');
            const result = await asyncTryCatch(
                Promise.reject(error),
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBeNull();
            expect(mockErrorManager.handleError).toHaveBeenCalled();
        });
    });
    
    describe('isError', () => {
        it('对于Error实例应返回true', () => {
            expect(isError(new Error())).toBe(true);
            expect(isError(new TypeError())).toBe(true);
        });
        
        it('对于非Error实例应返回false', () => {
            expect(isError('string')).toBe(false);
            expect(isError(123)).toBe(false);
            expect(isError({})).toBe(false);
            expect(isError(null)).toBe(false);
            expect(isError(undefined)).toBe(false);
        });
    });
    
    describe('convertToTitleChangerError', () => {
        it('应将普通Error转换为TitleChangerError', () => {
            const originalError = new Error('原始错误');
            const converted = convertToTitleChangerError(
                originalError, 
                'TestComponent', 
                ErrorCategory.VALIDATION
            );
            
            expect(converted).toBeInstanceOf(TitleChangerError);
            expect(converted.message).toBe('原始错误');
            expect(converted.sourceComponent).toBe('TestComponent');
            expect(converted.category).toBe(ErrorCategory.VALIDATION);
        });
        
        it('如果已是TitleChangerError则应原样返回', () => {
            const original = new TitleChangerError('已存在的错误', {
                sourceComponent: 'Original',
                category: ErrorCategory.PARSER
            });
            
            const result = convertToTitleChangerError(
                original, 
                'TestComponent',
                ErrorCategory.VALIDATION
            );
            
            expect(result).toBe(original);
        });
    });
    
    describe('validateData', () => {
        it('有效数据应原样返回', () => {
            const data = { name: 'test' };
            const result = validateData(
                data, 
                d => Boolean(d.name), 
                '无效数据', 
                'TestComponent'
            );
            
            expect(result).toBe(data);
        });
        
        it('无效数据应抛出ValidationError', () => {
            const data = { name: '' };
            
            expect(() => validateData(
                data, 
                d => Boolean(d.name), 
                '无效数据', 
                'TestComponent'
            )).toThrow();
        });
    });
    
    describe('handleSpecificErrors', () => {
        it('应处理特定类别的错误', () => {
            const error = new TitleChangerError('测试错误', {
                category: ErrorCategory.PARSER,
                sourceComponent: 'TestComponent'
            });
            
            const result = handleSpecificErrors(
                error,
                {
                    [ErrorCategory.PARSER]: () => 'parser error handled',
                    [ErrorCategory.VALIDATION]: () => 'validation error handled'
                }
            );
            
            expect(result).toBe('parser error handled');
        });
        
        it('没有匹配处理器时应使用默认处理器', () => {
            const error = new TitleChangerError('测试错误', {
                category: ErrorCategory.API,
                sourceComponent: 'TestComponent'
            });
            
            const result = handleSpecificErrors(
                error,
                {
                    [ErrorCategory.PARSER]: () => 'parser error handled'
                },
                () => 'default handler'
            );
            
            expect(result).toBe('default handler');
        });
    });
    
    describe('safeRegexCreation', () => {
        it('应安全创建有效的正则表达式', () => {
            const regex = safeRegexCreation(
                'test\\d+',
                'i',
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(regex).toBeInstanceOf(RegExp);
            expect(regex?.test('TEST123')).toBe(true);
        });
        
        it('无效的正则表达式应返回null并处理错误', () => {
            const regex = safeRegexCreation(
                '\\',  // 无效的正则表达式
                'i',
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(regex).toBeNull();
            expect(mockErrorManager.handleError).toHaveBeenCalled();
        });
    });
    
    describe('handleEditorOperation & handleDataOperation', () => {
        it('handleEditorOperation应捕获错误并返回null', () => {
            const result = handleEditorOperation(
                () => { throw new Error('编辑器错误'); },
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBeNull();
            expect(mockErrorManager.handleError).toHaveBeenCalled();
            const error = mockErrorManager.handleError.mock.calls[0][0];
            expect(error.category).toBe(ErrorCategory.EDITOR);
        });
        
        it('handleDataOperation应捕获错误并返回null', () => {
            const result = handleDataOperation(
                () => { throw new Error('数据错误'); },
                'TestComponent',
                mockErrorManager as any,
                mockLogger as any
            );
            
            expect(result).toBeNull();
            expect(mockErrorManager.handleError).toHaveBeenCalled();
            const error = mockErrorManager.handleError.mock.calls[0][0];
            expect(error.category).toBe(ErrorCategory.DATA);
        });
    });
}); 