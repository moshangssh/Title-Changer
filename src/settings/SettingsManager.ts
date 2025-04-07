import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols';
import { TitleChangerSettings, DEFAULT_SETTINGS } from './TitleChangerSettings';
import type { TitleChangerPlugin } from '../main';
import type { Logger } from '../utils/logger';

/**
 * 设置管理器服务
 * 帮助管理插件设置的加载和保存
 */
@injectable()
export class SettingsManager {
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) private logger: Logger
    ) {}
    
    /**
     * 加载设置
     * @returns 加载的设置
     */
    async loadSettings(): Promise<TitleChangerSettings> {
        try {
            const loadedData = await this.plugin.loadData();
            const settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
            this.logger.debug('设置已加载', settings);
            return settings;
        } catch (error) {
            this.logger.error('加载设置失败', { error });
            return { ...DEFAULT_SETTINGS };
        }
    }
    
    /**
     * 保存设置
     * @param settings 要保存的设置
     */
    async saveSettings(settings: TitleChangerSettings): Promise<void> {
        try {
            await this.plugin.saveData(settings);
            this.logger.debug('设置已保存');
        } catch (error) {
            this.logger.error('保存设置失败', { error });
        }
    }
} 