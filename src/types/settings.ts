/**
 * 插件设置接口
 */
export interface Settings {
    /**
     * 是否启用调试模式
     */
    debugMode: boolean;

    /**
     * 是否在文件浏览器中显示自定义标题
     */
    showInFileExplorer: boolean;

    /**
     * 是否在编辑器中显示自定义标题
     */
    showInEditor: boolean;

    /**
     * 是否使用缓存
     */
    useCache: boolean;

    /**
     * 缓存过期时间（分钟）
     */
    cacheExpiration: number;
} 