## Language: TypeScript
> 当前项目采用了TypeScript作为主要开发语言，具有严格的类型检查和模块化结构。项目使用了InversifyJS进行依赖注入，实现了面向接口编程。

**Formatter Library:**
- [TypeScript ESLint (5.29.0)]()
- [tslib (2.4.0)]()

**Usable Utilities and Components:**
> 项目中存在的公共方法和组件目录，以及其功能简介。
```
- src/utils            # 通用工具函数
  - DOMUtils          # DOM操作相关工具
  - FileUtils         # 文件处理工具
  - RegexUtils        # 正则表达式处理工具
- src/services        # 核心服务
  - DOMSelectorService # DOM元素选择服务
  - FileHandlerService # 文件处理服务
  - ExplorerEventsService # 文件浏览器事件服务
- src/managers        # 管理器
  - CacheManager      # 缓存管理器
  - ViewManager       # 视图管理器
```

**Coding Conventions:**
> 清晰的代码责任分离：路由、业务逻辑和工具函数独立组织。
```
- services   # 核心服务实现
- managers   # 管理器和协调器
- utils      # 工具函数定义
- components # UI组件实现
- types      # 类型定义
```

**Folder and Variable Naming Conventions:**
- 使用语义化命名
- 类名使用PascalCase
- 变量和方法使用camelCase
- 接口名前加"I"前缀（如IService）
- 常量使用UPPER_SNAKE_CASE
- 文件名与导出的主要类/接口同名

**Error Monitoring and Logging:**
> 项目使用统一的错误处理机制，分为8种错误类别。日志记录遵循以下原则：
```
- 使用Obsidian API的console进行日志记录
- 错误日志包含详细的上下文信息
- 开发模式下提供更详细的日志
- 生产环境中最小化日志输出
- 关键操作记录警告和错误