import { LRUCache } from '../../../src/utils/LRUCache';

describe('LRUCache', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
        // 创建一个容量为3的缓存用于测试
        cache = new LRUCache<string, string>(3);
    });

    test('应正确添加和获取项', () => {
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
        expect(cache.size()).toBe(1);
    });

    test('超出容量时应删除最久未使用的项', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        cache.set('key4', 'value4'); // 这应该导致key1被删除
        
        expect(cache.has('key1')).toBe(false);
        expect(cache.has('key2')).toBe(true);
        expect(cache.has('key3')).toBe(true);
        expect(cache.has('key4')).toBe(true);
        expect(cache.size()).toBe(3);
    });

    test('访问项时应更新使用顺序', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        
        // 访问key1使其变为最近使用
        cache.get('key1');
        
        // 添加第四个项，应该删除key2而非key1
        cache.set('key4', 'value4');
        
        expect(cache.has('key1')).toBe(true);
        expect(cache.has('key2')).toBe(false);
        expect(cache.has('key3')).toBe(true);
        expect(cache.has('key4')).toBe(true);
    });

    test('应正确计算命中率', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        
        // 两次命中
        cache.get('key1');
        cache.get('key2');
        
        // 一次未命中
        cache.get('key3');
        
        expect(cache.getHitRate()).toBeCloseTo(2/3, 2);
    });

    test('clear应重置缓存和统计数据', () => {
        cache.set('key1', 'value1');
        cache.get('key1'); // 命中
        cache.get('key2'); // 未命中
        
        cache.clear();
        
        expect(cache.size()).toBe(0);
        expect(cache.getHitRate()).toBe(0);
    });

    test('应正确处理undefined和null值', () => {
        const nullCache = new LRUCache<string, string | null>(3);
        nullCache.set('key1', null);
        expect(nullCache.get('key1')).toBeNull();
        
        const undefinedCache = new LRUCache<string, string | undefined>(3);
        undefinedCache.set('key1', undefined);
        expect(undefinedCache.get('key1')).toBeUndefined();
    });

    test('entries应返回所有缓存项', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        
        const entries = Array.from(cache.entries());
        expect(entries.length).toBe(2);
        expect(entries).toContainEqual(['key1', 'value1']);
        expect(entries).toContainEqual(['key2', 'value2']);
    });

    test('delete应正确删除缓存项', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        
        expect(cache.delete('key1')).toBe(true);
        expect(cache.has('key1')).toBe(false);
        expect(cache.has('key2')).toBe(true);
        expect(cache.size()).toBe(1);
        
        // 尝试删除不存在的项
        expect(cache.delete('key3')).toBe(false);
    });
    
    test('应正确支持过期时间功能', () => {
        jest.useFakeTimers();
        
        // 测试固定过期时间
        const ttlCache = new LRUCache<string, string>(3);
        ttlCache.set('key1', 'value1', { ttl: 1000 }); // 1秒过期
        
        expect(ttlCache.get('key1')).toBe('value1');
        
        // 前进900毫秒
        jest.advanceTimersByTime(900);
        expect(ttlCache.get('key1')).toBe('value1');
        
        // 再前进200毫秒，应该过期
        jest.advanceTimersByTime(200);
        expect(ttlCache.get('key1')).toBeUndefined();
        expect(ttlCache.has('key1')).toBe(false);
        
        // 测试滑动过期时间
        ttlCache.set('key2', 'value2', { ttl: 1000, slidingExpiration: true });
        
        // 前进900毫秒
        jest.advanceTimersByTime(900);
        expect(ttlCache.get('key2')).toBe('value2'); // 访问后重置过期时间
        
        // 前进900毫秒，应该还不过期
        jest.advanceTimersByTime(900);
        expect(ttlCache.get('key2')).toBe('value2');
        
        // 前进1100毫秒，应该过期
        jest.advanceTimersByTime(1100);
        expect(ttlCache.get('key2')).toBeUndefined();
        
        jest.useRealTimers();
    });
    
    test('应正确清理过期项', () => {
        jest.useFakeTimers();
        
        const ttlCache = new LRUCache<string, string>(10);
        ttlCache.set('key1', 'value1', { ttl: 1000 }); // 1秒过期
        ttlCache.set('key2', 'value2', { ttl: 2000 }); // 2秒过期
        ttlCache.set('key3', 'value3', { ttl: 3000 }); // 3秒过期
        ttlCache.set('key4', 'value4'); // 不过期
        
        // 前进1500毫秒
        jest.advanceTimersByTime(1500);
        
        expect(ttlCache.purgeExpired()).toBe(1); // 应清理一项
        expect(ttlCache.has('key1')).toBe(false);
        expect(ttlCache.has('key2')).toBe(true);
        
        // 前进1000毫秒
        jest.advanceTimersByTime(1000);
        
        expect(ttlCache.purgeExpired()).toBe(1); // 再清理一项
        expect(ttlCache.has('key2')).toBe(false);
        expect(ttlCache.has('key3')).toBe(true);
        
        jest.useRealTimers();
    });
    
    test('应正确支持权重引擎', () => {
        // 创建权重为10的缓存
        const weightCache = new LRUCache<string, string>(5, { maxWeight: 10 });
        
        // 添加不同权重的项
        weightCache.set('key1', 'value1', { weight: 2 });
        weightCache.set('key2', 'value2', { weight: 3 });
        weightCache.set('key3', 'value3', { weight: 4 });
        
        expect(weightCache.has('key1')).toBe(true);
        expect(weightCache.has('key2')).toBe(true);
        expect(weightCache.has('key3')).toBe(true);
        
        // 添加新项，应淘汰key1
        weightCache.set('key4', 'value4', { weight: 2 });
        
        expect(weightCache.has('key1')).toBe(false);
        expect(weightCache.has('key2')).toBe(true);
        expect(weightCache.has('key3')).toBe(true);
        expect(weightCache.has('key4')).toBe(true);
        
        // 添加大权重项，应淘汰多个小权重项
        weightCache.set('key5', 'value5', { weight: 8 });
        
        expect(weightCache.has('key2')).toBe(false);
        expect(weightCache.has('key3')).toBe(false);
        expect(weightCache.has('key4')).toBe(false);
        expect(weightCache.has('key5')).toBe(true);
    });
    
    test('应正确支持批量操作', () => {
        const batchCache = new LRUCache<string, string>(5);
        
        // 测试批量设置
        batchCache.setMany([
            ['key1', 'value1'],
            ['key2', 'value2'],
            ['key3', 'value3']
        ]);
        
        expect(batchCache.size()).toBe(3);
        expect(batchCache.has('key1')).toBe(true);
        expect(batchCache.has('key2')).toBe(true);
        expect(batchCache.has('key3')).toBe(true);
        
        // 测试批量获取
        const values = batchCache.getMany(['key1', 'key2', 'nonexistent']);
        
        expect(values.size).toBe(2);
        expect(values.get('key1')).toBe('value1');
        expect(values.get('key2')).toBe('value2');
        expect(values.has('nonexistent')).toBe(false);
    });
    
    test('应正确支持条件淘汰', () => {
        const evictCache = new LRUCache<string, string>(5);
        
        evictCache.set('key1', 'apple');
        evictCache.set('key2', 'banana');
        evictCache.set('key3', 'orange');
        evictCache.set('key4', 'pear');
        
        // 淘汰包含'a'的值
        const evictedCount = evictCache.evictWhere((key, value) => value.includes('a'));
        
        expect(evictedCount).toBe(2); // 应淘汰apple和banana
        expect(evictCache.has('key1')).toBe(false);
        expect(evictCache.has('key2')).toBe(false);
        expect(evictCache.has('key3')).toBe(true);
        expect(evictCache.has('key4')).toBe(true);
        expect(evictCache.size()).toBe(2);
    });
});