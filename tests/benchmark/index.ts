import { LRUCacheBenchmark } from './LRUCacheBenchmark';
import { TitleCacheBenchmark } from './TitleCacheBenchmark';
import { ResultProcessor } from './ResultProcessor';

/**
 * 基准测试入口
 */
async function runBenchmarks() {
  try {
    // 创建结果处理器
    const resultProcessor = new ResultProcessor('./tests/benchmark/results');
    
    console.log('==========================================');
    console.log('开始执行 LRU 缓存基准测试');
    console.log('==========================================\n');
    
    // 1. 通用 LRU 缓存测试 - 测试各种操作的基本性能
    const cacheBenchmark = new LRUCacheBenchmark();
    // 捕获测试结果
    const originalConsoleLog = console.log;
    let currentTest = '';
    let legacyTime = 0;
    let enhancedTime = 0;
    
    console.log = function(...args) {
      originalConsoleLog(...args);
      
      const logString = args.join(' ');
      
      // 捕获测试名称
      if (logString.includes('性能比较:')) {
        currentTest = logString.split(':')[1]?.trim() || '';
      }
      
      // 捕获传统缓存的测试时间
      if (logString.includes('传统') && logString.includes('总时间')) {
        const timeStr = logString.split('总时间')[1]?.split(',')[0]?.trim() || '0ms';
        legacyTime = parseFloat(timeStr.replace(/[^\d.]/g, ''));
        if (timeStr.includes('μs')) legacyTime /= 1000; // 微秒转毫秒
        if (timeStr.includes('s') && !timeStr.includes('μs') && !timeStr.includes('ms')) legacyTime *= 1000; // 秒转毫秒
      }
      
      // 捕获增强型缓存的测试时间
      if (logString.includes('增强型') && logString.includes('总时间')) {
        const timeStr = logString.split('总时间')[1]?.split(',')[0]?.trim() || '0ms';
        enhancedTime = parseFloat(timeStr.replace(/[^\d.]/g, ''));
        if (timeStr.includes('μs')) enhancedTime /= 1000; // 微秒转毫秒
        if (timeStr.includes('s') && !timeStr.includes('μs') && !timeStr.includes('ms')) enhancedTime *= 1000; // 秒转毫秒
      }
      
      // 当比较结果显示时，收集结果
      if (logString.includes('结果:') && currentTest && legacyTime && enhancedTime) {
        resultProcessor.addResult({
          category: '基础操作测试',
          name: currentTest,
          legacyTime,
          enhancedTime
        });
        
        // 重置变量
        currentTest = '';
        legacyTime = 0;
        enhancedTime = 0;
      }
    };
    
    await cacheBenchmark.runAll();
    
    console.log('\n==========================================');
    console.log('开始执行 标题缓存应用场景 基准测试');
    console.log('==========================================\n');
    
    // 2. 应用场景测试 - 模拟实际使用场景下的性能表现
    const titleBenchmark = new TitleCacheBenchmark();
    await titleBenchmark.runAll();
    
    // 恢复原始的console.log
    console.log = originalConsoleLog;
    
    // 保存测试结果和生成摘要
    resultProcessor.saveResults();
    resultProcessor.saveSummary();
    
    console.log('\n==========================================');
    console.log('所有基准测试已完成');
    console.log('测试结果和摘要报告已生成');
    console.log('==========================================');
  } catch (error) {
    console.error('基准测试执行失败:', error);
  }
}

// 执行所有基准测试
runBenchmarks();