import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';
import { ErrorCategory, RegexError } from './errors';
import { ErrorLevel, ErrorManagerService } from '../services/error-manager.service';
import { Logger } from './logger';
import { safeRegexCreation, safeRegexExecution } from './error-helpers';

export class TitleProcessor {
    /**
     * 处理文件，提取显示标题
     * @param file 要处理的文件
     * @param settings 插件设置
     * @param errorManager 错误管理服务
     * @param logger 日志服务
     * @returns 显示标题，如果不应该更改则返回 null
     */
    static processFile(
        file: TFile, 
        settings: TitleChangerSettings,
        errorManager: ErrorManagerService,
        logger: Logger
    ): string | null {
        // 获取没有扩展名的文件名
        const filename = this.getFilenameWithoutExtension(file);
        
        // 检查正则表达式是否有效
        if (!settings.regexPattern || settings.regexPattern.trim() === '') {
            return null;
        }
        
        // 创建正则表达式对象
        const regex = safeRegexCreation(
            settings.regexPattern,
            '',  // 无特殊标志
            'TitleProcessor',
            errorManager,
            logger
        );
        
        // 如果正则表达式无效，返回null
        if (!regex) {
            return null;
        }
        
        // 执行正则匹配
        const match = safeRegexExecution(
            regex,
            filename,
            'TitleProcessor',
            errorManager,
            logger
        );
        
        // 如果没有匹配，返回 null
        if (!match) {
            return null;
        }
        
        // 如果有捕获组，返回第一个捕获组
        if (match.length > 1) {
            return match[1];
        }
        
        // 如果只有整个匹配（没有捕获组），返回整个匹配
        return match[0];
    }
    
    /**
     * 获取文件名（不含扩展名）
     * @param file 文件对象
     * @returns 不含扩展名的文件名
     */
    private static getFilenameWithoutExtension(file: TFile): string {
        const filename = file.basename;
        return filename;
    }
} 