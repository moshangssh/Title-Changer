import { Setting, Notice } from 'obsidian';
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
                .setName('使用增强型缓存')
                .setDesc('使用双向链表+Map结构实现的高性能缓存。启用后可提高缓存操作性能，但略微增加内存使用。')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useFastCache)
                    .onChange(async (value) => {
                        this.plugin.settings.useFastCache = value;
                        await this.plugin.saveSettings();
                    }));
            
            new Setting(containerEl)
                .setName('启用缓存持久化')
                .setDesc('保存缓存到本地存储，插件重启后恢复。可提高重启后的响应速度，但会增加存储和加载时间。')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.persistCache ?? false)
                    .onChange(async (value) => {
                        this.plugin.settings.persistCache = value;
                        await this.plugin.saveSettings();
                    }));
            
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
                .setName('缓存最大权重')
                .setDesc('默认等于缓存容量。可用于掌控不同缓存项的权重。')
                .addSlider(slider => slider
                    .setLimits(100, 20000, 100)
                    .setValue(this.plugin.settings.cacheMaxWeight || this.plugin.settings.cacheCapacity)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.cacheMaxWeight = value;
                        await this.plugin.saveSettings();
                    }));
            
            new Setting(containerEl)
                .setName('清理间隔')
                .setDesc('过期项清理间隔（秒）。降低此值可提高及时性，但会增加处理负担。')
                .addSlider(slider => slider
                    .setLimits(10, 600, 10)
                    .setValue((this.plugin.settings.cachePurgeInterval || 60000) / 1000)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.cachePurgeInterval = value * 1000;
                        await this.plugin.saveSettings();
                    }));
                    
            new Setting(containerEl)
                .setName('启用滑动过期')
                .setDesc('每次访问缓存项时重置其过期计时器。合适于频繁访问的项。')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.cacheSlidingExpiration ?? true)
                    .onChange(async (value) => {
                        this.plugin.settings.cacheSlidingExpiration = value;
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
                    
            // 添加缓存管理按钮组
            const cacheManagementDiv = containerEl.createDiv('cache-management-buttons');
            cacheManagementDiv.createEl('h4', { text: '缓存管理' });
            
            const buttonContainer = cacheManagementDiv.createDiv('button-container');
            
            const clearCacheButton = buttonContainer.createEl('button', { text: '清空缓存' });
            clearCacheButton.addEventListener('click', () => {
                this.plugin.getCacheManager().clearCache();
                new Notice('缓存已清空');
            });
            
            const saveCacheButton = buttonContainer.createEl('button', { text: '保存缓存' });
            saveCacheButton.addEventListener('click', () => {
                // 调用CacheManager中的保存方法
                // 这需要在CacheManager中添加公共方法
                this.plugin.getCacheManager().saveCache();
                new Notice('缓存已保存');
            });
            
            // 添加样式
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginTop = '10px';
        }
    }
} 