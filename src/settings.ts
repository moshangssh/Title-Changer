import { App, PluginSettingTab, Setting } from 'obsidian';
import { TitleChangerPlugin } from './main';

export interface TitleChangerSettings {
    // 正则表达式用于从文件名中提取显示名称
    regexPattern: string;
    
    // 是否启用文件夹限制
    folderRestrictionEnabled: boolean;
    
    // 启用插件的文件夹路径列表
    includedFolders: string[];
}

export const DEFAULT_SETTINGS: TitleChangerSettings = {
    regexPattern: '.*_([^_]+)$', // 默认匹配最后一个下划线后的所有内容
    folderRestrictionEnabled: false,
    includedFolders: []
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

        new Setting(containerEl)
            .setName('正则表达式')
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。')
            .addText(text => text
                .setPlaceholder('例如: .*_([^_]+)$')
                .setValue(this.plugin.settings.regexPattern)
                .onChange(async (value) => {
                    this.plugin.settings.regexPattern = value;
                    await this.plugin.saveSettings();
                }));

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
        }
    }
} 