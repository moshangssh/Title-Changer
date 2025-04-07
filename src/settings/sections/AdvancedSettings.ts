import { App, Setting } from 'obsidian';
import { TitleChangerPlugin } from '../../main';
import { SettingSection } from './interfaces';
import { FolderSelector } from '../../components/FolderSelector';

/**
 * 高级设置部分
 */
export class AdvancedSettingsSection implements SettingSection {
    private folderSelector: FolderSelector | null = null;
    
    constructor(
        private plugin: TitleChangerPlugin,
        private app: App
    ) {}
    
    /**
     * 在容器中显示高级设置
     * @param containerEl 设置容器
     */
    display(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '高级选项' });

        // 文件夹选择器设置
        const folderSetting = new Setting(containerEl)
            .setName('指定生效文件夹')
            .setDesc('指定应用此插件的文件夹路径。如不选择则全局生效。插件将应用于所有指定文件夹及其子文件夹。');
        
        // 创建文件夹选择器容器
        const folderSelectorContainer = containerEl.createDiv('folder-selector-container');
        
        // 初始化文件夹选择器
        this.folderSelector = new FolderSelector(
            folderSelectorContainer,
            this.app,
            this.plugin.settings.includedFolders,
            async (folders: string[]) => {
                this.plugin.settings.includedFolders = folders;
                await this.plugin.saveSettings();
            }
        );
        
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