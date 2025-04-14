/**
 * 增强型LRU缓存实现，使用双向链表 + Map结构
 * 最近最少使用(Least Recently Used)缓存算法
 */
import { LRUCacheBase, CacheOptions, CacheEventType, CacheEventCallback } from './LRUCacheBase';

/**
 * 双向链表节点
 */
class DoublyLinkedNode<K, V> {
    key: K;
    value: V;
    prev: DoublyLinkedNode<K, V> | null = null;
    next: DoublyLinkedNode<K, V> | null = null;
    
    // 过期相关属性
    expiresAt?: number;  // 过期时间戳
    slidingExpiration?: boolean; // 是否滑动过期
    ttl?: number; // 存活时间(毫秒)
    weight: number = 1; // 缓存项权重
    
    constructor(key: K, value: V, options?: CacheOptions) {
        this.key = key;
        this.value = value;
        
        // 设置过期时间
        if (options?.ttl !== undefined && options.ttl > 0) {
            this.ttl = options.ttl;
            this.slidingExpiration = options.slidingExpiration ?? false;
            this.expiresAt = Date.now() + options.ttl;
        }
        
        // 设置权重
        if (options?.weight !== undefined && options.weight > 0) {
            this.weight = options.weight;
        }
    }
    
    /**
     * 检查节点是否已过期
     */
    isExpired(): boolean {
        return this.expiresAt !== undefined && Date.now() > this.expiresAt;
    }
    
    /**
     * 更新滑动过期时间
     */
    updateExpirationTime(): void {
        if (this.slidingExpiration && this.ttl !== undefined) {
            this.expiresAt = Date.now() + this.ttl;
        }
    }
}

/**
 * 增强型LRU缓存，使用双向链表+Map实现
 * 相比于基于单一Map的实现，提供更高效的操作
 */
export class EnhancedLRUCache<K, V> implements LRUCacheBase<K, V> {
    private cache: Map<K, DoublyLinkedNode<K, V>>;
    private head: DoublyLinkedNode<K, V> | null = null; // 最不常用的节点（最老）
    private tail: DoublyLinkedNode<K, V> | null = null; // 最常用的节点（最新）
    private readonly capacity: number;
    private hits: number = 0;
    private misses: number = 0;
    private nodeCount: number = 0;
    private totalWeight: number = 0;
    private readonly maxWeight: number;
    private lastPurgeTime: number = Date.now();
    private purgeInterval: number = 60000; // 清理过期项的时间间隔（毫秒），默认60秒
    private eventListeners: Map<CacheEventType, Set<CacheEventCallback<K, V>>> = new Map();

    constructor(capacity: number = 1000, options?: { maxWeight?: number, purgeInterval?: number }) {
        this.cache = new Map<K, DoublyLinkedNode<K, V>>();
        this.capacity = Math.max(1, capacity);
        this.maxWeight = options?.maxWeight ?? capacity;
        
        // 设置清理间隔
        if (options?.purgeInterval !== undefined && options.purgeInterval > 0) {
            this.purgeInterval = options.purgeInterval;
        }
    }

    /**
     * 在链表头部添加节点（最不常用的位置）
     */
    private addToHead(node: DoublyLinkedNode<K, V>): void {
        node.next = this.head;
        node.prev = null;
        
        if (this.head) {
            this.head.prev = node;
        }
        
        this.head = node;
        
        // 如果这是第一个节点，同时设置为尾节点
        if (!this.tail) {
            this.tail = node;
        }
        
        this.nodeCount++;
        this.totalWeight += node.weight;
    }

    /**
     * 将节点移动到尾部（最常用的位置）
     */
    private moveToTail(node: DoublyLinkedNode<K, V>): void {
        if (node === this.tail) {
            return; // 已经在尾部
        }
        
        // 如果是头节点，更新头节点指针
        if (node === this.head) {
            this.head = node.next;
            if (this.head) {
                this.head.prev = null;
            }
        } else {
            // 从当前位置断开
            if (node.prev) {
                node.prev.next = node.next;
            }
            if (node.next) {
                node.next.prev = node.prev;
            }
        }
        
        // 添加到尾部
        if (this.tail) {
            this.tail.next = node;
            node.prev = this.tail;
            node.next = null;
            this.tail = node;
        } else {
            // 如果尾节点为空，这是唯一的节点
            this.head = this.tail = node;
            node.prev = node.next = null;
        }
    }

    /**
     * 删除头节点（最不常用的节点）
     */
    private removeHead(): DoublyLinkedNode<K, V> | null {
        if (!this.head) {
            return null;
        }
        
        const removedNode = this.head;
        
        this.head = this.head.next;
        if (this.head) {
            this.head.prev = null;
        } else {
            // 如果头节点被移除后链表为空，同时更新尾节点
            this.tail = null;
        }
        
        this.nodeCount--;
        this.totalWeight -= removedNode.weight;
        return removedNode;
    }

