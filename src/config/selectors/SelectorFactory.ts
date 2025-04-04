/**
 * 选择器工厂
 * 根据Obsidian版本提供适当的选择器配置
 */
import { baseSelectors, detectObsidianVersion, SelectorVersion } from './BaseSelectors';
import { modernSelectors } from './ModernSelectors';
import { legacySelectors } from './LegacySelectors';
import { Logger } from '../../utils/Logger';
import { injectable, inject, optional } from 'inversify';
import { TYPES } from '../../types/Symbols';

/**
 * 选择器配置项
 */
export interface SelectorConfig {
    fileExplorer: {
        primary: string;
        alternatives: string[];
        fallbacks: string[];
    };
    fileItems: {
        primary: string;
        alternatives: string[];
        fallbacks: string[];
    };
    titleElements: {
        primary: string;
        alternatives: string[];
        fallbacks: string[];
    };
    attributes: {
        path: string;
        title: string;
        ariaLabel: string;
        href: string;
    };
}

/**
 * 选择器工厂类
 * 提供智能的选择器配置，能够根据Obsidian版本自动适配
 */
@injectable()
export class SelectorFactory {
    private detectedVersion: SelectorVersion | null = null;
    private selectorConfig: SelectorConfig;
    
    constructor(@inject(TYPES.Logger) @optional() private logger?: Logger) {
        this.selectorConfig = this.getDefaultConfig();
    }
    
    /**
     * 检测Obsidian版本并自动选择适当的选择器配置
     */
    public detectAndConfigure(): SelectorConfig {
        try {
            this.detectedVersion = detectObsidianVersion();
            this.logger?.debug('检测到的Obsidian UI版本', { version: this.detectedVersion });
            
            if (this.detectedVersion.isModern) {
                this.logger?.debug('使用现代选择器配置');
                this.selectorConfig = modernSelectors;
            } else if (this.detectedVersion.isLegacy) {
                this.logger?.debug('使用传统选择器配置');
                this.selectorConfig = legacySelectors;
            } else {
                this.logger?.debug('使用基础选择器配置');
                this.selectorConfig = baseSelectors;
            }
            
            return this.selectorConfig;
        } catch (error) {
            this.logger?.error('检测Obsidian版本时出错', { error });
            return this.getDefaultConfig();
        }
    }
    
    /**
     * 获取当前配置的选择器
     */
    public getSelectors(): SelectorConfig {
        return this.selectorConfig;
    }
    
    /**
     * 重新检测并更新选择器配置
     */
    public refreshSelectors(): SelectorConfig {
        return this.detectAndConfigure();
    }
    
    /**
     * 获取默认选择器配置
     * 使用基础选择器，确保最大兼容性
     */
    private getDefaultConfig(): SelectorConfig {
        return baseSelectors;
    }
} 