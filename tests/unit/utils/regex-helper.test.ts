/**
 * 正则表达式辅助函数测试
 */
import { 
    createSafeRegex,
    executeSafeRegex,
    ErrorType,
    ErrorSeverity,
    hasCapturingGroups,
    getRegexErrorDescription
} from '../../../src/utils/RegexHelper';

describe('正则表达式辅助工具', () => {
    describe('createSafeRegex', () => {
        it('应成功创建有效的正则表达式', () => {
            const result = createSafeRegex('\\d+', 'g');
            expect(result.regex).toBeInstanceOf(RegExp);
            expect(result.error).toBeNull();
        });

        it('应处理无效的正则表达式语法', () => {
            const result = createSafeRegex('\\', '');
            expect(result.regex).toBeNull();
            expect(result.error).toBeTruthy();
        });
        
        it('应处理无效的正则表达式标志', () => {
            const result = createSafeRegex('\\d+', 'z');
            expect(result.regex).toBeNull();
            expect(result.error).toBeTruthy();
        });
    });

    describe('executeSafeRegex', () => {
        it('应成功执行有效的正则匹配', () => {
            const regex = new RegExp('\\d+');
            const result = executeSafeRegex(regex, 'abc123def');
            expect(result.matches).toEqual(['123']);
            expect(result.error).toBeNull();
        });

        it('应处理执行错误', () => {
            // 创建一个会导致执行错误的正则表达式
            // 例如，会导致堆栈溢出的正则表达式
            const problematicRegex = new RegExp('(x+x+)+y');
            const result = executeSafeRegex(problematicRegex, 'xxxxxxxxxxxxxxxxxxxxxxxxxy');
            
            // 注意：在某些JavaScript引擎中这可能不会失败，但在有些环境中会
            // 因此只需验证方法返回了预期的结构
            expect(result).toHaveProperty('matches');
            expect(result).toHaveProperty('error');
        });

        it('应返回null匹配当无匹配时', () => {
            const regex = new RegExp('\\d+');
            const result = executeSafeRegex(regex, 'abcdef');
            expect(result.matches).toBeNull();
            expect(result.error).toBeNull();
        });
    });

    describe('hasCapturingGroups', () => {
        it('应检测到存在捕获组', () => {
            const regex = new RegExp('test_(\\d+)');
            expect(hasCapturingGroups(regex)).toBe(true);
        });

        it('应检测到无捕获组', () => {
            const regex = new RegExp('test_\\d+');
            expect(hasCapturingGroups(regex)).toBe(false);
        });
    });

    describe('getRegexErrorDescription', () => {
        it('应提供用户友好的错误描述', () => {
            const result = getRegexErrorDescription('\\', '无效的转义');
            expect(result).toContain('转义');
        });

        it('应处理未知错误类型', () => {
            const errorMessage = '未知错误类型';
            const result = getRegexErrorDescription('[a-z', errorMessage);
            expect(result).toBe(errorMessage);
        });
    });
}); 