import { TFile, Vault, App } from 'obsidian';
import { FolderChecker } from './FolderChecker';
import { TitleChangerSettings } from '../settings';

/**
 * 性能测试结果接口
 */
interface PerformanceTestResult {
    testName: string;
    executionTime: number;
    operationsPerSecond: number;
    fileCount: number;
    optimizationEnabled: boolean;
    description: string;
    timestamp: number;
}

/**
 * 文件夹递归性能测试工具
 * 用于测试和验证文件夹递归优化的效果
 */
export class PerformanceTest {
    private static results: PerformanceTestResult[] = [];
    
    /**
     * 运行基准测试
     * @param app Obsidian应用实例
     * @param settings 插件设置
     * @returns 测试结果
     */
    static async runBenchmark(app: App, settings: TitleChangerSettings): Promise<PerformanceTestResult[]> {
        // 清空之前的结果
        this.results = [];
        
        // 获取所有Markdown文件
        const files = app.vault.getMarkdownFiles();
        
        // 清空FolderChecker的缓存以确保公平测试
        FolderChecker.clearCache();
        
        // 执行各种测试
        await this.testSingleFileAccess(files, settings);
        await this.testBatchAccess(files, settings);
        await this.testSequentialAccess(files, settings);
        await this.testRandomAccess(files, settings);
        await this.testWithPrecomputation(app, files, settings);
        
        return this.results;
    }
    
    /**
     * 测试单个文件访问性能
     * @param files 所有文件
     * @param settings 插件设置
     */
    private static async testSingleFileAccess(files: TFile[], settings: TitleChangerSettings): Promise<void> {
        // 选择测试文件数量
        const testCount = Math.min(files.length, 100);
        const testFiles = files.slice(0, testCount);
        
        // 清空缓存
        FolderChecker.clearCache();
        
        // 开始计时
        const startTime = performance.now();
        
        // 按顺序依次检查文件
        for (const file of testFiles) {
            FolderChecker.shouldApplyToFile(file, settings);
        }
        
        // 结束计时
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 记录结果
        this.results.push({
            testName: "单文件顺序访问",
            executionTime,
            operationsPerSecond: (testCount / executionTime) * 1000,
            fileCount: testCount,
            optimizationEnabled: true,
            description: "测试单个文件按顺序依次检查的性能",
            timestamp: Date.now()
        });
    }
    
    /**
     * 测试批量文件访问性能
     * @param files 所有文件
     * @param settings 插件设置
     */
    private static async testBatchAccess(files: TFile[], settings: TitleChangerSettings): Promise<void> {
        // 选择测试文件数量
        const testCount = Math.min(files.length, 1000);
        const testFiles = files.slice(0, testCount);
        
        // 清空缓存
        FolderChecker.clearCache();
        
        // 开始计时
        const startTime = performance.now();
        
        // 批量检查文件
        FolderChecker.batchCheckFiles(testFiles, settings);
        
        // 结束计时
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 记录结果
        this.results.push({
            testName: "批量文件访问",
            executionTime,
            operationsPerSecond: (testCount / executionTime) * 1000,
            fileCount: testCount,
            optimizationEnabled: true,
            description: "测试批量处理多个文件的性能",
            timestamp: Date.now()
        });
    }
    
    /**
     * 测试连续访问相同文件的性能
     * @param files 所有文件
     * @param settings 插件设置
     */
    private static async testSequentialAccess(files: TFile[], settings: TitleChangerSettings): Promise<void> {
        if (files.length === 0) return;
        
        // 选择5个测试文件
        const testFiles = files.slice(0, Math.min(5, files.length));
        const iterations = 200; // 每个文件重复访问次数
        const totalOperations = testFiles.length * iterations;
        
        // 清空缓存
        FolderChecker.clearCache();
        
        // 开始计时
        const startTime = performance.now();
        
        // 重复访问相同文件
        for (let i = 0; i < iterations; i++) {
            for (const file of testFiles) {
                FolderChecker.shouldApplyToFile(file, settings);
            }
        }
        
        // 结束计时
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 记录结果
        this.results.push({
            testName: "连续访问相同文件",
            executionTime,
            operationsPerSecond: (totalOperations / executionTime) * 1000,
            fileCount: totalOperations,
            optimizationEnabled: true,
            description: "测试重复访问相同文件的缓存性能",
            timestamp: Date.now()
        });
    }
    
