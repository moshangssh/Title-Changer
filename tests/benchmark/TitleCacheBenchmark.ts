import { LRUCache } from '../../src/utils/LRUCache';
import { EnhancedLRUCache } from '../../src/utils/EnhancedLRUCache';
import { LRUCacheBase } from '../../src/utils/LRUCacheBase';
import { PerformanceMeasure } from './LRUCacheBenchmark';

/**
 * 模拟标题处理场景的缓存性能测试
 * 这个测试更接近实际应用场景
 */
class TitleCacheBenchmark {
  private readonly fileCount = 1000; // 模拟的文件数量
  private readonly fileNames: string[] = [];
  private readonly processedTitles: string[] = [];
  
  constructor() {
    // 生成模拟的文件名和处理后的标题
    this.generateTestData();
  }
  
  /**
   * 生成模拟的文件名和处理后的标题
   */
  private generateTestData(): void {
    const prefixes = ['Report', 'Memo', 'Note', 'Document', 'Project', 'Meeting', 'Summary', 'Analysis'];
    const domains = ['Finance', 'Marketing', 'Sales', 'HR', 'Legal', 'IT', 'Operations', 'Research'];
    const suffixes = ['Draft', 'Final', 'Review', 'Update', 'v1.0', 'v2.0', 'Rev2', 'Notes'];
    
    for (let i = 0; i < this.fileCount; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      // 生成类似实际文件名的字符串
      const fileName = `${prefix}-${domain}-${timestamp}-${i}-${suffix}.md`;
      this.fileNames.push(fileName);
      
      // 模拟处理过程，生成处理后的标题
      const processedTitle = this.processTitle(fileName);
      this.processedTitles.push(processedTitle);
    }
  }
  
