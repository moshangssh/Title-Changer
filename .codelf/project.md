## TitleChanger
> 该项目使用的技术、工具库及其对应的依赖版本如下：
> TypeScript(4.7.4)、Obsidian API(latest)、InversifyJS(7.2.0)、Jest(29.7.0)、Reflect-metadata(0.2.2)、UUID(11.1.0)、ts-node(10.9.2)


## 项目结构

> 项目结构如下，按重要度和功能进行分类：

```
Title-Changer/
├── src/                 # 源代码目录
│   ├── services/        # 服务层实现，包含DOM选择器、事件处理等核心服务
│   │   ├── DOMSelectorService.ts # DOM元素选择和操作服务
│   │   ├── FileHandlerService.ts # 文件处理和操作服务
│   │   ├── TitleService.ts # 标题服务，负责自定义标题获取与回退逻辑
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
│   │   ├── LRUCacheFactory.ts # LRU缓存工厂类
│   │   └── DomRecycler.ts # DOM元素池与回收机制（新）
│   ├── components/      # UI组件和视图相关逻辑
│   │   └── modals/      # 对话框和弹窗组件
│   ├── managers/        # 管理器类，如缓存管理器等
│   │   ├── ViewManager.ts # 视图控制管理器
│   │   └── VirtualScrollManager.ts # 虚拟滚动管理器，优化大文件列表滚动性能，集成DomRecycler实现DOM池自动复用与回收
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
│   ├── unit/           # 单元测试文件
│   │   └── utils/      # 工具类测试
│   │       ├── LRUCache.test.ts # 基础LRU缓存测试
│   │       └── EnhancedLRUCache.test.ts # 增强型LRU缓存测试
├── benchmark/      # 性能基准测试目录
│       ├── LRUCacheBenchmark.ts # LRU缓存基准测试实现
│       ├── TitleCacheBenchmark.ts # 标题缓存应用场景测试
│       ├── ResultProcessor.ts # 测试结果处理和分析工具
│       ├── index.ts # 基准测试入口文件
│       └── results/ # 测试结果和报告存储目录
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

> TitleChanger是一个Obsidian插件，主要功能是允许用户自定义和修改文档的显示标题。该插件主要实现以下功能：

1. **文件标题自定义**: 允许用户为Obsidian中的每个文件设置自定义显示标题，而不改变文件名
2. **标题格式化**: 支持多种标题格式化选项，如大小写调整、前缀/后缀添加等
3. **批量标题处理**: 支持按照规则批量修改多个文件的显示标题
4. **标题缓存**: 通过LRU缓存机制提高性能，避免重复计算
5. **设置界面**: 提供友好的设置界面，允许用户配置插件行为
6. **缓存持久化**: 支持缓存保存和恢复功能，提高重启后性能

## 核心模块与职责

| 模块 | 主要职责 | 关键文件 |
|------|---------|---------|
| 服务层 | 提供核心功能实现 | services/DOMSelectorService.ts, services/FileHandlerService.ts, services/TitleService.ts |
| 管理器 | 协调和管理功能模块 | CacheManager.ts, managers/ViewManager.ts, managers/VirtualScrollManager.ts |
| UI组件 | 提供用户界面 | components/modals/TitleModal.ts, settings/SettingTab.ts |
| 工具类 | 提供通用功能 | utils/DOMUtils.ts, utils/FileUtils.ts, utils.DonRecycler.ts |
| 缓存系统 | 提高性能，减少重复计算 | utils/LRUCache.ts, utils/EnhancedLRUCache.ts, CacheManager.ts |
| 插件核心 | 插件生命周期与入口 | main.ts, InversifyConfig.ts |

## 依赖注入与模块化

> 项目采用InversifyJS实现依赖注入，通过面向接口编程提高代码的可测试性和可维护性。主要模块通过IoC容器进行管理，降低组件间的耦合度。

## 文件详细说明

### 服务层文件
- **TitleService.ts**: 标题服务，负责自定义标题获取、缓存命中与回退逻辑。2024-07-22修复了GraphView节点显示异常，未命中缓存时回退只返回文件名（去除路径和扩展名），不会再显示路径+文件名+md。

### 工具类文件
- **DomRecycler.ts**: DOM元素池与回收机制，支持高效复用和回收div等常用元素，减少频繁创建销毁带来的性能损耗。

### 管理器文件
- **VirtualScrollManager.ts**: 虚拟滚动管理器，负责大文件列表的高效滚动与可见项追踪，已实现节流与requestAnimationFrame优化，集成DomRecycler实现DOM池自动复用与回收，并已集成IntersectionObserver实现文件项可见性高效追踪，仅渲染可见元素，进一步提升滚动流畅度和性能。

### 其他说明
- 其余说明同前，未变更部分略。
