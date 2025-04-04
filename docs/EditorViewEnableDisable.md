# EditorView启用/禁用功能方案设计

## 1. 功能概述

为`EditorLinkView`组件添加启用和禁用功能，使用户能够控制编辑器视图中双链标题的显示功能。要求能在启用或禁用后立即刷新文件名显示，提供即时的用户反馈。

## 2. 当前状态分析

`EditorLinkView`目前负责处理编辑器中Wiki链接的显示，将原始文件名替换为自定义显示标题。当前实现已经具备视图更新机制，但缺少启用/禁用控制功能。

从代码分析可知：
- `AbstractView`基类已经实现了基础的启用/禁用功能
- `EditorLinkView`需要扩展这些功能，特别是处理启用/禁用状态变化时的即时刷新

## 3. 实现方案

### 3.1 添加设置页面开关

在插件的设置页面中添加EditorLinkView的启用/禁用控制开关：

```typescript
export class SettingTabView extends PluginSettingTab {
    // 现有代码保持不变...
    
    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        
        // 添加编辑器链接视图启用/禁用设置
        new Setting(containerEl)
            .setName('启用编辑器链接视图')
            .setDesc('控制是否在编辑器中将Wiki链接显示为自定义标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableEditorLinkView)
                .onChange(async (value) => {
                    this.plugin.settings.enableEditorLinkView = value;
                    
                    // 根据开关状态启用或禁用视图
                    if (value) {
                        this.plugin.viewManager.enableView(EditorLinkView.VIEW_ID);
                    } else {
                        this.plugin.viewManager.disableView(EditorLinkView.VIEW_ID);
                    }
                    
                    // 保存设置
                    await this.plugin.saveSettings();
                }));
        
        // 其他设置项保持不变...
    }
}

// 添加设置模型中的相关字段
interface PluginSettings {
    // 现有设置保持不变...
    enableEditorLinkView: boolean;
}

// 默认设置
const DEFAULT_SETTINGS: PluginSettings = {
    // 现有默认设置保持不变...
    enableEditorLinkView: true
};
```

### 3.2 修改EditorLinkView实现

扩展`EditorLinkView`类的实现，重写`onEnable`和`onDisable`方法，以确保状态变更时视图能够立即更新：

```typescript
import { App, MarkdownView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { EditorView, StateEffect, Extension } from '@codemirror/view';
import { ErrorCategory, ErrorLevel } from '../errors/error-types';
import { injectable } from 'inversify';
import { AbstractView } from './abstract-view';

@injectable()
export class EditorLinkView extends AbstractView {
    // 现有代码保持不变...

    /**
     * 当视图被启用时调用
     * 重写基类方法以提供自定义行为
     */
    protected override onEnable(): void {
        super.onEnable();
        
        // 重新注册编辑器扩展（如果之前被禁用）
        if (this.registeredExtensions.length === 0) {
            this.registerEditorExtension();
        }
        
        // 立即刷新视图以显示更新后的文件名
        this.updateView();
    }

    /**
     * 当视图被禁用时调用
     * 重写基类方法以提供自定义行为
     */
    protected override onDisable(): void {
        super.onDisable();
        
        // 移除所有已注册的编辑器扩展
        this.registeredExtensions.forEach(symbol => {
            this.extensionManager.unregisterExtension(symbol);
        });
        this.registeredExtensions = [];
        
        // 通知编辑器视图已更新（移除了所有装饰）
        this.extensionManager.refreshAll();
        
        // BUG修复：强制触发编辑器重绘以确保文件名立即刷新
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view.getViewType() === 'markdown') {
                // 获取编辑器实例
                const editorView = this.getEditorFromLeaf(leaf);
                if (editorView) {
                    // 触发编辑器重新渲染
                    editorView.dispatch({
                        effects: StateEffect.reconfigure.of(this.buildBaseEditorConfig())
                    });
                    
                    // 强制编辑器更新视图
                    editorView.requestMeasure();
                }
            }
        });
    }

    /**
     * 辅助方法：从叶子获取编辑器实例
     */
    private getEditorFromLeaf(leaf: WorkspaceLeaf): EditorView | null {
        if (leaf.view instanceof MarkdownView) {
            return leaf.view.editor.cm as EditorView;
        }
        return null;
    }
    
    /**
     * 构建基础编辑器配置
     */
    private buildBaseEditorConfig(): Extension[] {
        // 返回基本配置，不包含我们自定义的扩展
        return [
            // 基础编辑器配置项
        ];
    }

    /**
     * 修改registerEditorExtension方法
     * 添加状态检查，只有在启用状态下才注册扩展
     */
    private registerEditorExtension(): void {
        // 如果视图被禁用，不注册任何扩展
        if (!this.isEnabled()) {
            this.logInfo(`[${EditorLinkView.VIEW_ID}] 视图已禁用，跳过扩展注册`);
            return;
        }

        // 现有实现保持不变...
    }

    /**
     * 修改updateView方法
     * 添加状态检查，只在启用状态下更新视图
     */
    updateView(): void {
        this.logDebug(`[${EditorLinkView.VIEW_ID}] 正在更新视图...`);
        
        // 如果视图被禁用，跳过更新
        if (!this.isEnabled()) {
            this.logDebug(`[${EditorLinkView.VIEW_ID}] 视图已禁用，跳过更新`);
            return;
        }
        
        // 使用更新调度器来调度更新，避免频繁刷新
        this.updateScheduler.scheduleUpdate(
            EditorLinkView.VIEW_ID,
            () => {
                this.safeOperation(
                    () => this.extensionManager.refreshAll(),
                    'EditorLinkView',
                    '刷新编辑器扩展失败',
                    ErrorCategory.VIEW,
                    ErrorLevel.WARNING,
                    { action: 'refreshExtensions' }
                );
            },
            300 // 300ms的防抖延迟
        );
    }
}
```

