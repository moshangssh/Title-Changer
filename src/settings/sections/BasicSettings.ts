import { Setting } from 'obsidian';
import { TitleChangerPlugin } from '../../main';
import { SettingSection } from './interfaces';

/**
 * 基本设置部分
 */
export class BasicSettingsSection implements SettingSection {
    constructor(private plugin: TitleChangerPlugin) {}
    
    /**
     * 在容器中显示基本设置
     * @param containerEl 设置容器
     */
    display(containerEl: HTMLElement): void {
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
} 