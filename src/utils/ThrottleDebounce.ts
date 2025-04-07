/**
 * Title Changer 插件 - 节流和防抖工具函数
 * 用于限制函数调用频率，提高性能
 */

/**
 * 节流函数
 * 确保函数在指定的时间间隔内最多执行一次
 * 
 * @param fn 要节流的函数
 * @param wait 节流间隔(毫秒)
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    wait: number = 100
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastCallTime = 0;
    let lastResult: ReturnType<T>;
    
    return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
        const now = performance.now();
        const timeSinceLastCall = now - lastCallTime;
        
        if (timeSinceLastCall >= wait) {
            lastCallTime = now;
            lastResult = fn.apply(this, args);
            return lastResult;
        }
        
        return lastResult;
    };
}

/**
 * 防抖函数
 * 延迟函数执行直到指定的等待时间过去，重置计时器如果被再次调用
 * 
 * @param fn 要防抖的函数
 * @param wait 等待时间(毫秒)
 * @param immediate 是否在前沿触发（而非后沿）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    wait: number = 100,
    immediate: boolean = false
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeout: number | null = null;
    let previousArgs: Parameters<T> | null = null;
    
    return function(this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
        return new Promise((resolve) => {
            const callNow = immediate && !timeout;
            previousArgs = args;
            
            const later = () => {
                timeout = null;
                if (!immediate && previousArgs) {
                    const result = fn.apply(this, previousArgs);
                    resolve(result);
                    previousArgs = null;
                }
            };
            
            if (timeout) {
                window.clearTimeout(timeout);
            }
            
            timeout = window.setTimeout(later, wait);
            
            if (callNow) {
                const result = fn.apply(this, args);
                resolve(result);
            }
        });
    };
}

/**
 * 异步节流函数
 * 确保异步函数在指定的时间间隔内最多执行一次
 * 
 * @param fn 要节流的异步函数
 * @param wait 节流间隔(毫秒)
 * @returns 节流后的异步函数
 */
export function asyncThrottle<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    wait: number = 100
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined> {
    let lastCallTime = 0;
    let lastPromise: Promise<Awaited<ReturnType<T>>>;
    let pending = false;
    
    return async function(this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> {
        const now = performance.now();
        const timeSinceLastCall = now - lastCallTime;
        
        // 如果有操作正在进行或者还没到节流时间，返回上一次的结果
        if (pending || timeSinceLastCall < wait) {
            return lastPromise;
        }
        
        // 更新调用时间和状态
        lastCallTime = now;
        pending = true;
        
        try {
            // 执行异步函数并保存结果
            lastPromise = await fn.apply(this, args);
            return lastPromise;
        } finally {
            pending = false;
        }
    };
}

/**
 * 带拒绝延迟的节流函数
 * 如果被拒绝的调用次数超过阈值，会强制执行一次
 * 
 * @param fn 要节流的函数
 * @param wait 节流间隔(毫秒)
 * @param maxRejections 最大拒绝次数
 * @returns 节流后的函数
 */
export function adaptiveThrottle<T extends (...args: any[]) => any>(
    fn: T,
    wait: number = 100,
    maxRejections: number = 5
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastCallTime = 0;
    let lastResult: ReturnType<T>;
    let rejectionCount = 0;
    
    return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
        const now = performance.now();
        const timeSinceLastCall = now - lastCallTime;
        
        // 如果达到节流间隔或者拒绝次数超过阈值，执行函数
        if (timeSinceLastCall >= wait || rejectionCount >= maxRejections) {
            lastCallTime = now;
            rejectionCount = 0;
            lastResult = fn.apply(this, args);
            return lastResult;
        }
        
        // 增加拒绝计数
        rejectionCount++;
        return lastResult;
    };
} 