  /**
   * 模拟标题处理逻辑
   * @param fileName 文件名
   * @returns 处理后的标题
   */
  private processTitle(fileName: string): string {
    // 模拟一些标题处理逻辑，例如：
    // 1. 移除扩展名
    let title = fileName.replace(/\.[^.]+$/, '');
    
    // 2. 替换连字符为空格
    title = title.replace(/-/g, ' ');
    
    // 3. 首字母大写
    title = title.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // 4. 移除日期部分 (假设格式为 YYYYMMDD)
    title = title.replace(/\d{8}/g, '');
    
    // 5. 精简多余空格
    title = title.replace(/\s+/g, ' ').trim();
    
    // 模拟一些额外的计算工作
    for (let i = 0; i < 100; i++) {
      title = title.replace(/\d+/g, match => `#${match}#`);
      title = title.replace(/#(\d+)#/g, match => match.replace(/#/g, ''));
    }
    
    return title;
  }
  
  /**
   * 模拟真实应用场景：缓存标题
   */
  async benchmarkTitleCaching(): Promise<void> {
    console.log("\n===== 标题缓存性能比较 =====");
    
    // 传统缓存
    const legacyImpl = () => {
      const cache = new LRUCache<string, string>(this.fileCount);
      
      // 第一次：填充缓存
      for (let i = 0; i < this.fileCount; i++) {
        const fileName = this.fileNames[i];
        
        // 模拟从缓存获取，未命中时计算并缓存
        let title = cache.get(fileName);
        if (title === undefined) {
          title = this.processTitle(fileName);
          cache.set(fileName, title);
        }
      }
      
      // 第二次：模拟重复访问，应该命中缓存
      for (let i = 0; i < this.fileCount; i++) {
        const fileName = this.fileNames[i];
        cache.get(fileName);
      }
      
      // 第三次：混合访问（20%的新项目）
      for (let i = 0; i < this.fileCount; i++) {
        if (i % 5 === 0) {
          // 新项目，不在缓存中
          const newFileName = `New-${this.fileNames[i]}`;
          let title = cache.get(newFileName);
          if (title === undefined) {
            title = this.processTitle(newFileName);
            cache.set(newFileName, title);
          }
        } else {
          // 已缓存项目
          cache.get(this.fileNames[i]);
        }
      }
    };
    
    // 增强型缓存
    const enhancedImpl = () => {
      const cache = new EnhancedLRUCache<string, string>(this.fileCount);
      
      // 第一次：填充缓存
      for (let i = 0; i < this.fileCount; i++) {
        const fileName = this.fileNames[i];
        
        // 模拟从缓存获取，未命中时计算并缓存
        let title = cache.get(fileName);
        if (title === undefined) {
          title = this.processTitle(fileName);
          cache.set(fileName, title);
        }
      }
      
      // 第二次：模拟重复访问，应该命中缓存
      for (let i = 0; i < this.fileCount; i++) {
        const fileName = this.fileNames[i];
        cache.get(fileName);
      }
      
      // 第三次：混合访问（20%的新项目）
      for (let i = 0; i < this.fileCount; i++) {
        if (i % 5 === 0) {
          // 新项目，不在缓存中
          const newFileName = `New-${this.fileNames[i]}`;
          let title = cache.get(newFileName);
          if (title === undefined) {
            title = this.processTitle(newFileName);
            cache.set(newFileName, title);
          }
        } else {
          // 已缓存项目
          cache.get(this.fileNames[i]);
        }
      }
    };
    
    await PerformanceMeasure.compare(
      `标题缓存场景（${this.fileCount}文件）`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 模拟实际场景：滑动窗口访问模式
   * 这种模式更接近现实：用户通常会集中访问相关文件
   */
  async benchmarkSlidingWindowAccess(): Promise<void> {
    console.log("\n===== 滑动窗口访问模式性能比较 =====");
    
    // 窗口大小（一次集中访问的文件数）
    const windowSize = 50;
    
    // 传统缓存
    const legacyImpl = () => {
      const cache = new LRUCache<string, string>(this.fileCount / 2); // 故意设置较小的缓存，造成淘汰
      
      // 填充初始数据
      for (let i = 0; i < this.fileCount / 2; i++) {
        cache.set(this.fileNames[i], this.processedTitles[i]);
      }
      
      // 模拟滑动窗口访问模式
      for (let start = 0; start < this.fileCount - windowSize; start += windowSize / 2) {
        // 集中访问窗口内的文件
        for (let i = 0; i < windowSize; i++) {
          const index = start + i;
          if (index < this.fileCount) {
            const fileName = this.fileNames[index];
            
            let title = cache.get(fileName);
            if (title === undefined) {
              title = this.processedTitles[index];
              cache.set(fileName, title);
            }
          }
        }
      }
    };
    
    // 增强型缓存
    const enhancedImpl = () => {
      const cache = new EnhancedLRUCache<string, string>(this.fileCount / 2); // 故意设置较小的缓存，造成淘汰
      
      // 填充初始数据
      for (let i = 0; i < this.fileCount / 2; i++) {
        cache.set(this.fileNames[i], this.processedTitles[i]);
      }
      
      // 模拟滑动窗口访问模式
      for (let start = 0; start < this.fileCount - windowSize; start += windowSize / 2) {
        // 集中访问窗口内的文件
        for (let i = 0; i < windowSize; i++) {
          const index = start + i;
          if (index < this.fileCount) {
            const fileName = this.fileNames[index];
            
            let title = cache.get(fileName);
            if (title === undefined) {
              title = this.processedTitles[index];
              cache.set(fileName, title);
            }
          }
        }
      }
    };
    
    await PerformanceMeasure.compare(
      `滑动窗口访问（窗口大小${windowSize}）`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 模拟实际场景：批量操作性能
   */
  async benchmarkTitleBatchOperations(): Promise<void> {
    console.log("\n===== 标题批量操作性能比较 =====");
    
    // 批量大小
    const batchSize = 50;
    
    // 生成批量键和值
    const generateBatch = (start: number, size: number): [string[], string[]] => {
      const keys: string[] = [];
      const values: string[] = [];
      
      for (let i = 0; i < size; i++) {
        const index = (start + i) % this.fileCount;
        keys.push(this.fileNames[index]);
        values.push(this.processedTitles[index]);
      }
      
      return [keys, values];
    };
    
    // 传统缓存 - 没有真正的批量API，单个操作模拟批量
    const legacyImpl = () => {
      const cache = new LRUCache<string, string>(this.fileCount);
      
      // 模拟多次批量操作
      for (let batch = 0; batch < this.fileCount; batch += batchSize) {
        // 批量设置
        const [keys, values] = generateBatch(batch, batchSize);
        for (let i = 0; i < batchSize; i++) {
          cache.set(keys[i], values[i]);
        }
        
        // 批量获取
        for (let i = 0; i < batchSize; i++) {
          cache.get(keys[i]);
        }
      }
    };
    
    // 增强型缓存 - 使用批量API
    const enhancedImpl = () => {
      const cache = new EnhancedLRUCache<string, string>(this.fileCount);
      
      // 模拟多次批量操作
      for (let batch = 0; batch < this.fileCount; batch += batchSize) {
        // 批量设置
        const [keys, values] = generateBatch(batch, batchSize);
        const entries: Array<[string, string]> = keys.map((key, i) => [key, values[i]]);
        cache.setMany(entries);
        
        // 批量获取
        cache.getMany(keys);
      }
    };
    
    await PerformanceMeasure.compare(
      `标题批量操作（批量大小${batchSize}）`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 运行所有基准测试
   */
  async runAll(): Promise<void> {
    console.log("========== 标题缓存实际应用场景性能测试 ==========");
    
    await this.benchmarkTitleCaching();
    await this.benchmarkSlidingWindowAccess();
    await this.benchmarkTitleBatchOperations();
    
    console.log("\n========== 应用场景测试完成 ==========");
  }
}

export { TitleCacheBenchmark };