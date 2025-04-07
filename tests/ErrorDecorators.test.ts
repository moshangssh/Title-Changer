import { ErrorHandled, AsyncErrorHandled, ClassErrorHandled, ErrorHandlerOptions, ErrorHandler } from '../src/utils/ErrorDecorators';
import { ErrorCategory, TitleChangerError } from '../src/utils/errors';
import { ErrorLevel, ErrorManagerService } from '../src/services/ErrorManagerService';
import { Logger } from '../src/utils/logger';

// 模拟错误管理器
class MockErrorManager {
  public lastError: TitleChangerError | null = null;
  public lastLevel: ErrorLevel | null = null;
  
  handleError(error: TitleChangerError, level: ErrorLevel): void {
    this.lastError = error;
    this.lastLevel = level;
  }
}

// 模拟日志记录器
class MockLogger {
  public lastMessage: string | null = null;
  public lastData: any = null;
  
  debug(message: string, data?: any): void {
    this.lastMessage = message;
    this.lastData = data;
  }
  
  info(message: string, data?: any): void {
    this.lastMessage = message;
    this.lastData = data;
  }
  
  warn(message: string, data?: any): void {
    this.lastMessage = message;
    this.lastData = data;
  }
  
  error(message: string, data?: any): void {
    this.lastMessage = message;
    this.lastData = data;
  }
}

describe('ErrorDecorators', () => {
  let errorManager: MockErrorManager;
  let logger: MockLogger;
  let consoleErrorSpy: jest.SpyInstance;
  
  beforeEach(() => {
    errorManager = new MockErrorManager();
    logger = new MockLogger();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });
  
  describe('ErrorHandled Decorator', () => {
    it('应该正常执行没有错误的方法', () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @ErrorHandled({
          errorMessage: '测试错误',
          category: ErrorCategory.GENERAL,
          level: ErrorLevel.WARNING
        })
        testMethod(a: number, b: number): number {
          return a + b;
        }
      }
      
      const instance = new TestClass();
      const result = instance.testMethod(1, 2);
      
      expect(result).toBe(3);
      expect(errorManager.lastError).toBeNull();
      expect(logger.lastMessage).toBeNull();
    });
    
    it('应该捕获并处理方法中的错误', () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @ErrorHandled({
          errorMessage: '测试错误',
          category: ErrorCategory.GENERAL,
          level: ErrorLevel.WARNING
        })
        testMethod(): number {
          throw new Error('测试异常');
        }
      }
      
      const instance = new TestClass();
      const result = instance.testMethod();
      
      expect(result).toBeNull();
      expect(errorManager.lastError).not.toBeNull();
      expect(errorManager.lastError?.category).toBe(ErrorCategory.GENERAL);
      expect(errorManager.lastLevel).toBe(ErrorLevel.WARNING);
      expect(logger.lastMessage).toBe('测试错误');
    });
    
    it('应该使用默认值作为错误情况下的返回值', () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @ErrorHandled({
          errorMessage: '测试错误',
          category: ErrorCategory.GENERAL,
          level: ErrorLevel.WARNING,
          defaultValue: -1
        })
        testMethod(): number {
          throw new Error('测试异常');
        }
      }
      
      const instance = new TestClass();
      const result = instance.testMethod();
      
      expect(result).toBe(-1);
    });
  });
  
  describe('AsyncErrorHandled Decorator', () => {
    it('应该正常执行没有错误的异步方法', async () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @AsyncErrorHandled({
          errorMessage: '异步测试错误',
          category: ErrorCategory.SERVICE,
          level: ErrorLevel.ERROR
        })
        async testAsyncMethod(a: number, b: number): Promise<number> {
          return a + b;
        }
      }
      
      const instance = new TestClass();
      const result = await instance.testAsyncMethod(3, 4);
      
      expect(result).toBe(7);
      expect(errorManager.lastError).toBeNull();
      expect(logger.lastMessage).toBeNull();
    });
    
    it('应该捕获并处理异步方法中的错误', async () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @AsyncErrorHandled({
          errorMessage: '异步测试错误',
          category: ErrorCategory.SERVICE,
          level: ErrorLevel.ERROR
        })
        async testAsyncMethod(): Promise<number> {
          throw new Error('异步测试异常');
        }
      }
      
      const instance = new TestClass();
      const result = await instance.testAsyncMethod();
      
      expect(result).toBeNull();
      expect(errorManager.lastError).not.toBeNull();
      expect(errorManager.lastError?.category).toBe(ErrorCategory.SERVICE);
      expect(errorManager.lastLevel).toBe(ErrorLevel.ERROR);
      expect(logger.lastMessage).toBe('异步测试错误');
    });
  });
  
  describe('ClassErrorHandled Decorator', () => {
    it('应该为类的所有方法添加错误处理', () => {
      // 创建测试类
      @ClassErrorHandled({
        errorMessage: '类测试错误',
        category: ErrorCategory.GENERAL,
        level: ErrorLevel.ERROR
      })
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        syncMethod(): string {
          throw new Error('同步方法错误');
        }
        
        async asyncMethod(): Promise<string> {
          throw new Error('异步方法错误');
        }
      }
      
      const instance = new TestClass();
      
      // 测试同步方法
      const syncResult = instance.syncMethod();
      expect(syncResult).toBeNull();
      expect(errorManager.lastError?.category).toBe(ErrorCategory.GENERAL);
      
      // 重置模拟
      errorManager.lastError = null;
      logger.lastMessage = null;
      
      // 测试异步方法
      instance.asyncMethod().then(asyncResult => {
        expect(asyncResult).toBeNull();
        expect(errorManager.lastError?.category).toBe(ErrorCategory.GENERAL);
      });
    });
  });
  
  describe('ErrorHandler Legacy Decorator', () => {
    it('应该与新API兼容', () => {
      // 创建测试类
      class TestClass {
        public errorManager = errorManager;
        public logger = logger;
        
        @ErrorHandler({
          errorMessage: '旧版装饰器测试',
          category: ErrorCategory.VALIDATION,
          level: ErrorLevel.INFO
        })
        legacyMethod(): void {
          throw new Error('旧版错误');
        }
      }
      
      const instance = new TestClass();
      instance.legacyMethod();
      
      expect(errorManager.lastError).not.toBeNull();
      expect(errorManager.lastError?.category).toBe(ErrorCategory.VALIDATION);
      expect(errorManager.lastLevel).toBe(ErrorLevel.INFO);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
}); 