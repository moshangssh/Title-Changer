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
                    
                    // 刷新以显示或隐藏缓存相关设置
                    this.plugin.getViewManager().updateAllViews();
                }));

        // 仅当缓存启用时显示缓存相关设置
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
            
            new Setting(containerEl)
                .setName('缓存容量')
                .setDesc('LRU缓存的最大项数。降低此值可减少内存使用，但可能增加处理开销。')
                .addSlider(slider => slider
                    .setLimits(100, 10000, 100)
                    .setValue(this.plugin.settings.cacheCapacity)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.cacheCapacity = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('记录缓存统计')
                .setDesc('定期在控制台记录缓存命中率和使用情况统计。')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.logCacheStats)
                    .onChange(async (value) => {
                        this.plugin.settings.logCacheStats = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
} 