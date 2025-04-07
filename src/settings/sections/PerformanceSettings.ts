import { Setting } from 'obsidian';
import { TitleChangerPlugin } from '../../main';
import { SettingSection } from './interfaces';

/**
 * 性能设置部分
 */
export class PerformanceSettingsSection implements SettingSection {
    constructor(private plugin: TitleChangerPlugin) {}
    
    /**
     * 在容器中显示性能设置
     * @param containerEl 设置容器
     */
    display(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '性能优化' });

        new Setting(containerEl)
            .setName('启用缓存')
            .setDesc('使用缓存以提高性能')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCache)
                .onChange(async (value) => {
                    this.plugin.settings.useCache = value;
                    await this.plugin.saveSettings();
                    
                    // 刷新以显示或隐藏缓存过期时间设置
                    this.plugin.getViewManager().updateAllViews();
                }));

        // 仅当缓存启用时显示缓存过期时间设置
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
} 