import { Plugin } from 'obsidian';
import { TitleChangerSettings, DEFAULT_SETTINGS, TitleChangerSettingTab } from './settings';
import { ViewManager } from './views/view-manager';

export class TitleChangerPlugin extends Plugin {
    settings: TitleChangerSettings;
    private viewManager: ViewManager;

    async onload() {
        console.log('加载 Title Changer 插件');

        // 加载设置
        await this.loadSettings();

        // 添加设置选项卡
        this.addSettingTab(new TitleChangerSettingTab(this.app, this));

        // 初始化视图管理器
        this.viewManager = new ViewManager(this);
        this.viewManager.initialize();

        // 添加命令，刷新所有视图
        this.addCommand({
            id: 'refresh-title-changer-views',
            name: '刷新文件名显示',
            callback: () => {
                this.viewManager.updateAllViews();
            }
        });
    }

    onunload() {
        console.log('卸载 Title Changer 插件');
        
        // 卸载视图管理器
        if (this.viewManager) {
            this.viewManager.unload();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // 设置变更时更新视图
        if (this.viewManager) {
            this.viewManager.onSettingsChanged();
        }
    }
} 