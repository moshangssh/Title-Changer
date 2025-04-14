import * as fs from 'fs';
import * as path from 'path';

/**
 * 基准测试结果处理工具
 * 用于保存和分析基准测试结果
 */
class ResultProcessor {
  private results: any[] = [];
  private outputPath: string;
  
  constructor(outputPath: string = './benchmark-results') {
    this.outputPath = outputPath;
    this.ensureOutputDirectory();
  }
  
  /**
   * 确保输出目录存在
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }
  
  /**
   * 添加测试结果
   * @param result 测试结果对象
   */
  addResult(result: any): void {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 保存测试结果到JSON文件
   */
  saveResults(): void {
    const filename = `benchmark-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filepath = path.join(this.outputPath, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`测试结果已保存至: ${filepath}`);
  }
  
  /**
   * 生成性能摘要报告
   * @returns 格式化的摘要报告
   */
  generateSummary(): string {
    if (this.results.length === 0) {
      return '无测试结果可用';
    }
    
    let summary = '# LRU缓存性能测试摘要\n\n';
    summary += `测试时间: ${new Date().toLocaleString()}\n\n`;
    
    // 按测试类别分组
    const categories: Record<string, any[]> = {};
    
    for (const result of this.results) {
      const category = result.category || '未分类';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(result);
    }
    
    // 按类别生成摘要
    for (const [category, results] of Object.entries(categories)) {
      summary += `## ${category}\n\n`;
      summary += '| 测试名称 | 传统LRUCache | 增强型EnhancedLRUCache | 性能提升 |\n';
      summary += '|---------|------------|-------------------|--------|\n';
      
      for (const result of results) {
        const legacy = this.formatTime(result.legacyTime);
        const enhanced = this.formatTime(result.enhancedTime);
        const improvement = ((1 - result.enhancedTime / result.legacyTime) * 100).toFixed(2);
        
        summary += `| ${result.name} | ${legacy} | ${enhanced} | ${improvement}% |\n`;
      }
      
      summary += '\n';
    }
    
    // 添加综合性能分析
    summary += '## 综合性能分析\n\n';
    
    // 计算平均性能提升
    let totalImprovement = 0;
    let count = 0;
    
    for (const result of this.results) {
      if (result.legacyTime && result.enhancedTime) {
        totalImprovement += (1 - result.enhancedTime / result.legacyTime) * 100;
        count++;
      }
    }
    
    const avgImprovement = (totalImprovement / count).toFixed(2);
    summary += `- 平均性能提升: ${avgImprovement}%\n`;
    
    // 找出最大和最小提升
    let maxImprovement = -Infinity;
    let minImprovement = Infinity;
    let maxImprovementTest = '';
    let minImprovementTest = '';
    
    for (const result of this.results) {
      if (result.legacyTime && result.enhancedTime) {
        const improvement = (1 - result.enhancedTime / result.legacyTime) * 100;
        
        if (improvement > maxImprovement) {
          maxImprovement = improvement;
          maxImprovementTest = result.name;
        }
        
        if (improvement < minImprovement) {
          minImprovement = improvement;
          minImprovementTest = result.name;
        }
      }
    }
    
    summary += `- 最大性能提升: ${maxImprovement.toFixed(2)}% (${maxImprovementTest})\n`;
    summary += `- 最小性能提升: ${minImprovement.toFixed(2)}% (${minImprovementTest})\n\n`;
    
    summary += '## 结论\n\n';
    summary += '基于以上测试结果，增强型EnhancedLRUCache在以下场景中表现最佳：\n\n';
    
    // 按性能提升排序，找出最佳场景
    const sortedResults = [...this.results]
      .filter(r => r.legacyTime && r.enhancedTime)
      .sort((a, b) => {
        const improvementA = (1 - a.enhancedTime / a.legacyTime) * 100;
        const improvementB = (1 - b.enhancedTime / b.legacyTime) * 100;
        return improvementB - improvementA;
      });
    
    for (let i = 0; i < Math.min(3, sortedResults.length); i++) {
      const result = sortedResults[i];
      const improvement = ((1 - result.enhancedTime / result.legacyTime) * 100).toFixed(2);
      summary += `- ${result.name}: 提升 ${improvement}%\n`;
    }
    
    return summary;
  }
  
  /**
   * 保存性能摘要报告到文件
   */
  saveSummary(): void {
    const summary = this.generateSummary();
    const filename = `summary-${new Date().toISOString().replace(/:/g, '-')}.md`;
    const filepath = path.join(this.outputPath, filename);
    
    fs.writeFileSync(filepath, summary);
    console.log(`性能摘要报告已保存至: ${filepath}`);
  }
  
  /**
   * 格式化时间显示
   * @param ms 毫秒数
   * @returns 格式化后的时间字符串
   */
  private formatTime(ms: number): string {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}μs`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

export { ResultProcessor };