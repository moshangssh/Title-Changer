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
}); 