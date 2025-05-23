## 2024-07-22 20:00:00

1. 修复GraphView启动时部分节点显示"路径+文件名+md"问题
   ```
   root
   - src/services/TitleService.ts // fix getDisplayTitle回退逻辑，未命中缓存时只返回文件名（去除路径和扩展名）
   ```

2. 项目文档同步
   ```
   root
   - .codelf/project.md // update TitleService.ts回退逻辑修复说明
   ```

---

## 2024-07-22 00:00:00

1. 集成IntersectionObserver到VirtualScrollManager，实现文件项可见性高效追踪，仅渲染可见元素，进一步提升虚拟滚动性能
   ```
   root
   - src/managers/VirtualScrollManager.ts // update 集成IntersectionObserver，完善可见项追踪与渲染逻辑，配合DomRecycler实现高效DOM复用
   ```

2. 项目文档同步
   ```
   root
   - .codelf/project.md // update VirtualScrollManager.ts集成IntersectionObserver相关说明
   ```

---

## 2024-07-21 00:00:00

1. 集成DomRecycler到VirtualScrollManager，实现文件项DOM的自动复用与回收
   ```
   root
   - src/managers/VirtualScrollManager.ts // update 集成DomRecycler，新增renderFileItem与recycleFileItem方法，优化文件项渲染与回收流程，减少DOM频繁创建销毁
   ```

2. 项目文档同步
   ```
   root
   - .codelf/project.md // update VirtualScrollManager.ts集成DomRecycler相关说明
   ```

---

## 2024-07-20 10:20:00

1. 新增DOM元素池机制DomRecycler
   ```
   root
   - src/utils/DomRecycler.ts // add 新增DOMRecycler类，实现元素池与回收机制，为虚拟滚动和大列表渲染提供高效DOM复用能力
   ```

2. 项目文档同步
   ```
   root
   - .codelf/project.md // update 新增DomRecycler.ts说明，完善工具类文件描述
   ```

---

## 2024-07-22 21:00:00

1. 设置界面新增表达式下拉菜单，支持常用表达式（如"随便什么内容_YYYY_WW_要被提取的内容"）一键选择，自动填充输入框，仍可手动编辑。
   ```
   root
   - src/settings/sections/BasicSettings.ts // add 新增表达式下拉菜单，内置常用表达式选项，优化正则表达式配置体验
   ```

2. 项目文档同步
   ```
   root
   - .codelf/project.md // update 新增表达式下拉菜单功能说明
   ```

---
