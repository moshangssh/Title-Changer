import { App, PluginSettingTab } from 'obsidian';
import { TitleChangerPlugin } from '../main';
import { BasicSettingsSection } from './sections/BasicSettings';
import { DisplaySettingsSection } from './sections/DisplaySettings';
import { PerformanceSettingsSection } from './sections/PerformanceSettings';
import { AdvancedSettingsSection } from './sections/AdvancedSettings';
import { SettingSection } from './sections/interfaces';

/**
 * Title Changer 设置选项卡
 */
export class TitleChangerSettingTab extends PluginSettingTab {
    private sections: SettingSection[];
    
    constructor(app: App, private plugin: TitleChangerPlugin) {
        super(app, plugin);
        
        // 初始化各设置部分
        this.sections = [
            new BasicSettingsSection(this.plugin),
            new DisplaySettingsSection(this.plugin),
            new PerformanceSettingsSection(this.plugin),
            new AdvancedSettingsSection(this.plugin, this.app)
        ];
    }
    
    /**
     * 显示设置界面
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('title-changer-settings');
        
        containerEl.createEl('h2', { text: 'Title Changer 设置' });
        
        // 渲染各设置部分
        this.sections.forEach(section => section.display(containerEl));
    }
} 