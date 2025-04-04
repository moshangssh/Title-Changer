import { App, PluginSettingTab, Setting } from 'obsidian';
import { TitleChangerPlugin } from './main';

export interface TitleChangerSettings {
    // 正则表达式用于从文件名中提取显示名称
    regexPattern: string;
    
    // 是否启用文件夹限制
    folderRestrictionEnabled: boolean;
    
    // 启用插件的文件夹路径列表
    includedFolders: string[];

    // 是否启用递归子文件夹
    includeSubfolders: boolean;

    /**
     * 是否启用调试模式
     */
    debugMode: boolean;

    /**
     * 是否使用缓存
     */
    useCache: boolean;

    /**
     * 缓存过期时间（分钟）
     */
    cacheExpiration: number;

    /**
     * 是否启用标题变更功能
     */
    enabled: boolean;
    
    /**
     * 是否启用阅读视图标题替换
     */
    enableReadingView: boolean;
    
    /**
     * 是否启用编辑器视图标题替换
     */
    enableEditorLinkView: boolean;
}

export const DEFAULT_SETTINGS: TitleChangerSettings = {
    regexPattern: '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$', // 匹配日期格式后的所有内容
    folderRestrictionEnabled: false,
    includedFolders: [],
    includeSubfolders: true,
    debugMode: false,
    useCache: true,
    cacheExpiration: 60,
    enabled: true,
    enableReadingView: true,
    enableEditorLinkView: true
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

        // 全局启用设置
        this.createGlobalSettings(containerEl);

        // 提取标题设置
        this.createTitleSettings(containerEl);

        // 文件夹限制设置
        this.createFolderSettings(containerEl);

        // 视图设置
        this.createViewSettings(containerEl);

        // 缓存设置
        this.createCacheSettings(containerEl);

        // 调试设置
        this.createDebugSettings(containerEl);
    }

    private createGlobalSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '全局设置' });

        new Setting(containerEl)
            .setName('文件游览器')
            .setDesc('文件游览器启动状况')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                    
                    // 立即应用状态变化
                    this.plugin.refreshExplorerView();
                }));
    }

    private createTitleSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '标题设置' });

        new Setting(containerEl)
            .setName('正则表达式')
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。默认模式匹配日期格式(YYYY_MM_DD)后的所有内容。')
            .addText(text => text
                .setPlaceholder('例如: .*_\\d{4}_\\d{2}_\\d{2}_(.+)$')
                .setValue(this.plugin.settings.regexPattern)
                .onChange(async (value) => {
                    this.plugin.settings.regexPattern = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createFolderSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '文件夹设置' });

        new Setting(containerEl)
            .setName('启用文件夹限制')
            .setDesc('只在特定文件夹中应用此插件')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.folderRestrictionEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.folderRestrictionEnabled = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.folderRestrictionEnabled) {
            new Setting(containerEl)
                .setName('包含的文件夹')
                .setDesc('指定应用此插件的文件夹路径（每行一个）')
                .addTextArea(text => text
                    .setPlaceholder('例如: 文件夹1\n文件夹2/子文件夹')
                    .setValue(this.plugin.settings.includedFolders.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.includedFolders = value.split('\n').map(folder => folder.trim()).filter(folder => folder.length > 0);
                        await this.plugin.saveSettings();
                    }));
                    
            new Setting(containerEl)
                .setName('包含子文件夹')
                .setDesc('启用后，插件将应用于所有指定文件夹及其子文件夹')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeSubfolders)
                    .onChange(async (value) => {
                        this.plugin.settings.includeSubfolders = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }

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
            .setName('启用编辑器链接视图')
            .setDesc('控制是否在编辑器中将Wiki链接显示为自定义标题')
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

    private createCacheSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '缓存设置' });

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

    private createDebugSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '调试设置' });

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