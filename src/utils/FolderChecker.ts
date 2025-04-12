import { TFile, Vault, App, TAbstractFile } from 'obsidian';
import { TitleChangerSettings } from '../settings';

// BUG: 文件夹递归检查性能不佳
// Affects: src/utils/FolderChecker.ts
// 已优化: 使用树形结构提高大型知识库的递归性能
// 已优化: 添加路径检查结果缓存减少重复计算
// 已优化: 实现批量处理功能减少重复初始化开销
// 已优化: 添加常用路径预计算功能提前缓存结果

/**
 * 文件夹树节点接口
 */
interface FolderNode {
    name: string;
    isIncluded: boolean;
    children: Map<string, FolderNode>;
}

/**
 * 文件访问记录接口
 */
interface FileAccessRecord {
    file: TFile;
    lastAccessed: number;
    accessCount: number;
}

export class FolderChecker {
    private static folderTree: FolderNode = {
        name: '',
        isIncluded: false,
        children: new Map()
    };
    
    private static isInitialized: boolean = false;
    private static _lastSettings: TitleChangerSettings | null = null;
    
    // 缓存最近检查的文件路径结果
    private static pathCache = new Map<string, boolean>();
    private static MAX_CACHE_SIZE = 1000; // 限制缓存大小
    
    // 文件访问记录
    private static fileAccessRecords = new Map<string, FileAccessRecord>();
    private static MAX_ACCESS_RECORDS = 500; // 最大记录数量
    
    /**
     * 初始化文件夹树
     * @param includedFolders 包含的文件夹列表
     */
    static initializeFolderTree(includedFolders: string[]): void {
        // 重置树
        this.folderTree = {
            name: '',
            isIncluded: includedFolders.length === 0, // 如果没有指定文件夹，则包含所有文件
            children: new Map()
        };
        
        // 构建树
        for (const folder of includedFolders) {
            this.addFolderToTree(folder);
        }
        
        this.isInitialized = true;
    }
    
