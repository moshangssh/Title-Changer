/**
 * LRU缓存实现，使用Map保持插入顺序
 * 最近最少使用(Least Recently Used)缓存算法
 */
import { LRUCacheBase, CacheOptions, CacheEventType, CacheEventCallback } from './LRUCacheBase';

/**
 * 缓存项包装类，用于存储值和元数据
 */
interface CacheItem<V> {
    value: V;
    expiresAt?: number;
    slidingExpiration?: boolean;
    ttl?: number;
    weight: number;
    createdAt: number;
}

export class LRUCache<K, V> implements LRUCacheBase<K, V> {
    private cache: Map<K, CacheItem<V>>;
    private readonly capacity: number;
    private hits: number = 0;
    private misses: number = 0;
    private totalWeight: number = 0;
    private readonly maxWeight: number;
    private lastPurgeTime: number = Date.now();
    private purgeInterval: number = 60000; // 清理过期项的时间间隔（毫秒），默认60秒
    private eventListeners: Map<CacheEventType, Set<CacheEventCallback<K, V>>> = new Map();

    constructor(capacity: number = 1000, options?: { maxWeight?: number, purgeInterval?: number }) {
        this.cache = new Map<K, CacheItem<V>>();
        this.capacity = Math.max(1, capacity);
        this.maxWeight = options?.maxWeight ?? capacity;
        
        // 设置清理间隔
        if (options?.purgeInterval !== undefined && options.purgeInterval > 0) {
            this.purgeInterval = options.purgeInterval;
        }
    }

