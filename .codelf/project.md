## Title Changer
> 该项目使用的技术、工具库及其对应的依赖版本如下：
> TypeScript(4.7.4)、Obsidian API(latest)、InversifyJS(7.2.0)、Jest(29.7.0)、Reflect-metadata(0.2.2)、UUID(11.1.0)


## 项目结构

> 项目结构如下，按重要度和功能进行分类：

```
Title-Changer/
├── src/                 # 源代码目录
│   ├── services/        # 服务层实现，包含DOM选择器、事件处理等核心服务
│   │   ├── DOMSelectorService.ts # DOM元素选择和操作服务
│   │   ├── FileHandlerService.ts # 文件处理和操作服务
│   │   └── ExplorerEventsService.ts # 文件浏览器事件监听服务
│   ├── types/           # TypeScript类型定义和接口
│   │   ├── interfaces/  # 接口定义目录
│   │   └── models/      # 数据模型定义
│   ├── utils/           # 工具函数和辅助方法
│   │   ├── DOMUtils.ts  # DOM操作辅助函数
│   │   ├── FileUtils.ts # 文件处理辅助函数
│   │   ├── RegexUtils.ts # 正则表达式处理工具
│   │   ├── LRUCache.ts  # 基础LRU缓存实现（Map结构）
│   │   ├── LRUCacheBase.ts # LRU缓存基础接口定义
│   │   ├── EnhancedLRUCache.ts # 增强型LRU缓存实现（双向链表+Map结构）
│   │   └── LRUCacheFactory.ts # LRU缓存工厂类
│   ├── components/      # UI组件和视图相关逻辑
│   │   └── modals/      # 对话框和弹窗组件
│   ├── managers/        # 管理器类，如缓存管理器等
│   │   └── ViewManager.ts # 视图控制管理器
│   ├── settings/        # 插件设置相关代码
│   │   └── SettingTab.ts # 设置界面实现
│   ├── views/           # 视图和UI显示逻辑
│   ├── styles/          # 样式文件目录
│   ├── config/          # 配置文件和常量定义
│   │   └── Constants.ts # 全局常量定义
│   ├── InversifyConfig.ts # 依赖注入配置，实现IoC容器
│   ├── main.ts          # 插件入口文件，包含插件生命周期管理
│   └── CacheManager.ts  # 缓存管理器实现，提高性能
├── tests/              # 测试目录
│   └── unit/           # 单元测试文件
│       └── utils/      # 工具类测试
│           ├── LRUCache.test.ts # 基础LRU缓存测试
│           └── EnhancedLRUCache.test.ts # 增强型LRU缓存测试
├── docs/               # 文档目录
│   ├── api/            # API文档
│   ├── usage/          # 使用指南
│   ├── LRU缓存优化方案.md # LRU缓存优化设计文档
│   └── LRU缓存优化进度.md # LRU缓存优化实现进度记录
├── samples/            # 示例文件目录
├── .codelf/            # 项目文档和记录目录
├── .cursor/            # Cursor IDE配置目录
├── styles.css          # 全局样式表
├── main.js             # 编译后的插件主文件
├── tsconfig.json       # TypeScript配置
├── package.json        # 项目依赖和脚本定义
├── package-lock.json   # 依赖版本锁定文件
├── jest.config.js      # Jest测试框架配置
├── esbuild.config.mjs  # ESBuild打包工具配置
├── manifest.json       # Obsidian插件清单
├── LICENSE             # 项目许可证文件
└── README.md           # 项目说明文档
```

## 项目功能概述

> Title Changer是一个Obsidian插件，主要功能是允许用户自定义和修改文档的显示标题。该插件主要实现以下功能：

1. **文件标题自定义**: 允许用户为Obsidian中的每个文件设置自定义显示标题，而不改变文件名
2. **标题格式化**: 支持多种标题格式化选项，如大小写调整、前缀/后缀添加等
3. **批量标题处理**: 支持按照规则批量修改多个文件的显示标题
4. **标题缓存**: 通过LRU缓存机制提高性能，避免重复计算
5. **设置界面**: 提供友好的设置界面，允许用户配置插件行为
6. **缓存持久化**: 支持缓存保存和恢复功能，提高重启后性能

## 核心模块与职责

| 模块 | 主要职责 | 关键文件 |
|------|---------|---------|
| 服务层 | 提供核心功能实现 | services/DOMSelectorService.ts, services/FileHandlerService.ts |
| 管理器 | 协调和管理功能模块 | CacheManager.ts, managers/ViewManager.ts |
| UI组件 | 提供用户界面 | components/modals/TitleModal.ts, settings/SettingTab.ts |
| 工具类 | 提供通用功能 | utils/DOMUtils.ts, utils/FileUtils.ts |
| 缓存系统 | 提高性能，减少重复计算 | utils/LRUCache.ts, utils/EnhancedLRUCache.ts, CacheManager.ts |
| 插件核心 | 插件生命周期与入口 | main.ts, InversifyConfig.ts |

## 依赖注入与模块化

> 项目采用InversifyJS实现依赖注入，通过面向接口编程提高代码的可测试性和可维护性。主要模块通过IoC容器进行管理，降低组件间的耦合度。

## 文件详细说明

### 核心服务文件
- **DOMSelectorService.ts**: 负责选择和操作DOM元素，特别是与标题显示相关的DOM节点
- **FileHandlerService.ts**: 处理文件操作，包括读取、写入和更新文件信息
- **ExplorerEventsService.ts**: 监听文件浏览器事件，响应文件选择、重命名等操作

### 工具类文件
- **DOMUtils.ts**: 提供DOM操作的通用方法，简化DOM节点的查找和更新
- **FileUtils.ts**: 文件处理辅助函数，处理文件路径、名称解析等
- **RegexUtils.ts**: 正则表达式工具，用于标题格式化和模式匹配

### 缓存系统文件
- **LRUCacheBase.ts**: 定义LRU缓存基础接口，确保不同实现的兼容性，支持过期时间、权重机制、批量操作、事件系统和序列化功能
- **LRUCache.ts**: 基于Map结构的经典LRU缓存实现，包含过期时间、权重机制、事件发布和序列化/反序列化支持
- **EnhancedLRUCache.ts**: 基于双向链表+Map结构的增强型LRU缓存实现，提供更高效的操作，支持固定和滑动过期时间，完整事件系统和序列化功能
- **LRUCacheFactory.ts**: 工厂类，根据配置创建不同类型的LRU缓存实例，支持容量、权重上限和清理间隔设置，以及序列化/反序列化帮助方法
- **CacheManager.ts**: 管理标题缓存，协调不同类型缓存的创建和使用，定期清理过期项，支持缓存持久化和从本地存储恢复缓存状态

### 管理器文件
- **ViewManager.ts**: 控制视图渲染和更新，管理UI状态

### 配置文件
- **InversifyConfig.ts**: 配置依赖注入容器，绑定接口和实现类
- **Constants.ts**: 定义全局常量，统一管理配置值

### 入口文件
- **main.ts**: 插件入口点，处理插件的生命周期事件，初始化各模块