    /**
     * 添加文件夹到树中
     * @param folderPath 要添加的文件夹路径
     */
    private static addFolderToTree(folderPath: string): void {
        // 规范化路径
        const normalizedPath = this.normalizePath(folderPath);
        if (!normalizedPath) return;
        
        // 分割路径
        const parts = normalizedPath.split('/').filter(p => p !== '');
        
        // 从根节点开始
        let currentNode = this.folderTree;
        
        // 遍历路径部分
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // 如果节点不存在，创建它
            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, {
                    name: part,
                    isIncluded: false,
                    children: new Map()
                });
            }
            
            // 移动到下一个节点
            currentNode = currentNode.children.get(part)!;
            
            // 如果是路径的最后一部分，标记为包含
            if (i === parts.length - 1) {
                currentNode.isIncluded = true;
            }
        }
    }
    
    /**
     * 检查文件是否应该应用标题修改
     * @param file 要检查的文件
     * @param settings 插件设置
     * @returns 如果文件应该应用标题修改则返回 true
     */
    static shouldApplyToFile(file: TFile, settings: TitleChangerSettings): boolean {
        // 如果树未初始化或设置已更改，初始化树和清空缓存
        if (!this.isInitialized || this._lastSettings !== settings) {
            this.initializeFolderTree(settings.includedFolders);
            this._lastSettings = settings;
            this.pathCache.clear(); // 清空缓存
        }
        
        // 记录文件访问
        this.recordFileAccess(file);
        
        // 获取文件路径并验证
        const filePath = file.path;
        // 严格确保路径是有效的字符串
        if (!filePath || typeof filePath !== 'string' || filePath === '') {
            return false;
        }
        
        // 检查缓存中是否存在结果
        if (this.pathCache.has(filePath)) {
            return this.pathCache.get(filePath)!;
        }
        
        // 如果没有包含的文件夹，返回true
        if (settings.includedFolders.length === 0) {
            this.addToCache(filePath, true);
            return true;
        }
        
        // 检查文件路径是否在树中并缓存结果
        // 使用非空断言操作符!表明filePath一定不为undefined
        const result = this.isPathIncluded(filePath!);
        this.addToCache(filePath, result);
        
        return result;
    }
    
    /**
     * 批量检查文件是否应用标题修改
     * 适用于需要一次性检查多个文件的场景，减少重复初始化开销
     * @param files 要检查的文件列表
     * @param settings 插件设置
     * @returns 文件路径到检查结果的映射
     */
    static batchCheckFiles(files: TFile[], settings: TitleChangerSettings): Map<string, boolean> {
        const results = new Map<string, boolean>();
        
        // 确保树已初始化
        if (!this.isInitialized || this._lastSettings !== settings) {
            this.initializeFolderTree(settings.includedFolders);
            this._lastSettings = settings;
            // 不清空缓存，保留有用的缓存结果
        }
        
        // 如果没有包含的文件夹，所有文件都返回true
        if (settings.includedFolders.length === 0) {
            for (const file of files) {
                const filePath = file.path;
                if (filePath && typeof filePath === 'string') {
                    results.set(filePath, true);
                    this.addToCache(filePath, true);
                }
            }
            return results;
        }
        
        // 批量处理文件
        for (const file of files) {
            const filePath = file.path;
            if (!filePath || typeof filePath !== 'string' || filePath === '') {
                continue; // 跳过无效路径
            }
            
            // 检查缓存
            if (this.pathCache.has(filePath)) {
                results.set(filePath, this.pathCache.get(filePath)!);
                continue;
            }
            
            // 执行路径检查
            const result = this.isPathIncluded(filePath);
            
            // 保存结果
            results.set(filePath, result);
            this.addToCache(filePath, result);
        }
        
        return results;
    }
    
    /**
     * 记录文件访问情况
     * @param file 被访问的文件
     */
    private static recordFileAccess(file: TFile): void {
        const filePath = file.path;
        if (!filePath) return;
        
        const now = Date.now();
        
        if (this.fileAccessRecords.has(filePath)) {
            // 更新已有记录
            const record = this.fileAccessRecords.get(filePath)!;
            record.lastAccessed = now;
            record.accessCount++;
        } else {
            // 添加新记录
            this.fileAccessRecords.set(filePath, {
                file,
                lastAccessed: now,
                accessCount: 1
            });
            
            // 如果记录超过上限，清理最旧/最少访问的记录
            if (this.fileAccessRecords.size > this.MAX_ACCESS_RECORDS) {
                this.pruneAccessRecords();
            }
        }
    }
    
    /**
     * 清理访问记录，移除最旧或最少访问的记录
     */
    private static pruneAccessRecords(): void {
        // 转换为数组进行排序
        const records = Array.from(this.fileAccessRecords.entries());
        
        // 按访问时间和次数排序
        records.sort((a, b) => {
            // 首先按访问次数排序
            const countDiff = a[1].accessCount - b[1].accessCount;
            if (countDiff !== 0) return countDiff;
            
            // 次数相同则按最后访问时间排序
            return a[1].lastAccessed - b[1].lastAccessed;
        });
        
        // 移除前20%的记录
        const removeCount = Math.ceil(this.MAX_ACCESS_RECORDS * 0.2);
        for (let i = 0; i < removeCount && i < records.length; i++) {
            this.fileAccessRecords.delete(records[i][0]);
        }
    }
    
    /**
     * 获取最近访问的文件
     * @param limit 返回的文件数量
     * @returns 最近访问的文件列表
     */
    static getRecentlyAccessedFiles(limit: number = 100): TFile[] {
        // 转换为数组进行排序
        const records = Array.from(this.fileAccessRecords.values());
        
        // 按最后访问时间倒序排序
        records.sort((a, b) => b.lastAccessed - a.lastAccessed);
        
        // 返回前N个文件
        return records.slice(0, limit).map(record => record.file);
    }
    
    /**
     * 获取访问频率最高的文件
     * @param limit 返回的文件数量
     * @returns 访问频率最高的文件列表
     */
    static getMostFrequentlyAccessedFiles(limit: number = 100): TFile[] {
        // 转换为数组进行排序
        const records = Array.from(this.fileAccessRecords.values());
        
        // 按访问次数倒序排序
        records.sort((a, b) => b.accessCount - a.accessCount);
        
        // 返回前N个文件
        return records.slice(0, limit).map(record => record.file);
    }
    
    /**
     * 预计算常用路径的检查结果
     * 根据最近访问和访问频率计算最可能被使用的文件
     * @param app Obsidian应用实例
     * @param settings 插件设置
     * @param limit 预计算文件的数量限制
     */
    static precomputePaths(app: App, settings: TitleChangerSettings, limit: number = 200): void {
        // 收集要预计算的文件
        const filesToPrecompute = new Set<TFile>();
        
        // 1. 添加最近访问的文件
        const recentFiles = this.getRecentlyAccessedFiles(limit / 2);
        recentFiles.forEach(file => filesToPrecompute.add(file));
        
        // 2. 添加访问频率最高的文件
        const frequentFiles = this.getMostFrequentlyAccessedFiles(limit / 2);
        frequentFiles.forEach(file => filesToPrecompute.add(file));
        
        // 3. 如果有空间，添加活动窗口中的文件
        if (filesToPrecompute.size < limit) {
            const openFiles = this.getOpenFiles(app);
            openFiles.forEach(file => {
                if (filesToPrecompute.size < limit) {
                    filesToPrecompute.add(file);
                }
            });
        }
        
        // 4. 如果还有空间，添加一些最近修改的文件
        if (filesToPrecompute.size < limit) {
            const recentlyModified = this.getRecentlyModifiedFiles(app, limit - filesToPrecompute.size);
            recentlyModified.forEach(file => filesToPrecompute.add(file));
        }
        
        // 将Set转换为数组并执行批量检查
        this.batchCheckFiles(Array.from(filesToPrecompute), settings);
    }
    
    /**
     * 获取当前打开的文件
     * @param app Obsidian应用实例
     * @returns 当前打开的文件列表
     */
    private static getOpenFiles(app: App): TFile[] {
        const openFiles: TFile[] = [];
        
        // 获取所有打开的叶子
        const leaves = app.workspace.getLeavesOfType('markdown');
        
        // 从叶子中提取文件
        for (const leaf of leaves) {
            // 使用any类型避免TypeScript错误，因为Obsidian API的类型定义不完整
            const view = leaf.view as any;
            if (view && view.file instanceof TFile) {
                openFiles.push(view.file);
            }
        }
        
        return openFiles;
    }
    
    /**
     * 获取最近修改的文件
     * @param app Obsidian应用实例
     * @param limit 返回的文件数量
     * @returns 最近修改的文件列表
     */
    private static getRecentlyModifiedFiles(app: App, limit: number): TFile[] {
        // 获取所有Markdown文件
        const files = app.vault.getMarkdownFiles();
        
        // 按修改时间排序
        files.sort((a, b) => b.stat.mtime - a.stat.mtime);
        
        // 返回前N个文件
        return files.slice(0, limit);
    }
    
    /**
     * 添加结果到缓存，同时管理缓存大小
     * @param path 文件路径
     * @param result 检查结果
     */
    private static addToCache(path: string, result: boolean): void {
        if (!path) return; // 避免处理undefined
        
        // 如果缓存已满，移除最旧的条目
        if (this.pathCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.pathCache.keys().next().value;
            if (oldestKey) {
                this.pathCache.delete(oldestKey);
            }
        }
        
        // 添加新条目
        this.pathCache.set(path, result);
    }
    
    /**
     * 检查路径是否包含在树中
     * @param path 要检查的路径
     * @returns 如果路径包含在树中则返回 true
     */
    private static isPathIncluded(path: string): boolean {
        // 不再需要检查path是否为字符串，因为类型已经确保
        if (path === '') {
            return false;
        }
        
        // 分割路径
        const parts = path.split('/').filter(p => p !== '');
        
        // 从根节点开始
        let currentNode = this.folderTree;
        if (currentNode.isIncluded) return true; // 根节点包含所有文件
        
        // 遍历路径部分
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath += part;
            
            // 检查当前节点的子节点
            if (currentNode.children.has(part)) {
                currentNode = currentNode.children.get(part)!;
                
                // 如果当前节点被包含，文件也被包含
                if (currentNode.isIncluded) {
                    return true;
                }
            } else {
                // 如果找不到子节点，检查是否有通配符（未来可能支持）
                if (currentNode.children.has('*')) {
                    return true;
                }
                break;
            }
            
            // 为下一部分添加分隔符
            if (i < parts.length - 1) {
                currentPath += '/';
            }
        }
        
        return false;
    }
    
    /**
     * 规范化路径，确保以 / 结尾
     * @param path 路径
     * @returns 规范化后的路径
     */
    private static normalizePath(path: string): string {
        // 如果路径为空，返回空字符串
        if (!path) {
            return '';
        }
        
        // 确保路径以 / 结尾
        return path.endsWith('/') ? path : path + '/';
    }
    
    /**
     * 清空路径缓存
     * 当需要强制重新计算所有路径时使用
     */
    static clearCache(): void {
        this.pathCache.clear();
    }
} 