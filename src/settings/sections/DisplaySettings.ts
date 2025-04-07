import { Setting } from 'obsidian';
import { TitleChangerPlugin } from '../../main';
import { SettingSection } from './interfaces';

/**
 * 显示设置部分
 */
export class DisplaySettingsSection implements SettingSection {
    constructor(private plugin: TitleChangerPlugin) {}
    
    /**
     * 在容器中显示显示设置
     * @param containerEl 设置容器
     */
    display(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '显示选项' });
        
        new Setting(containerEl)
            .setName('启用文件浏览器视图')
            .setDesc('在文件浏览器中显示经过处理的文件名')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    if (value) {
                        this.plugin.getViewManager().enableView('explorer');
                    } else {
                        this.plugin.getViewManager().disableView('explorer');
                    }
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('启用编辑器链接视图')
            .setDesc('在编辑器中显示经过处理的链接文本')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableEditorLinkView)
                .onChange(async (value) => {
                    this.plugin.settings.enableEditorLinkView = value;
                    if (value) {
                        this.plugin.getViewManager().enableView('editor');
                    } else {
                        this.plugin.getViewManager().disableView('editor');
                    }
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('启用阅读视图')
            .setDesc('在阅读视图中显示经过处理的文件名和链接文本')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableReadingView)
                .onChange(async (value) => {
                    this.plugin.settings.enableReadingView = value;
                    if (value) {
                        this.plugin.getViewManager().enableView('reading');
                    } else {
                        this.plugin.getViewManager().disableView('reading');
                    }
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('启用图表视图')
            .setDesc('在图表视图(Graph View)中显示修改后的文件名')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableGraphView)
                .onChange(async (value) => {
                    this.plugin.settings.enableGraphView = value;
                    if (value) {
                        this.plugin.getViewManager().enableView('graph');
                    } else {
                        this.plugin.getViewManager().disableView('graph');
                    }
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(containerEl)
            .setName('启用Markdown视图标题替换')
            .setDesc('在Markdown编辑和阅读视图中替换标题显示')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableMarkdownView)
                .onChange(async (value) => {
                    this.plugin.settings.enableMarkdownView = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        this.plugin.getViewManager().enableView('markdown');
                    } else {
                        this.plugin.getViewManager().disableView('markdown');
                    }
                })
            );
    }
} 