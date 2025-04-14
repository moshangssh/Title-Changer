import { LRUCacheBase } from './LRUCacheBase';
import { LRUCache } from './LRUCache';
import { EnhancedLRUCache } from './EnhancedLRUCache';

/**
 * LRU缓存类型枚举
 */
export enum LRUCacheType {
    CLASSIC = 'classic',   // 经典实现 (Map)
    ENHANCED = 'enhanced'  // 增强实现 (双向链表 + Map)
}

/**
 * 缓存创建选项
 */
export interface LRUCacheOptions {
    capacity?: number;       // 缓存容量
    maxWeight?: number;     // 最大权重
    purgeInterval?: number; // 清理间隔（毫秒）
}

/**
 * 序列化缓存数据结构
 */
export interface SerializedCache<K, V> {
    type: LRUCacheType;     // 缓存类型
    data: string;          // 序列化后的缓存数据
}

/**
 * LRU缓存工厂
 * 负责创建不同类型的LRU缓存实例
 */
export class LRUCacheFactory {
    /**
     * 创建LRU缓存实例
     * @param type 缓存类型
     * @param options 缓存创建选项
     * @returns LRU缓存实例
     */
    static create<K, V>(type: LRUCacheType, options?: LRUCacheOptions): LRUCacheBase<K, V> {
        const capacity = options?.capacity ?? 1000;
        const maxWeight = options?.maxWeight;
        const purgeInterval = options?.purgeInterval;
        
        switch (type) {
            case LRUCacheType.ENHANCED:
                return new EnhancedLRUCache<K, V>(capacity, { maxWeight, purgeInterval });
            case LRUCacheType.CLASSIC:
            default:
                return new LRUCache<K, V>(capacity, { maxWeight, purgeInterval });
        }
    }
    
    /**
     * 序列化缓存
     * @param cache 缓存实例
     * @param type 缓存类型
     * @returns 序列化后的缓存数据
     */
    static serialize<K, V>(cache: LRUCacheBase<K, V>, type: LRUCacheType): SerializedCache<K, V> {
        return {
            type,
            data: cache.serialize()
        };
    }
    
    /**
     * 从序列化数据恢复缓存
     * @param serialized 序列化后的缓存数据
     * @returns 恢复后的缓存实例
     */
    static deserialize<K, V>(serialized: SerializedCache<K, V>): LRUCacheBase<K, V> {
        try {
            switch (serialized.type) {
                case LRUCacheType.ENHANCED:
                    return EnhancedLRUCache.deserialize<K, V>(serialized.data);
                case LRUCacheType.CLASSIC:
                default:
                    return LRUCache.deserialize<K, V>(serialized.data);
            }
        } catch (error) {
            console.error("缓存反序列化失败:", error);
            // 返回默认缓存
            return new LRUCache<K, V>();
        }
    }
} 