    /**
     * 测试随机访问文件的性能
     * @param files 所有文件
     * @param settings 插件设置
     */
    private static async testRandomAccess(files: TFile[], settings: TitleChangerSettings): Promise<void> {
        if (files.length < 10) return;
        
        // 选择测试文件数量
        const testCount = Math.min(files.length, 500);
        const filesToUse = files.slice(0, testCount);
        
        // 清空缓存
        FolderChecker.clearCache();
        
        // 开始计时
        const startTime = performance.now();
        
        // 随机访问文件
        for (let i = 0; i < testCount; i++) {
            const randomIndex = Math.floor(Math.random() * filesToUse.length);
            FolderChecker.shouldApplyToFile(filesToUse[randomIndex], settings);
        }
        
        // 结束计时
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 记录结果
        this.results.push({
            testName: "随机文件访问",
            executionTime,
            operationsPerSecond: (testCount / executionTime) * 1000,
            fileCount: testCount,
            optimizationEnabled: true,
            description: "测试随机访问文件的性能",
            timestamp: Date.now()
        });
    }
    
    /**
     * 测试预计算路径后的访问性能
     * @param app Obsidian应用实例
     * @param files 所有文件
     * @param settings 插件设置
     */
    private static async testWithPrecomputation(app: App, files: TFile[], settings: TitleChangerSettings): Promise<void> {
        if (files.length === 0) return;
        
        // 选择50个测试文件
        const testCount = Math.min(files.length, 50);
        const testFiles = files.slice(0, testCount);
        
        // 清空缓存
        FolderChecker.clearCache();
        
        // 先执行预计算
        FolderChecker.precomputePaths(app, settings);
        
        // 开始计时
        const startTime = performance.now();
        
        // 访问文件 (应该利用到预计算的结果)
        for (const file of testFiles) {
            FolderChecker.shouldApplyToFile(file, settings);
        }
        
        // 结束计时
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 记录结果
        this.results.push({
            testName: "预计算后的文件访问",
            executionTime,
            operationsPerSecond: (testCount / executionTime) * 1000,
            fileCount: testCount,
            optimizationEnabled: true,
            description: "测试预计算路径后访问文件的性能",
            timestamp: Date.now()
        });
    }
    
    /**
     * 获取测试结果的HTML表格表示
     * @returns HTML表格字符串
     */
    static getResultsAsHTML(): string {
        if (this.results.length === 0) {
            return '<p>还没有性能测试结果。请先运行测试。</p>';
        }
        
        let html = `
        <table class="performance-results">
            <thead>
                <tr>
                    <th>测试名称</th>
                    <th>执行时间(ms)</th>
                    <th>操作/秒</th>
                    <th>文件数量</th>
                    <th>描述</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        for (const result of this.results) {
            html += `
                <tr>
                    <td>${result.testName}</td>
                    <td>${result.executionTime.toFixed(2)}</td>
                    <td>${result.operationsPerSecond.toFixed(2)}</td>
                    <td>${result.fileCount}</td>
                    <td>${result.description}</td>
                </tr>
            `;
        }
        
        html += `
            </tbody>
        </table>
        `;
        
        return html;
    }
    
    /**
     * 获取基准测试结果的Markdown报告
     * @returns Markdown格式的报告
     */
    static getResultsAsMarkdown(): string {
        if (this.results.length === 0) {
            return '> 还没有性能测试结果。请先运行测试。';
        }
        
        let markdown = `# 文件夹递归性能测试报告\n\n`;
        markdown += `*测试时间: ${new Date().toLocaleString()}*\n\n`;
        
        markdown += `## 测试结果\n\n`;
        markdown += `| 测试名称 | 执行时间(ms) | 操作/秒 | 文件数量 | 描述 |\n`;
        markdown += `| :------ | -----------: | ------: | -------: | :--- |\n`;
        
        for (const result of this.results) {
            markdown += `| ${result.testName} | ${result.executionTime.toFixed(2)} | ${result.operationsPerSecond.toFixed(2)} | ${result.fileCount} | ${result.description} |\n`;
        }
        
        markdown += `\n## 优化总结\n\n`;
        markdown += `- 树形结构：将线性搜索优化为对数复杂度\n`;
        markdown += `- 缓存机制：减少重复路径计算开销\n`;
        markdown += `- 批量处理：减少重复初始化开销\n`;
        markdown += `- 预计算：提前缓存热门文件路径\n\n`;
        
        markdown += `> 性能测试由FolderChecker优化工具自动生成\n`;
        
        return markdown;
    }
} 