    /**
     * 删除指定节点
     */
    private removeNode(node: DoublyLinkedNode<K, V>): void {
        // 如果是头节点
        if (node === this.head) {
            this.removeHead();
            return;
        }
        
        // 如果是尾节点
        if (node === this.tail) {
            this.tail = node.prev;
            if (this.tail) {
                this.tail.next = null;
            } else {
                // 如果链表现在为空，同时更新头节点
                this.head = null;
            }
        } else {
            // 如果是中间节点
            if (node.prev) {
                node.prev.next = node.next;
            }
            if (node.next) {
                node.next.prev = node.prev;
            }
        }
        
        this.nodeCount--;
        this.totalWeight -= node.weight;
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
     * 获取缓存项，同时将其移到最近使用位置
     */
    get(key: K): V | undefined {
        const node = this.cache.get(key);
        
        if (!node) {
            this.misses++;
            return undefined;
        }
        
        // 检查是否过期
        if (node.isExpired()) {
            this.delete(key);
            this.emitEvent('expire', key, node.value);
            this.misses++;
            return undefined;
        }
        
        // 如果使用滑动过期，更新过期时间
        node.updateExpirationTime();
        
        // 将节点移到尾部，表示最近访问
        this.moveToTail(node);
        
        this.hits++;
        this.emitEvent('get', key, node.value);
        return node.value;
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
        
        // 如果键已存在，更新值和选项，并移到最近使用位置
        const existingNode = this.cache.get(key);
        if (existingNode) {
            // 先从总权重中减去节点原有权重
            this.totalWeight -= existingNode.weight;
            
            // 更新值和选项
            existingNode.value = value;
            
            if (options?.ttl !== undefined && options.ttl > 0) {
                existingNode.ttl = options.ttl;
                existingNode.slidingExpiration = options.slidingExpiration ?? false;
                existingNode.expiresAt = Date.now() + options.ttl;
            } else {
                // 如果新设置不包含ttl，则清除过期时间
                existingNode.ttl = undefined;
                existingNode.slidingExpiration = undefined;
                existingNode.expiresAt = undefined;
            }
            
            // 更新权重
            if (options?.weight !== undefined && options.weight > 0) {
                existingNode.weight = options.weight;
            }
            
            // 更新总权重
            this.totalWeight += existingNode.weight;
            
            // 移到最近使用位置
            this.moveToTail(existingNode);
            
            this.emitEvent('set', key, value);
            return;
        }
        
        // 创建新节点
        const newNode = new DoublyLinkedNode<K, V>(key, value, options);
        
        // 检查是否会超过权重上限
        while ((this.totalWeight + newNode.weight > this.maxWeight || this.nodeCount >= this.capacity) && this.head) {
            const removedNode = this.removeHead();
            if (removedNode) {
                this.cache.delete(removedNode.key);
                this.emitEvent('delete', removedNode.key, removedNode.value);
            }
        }
        
        // 添加新节点
        this.cache.set(key, newNode);
        this.addToHead(newNode);
        this.moveToTail(newNode); // 新添加的节点移到最近使用位置
        
        this.emitEvent('set', key, value);
    }
    
    /**
     * 检查是否应该清理过期项
     */
    private shouldPurgeExpired(): boolean {
        const now = Date.now();
        return now - this.lastPurgeTime > this.purgeInterval;
    }

    /**
     * 检查键是否存在，不更新访问顺序
     */
    has(key: K): boolean {
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        
        // 检查是否过期
        if (node.isExpired()) {
            this.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * 从缓存中删除项
     */
    delete(key: K): boolean {
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        
        this.removeNode(node);
        const result = this.cache.delete(key);
        if (result) {
            this.emitEvent('delete', key, node.value);
        }
        return result;
    }

    /**
     * 清空缓存
     */
    clear(): void {
        // 保存所有键用于触发事件
        const keys = Array.from(this.cache.keys());
        
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.nodeCount = 0;
        this.totalWeight = 0;
        
        // 为每个已删除的键触发事件
        for (const key of keys) {
            this.emitEvent('delete', key);
        }
        
        this.emitEvent('clear', {} as K);
    }

    /**
     * 获取当前缓存大小
     */
    size(): number {
        return this.nodeCount;
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
     * 清理过期的缓存项
     * @returns 清理的项数
     */
    purgeExpired(): number {
        this.lastPurgeTime = Date.now();
        let purgedCount = 0;
        
        const keysToDelete: K[] = [];
        
        // 找出所有过期的键
        for (const [key, node] of this.cache.entries()) {
            if (node.isExpired()) {
                keysToDelete.push(key);
            }
        }
        
        // 删除过期项
        for (const key of keysToDelete) {
            const node = this.cache.get(key);
            if (node) {
                this.removeNode(node);
                this.cache.delete(key);
                this.emitEvent('expire', key, node.value);
                purgedCount++;
            }
        }
        
        return purgedCount;
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
     * 基于条件淘汰缓存项
     */
    evictWhere(predicate: (key: K, value: V) => boolean): number {
        let evictedCount = 0;
        const keysToEvict: K[] = [];
        
        // 找出所有符合条件的键
        for (const [key, node] of this.cache.entries()) {
            if (predicate(key, node.value)) {
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
     * 返回所有缓存条目
     */
    entries(): IterableIterator<[K, V]> {
        const result = new Map<K, V>();
        let current = this.head;
        
        while (current) {
            // 仅返回未过期的项
            if (!current.isExpired()) {
                result.set(current.key, current.value);
            }
            current = current.next;
        }
        
        return result.entries();
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
            entries: [] as Array<{
                key: K,
                value: V,
                expiresAt?: number,
                ttl?: number, 
                slidingExpiration?: boolean,
                weight: number
            }>
        };
        
        // 按照从最不常用到最常用的顺序收集条目
        let current = this.head;
        while (current) {
            data.entries.push({
                key: current.key,
                value: current.value,
                expiresAt: current.expiresAt,
                ttl: current.ttl,
                slidingExpiration: current.slidingExpiration,
                weight: current.weight
            });
            current = current.next;
        }
        
        return JSON.stringify(data);
    }

    /**
     * 从序列化字符串中恢复缓存
     * @param serialized 序列化字符串
     * @returns 恢复后的缓存实例
     * @static
     */
    static deserialize<K, V>(serialized: string): EnhancedLRUCache<K, V> {
        try {
            const data = JSON.parse(serialized);
            
            // 创建新的缓存实例
            const cache = new EnhancedLRUCache<K, V>(
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
            return new EnhancedLRUCache<K, V>();
        }
    }
} 