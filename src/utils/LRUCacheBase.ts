/**
 * 缓存选项接口
 */
export interface CacheOptions {
    /**
     * 存活时间（毫秒）
     */
    ttl?: number;
    
    /**
     * 是否使用滑动过期时间
     * - true: 每次访问后重置过期时间
     * - false: 使用固定过期时间
     */
    slidingExpiration?: boolean;
    
    /**
     * 缓存项权重，默认为1
     */
    weight?: number;
}

/**
 * 缓存事件类型
 */
export type CacheEventType = 'set' | 'get' | 'delete' | 'clear' | 'expire';

/**
 * 缓存事件回调函数
 */
export type CacheEventCallback<K, V> = (eventType: CacheEventType, key: K, value?: V) => void;

/**
 * LRU缓存基础接口
 * 定义所有LRU缓存实现必须提供的方法
 */
export interface LRUCacheBase<K, V> {
    /**
     * 获取缓存项，同时将其移到最近使用位置
     */
    get(key: K): V | undefined;

    /**
     * 设置缓存项
     * @param key 键
     * @param value 值
     * @param options 缓存选项
     */
    set(key: K, value: V, options?: CacheOptions): void;

    /**
     * 检查键是否存在，不更新访问顺序
     */
    has(key: K): boolean;

    /**
     * 从缓存中删除项
     */
    delete(key: K): boolean;

    /**
     * 清空缓存
     */
    clear(): void;

    /**
     * 获取当前缓存大小
     */
    size(): number;

    /**
     * 获取缓存命中率
     */
    getHitRate(): number;

    /**
     * 重置统计数据
     */
    resetStats(): void;
    
    /**
     * 返回所有缓存条目
     */
    entries(): IterableIterator<[K, V]>;
    
    /**
     * 批量获取缓存项
     * @param keys 键数组
     * @returns 键值对映射
     */
    getMany(keys: K[]): Map<K, V>;
    
    /**
     * 批量设置缓存项
     * @param entries 键值对数组
     * @param options 缓存选项
     */
    setMany(entries: Array<[K, V]>, options?: CacheOptions): void;
    
    /**
     * 按条件淘汰缓存项
     * @param predicate 判断函数
     * @returns 被淘汰的缓存项数量
     */
    evictWhere(predicate: (key: K, value: V) => boolean): number;
    
    /**
     * 清理过期的缓存项
     * @returns 清理的项数
     */
    purgeExpired(): number;
    
    /**
     * 添加事件监听器
     * @param eventType 事件类型
     * @param callback 回调函数
     */
    on(eventType: CacheEventType, callback: CacheEventCallback<K, V>): void;
    
    /**
     * 移除事件监听器
     * @param eventType 事件类型
     * @param callback 回调函数
     */
    off(eventType: CacheEventType, callback: CacheEventCallback<K, V>): void;
    
    /**
     * 序列化缓存内容
     * @returns 序列化后的字符串
     */
    serialize(): string;
    
    /**
     * 从序列化字符串中恢复缓存
     * @param serialized 序列化字符串
     * @static 静态方法
     */
    deserialize?(serialized: string): LRUCacheBase<K, V>;
} 