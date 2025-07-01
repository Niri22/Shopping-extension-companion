/**
 * Performance Manager Service
 * Handles caching, debouncing, lazy loading, and memory optimization
 */

class PerformanceManager {
    constructor() {
        this.cache = new Map();
        this.debounceTimers = new Map();
        this.observers = new Map();
        this.memoryThreshold = 50; // MB
        
        this.init();
    }
    
    init() {
        this.setupMemoryMonitoring();
        this.setupCacheCleanup();
    }
    
    /**
     * Cache management with TTL and size limits
     */
    cacheAPI = {
        set: (key, value, ttl = 300000) => { // 5 minutes default TTL
            const now = Date.now();
            this.cache.set(key, {
                value,
                expires: now + ttl,
                created: now,
                hits: 0
            });
            
            // Prevent cache from growing too large
            if (this.cache.size > 100) {
                this.cleanupCache();
            }
        },
        
        get: (key) => {
            const item = this.cache.get(key);
            if (!item) return null;
            
            if (Date.now() > item.expires) {
                this.cache.delete(key);
                return null;
            }
            
            item.hits++;
            return item.value;
        },
        
        has: (key) => {
            const item = this.cache.get(key);
            return item && Date.now() <= item.expires;
        },
        
        delete: (key) => {
            return this.cache.delete(key);
        },
        
        clear: () => {
            this.cache.clear();
        },
        
        size: () => {
            return this.cache.size;
        },
        
        stats: () => {
            let totalHits = 0;
            let expired = 0;
            const now = Date.now();
            
            for (const [key, item] of this.cache.entries()) {
                totalHits += item.hits;
                if (now > item.expires) expired++;
            }
            
            return {
                size: this.cache.size,
                totalHits,
                expired,
                hitRate: totalHits / Math.max(this.cache.size, 1)
            };
        }
    };
    
    /**
     * Debouncing utility to prevent excessive function calls
     */
    debounce(key, func, delay = 300) {
        // Clear existing timer
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        // Set new timer
        const timerId = setTimeout(() => {
            func();
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timerId);
    }
    
    /**
     * Throttling utility to limit function execution frequency
     */
    throttle(key, func, limit = 1000) {
        const now = Date.now();
        const lastCall = this.cacheAPI.get(`throttle_${key}`);
        
        if (!lastCall || now - lastCall >= limit) {
            this.cacheAPI.set(`throttle_${key}`, now, limit);
            return func();
        }
        
        return Promise.resolve(null);
    }
    
    /**
     * Lazy loading with intersection observer
     */
    lazyLoad(elements, callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };
        
        const observerOptions = { ...defaultOptions, ...options };
        const observerId = `lazy_${Date.now()}`;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        elements.forEach(element => observer.observe(element));
        this.observers.set(observerId, observer);
        
        return observerId;
    }
    
    /**
     * Batch DOM operations for better performance
     */
    batchDOMUpdates(operations) {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                const fragment = document.createDocumentFragment();
                const results = [];
                
                operations.forEach(operation => {
                    try {
                        const result = operation(fragment);
                        results.push(result);
                    } catch (error) {
                        console.warn('Batch DOM operation failed:', error);
                        results.push(null);
                    }
                });
                
                resolve(results);
            });
        });
    }
    
    /**
     * Memory optimization utilities
     */
    setupMemoryMonitoring() {
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
                
                if (usedMB > this.memoryThreshold) {
                    this.optimizeMemory();
                }
            }, 30000); // Check every 30 seconds
        }
    }
    
    optimizeMemory() {
        // Clear expired cache entries
        this.cleanupCache();
        
        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Disconnect unused observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        // Force garbage collection if available
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
    }
    
    cleanupCache() {
        const now = Date.now();
        const toDelete = [];
        
        // Find expired entries
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expires) {
                toDelete.push(key);
            }
        }
        
        // Remove expired entries
        toDelete.forEach(key => this.cache.delete(key));
        
        // If still too large, remove least recently used items
        if (this.cache.size > 80) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].hits - b[1].hits)
                .slice(0, 20);
                
            entries.forEach(([key]) => this.cache.delete(key));
        }
    }
    
    setupCacheCleanup() {
        // Cleanup cache every 5 minutes
        setInterval(() => {
            this.cleanupCache();
        }, 300000);
    }
    
    /**
     * Performance measurement utilities
     */
    measure(name, func) {
        const start = performance.now();
        const result = func();
        const end = performance.now();
        
        const duration = end - start;
        console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
        
        return result;
    }
    
    async measureAsync(name, func) {
        const start = performance.now();
        const result = await func();
        const end = performance.now();
        
        const duration = end - start;
        console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
        
        return result;
    }
    
    /**
     * Resource preloading
     */
    preloadResource(url, type = 'fetch') {
        const cacheKey = `preload_${url}`;
        
        if (this.cacheAPI.has(cacheKey)) {
            return this.cacheAPI.get(cacheKey);
        }
        
        let promise;
        
        switch (type) {
            case 'image':
                promise = new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = url;
                });
                break;
                
            case 'fetch':
            default:
                promise = fetch(url).then(response => response.text());
                break;
        }
        
        this.cacheAPI.set(cacheKey, promise, 600000); // 10 minutes
        return promise;
    }
    
    /**
     * Cleanup method for proper resource disposal
     */
    dispose() {
        // Clear all caches
        this.cache.clear();
        
        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Disconnect all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceManager;
} else {
    window.PerformanceManager = PerformanceManager;
} 