import { TFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';

export class TitleProcessor {
    /**
     * 从文件名中提取显示标题
     * @param file 文件对象
     * @param settings 插件设置
     * @returns 提取的显示标题，如果无法提取则返回原始文件名
     */
    static extractDisplayTitle(file: TFile, settings: TitleChangerSettings): string | null {
        try {
            // 获取没有扩展名的文件名
            const filename = this.getFilenameWithoutExtension(file);
            
            // 创建正则表达式对象
            const regex = new RegExp(settings.regexPattern);
            
            // 尝试匹配
            const match = filename.match(regex);
            
            // 如果没有匹配，返回 null
            if (!match) {
                return null;
            }
            
            // 如果有捕获组，返回第一个捕获组
            if (match.length > 1) {
                // 存在至少一个捕获组，返回第一个捕获组
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
     * 获取没有扩展名的文件名
     * @param file 文件对象
     * @returns 没有扩展名的文件名
     */
    private static getFilenameWithoutExtension(file: TFile): string {
        const filename = file.basename;
        return filename;
    }
} 