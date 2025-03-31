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
}

export const DEFAULT_SETTINGS: TitleChangerSettings = {
    regexPattern: '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$', // 匹配日期格式后的所有内容
    folderRestrictionEnabled: false,
    includedFolders: [],
    includeSubfolders: true
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
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。默认模式匹配日期格式(YYYY_MM_DD)后的所有内容。')
            .addText(text => text
                .setPlaceholder('例如: .*_\\d{4}_\\d{2}_\\d{2}_(.+)$')
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
} 