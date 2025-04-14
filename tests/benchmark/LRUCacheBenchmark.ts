import { LRUCache } from '../../src/utils/LRUCache';
import { EnhancedLRUCache } from '../../src/utils/EnhancedLRUCache';
import { LRUCacheBase } from '../../src/utils/LRUCacheBase';

/**
 * 简单的性能测试工具，用于测量代码块执行时间
 */
class PerformanceMeasure {
  private static formatTime(ms: number): string {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}μs`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * 运行性能测试并测量执行时间
   * @param name 测试名称
   * @param iterations 迭代次数
   * @param fn 要测试的函数
   * @returns 执行时间（毫秒）
   */
  static async measure(name: string, iterations: number, fn: () => void | Promise<void>): Promise<number> {
    console.log(`开始测试: ${name} (${iterations} 次迭代)`);
    
    // 预热
    for (let i = 0; i < Math.min(iterations * 0.1, 100); i++) {
      await fn();
    }
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    
    const end = performance.now();
    const duration = end - start;
    const avgTime = duration / iterations;
    
    console.log(`${name}: 总时间 ${this.formatTime(duration)}, 平均时间 ${this.formatTime(avgTime)}`);
    
    return duration;
  }

  /**
   * 比较两个实现的性能
   * @param name 测试名称
   * @param iterations 迭代次数
   * @param impl1 第一个实现
   * @param impl2 第二个实现
   * @param impl1Name 第一个实现的名称
   * @param impl2Name 第二个实现的名称
   */
  static async compare(
    name: string, 
    iterations: number, 
    impl1: () => void | Promise<void>, 
    impl2: () => void | Promise<void>,
    impl1Name: string,
    impl2Name: string
  ): Promise<void> {
    console.log(`\n===== 性能比较: ${name} =====`);
    
    const time1 = await this.measure(`${impl1Name}`, iterations, impl1);
    const time2 = await this.measure(`${impl2Name}`, iterations, impl2);
    
    const ratio = time1 / time2;
    const improvement = ((1 - time2 / time1) * 100).toFixed(2);
    
    console.log(`\n结果: ${impl2Name} 比 ${impl1Name} ${ratio < 1 ? "慢" : "快"} ${Math.abs(ratio - 1) * 100}%`);
    if (ratio > 1) {
      console.log(`性能提升: ${improvement}%`);
    }
    console.log("===================================\n");
  }
}

/**
 * LRU缓存性能基准测试
 */
class LRUCacheBenchmark {
  // 测试数据大小
  private readonly small = 100;
  private readonly medium = 1000;
  private readonly large = 10000;
  
  // 缓存实例
  private legacyCache: LRUCacheBase<string, string>;
  private enhancedCache: LRUCacheBase<string, string>;
  
  constructor(capacity: number = 1000) {
    this.legacyCache = new LRUCache<string, string>(capacity);
    this.enhancedCache = new EnhancedLRUCache<string, string>(capacity);
  }
  
  /**
   * 生成测试键
   * @param size 键的数量
   * @returns 测试键数组
   */
  private generateKeys(size: number): string[] {
    return Array.from({ length: size }, (_, i) => `key-${i}`);
  }
  
  /**
   * 生成测试值
   * @param key 键
   * @returns 测试值
   */
  private generateValue(key: string): string {
    return `value-for-${key}-${Date.now()}`;
  }
  
  /**
   * 测试设置操作性能
   * @param size 测试数据大小
   */
  async benchmarkSet(size: number): Promise<void> {
    const keys = this.generateKeys(size);
    
    // 传统缓存
    const legacyImpl = () => {
      const cache = new LRUCache<string, string>(size);
      for (const key of keys) {
        cache.set(key, this.generateValue(key));
      }
    };
    
    // 增强型缓存
    const enhancedImpl = () => {
      const cache = new EnhancedLRUCache<string, string>(size);
      for (const key of keys) {
        cache.set(key, this.generateValue(key));
      }
    };
    
    await PerformanceMeasure.compare(
      `设置 ${size} 个项目`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 测试获取操作性能
   * @param size 测试数据大小
   * @param hitRatio 缓存命中率 (0-1)
   */
  async benchmarkGet(size: number, hitRatio: number = 0.8): Promise<void> {
    const keys = this.generateKeys(size);
    const hitCount = Math.floor(size * hitRatio);
    
    // 预填充缓存
    this.legacyCache = new LRUCache<string, string>(size);
    this.enhancedCache = new EnhancedLRUCache<string, string>(size);
    
    for (const key of keys) {
      const value = this.generateValue(key);
      this.legacyCache.set(key, value);
      this.enhancedCache.set(key, value);
    }
    
    // 构建查询键（一部分命中，一部分未命中）
    const queryKeys = [
      ...keys.slice(0, hitCount),  // 命中的键
      ...Array.from({ length: size - hitCount }, (_, i) => `miss-key-${i}`)  // 未命中的键
    ];
    
    // 随机打乱查询键
    queryKeys.sort(() => Math.random() - 0.5);
    
    // 传统缓存
    const legacyImpl = () => {
      for (const key of queryKeys) {
        this.legacyCache.get(key);
      }
    };
    
    // 增强型缓存
    const enhancedImpl = () => {
      for (const key of queryKeys) {
        this.enhancedCache.get(key);
      }
    };
    
    await PerformanceMeasure.compare(
      `获取 ${size} 个项目 (命中率: ${hitRatio * 100}%)`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 测试混合操作性能
   * @param size 测试数据大小
   * @param readRatio 读取操作比例 (0-1)
   */
  async benchmarkMixed(size: number, readRatio: number = 0.7): Promise<void> {
    const keys = this.generateKeys(size);
    
    // 预填充一半容量
    this.legacyCache = new LRUCache<string, string>(size);
    this.enhancedCache = new EnhancedLRUCache<string, string>(size);
    
    const halfSize = Math.floor(size / 2);
    for (let i = 0; i < halfSize; i++) {
      const key = keys[i];
      const value = this.generateValue(key);
      this.legacyCache.set(key, value);
      this.enhancedCache.set(key, value);
    }
    
    // 生成操作序列（读取和写入的混合）
    const operations: Array<'read' | 'write'> = [];
    for (let i = 0; i < size; i++) {
      operations.push(Math.random() < readRatio ? 'read' : 'write');
    }
    
    // 传统缓存
    const legacyImpl = () => {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const key = keys[i % keys.length];
        
        if (op === 'read') {
          this.legacyCache.get(key);
        } else {
          this.legacyCache.set(key, this.generateValue(key));
        }
      }
    };
    
    // 增强型缓存
    const enhancedImpl = () => {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const key = keys[i % keys.length];
        
        if (op === 'read') {
          this.enhancedCache.get(key);
        } else {
          this.enhancedCache.set(key, this.generateValue(key));
        }
      }
    };
    
    await PerformanceMeasure.compare(
      `混合操作 ${size} 次 (读取: ${readRatio * 100}%, 写入: ${(1 - readRatio) * 100}%)`,
      10,
      legacyImpl,
      enhancedImpl,
      "传统LRUCache",
      "增强型EnhancedLRUCache"
    );
  }
  
  /**
   * 测试过期时间功能性能
   * @param size 测试数据大小
   */
  async benchmarkExpiration(size: number): Promise<void> {
    const keys = this.generateKeys(size);
    
    // 使用过期时间的传统缓存
    const legacyExpirationImpl = () => {
      const cache = new LRUCache<string, string>(size);
      for (const key of keys) {
        cache.set(key, this.generateValue(key), { ttl: 10000 });
      }
      // 检查一些过期项
      for (let i = 0; i < size / 10; i++) {
        cache.get(keys[i]);
      }
      // 清理过期项
      cache.purgeExpired();
    };
    
    // 使用过期时间的增强型缓存
    const enhancedExpirationImpl = () => {
      const cache = new EnhancedLRUCache<string, string>(size);
      for (const key of keys) {
        cache.set(key, this.generateValue(key), { ttl: 10000 });
      }
      // 检查一些过期项
      for (let i = 0; i < size / 10; i++) {
        cache.get(keys[i]);
      }
      // 清理过期项
      cache.purgeExpired();
    };
    
    await PerformanceMeasure.compare(
      `带过期时间操作 ${size} 项`,
      10,
      legacyExpirationImpl,
      enhancedExpirationImpl,
      "传统LRUCache (带过期时间)",
      "增强型EnhancedLRUCache (带过期时间)"
    );
  }
  
  /**
   * 测试序列化和反序列化性能
   * @param size 测试数据大小
   */
  async benchmarkSerialization(size: number): Promise<void> {
    const keys = this.generateKeys(size);
    
    // 预填充缓存
    const legacyCache = new LRUCache<string, string>(size);
    const enhancedCache = new EnhancedLRUCache<string, string>(size);
    
    for (const key of keys) {
      const value = this.generateValue(key);
      legacyCache.set(key, value);
      enhancedCache.set(key, value);
    }
    
    let legacySerialized = '';
    let enhancedSerialized = '';
    
    // 传统缓存序列化
    const legacySerializeImpl = () => {
      legacySerialized = legacyCache.serialize();
    };
    
    // 增强型缓存序列化
    const enhancedSerializeImpl = () => {
      enhancedSerialized = enhancedCache.serialize();
    };
    
    await PerformanceMeasure.compare(
      `序列化 ${size} 项`,
      10,
      legacySerializeImpl,
      enhancedSerializeImpl,
      "传统LRUCache序列化",
      "增强型EnhancedLRUCache序列化"
    );
    
    // 传统缓存反序列化
    const legacyDeserializeImpl = () => {
      LRUCache.deserialize<string, string>(legacySerialized);
    };
    
    // 增强型缓存反序列化
    const enhancedDeserializeImpl = () => {
      EnhancedLRUCache.deserialize<string, string>(enhancedSerialized);
    };
    
    await PerformanceMeasure.compare(
      `反序列化 ${size} 项`,
      10,
      legacyDeserializeImpl,
      enhancedDeserializeImpl,
      "传统LRUCache反序列化",
      "增强型EnhancedLRUCache反序列化"
    );
  }
  
  /**
   * 测试批量操作性能
   * @param size 测试数据大小
   */
  async benchmarkBulkOperations(size: number): Promise<void> {
    const keys = this.generateKeys(size);
    const entries: Array<[string, string]> = keys.map(key => [key, this.generateValue(key)]);
    
    // 预填充缓存
    this.legacyCache = new LRUCache<string, string>(size);
    this.enhancedCache = new EnhancedLRUCache<string, string>(size);
    
    for (const [key, value] of entries) {
      this.legacyCache.set(key, value);
      this.enhancedCache.set(key, value);
    }
    
    // 传统缓存批量获取
    const legacyGetManyImpl = () => {
      this.legacyCache.getMany(keys);
    };
    
    // 增强型缓存批量获取
    const enhancedGetManyImpl = () => {
      this.enhancedCache.getMany(keys);
    };
    
    await PerformanceMeasure.compare(
      `批量获取 ${size} 项`,
      10,
      legacyGetManyImpl,
      enhancedGetManyImpl,
      "传统LRUCache批量获取",
      "增强型EnhancedLRUCache批量获取"
    );
    
    // 传统缓存批量设置
    const legacySetManyImpl = () => {
      this.legacyCache.setMany(entries);
    };
    
    // 增强型缓存批量设置
    const enhancedSetManyImpl = () => {
      this.enhancedCache.setMany(entries);
    };
    
    await PerformanceMeasure.compare(
      `批量设置 ${size} 项`,
      10,
      legacySetManyImpl,
      enhancedSetManyImpl,
      "传统LRUCache批量设置",
      "增强型EnhancedLRUCache批量设置"
    );
  }
  
  /**
   * 运行所有基准测试
   */
  async runAll(): Promise<void> {
    console.log("========== LRU缓存性能基准测试 ==========");
    
    // 小数据集测试
    console.log("\n----- 小数据集 (100项) -----");
    await this.benchmarkSet(this.small);
    await this.benchmarkGet(this.small);
    await this.benchmarkMixed(this.small);
    await this.benchmarkExpiration(this.small);
    await this.benchmarkSerialization(this.small);
    await this.benchmarkBulkOperations(this.small);
    
    // 中数据集测试
    console.log("\n----- 中数据集 (1000项) -----");
    await this.benchmarkSet(this.medium);
    await this.benchmarkGet(this.medium);
    await this.benchmarkMixed(this.medium);
    await this.benchmarkExpiration(this.medium);
    await this.benchmarkSerialization(this.medium);
    await this.benchmarkBulkOperations(this.medium);
    
    // 大数据集测试
    console.log("\n----- 大数据集 (10000项) -----");
    await this.benchmarkSet(this.large);
    await this.benchmarkGet(this.large);
    await this.benchmarkMixed(this.large);
    await this.benchmarkExpiration(this.large);
    await this.benchmarkSerialization(this.large);
    await this.benchmarkBulkOperations(this.large);
    
    console.log("\n========== 基准测试完成 ==========");
  }
}

export { LRUCacheBenchmark, PerformanceMeasure };