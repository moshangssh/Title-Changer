import { App, PluginSettingTab, Setting } from 'obsidian';
import { TitleChangerPlugin } from './main';

export interface TitleChangerSettings {
    /**
     * 是否启用标题变更功能
     */
    enabled: boolean;
    
    // 正则表达式用于从文件名中提取显示名称
    regexPattern: string;
    
    // 启用插件的文件夹路径列表
    includedFolders: string[];

    /**
     * 是否启用阅读视图标题替换
     */
    enableReadingView: boolean;
    
    /**
     * 是否启用编辑器视图标题替换
     */
    enableEditorLinkView: boolean;
    
    /**
     * 是否使用缓存
     */
    useCache: boolean;

    /**
     * 缓存过期时间（分钟）
     */
    cacheExpiration: number;
    
    /**
     * 是否启用调试模式
     */
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: TitleChangerSettings = {
    enabled: true,
    regexPattern: '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$', // 匹配日期格式后的所有内容
    includedFolders: [],
    enableReadingView: true,
    enableEditorLinkView: true,
    useCache: true,
    cacheExpiration: 60,
    debugMode: false
};

export class TitleChangerSettingTab extends PluginSettingTab {
    plugin: TitleChangerPlugin;

    constructor(app: App, plugin: TitleChangerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.addClass('title-changer-settings');

        containerEl.createEl('h2', { text: 'Title Changer 设置' });

        // 基本功能设置
        this.createBasicSettings(containerEl);

        // 显示选项设置
        this.createDisplaySettings(containerEl);

        // 性能优化设置
        this.createPerformanceSettings(containerEl);

        // 高级选项设置
        this.createAdvancedSettings(containerEl);
    }

    private createBasicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '基本功能' });

        new Setting(containerEl)
            .setName('标题提取正则表达式')
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。默认模式匹配日期格式(YYYY_MM_DD)后的所有内容。')
            .addText(text => text
                .setPlaceholder('例如: .*_\\d{4}_\\d{2}_\\d{2}_(.+)$')
                .setValue(this.plugin.settings.regexPattern)
                .onChange(async (value) => {
                    this.plugin.settings.regexPattern = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createDisplaySettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '显示选项' });
        
        new Setting(containerEl)
            .setName('文件列表')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                    
                    // 立即应用状态变化
                    this.plugin.refreshExplorerView();
                }));
                
        new Setting(containerEl)
            .setName('阅读视图')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableReadingView)
                .onChange(async (value) => {
                    this.plugin.settings.enableReadingView = value;
                    
                    // 根据设置立即启用或禁用ReadingView
                    const viewManager = this.plugin.getViewManager();
                    if (viewManager) {
                        if (value) {
                            viewManager.enableView('reading');
                        } else {
                            viewManager.disableView('reading');
                        }
                    }
                    
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(containerEl)
            .setName('编辑器视图')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableEditorLinkView)
                .onChange(async (value) => {
                    this.plugin.settings.enableEditorLinkView = value;
                    
                    // 根据开关状态启用或禁用视图
                    const viewManager = this.plugin.getViewManager();
                    if (viewManager) {
                        if (value) {
                            viewManager.enableView('editor');
                        } else {
                            viewManager.disableView('editor');
                        }
                    }
                    
                    await this.plugin.saveSettings();
                })
            );
    }

    private createPerformanceSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '性能优化' });

        new Setting(containerEl)
            .setName('启用缓存')
            .setDesc('使用缓存以提高性能')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCache)
                .onChange(async (value) => {
                    this.plugin.settings.useCache = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.useCache) {
            new Setting(containerEl)
                .setName('缓存过期时间')
                .setDesc('缓存过期时间（分钟）')
                .addSlider(slider => slider
                    .setLimits(5, 1440, 5)
                    .setValue(this.plugin.settings.cacheExpiration)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.cacheExpiration = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '高级选项' });

        // 文件夹限制设置
        new Setting(containerEl)
            .setName('指定生效文件夹')
            .setDesc('指定应用此插件的文件夹路径（每行一个）。如不填写则全局生效。插件将应用于所有指定文件夹及其子文件夹。')
            .addTextArea(text => text
                .setPlaceholder('例如: 文件夹1\n文件夹2/子文件夹')
                .setValue(this.plugin.settings.includedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.includedFolders = value.split('\n').map(folder => folder.trim()).filter(folder => folder.length > 0);
                    await this.plugin.saveSettings();
                }));

        // 调试设置
        new Setting(containerEl)
            .setName('调试模式')
            .setDesc('启用调试模式以获取更多日志信息')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }
} 