### 3.3 ViewManager接口调用示例

以下是使用ViewManager接口启用或禁用EditorLinkView的示例代码：

```typescript
// 禁用编辑器视图
viewManager.disableView('editor-view');

// 启用编辑器视图
viewManager.enableView('editor-view');

// 切换编辑器视图状态
viewManager.toggleView('editor-view');

// 检查编辑器视图是否启用
const isEnabled = viewManager.isViewEnabled('editor-view');
```

### 3.4 插件初始化时的视图状态设置

在插件初始化过程中，需要根据保存的设置来设置EditorLinkView的初始状态：

```typescript
export default class TitleChangerPlugin extends Plugin {
    // 现有代码保持不变...
    
    async onload() {
        await this.loadSettings();
        
        // 初始化容器和服务
        this.initializeContainer();
        
        // 根据设置控制EditorLinkView的初始状态
        const viewManager = this.container.get<ViewManager>(TYPES.ViewManager);
        
        if (this.settings.enableEditorLinkView) {
            viewManager.enableView(EditorLinkView.VIEW_ID);
        } else {
            // 确保视图初始为禁用状态
            viewManager.disableView(EditorLinkView.VIEW_ID);
        }
        
        // 添加设置选项卡
        this.addSettingTab(new SettingTabView(this.app, this));
        
        // 其他初始化代码...
    }
}
```

## 4. 实现步骤

1. 在`EditorLinkView`类中重写`onEnable`和`onDisable`方法
2. 修改`registerEditorExtension`方法添加状态检查
3. 修改`updateView`方法添加状态检查
4. 确保视图ID常量可被ViewManager访问
5. 在设置模型中添加`enableEditorLinkView`字段
6. 在设置页面添加对应的开关控件
7. 在插件初始化时根据设置启用或禁用视图
8. 测试启用/禁用功能及其对视图刷新的影响

## 5. 测试计划

1. **功能测试**
   - 在编辑器中打开含有Wiki链接的文档
   - 禁用EditorLinkView并验证链接显示是否立即恢复为原始文件名
   - 启用EditorLinkView并验证链接显示是否立即更新为自定义标题
   - 验证禁用状态下新打开的文档或新添加的链接是否保持原始文件名

2. **性能测试**
   - 测量启用/禁用操作的响应时间
   - 验证在大型文档中启用/禁用的性能表现

3. **边缘情况测试**
   - 在文档加载过程中切换启用/禁用状态
   - 在标题更改事件发生时切换启用/禁用状态
   - 多次快速切换启用/禁用状态

## 6. 预期收益

- 提高用户对插件行为的控制能力
- 允许用户在编辑大型文档时临时禁用标题替换功能以提高性能
- 为插件添加更细粒度的功能控制

## 7. 风险与缓解措施

- **风险**: 启用/禁用状态变更可能导致编辑器闪烁或性能问题
  **缓解**: 使用现有的更新调度器防抖机制减少频繁刷新

- **风险**: 扩展管理器的注册/注销操作可能失败
  **缓解**: 使用safeOperation包装所有操作，确保错误被妥善处理

- **风险**: 用户可能在频繁切换状态后遇到混乱
  **缓解**: 添加适当的日志记录和用户反馈机制 

- **风险**: 从启用状态切换到禁用状态时，文件名可能不会立即刷新
  **缓解**: 实现强制编辑器重绘机制，通过对所有打开的编辑器视图触发重新渲染和测量来确保文件名立即更新 