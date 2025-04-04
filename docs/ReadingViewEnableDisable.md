# ReadingView启用/禁用功能方案设计

## 功能概述

为`ReadingView`组件添加启用和禁用功能，使用户能够控制阅读视图中的标题替换功能。要求能在启用或禁用后立即刷新文件名显示，提供即时的用户反馈。

## 当前状态分析

`ReadingView`目前负责处理预览模式下的内部链接标题显示，在预览模式中将原始文件名替换为自定义显示标题。当前实现没有提供启用/禁用控制机制。

## 实现方案

### 1. 修改AbstractView基类

在`AbstractView`基类中添加启用/禁用相关的基础功能：

```typescript
export abstract class AbstractView {
    // 新增启用状态标志
    protected enabled: boolean = true;
    
    // 其余现有代码保持不变...

    /**
     * 检查视图是否启用
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 启用视图
     */
    public enable(): void {
        if (!this.enabled) {
            this.enabled = true;
            this.onEnable();
        }
    }

    /**
     * 禁用视图
     */
    public disable(): void {
        if (this.enabled) {
            this.enabled = false;
            this.onDisable();
        }
    }

    /**
     * 切换视图启用状态
     */
    public toggle(): void {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * 当视图被启用时调用
     * 子类可重写此方法以提供特定行为
     */
    protected onEnable(): void {
        this.logInfo(`${this.constructor.name} 已启用`);
    }

    /**
     * 当视图被禁用时调用
     * 子类可重写此方法以提供特定行为
     */
    protected onDisable(): void {
        this.logInfo(`${this.constructor.name} 已禁用`);
    }
}
```

### 2. 修改ReadingView实现

扩展`ReadingView`类实现启用/禁用功能：

```typescript
@injectable()
export class ReadingView extends AbstractView {
    // 保留现有属性和构造函数...

    /**
     * 重写updateView方法，添加启用状态检查
     */
    updateView(): void {
        // 检查是否启用，如果未启用则直接返回
        if (!this.enabled) {
            this.logDebug(`[${ReadingView.VIEW_ID}] 视图已禁用，跳过更新`);
            return;
        }

        this.logDebug(`[${ReadingView.VIEW_ID}] 正在更新视图...`);
        
        // 现有更新逻辑保持不变...
    }

    /**
     * 重写onEnable方法，在启用时立即刷新视图
     */
    protected override onEnable(): void {
        super.onEnable();
        this.logInfo(`[${ReadingView.VIEW_ID}] 视图已启用，立即刷新`);
        
        // 立即刷新视图以显示自定义标题
        this.updateView();
    }

    /**
     * 重写onDisable方法，在禁用时恢复原始文件名
     */
    protected override onDisable(): void {
        super.onDisable();
        this.logInfo(`[${ReadingView.VIEW_ID}] 视图已禁用，恢复原始文件名`);
        
        // 恢复原始文件名的逻辑
        this.restoreOriginalTitles();
    }

    /**
     * 恢复所有修改过的标题为原始文件名
     */
    private restoreOriginalTitles(): void {
        this.safeOperation(
            () => {
                // 获取当前活动叶子
                const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeLeaf) return;
                
                // 检查是否处于阅读模式
                if (activeLeaf.getMode() !== 'preview') return;

                // 获取预览模式下的DOM元素
                const previewEl = activeLeaf.previewMode.containerEl;
                if (!previewEl) return;

                // 查找所有已处理过的链接
                const processedLinks = querySelectorAll(
                    previewEl,
                    '.internal-link[data-title-processed="true"]',
                    'ReadingView',
                    this.errorManager,
                    this.logger
                );
                
                // 恢复原始文件名
                processedLinks.forEach(linkEl => {
                    logErrorsWithoutThrowing(
                        () => {
                            const originalFileName = getAttribute(
                                linkEl as HTMLElement,
                                'title',
                                'ReadingView',
                                this.errorManager,
                                this.logger
                            );
                            
                            if (originalFileName) {
                                // 恢复原始文件名作为显示文本
                                (linkEl as HTMLElement).textContent = originalFileName;
                                
                                // 移除已处理标记
                                (linkEl as HTMLElement).removeAttribute('data-title-processed');
                            }
                        },
                        'ReadingView',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '恢复原始标题失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.DEBUG
                        }
                    );
                });
                
                return true;
            },
            'ReadingView',
            '恢复原始标题时发生错误',
            ErrorCategory.UI,
            ErrorLevel.ERROR
        );
    }
}
```

### 3. 修改TitleChangerSettings

在插件设置中添加ReadingView启用/禁用选项：

```typescript
export interface TitleChangerSettings {
    // 现有设置...
    
    // 是否启用阅读视图标题替换
    enableReadingView: boolean;
}

// 默认设置
export const DEFAULT_SETTINGS: TitleChangerSettings = {
    // 现有默认设置...
    
    enableReadingView: true
};
```

### 4. 修改设置界面

在插件设置中添加启用/禁用ReadingView的选项：

```typescript
// 在TitleChangerSettingTab的display方法中添加
private createViewSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '视图设置' });
    
    new Setting(containerEl)
        .setName('启用阅读视图标题替换')
        .setDesc('在预览模式中启用内部链接的自定义标题显示')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.enableReadingView)
            .onChange(async (value) => {
                this.plugin.settings.enableReadingView = value;
                
                // 根据设置立即启用或禁用ReadingView
                if (value) {
                    this.plugin.viewManager.enableView('reading');
                } else {
                    this.plugin.viewManager.disableView('reading');
                }
                
                await this.plugin.saveSettings();
            })
        );
}
```

