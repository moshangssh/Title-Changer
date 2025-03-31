# Title-Changer 错误处理指南

## 介绍

Title-Changer 插件使用了一套统一的错误处理机制，旨在提高代码质量并简化错误处理流程。本文档将指导您如何在项目中正确使用这些错误处理工具。

## 错误分类

错误被分为以下几类：

- `CONFIG`: 配置相关错误
- `FILE`: 文件操作错误
- `REGEX`: 正则表达式错误
- `UI`: UI交互错误
- `NETWORK`: 网络相关错误
- `PARSER`: 解析错误
- `DATA`: 数据处理错误
- `LIFECYCLE`: 生命周期错误
- `PERFORMANCE`: 性能相关错误
- `EDITOR`: 编辑器相关错误
- `DECORATION`: 装饰/渲染相关错误
- `API`: API调用错误
- `VALIDATION`: 数据验证错误
- `UNKNOWN`: 未知错误

## 错误级别

错误级别从低到高分为：

- `DEBUG`: 调试信息
- `INFO`: 普通信息
- `WARNING`: 警告信息
- `ERROR`: 错误信息
- `CRITICAL`: 严重错误

## 基础错误处理工具

### 1. tryCatchWrapper

用于包装同步操作并统一处理错误。

```typescript
import { tryCatchWrapper } from '../utils/error-helpers';

// 使用示例
const result = tryCatchWrapper(
  () => someRiskyOperation(),
  'YourComponent',
  this.errorManager,
  this.logger,
  {
    errorMessage: '执行操作失败',
    category: ErrorCategory.FILE,
    level: ErrorLevel.ERROR,
    userVisible: true,
    details: { someContext: 'value' }
  }
);

// 结果可能为 null (出错时)
if (result !== null) {
  // 处理结果
}
```

### 2. asyncTryCatch

类似于 `tryCatchWrapper`，但用于异步操作。

```typescript
import { asyncTryCatch } from '../utils/error-helpers';

// 使用示例
const result = await asyncTryCatch(
  someAsyncOperation(),
  'YourComponent',
  this.errorManager,
  this.logger,
  {
    errorMessage: '异步操作失败',
    category: ErrorCategory.NETWORK,
    level: ErrorLevel.ERROR
  }
);

// 结果可能为 null (出错时)
if (result !== null) {
  // 处理结果
}
```

## 专业错误处理工具

### 3. handleSpecificErrors

针对不同类型的错误提供不同的处理方式。

```typescript
import { handleSpecificErrors } from '../utils/error-helpers';

try {
  // 尝试某些操作
} catch (error) {
  handleSpecificErrors(
    error,
    {
      [ErrorCategory.FILE]: (e) => {
        // 处理文件错误
        console.error('文件操作失败:', e.message);
      },
      [ErrorCategory.NETWORK]: (e) => {
        // 处理网络错误
        this.retryOperation();
      }
    },
    (e) => {
      // 默认处理其他错误
      console.error('未知错误:', e);
    }
  );
}
```

### 4. logErrorsWithoutThrowing

记录错误但不中断程序执行，适用于非关键操作。

```typescript
import { logErrorsWithoutThrowing } from '../utils/error-helpers';

const result = logErrorsWithoutThrowing(
  () => someOperation(),
  'YourComponent',
  this.errorManager,
  this.logger,
  {
    errorMessage: '操作失败但已被安全处理',
    category: ErrorCategory.UI,
    level: ErrorLevel.WARNING,
    defaultValue: fallbackValue
  }
);
```

## 性能监控工具

### 5. measurePerformance / measureAsyncPerformance

监控操作执行时间，在超过阈值时记录警告。

```typescript
import { measurePerformance } from '../utils/error-helpers';

// 监控同步操作性能
const result = measurePerformance(
  () => expensiveOperation(),
  'YourComponent',
  100, // 阈值(ms)
  this.errorManager,
  this.logger
);

// 监控异步操作性能
const asyncResult = await measureAsyncPerformance(
  asyncExpensiveOperation(),
  'YourComponent',
  200, // 阈值(ms)
  this.errorManager,
  this.logger
);
```

## 数据验证工具

### 6. validateData

验证数据，如果无效则抛出错误。

```typescript
import { validateData } from '../utils/error-helpers';

try {
  const validatedData = validateData(
    userData,
    (data) => data.title && data.title.length > 0,
    '标题不能为空',
    'YourComponent'
  );
  
  // 使用已验证的数据
} catch (error) {
  // 处理验证失败
}
```

### 7. tryCatchWithValidation

结合了 try-catch 和数据验证。

```typescript
import { tryCatchWithValidation } from '../utils/error-helpers';

const result = tryCatchWithValidation(
  () => fetchData(),
  (data) => Array.isArray(data) && data.length > 0,
  'YourComponent',
  this.errorManager,
  this.logger,
  {
    errorMessage: '获取数据失败',
    validationErrorMessage: '获取的数据无效',
    userVisible: true
  }
);
```

## 特定领域错误处理

### 8. handleEditorOperation

专门用于处理编辑器相关操作的错误。

```typescript
import { handleEditorOperation } from '../utils/error-helpers';

const editorResult = handleEditorOperation(
  () => this.editor.replaceSelection('new text'),
  'EditorComponent',
  this.errorManager,
  this.logger,
  {
    errorMessage: '编辑文本失败',
    userVisible: true
  }
);
```

### 9. handleDataOperation

专门用于处理数据操作的错误。

```typescript
import { handleDataOperation } from '../utils/error-helpers';

const processedData = handleDataOperation(
  () => processData(rawData),
  'DataProcessor',
  this.errorManager,
  this.logger,
  {
    errorMessage: '数据处理失败',
    userVisible: false
  }
);
```

## 最佳实践

1. **总是使用错误包装器**: 避免直接使用 try-catch，而应使用提供的错误处理工具。

2. **提供有意义的错误消息**: 错误消息应清晰描述发生了什么问题。

3. **正确分类错误**: 使用适合的错误类别，这有助于错误分析和处理。

4. **谨慎选择用户可见性**: 只有真正需要用户知道的错误才设置 `userVisible: true`。

5. **包含上下文信息**: 在 `details` 字段中提供足够的上下文信息以便调试。

6. **选择合适的错误级别**: 根据错误的严重性选择适当的级别。

7. **使用专门的错误类**: 例如，使用 `FileError` 而不是通用 `TitleChangerError`。

## 故障排除

如果您在使用错误处理工具时遇到问题:

1. 检查是否正确导入了所需的类和函数
2. 确保提供了所有必需的参数
3. 验证错误管理器和日志服务是否正确注入
4. 查看控制台中的详细错误信息 