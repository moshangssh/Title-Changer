/**
 * LRU缓存实现，使用Map保持插入顺序
 * 最近最少使用(Least Recently Used)缓存算法
 */
export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private readonly capacity: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(capacity: number = 1000) {
        this.cache = new Map<K, V>();
        this.capacity = Math.max(1, capacity);
    }

    /**
     * 获取缓存项，同时将其移到最近使用位置
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            this.misses++;
            return undefined;
        }

        // 获取值
        const value = this.cache.get(key)!;
        
        // 删除并重新添加到Map末尾以更新访问顺序
        this.cache.delete(key);
        this.cache.set(key, value);
        
        this.hits++;
        return value;
    }

    /**
     * 设置缓存项
     */
    set(key: K, value: V): void {
        // 如果键已存在，先删除
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // 如果达到容量上限，删除最早添加的项（LRU）
        else if (this.cache.size >= this.capacity) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        
        // 添加到Map末尾（最近使用）
        this.cache.set(key, value);
    }

    /**
     * 检查键是否存在，不更新访问顺序
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * 从缓存中删除项
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.resetStats();
    }

    /**
     * 获取当前缓存大小
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * 获取缓存命中率
     */
    getHitRate(): number {
        const total = this.hits + this.misses;
        return total > 0 ? this.hits / total : 0;
    }

    /**
     * 重置统计数据
     */
    resetStats(): void {
        this.hits = 0;
        this.misses = 0;
    }
    
    /**
     * 返回所有缓存条目
     */
    entries(): IterableIterator<[K, V]> {
        return this.cache.entries();
    }
} 