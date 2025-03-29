import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';

export class TitleProcessor {
    /**
     * 处理文件，提取显示标题
     * @param file 要处理的文件
     * @param settings 插件设置
     * @returns 显示标题，如果不应该更改则返回 null
     */
    static processFile(file: TFile, settings: TitleChangerSettings): string | null {
        try {
            // 获取没有扩展名的文件名
            const filename = this.getFilenameWithoutExtension(file);
            
            // 检查正则表达式是否有效
            if (!settings.regexPattern || settings.regexPattern.trim() === '') {
                return null;
            }
            
            // 创建正则表达式对象
            let regex: RegExp;
            try {
                regex = new RegExp(settings.regexPattern);
            } catch (regexError) {
                console.error(`Title Changer: 正则表达式无效: ${settings.regexPattern}`, regexError);
                return null;
            }
            
            // 尝试匹配
            const match = filename.match(regex);
            
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
        } catch (error) {
            console.error('Title Changer: 处理文件标题时出错', error);
            return null;
        }
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