    /**
     * 触发事件
     * @param eventType 事件类型
     * @param key 缓存键
     * @param value 缓存值（可选）
     * @private
     */
    private emitEvent(eventType: CacheEventType, key: K, value?: V): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(eventType, key, value);
                } catch (error) {
                    console.error(`错误：事件监听器执行失败(${eventType})：`, error);
                }
            }
        }
    }

    /**
     * 添加事件监听器
     * @param eventType 事件类型
     * @param callback 回调函数
     */
    on(eventType: CacheEventType, callback: CacheEventCallback<K, V>): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        this.eventListeners.get(eventType)!.add(callback);
    }

    /**
     * 移除事件监听器
     * @param eventType 事件类型
     * @param callback 回调函数
     */
    off(eventType: CacheEventType, callback: CacheEventCallback<K, V>): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.eventListeners.delete(eventType);
            }
        }
    }

    /**
     * 检查缓存项是否过期
     */
    private isExpired(item: CacheItem<V>): boolean {
        return item.expiresAt !== undefined && Date.now() > item.expiresAt;
    }
    
    /**
     * 更新滑动过期时间
     */
    private updateExpirationTime(item: CacheItem<V>): void {
        if (item.slidingExpiration && item.ttl !== undefined) {
            item.expiresAt = Date.now() + item.ttl;
        }
    }
    
    /**
     * 检查是否应该清理过期项
     */
    private shouldPurgeExpired(): boolean {
        const now = Date.now();
        return now - this.lastPurgeTime > this.purgeInterval;
    }
    
    /**
     * 获取缓存项，同时将其移到最近使用位置
     */
    get(key: K): V | undefined {
        const item = this.cache.get(key);
        
        if (!item) {
            this.misses++;
            return undefined;
        }
        
        // 检查是否过期
        if (this.isExpired(item)) {
            this.delete(key);
            this.emitEvent('expire', key, item.value);
            this.misses++;
            return undefined;
        }
        
        // 更新滑动过期时间
        this.updateExpirationTime(item);

        // 获取值
        const value = item.value;
        
        // 删除并重新添加到Map末尾以更新访问顺序
        this.cache.delete(key);
        this.cache.set(key, item);
        
        this.hits++;
        this.emitEvent('get', key, value);
        return value;
    }

    /**
     * 设置缓存项
     * @param key 键
     * @param value 值
     * @param options 缓存选项
     */
    set(key: K, value: V, options?: CacheOptions): void {
        // 如果过期时间不合理，清空项
        if (this.shouldPurgeExpired()) {
            this.purgeExpired();
        }
        
        // 构建缓存项
        const weight = (options?.weight !== undefined && options.weight > 0) ? options.weight : 1;
        
        // 如果键已存在，更新值和元数据
        if (this.cache.has(key)) {
            const existingItem = this.cache.get(key)!;
            // 先从总重量中减去原有重量
            this.totalWeight -= existingItem.weight;
            
            // 更新值
            existingItem.value = value;
            
            // 更新过期时间
            if (options?.ttl !== undefined && options.ttl > 0) {
                existingItem.ttl = options.ttl;
                existingItem.slidingExpiration = options.slidingExpiration ?? false;
                existingItem.expiresAt = Date.now() + options.ttl;
            } else {
                // 如果新设置不包含ttl，则清除过期时间
                existingItem.ttl = undefined;
                existingItem.slidingExpiration = undefined;
                existingItem.expiresAt = undefined;
            }
            
            // 更新权重
            existingItem.weight = weight;
            this.totalWeight += weight;
            
            // 删除并重新添加到Map末尾以更新访问顺序
            this.cache.delete(key);
            this.cache.set(key, existingItem);
            
            this.emitEvent('set', key, value);
            return;
        }
        
        // 创建新的缓存项
        const newItem: CacheItem<V> = {
            value,
            weight,
            createdAt: Date.now()
        };
        
        // 设置过期时间
        if (options?.ttl !== undefined && options.ttl > 0) {
            newItem.ttl = options.ttl;
            newItem.slidingExpiration = options.slidingExpiration ?? false;
            newItem.expiresAt = Date.now() + options.ttl;
        }
        
        // 如果添加该项后总权重超过最大值，则淘汰项直到有足够空间
        while ((this.totalWeight + weight > this.maxWeight || this.cache.size >= this.capacity) && this.cache.size > 0) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                const firstItem = this.cache.get(firstKey)!;
                this.totalWeight -= firstItem.weight;
                this.cache.delete(firstKey);
                this.emitEvent('delete', firstKey, firstItem.value);
            }
        }
        
        // 添加到Map末尾（最近使用）
        this.cache.set(key, newItem);
        this.totalWeight += weight;
        this.emitEvent('set', key, value);
    }

    /**
     * 检查键是否存在，不更新访问顺序
     */
    has(key: K): boolean {
        const item = this.cache.get(key);
        if (!item) {
            return false;
        }
        
        // 检查是否过期
        if (this.isExpired(item)) {
            this.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * 从缓存中删除项
     */
    delete(key: K): boolean {
        const item = this.cache.get(key);
        if (item) {
            this.totalWeight -= item.weight;
            const value = item.value;
            const result = this.cache.delete(key);
            if (result) {
                this.emitEvent('delete', key, value);
            }
            return result;
        }
        return false;
    }

    /**
     * 清空缓存
     */
    clear(): void {
        // 保存所有键和值用于触发事件
        const entries = Array.from(this.cache.entries()).map(([key, item]) => [key, item.value] as [K, V]);
        
        this.cache.clear();
        this.totalWeight = 0;
        this.resetStats();
        
        // 为每个删除的项触发事件
        for (const [key, value] of entries) {
            this.emitEvent('delete', key, value);
        }
        
        this.emitEvent('clear', {} as K);
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
        const result = new Map<K, V>();
        
        // 仅返回未过期的项
        for (const [key, item] of this.cache.entries()) {
            if (!this.isExpired(item)) {
                result.set(key, item.value);
            }
        }
        
        return result.entries();
    }
    
    /**
     * 批量获取缓存项
     */
    getMany(keys: K[]): Map<K, V> {
        const result = new Map<K, V>();
        
        for (const key of keys) {
            const value = this.get(key);
            if (value !== undefined) {
                result.set(key, value);
            }
        }
        
        return result;
    }
    
    /**
     * 批量设置缓存项
     */
    setMany(entries: Array<[K, V]>, options?: CacheOptions): void {
        for (const [key, value] of entries) {
            this.set(key, value, options);
        }
    }
    
    /**
     * 清理过期的缓存项
     * @returns 清理的项数
     */
    purgeExpired(): number {
        this.lastPurgeTime = Date.now();
        let purgedCount = 0;
        const now = Date.now();
        
        // 找出过期的项
        const keysToDelete: K[] = [];
        for (const [key, item] of this.cache.entries()) {
            if (item.expiresAt !== undefined && item.expiresAt <= now) {
                keysToDelete.push(key);
            }
        }
        
        // 删除过期项
        for (const key of keysToDelete) {
            const item = this.cache.get(key);
            if (item) {
                const value = item.value;
                this.totalWeight -= item.weight;
                this.cache.delete(key);
                this.emitEvent('expire', key, value);
                purgedCount++;
            }
        }
        
        return purgedCount;
    }
    
    /**
     * 基于条件淘汰缓存项
     */
    evictWhere(predicate: (key: K, value: V) => boolean): number {
        let evictedCount = 0;
        const keysToEvict: K[] = [];
        
        // 找出所有符合条件的键
        for (const [key, item] of this.cache.entries()) {
            if (predicate(key, item.value)) {
                keysToEvict.push(key);
            }
        }
        
        // 淘汰所有符合条件的项
        for (const key of keysToEvict) {
            this.delete(key);
            evictedCount++;
        }
        
        return evictedCount;
    }

    /**
     * 序列化缓存内容
     * @returns 序列化后的字符串
     */
    serialize(): string {
        // 创建需要序列化的数据结构
        const data = {
            capacity: this.capacity,
            maxWeight: this.maxWeight,
            purgeInterval: this.purgeInterval,
            entries: Array.from(this.cache.entries()).map(([key, item]) => ({
                key,
                value: item.value,
                expiresAt: item.expiresAt,
                ttl: item.ttl,
                slidingExpiration: item.slidingExpiration,
                weight: item.weight,
                createdAt: item.createdAt
            }))
        };
        
        return JSON.stringify(data);
    }

    /**
     * 从序列化字符串中恢复缓存
     * @param serialized 序列化字符串
     * @returns 恢复后的缓存实例
     * @static
     */
    static deserialize<K, V>(serialized: string): LRUCache<K, V> {
        try {
            const data = JSON.parse(serialized);
            
            // 创建新的缓存实例
            const cache = new LRUCache<K, V>(
                data.capacity, 
                { 
                    maxWeight: data.maxWeight,
                    purgeInterval: data.purgeInterval
                }
            );
            
            // 按原顺序填充缓存
            for (const entry of data.entries) {
                // 重新创建缓存选项
                const options: CacheOptions = {};
                
                if (entry.ttl !== undefined) {
                    options.ttl = entry.ttl;
                    options.slidingExpiration = entry.slidingExpiration;
                }
                
                if (entry.weight !== undefined && entry.weight > 0) {
                    options.weight = entry.weight;
                }
                
                // 重新计算过期时间（如果有）
                if (entry.expiresAt !== undefined) {
                    const now = Date.now();
                    // 如果已过期，则跳过
                    if (entry.expiresAt <= now) {
                        continue;
                    }
                    
                    // 如果使用固定过期时间，计算剩余TTL
                    if (!entry.slidingExpiration) {
                        options.ttl = entry.expiresAt - now;
                    }
                }
                
                // 设置缓存项
                cache.set(entry.key, entry.value, options);
            }
            
            return cache;
        } catch (error) {
            console.error("缓存反序列化失败:", error);
            return new LRUCache<K, V>();
        }
    }
} 