### 5. 扩展ViewManager

向ViewManager添加新方法以支持视图的启用/禁用管理：

```typescript
@injectable()
export class ViewManager implements IViewManager {
    // 现有代码...

    /**
     * 启用指定视图
     * @param viewId 视图ID标识符
     */
    public enableView(viewId: string): void {
        const view = this.getViewById(viewId);
        if (view) {
            view.enable();
        }
    }

    /**
     * 禁用指定视图
     * @param viewId 视图ID标识符
     */
    public disableView(viewId: string): void {
        const view = this.getViewById(viewId);
        if (view) {
            view.disable();
        }
    }

    /**
     * 切换指定视图的启用状态
     * @param viewId 视图ID标识符
     */
    public toggleView(viewId: string): void {
        const view = this.getViewById(viewId);
        if (view) {
            view.toggle();
        }
    }

    /**
     * 获取视图的启用状态
     * @param viewId 视图ID标识符
     * @returns 如果视图启用则返回true，否则返回false
     */
    public isViewEnabled(viewId: string): boolean {
        const view = this.getViewById(viewId);
        return view ? view.isEnabled() : false;
    }

    /**
     * 根据ID获取视图实例
     * @param viewId 视图ID标识符
     * @returns 对应的视图实例，如果不存在则返回null
     */
    private getViewById(viewId: string): AbstractView | null {
        switch (viewId) {
            case 'reading':
                return this.readingView;
            // 其他视图...
            default:
                return null;
        }
    }
}
```

### 6. 更新IViewManager接口

在`ObsidianExtensions.ts`中更新IViewManager接口以包含新增方法：

```typescript
export interface IViewManager {
    initialize(): void;
    unload(): void;
    updateAllViews(): void;
    onSettingsChanged(): void;
    enableView(viewId: string): void;
    disableView(viewId: string): void;
    toggleView(viewId: string): void;
    isViewEnabled(viewId: string): boolean;
}
```

### 7. 修改插件初始化逻辑

在插件的onload方法中，根据设置初始化视图状态：

```typescript
async onload() {
    // 加载设置
    await this.loadSettings();
    
    // 初始化容器...
    
    // 初始化视图管理器
    const viewManager = this.container.get<IViewManager>(TYPES.ViewManager);
    this.viewManager = viewManager;
    
    // 根据设置初始化视图状态
    if (!this.settings.enableReadingView) {
        this.viewManager.disableView('reading');
    }
    
    // 初始化视图
    this.viewManager.initialize();
    
    // 添加设置选项卡
    this.addSettingTab(new TitleChangerSettingTab(this.app, this));
    
    // 其他初始化步骤...
}
```

## 具体实现步骤

1. **修改AbstractView基类**
   - 在`src/views/base/abstract-view.ts`中添加启用状态属性及相关方法
   - 实现基本的enable、disable和toggle方法
   - 添加可重写的onEnable和onDisable钩子方法

2. **修改ReadingView类**
   - 在`src/views/ReadingView.ts`中重写updateView方法，添加启用状态检查
   - 实现onEnable方法，确保启用后立即刷新视图
   - 实现onDisable方法，确保禁用后恢复原始文件名
   - 添加restoreOriginalTitles方法来恢复原始文件名显示

3. **更新设置相关文件**
   - 在`src/settings.ts`中的TitleChangerSettings接口中添加enableReadingView字段
   - 在DEFAULT_SETTINGS中设置enableReadingView默认值为true
   - 在TitleChangerSettingTab类中添加阅读视图启用/禁用的设置选项

4. **扩展ViewManager**
   - 在`src/views/ViewManager.ts`中添加enableView、disableView和toggleView方法
   - 添加getViewById辅助方法以根据ID获取视图实例
   - 添加isViewEnabled方法以获取视图的当前启用状态

5. **更新接口定义**
   - 在`src/types/ObsidianExtensions.ts`中更新IViewManager接口，添加新方法

6. **修改插件主文件**
   - 在`src/main.ts`中的onload方法中添加视图状态初始化逻辑
   - 确保在视图初始化之前设置正确的启用/禁用状态

## 测试计划

1. **启用/禁用功能测试**
   - 验证启用ReadingView时链接显示自定义标题
   - 验证禁用ReadingView时链接显示原始文件名
   - 测试切换启用/禁用状态的即时反应

2. **性能测试**
   - 测量禁用状态下的性能改进
   - 确保启用/禁用操作不影响整体插件性能

3. **用户体验测试**
   - 测试设置界面的清晰度和可用性
   - 验证启用/禁用状态的持久性
   - 确保设置值正确保存并在重启后恢复

4. **边缘情况测试**
   - 测试在视图更新过程中切换启用/禁用状态
   - 测试在加载大文件时的启用/禁用行为
   - 测试快速切换启用/禁用状态

## 实现时间表

1. 修改AbstractView基类 - 1天
2. 实现ReadingView的启用/禁用功能 - 1.5天
3. 设置界面集成 - 0.5天
4. 测试和调试 - 1天
5. 文档更新 - 0.5天

## 预期效果

实现此功能后，用户将能够:
- 通过设置界面轻松启用/禁用阅读视图中的标题替换功能
- 在禁用功能时看到原始文件名，启用功能时看到自定义标题
- 体验更好的性能，尤其是当他们选择禁用不需要的功能时
- 根据个人偏好自定义插件行为，提高用户体验 