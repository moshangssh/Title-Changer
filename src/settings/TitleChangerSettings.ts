/**
 * Title Changer插件设置接口
 */
export interface TitleChangerSettings {
    /**
     * 是否启用标题变更功能
     */
    enabled: boolean;
    
    /**
     * 正则表达式用于从文件名中提取显示名称
     */
    regexPattern: string;
    
    /**
     * 启用插件的文件夹路径列表
     */
    includedFolders: string[];

    /**
     * 是否启用阅读视图标题替换
     */
    enableReadingView: boolean;
    
    /**
     * 是否启用编辑器视图标题替换
     */
    enableEditorLinkView: boolean;
    
    /**
     * 是否启用图表视图标题替换
     */
    enableGraphView: boolean;

    /**
     * 是否启用Markdown视图标题替换
     */
    enableMarkdownView: boolean;
    
    /**
     * 是否使用缓存
     */
    useCache: boolean;

    /**
     * 缓存过期时间（分钟）
     */
    cacheExpiration: number;
    
    /**
     * LRU缓存容量，默认1000
     */
    cacheCapacity: number;
    
    /**
     * 是否记录缓存统计信息
     */
    logCacheStats: boolean;
    
    /**
     * 是否启用调试模式
     */
    debugMode: boolean;
}

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS: TitleChangerSettings = {
    enabled: true,
    regexPattern: '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$', // 匹配日期格式后的所有内容
    includedFolders: [],
    enableReadingView: true,
    enableEditorLinkView: true,
    enableGraphView: true,
    enableMarkdownView: true,
    useCache: true,
    cacheExpiration: 60,
    cacheCapacity: 1000,
    logCacheStats: false,
    debugMode: false
}; 