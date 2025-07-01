/**
 * Storage Service
 * Optimized storage management with caching, validation, and batch operations
 */

class StorageService {
    constructor(performanceManager, eventBus) {
        this.performanceManager = performanceManager;
        this.eventBus = eventBus;
        this.config = ExtensionConfig.storage;
        this.cache = new Map();
        this.pendingOperations = new Map();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.preloadCriticalData();
    }
    
    setupEventListeners() {
        // Listen for storage changes from other instances
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    this.handleStorageChange(changes);
                }
            });
        }
    }
    
    async preloadCriticalData() {
        try {
            // Preload product list for faster access
            await this.getProducts();
        } catch (error) {
            console.warn('Failed to preload critical data:', error);
        }
    }
    
    /**
     * Get products with caching and performance optimization
     */
    async getProducts() {
        const cacheKey = this.config.keys.productList;
        
        // Check performance manager cache first
        const cached = this.performanceManager.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        // Check if operation is already pending
        if (this.pendingOperations.has('getProducts')) {
            return this.pendingOperations.get('getProducts');
        }
        
        const operation = this.performanceManager.measureAsync('getProducts', async () => {
            try {
                const result = await chrome.storage.local.get([cacheKey]);
                const products = result[cacheKey] || [];
                
                // Cache the result
                this.performanceManager.cache.set(cacheKey, products, 300000); // 5 minutes
                
                // Emit event for other components
                this.eventBus.emit('storage:products:loaded', products);
                
                return products;
            } catch (error) {
                console.error('Failed to get products:', error);
                return [];
            }
        });
        
        this.pendingOperations.set('getProducts', operation);
        const result = await operation;
        this.pendingOperations.delete('getProducts');
        
        return result;
    }
    
    /**
     * Save product with optimized validation and caching
     */
    async saveProduct(product) {
        if (!this.isValidProduct(product)) {
            throw new Error('Invalid product data');
        }
        
        return this.performanceManager.measureAsync('saveProduct', async () => {
            try {
                const existingProducts = await this.getProducts();
                const productId = this.generateProductId(product);
                
                const processedProduct = this.processProductData(product, productId);
                const updatedProducts = this.updateProductList(existingProducts, processedProduct);
                
                // Save to storage
                await this.setProducts(updatedProducts);
                
                // Update cache
                const cacheKey = this.config.keys.productList;
                this.performanceManager.cache.set(cacheKey, updatedProducts, 300000);
                
                // Emit events
                this.eventBus.emit('storage:product:saved', processedProduct);
                this.eventBus.emit('storage:products:updated', updatedProducts);
                
                return true;
            } catch (error) {
                console.error('Failed to save product:', error);
                this.eventBus.emit('storage:error', { operation: 'saveProduct', error });
                return false;
            }
        });
    }
    
    /**
     * Remove product with optimized operations
     */
    async removeProduct(productId) {
        if (!productId) {
            throw new Error('Product ID is required');
        }
        
        return this.performanceManager.measureAsync('removeProduct', async () => {
            try {
                const existingProducts = await this.getProducts();
                const filteredProducts = existingProducts.filter(p => p.id !== productId);
                
                if (filteredProducts.length === existingProducts.length) {
                    // Product not found
                    return false;
                }
                
                await this.setProducts(filteredProducts);
                
                // Update cache
                const cacheKey = this.config.keys.productList;
                this.performanceManager.cache.set(cacheKey, filteredProducts, 300000);
                
                // Emit events
                this.eventBus.emit('storage:product:removed', productId);
                this.eventBus.emit('storage:products:updated', filteredProducts);
                
                return true;
            } catch (error) {
                console.error('Failed to remove product:', error);
                this.eventBus.emit('storage:error', { operation: 'removeProduct', error });
                return false;
            }
        });
    }
    
    /**
     * Batch operations for better performance
     */
    async batchSaveProducts(products) {
        if (!Array.isArray(products) || products.length === 0) {
            return { success: 0, failed: 0, errors: [] };
        }
        
        return this.performanceManager.measureAsync('batchSaveProducts', async () => {
            const results = { success: 0, failed: 0, errors: [] };
            const validProducts = [];
            
            // Validate all products first
            for (const product of products) {
                if (this.isValidProduct(product)) {
                    const productId = this.generateProductId(product);
                    validProducts.push(this.processProductData(product, productId));
                } else {
                    results.failed++;
                    results.errors.push(`Invalid product: ${product.title || 'Unknown'}`);
                }
            }
            
            if (validProducts.length === 0) {
                return results;
            }
            
            try {
                const existingProducts = await this.getProducts();
                let updatedProducts = [...existingProducts];
                
                // Process all valid products
                for (const product of validProducts) {
                    updatedProducts = this.updateProductList(updatedProducts, product);
                    results.success++;
                }
                
                await this.setProducts(updatedProducts);
                
                // Update cache
                const cacheKey = this.config.keys.productList;
                this.performanceManager.cache.set(cacheKey, updatedProducts, 300000);
                
                // Emit events
                this.eventBus.emit('storage:products:batch-saved', validProducts);
                this.eventBus.emit('storage:products:updated', updatedProducts);
                
            } catch (error) {
                console.error('Batch save failed:', error);
                results.failed = validProducts.length;
                results.success = 0;
                results.errors.push(error.message);
            }
            
            return results;
        });
    }
    
    /**
     * Clear all products with confirmation
     */
    async clearProducts() {
        return this.performanceManager.measureAsync('clearProducts', async () => {
            try {
                await this.setProducts([]);
                
                // Clear cache
                const cacheKey = this.config.keys.productList;
                this.performanceManager.cache.delete(cacheKey);
                
                // Emit events
                this.eventBus.emit('storage:products:cleared');
                this.eventBus.emit('storage:products:updated', []);
                
                return true;
            } catch (error) {
                console.error('Failed to clear products:', error);
                this.eventBus.emit('storage:error', { operation: 'clearProducts', error });
                return false;
            }
        });
    }
    
    /**
     * Export products with formatting options
     */
    async exportProducts(format = 'json') {
        return this.performanceManager.measureAsync('exportProducts', async () => {
            try {
                const products = await this.getProducts();
                
                switch (format.toLowerCase()) {
                    case 'json':
                        return JSON.stringify(products, null, 2);
                    case 'csv':
                        return this.convertToCSV(products);
                    default:
                        throw new Error(`Unsupported export format: ${format}`);
                }
            } catch (error) {
                console.error('Failed to export products:', error);
                return '[]';
            }
        });
    }
    
    /**
     * Search products with caching
     */
    async searchProducts(query, options = {}) {
        const cacheKey = `search_${query}_${JSON.stringify(options)}`;
        
        // Check cache first
        const cached = this.performanceManager.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        return this.performanceManager.measureAsync('searchProducts', async () => {
            const products = await this.getProducts();
            const results = this.filterProducts(products, query, options);
            
            // Cache search results for 1 minute
            this.performanceManager.cache.set(cacheKey, results, 60000);
            
            return results;
        });
    }
    
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const products = await this.getProducts();
            const totalSize = JSON.stringify(products).length;
            
            return {
                productCount: products.length,
                totalSizeBytes: totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2),
                maxItems: this.config.maxItems,
                usagePercentage: ((products.length / this.config.maxItems) * 100).toFixed(1),
                cacheStats: this.performanceManager.cache.stats()
            };
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return null;
        }
    }
    
    // Helper methods
    
    processProductData(product, productId) {
        const now = new Date().toISOString();
        return {
            ...product,
            id: productId,
            title: this.truncateText(product.title, this.config.maxTitleLength),
            price: this.truncateText(product.price, this.config.maxPriceLength),
            dateAdded: product.dateAdded || now,
            dateUpdated: now,
            domain: product.domain || new URL(product.url).hostname
        };
    }
    
    updateProductList(existingProducts, newProduct) {
        const existingIndex = existingProducts.findIndex(p => p.id === newProduct.id);
        
        if (existingIndex !== -1) {
            // Update existing product
            existingProducts[existingIndex] = {
                ...newProduct,
                dateAdded: existingProducts[existingIndex].dateAdded
            };
            return existingProducts;
        } else {
            // Add new product at the beginning
            const updatedProducts = [newProduct, ...existingProducts];
            
            // Limit the number of stored products
            if (updatedProducts.length > this.config.maxItems) {
                updatedProducts.splice(this.config.maxItems);
            }
            
            return updatedProducts;
        }
    }
    
    async setProducts(products) {
        const data = { [this.config.keys.productList]: products };
        await chrome.storage.local.set(data);
    }
    
    generateProductId(product) {
        const identifier = product.url || `${product.title}-${product.domain}`;
        return btoa(identifier).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }
    
    isValidProduct(product) {
        return product && 
               product.title && 
               product.title.trim() !== '' &&
               product.title !== ExtensionConfig.messages.notFound.title &&
               product.url &&
               this.isValidUrl(product.url);
    }
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    filterProducts(products, query, options) {
        const { field = 'all', caseSensitive = false } = options;
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        return products.filter(product => {
            const searchFields = field === 'all' 
                ? [product.title, product.domain, product.url]
                : [product[field]];
                
            return searchFields.some(fieldValue => {
                if (!fieldValue) return false;
                const value = caseSensitive ? fieldValue : fieldValue.toLowerCase();
                return value.includes(searchQuery);
            });
        });
    }
    
    convertToCSV(products) {
        if (products.length === 0) return '';
        
        const headers = ['Title', 'Price', 'URL', 'Domain', 'Date Added'];
        const rows = products.map(product => [
            `"${product.title}"`,
            `"${product.price}"`,
            `"${product.url}"`,
            `"${product.domain}"`,
            `"${product.dateAdded}"`
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    
    handleStorageChange(changes) {
        const productListKey = this.config.keys.productList;
        
        if (changes[productListKey]) {
            // Clear cache when storage changes externally
            this.performanceManager.cache.delete(productListKey);
            
            // Emit event for other components
            this.eventBus.emit('storage:external-change', changes[productListKey]);
        }
    }
    
    /**
     * Dispose of the service and clean up resources
     */
    dispose() {
        this.cache.clear();
        this.pendingOperations.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
} else {
    window.StorageService = StorageService;
} 