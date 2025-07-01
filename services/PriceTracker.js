/**
 * Price Tracker Service
 * Simple daily price checking to detect price drops for wishlist products
 */

class PriceTracker {
    constructor() {
        this.alarmName = 'dailyPriceCheck';
        this.storageKey = 'price_tracking_data';
        this.init();
    }
    
    async init() {
        console.log('🎯 [PriceTracker] Initializing price tracker...');
        
        // Set up daily alarm for price checking
        await this.setupDailyAlarm();
        
        // Listen for alarm events
        this.setupAlarmListener();
        
        console.log('✅ [PriceTracker] Price tracker initialized');
    }
    
    /**
     * Set up daily alarm for price checking
     */
    async setupDailyAlarm() {
        try {
            // Clear existing alarm first
            await chrome.alarms.clear(this.alarmName);
            
            // Create new daily alarm (24 hours = 1440 minutes)
            await chrome.alarms.create(this.alarmName, {
                delayInMinutes: 1440, // 24 hours
                periodInMinutes: 1440  // Repeat every 24 hours
            });
            
            console.log('⏰ [PriceTracker] Daily alarm set up');
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to setup alarm:', error);
        }
    }
    
    /**
     * Set up alarm listener
     */
    setupAlarmListener() {
        if (chrome.alarms && chrome.alarms.onAlarm) {
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === this.alarmName) {
                    console.log('🔔 [PriceTracker] Daily price check alarm triggered');
                    this.performDailyPriceCheck();
                }
            });
        }
    }
    
    /**
     * Perform daily price check for all products
     */
    async performDailyPriceCheck() {
        console.log('🔍 [PriceTracker] Starting daily price check...');
        
        try {
            // Get all products from storage
            const products = await this.getProducts();
            
            if (!products || products.length === 0) {
                console.log('📭 [PriceTracker] No products to check');
                return;
            }
            
            console.log(`📦 [PriceTracker] Checking prices for ${products.length} products`);
            
            // Check each product's price
            const priceCheckResults = [];
            
            for (const product of products) {
                try {
                    const result = await this.checkProductPrice(product);
                    priceCheckResults.push(result);
                    
                    // Add small delay between requests to be respectful
                    await this.delay(2000);
                } catch (error) {
                    console.error(`❌ [PriceTracker] Failed to check price for ${product.title}:`, error);
                    priceCheckResults.push({
                        productId: product.id,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Process results and update storage
            await this.processCheckResults(priceCheckResults);
            
            console.log('✅ [PriceTracker] Daily price check completed');
            
        } catch (error) {
            console.error('❌ [PriceTracker] Daily price check failed:', error);
        }
    }
    
    /**
     * Check price for a single product
     */
    async checkProductPrice(product) {
        console.log(`🔍 [PriceTracker] Checking price for: ${product.title}`);
        
        try {
            // Create a new tab to check the price
            const tab = await chrome.tabs.create({
                url: product.url,
                active: false // Don't make it the active tab
            });
            
            // Wait for page to load
            await this.delay(5000);
            
            // Extract current price
            const currentPrice = await this.extractPriceFromTab(tab.id);
            
            // Close the tab
            await chrome.tabs.remove(tab.id);
            
            // Compare with stored price
            const priceComparison = this.comparePrices(product.price, currentPrice);
            
            return {
                productId: product.id,
                success: true,
                originalPrice: product.price,
                currentPrice: currentPrice,
                priceChanged: priceComparison.changed,
                priceDropped: priceComparison.dropped,
                priceDifference: priceComparison.difference,
                checkDate: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ [PriceTracker] Error checking price for ${product.title}:`, error);
            throw error;
        }
    }
    
    /**
     * Extract price from a tab using content script
     */
    async extractPriceFromTab(tabId) {
        try {
            // Wait for content script to be ready
            await this.delay(3000);
            
            // Send message to content script to get price
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'getProductPrice'
            });
            
            if (response && response.price && response.price !== 'No price found') {
                return response.price;
            }
            
            return null;
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to extract price from tab:', error);
            return null;
        }
    }
    
    /**
     * Compare two prices to detect changes and drops
     */
    comparePrices(originalPrice, currentPrice) {
        if (!originalPrice || !currentPrice) {
            return {
                changed: false,
                dropped: false,
                difference: 0
            };
        }
        
        // Extract numeric values from price strings
        const originalValue = this.extractNumericPrice(originalPrice);
        const currentValue = this.extractNumericPrice(currentPrice);
        
        if (originalValue === 0 || currentValue === 0) {
            return {
                changed: false,
                dropped: false,
                difference: 0
            };
        }
        
        const difference = originalValue - currentValue;
        const changed = Math.abs(difference) > 0.01; // Consider changes > 1 cent
        const dropped = difference > 0; // Original price was higher
        
        return {
            changed,
            dropped,
            difference: Math.abs(difference)
        };
    }
    
    /**
     * Extract numeric value from price string
     */
    extractNumericPrice(priceString) {
        if (!priceString || typeof priceString !== 'string') {
            return 0;
        }
        
        // Remove all currency symbols and prefixes (CA$, US$, etc.) and extract number
        const cleanedPrice = priceString.replace(/(?:CA|US|AU|NZ|HK|SG)\$|[^\d.,]/g, '');
        
        // Handle different number formats
        if (cleanedPrice.includes(',') && cleanedPrice.includes('.')) {
            // Format like 1,299.99 - comma as thousands separator
            const match = cleanedPrice.match(/[\d,]+\.?\d*/);
            return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
        } else if (cleanedPrice.includes(',')) {
            // Could be either thousands separator or decimal separator
            const parts = cleanedPrice.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                // Likely decimal separator (e.g., "29,99")
                return parseFloat(cleanedPrice.replace(',', '.'));
            } else {
                // Likely thousands separator (e.g., "1,299")
                return parseFloat(cleanedPrice.replace(/,/g, ''));
            }
        } else {
            // Simple number with just dots
            const match = cleanedPrice.match(/\d+(?:\.\d{2})?/);
            return match ? parseFloat(match[0]) : 0;
        }
    }
    
    /**
     * Process price check results and update storage
     */
    async processCheckResults(results) {
        console.log('📊 [PriceTracker] Processing price check results...');
        
        try {
            // Get current products
            const products = await this.getProducts();
            const updatedProducts = [...products];
            
            // Get existing tracking data
            const trackingData = await this.getTrackingData();
            
            // Process each result
            for (const result of results) {
                if (!result.success) continue;
                
                // Find the product in the list
                const productIndex = updatedProducts.findIndex(p => p.id === result.productId);
                if (productIndex === -1) continue;
                
                const product = updatedProducts[productIndex];
                
                // Update product with new price if it changed
                if (result.priceChanged && result.currentPrice) {
                    product.price = result.currentPrice;
                    product.lastPriceUpdate = result.checkDate;
                    
                    // Add to price history
                    if (!product.priceHistory) {
                        product.priceHistory = [];
                    }
                    
                    product.priceHistory.push({
                        price: result.currentPrice,
                        date: result.checkDate,
                        dropped: result.priceDropped
                    });
                    
                    // Keep only last 10 price history entries
                    if (product.priceHistory.length > 10) {
                        product.priceHistory = product.priceHistory.slice(-10);
                    }
                }
                
                // Update tracking data
                if (!trackingData[result.productId]) {
                    trackingData[result.productId] = {
                        productId: result.productId,
                        checks: []
                    };
                }
                
                trackingData[result.productId].checks.push({
                    date: result.checkDate,
                    originalPrice: result.originalPrice,
                    currentPrice: result.currentPrice,
                    priceDropped: result.priceDropped,
                    difference: result.priceDifference
                });
                
                // Keep only last 30 check records
                if (trackingData[result.productId].checks.length > 30) {
                    trackingData[result.productId].checks = trackingData[result.productId].checks.slice(-30);
                }
            }
            
            // Save updated products
            await this.saveProducts(updatedProducts);
            
            // Save tracking data
            await this.saveTrackingData(trackingData);
            
            // Count price drops for logging
            const priceDrops = results.filter(r => r.success && r.priceDropped).length;
            console.log(`📉 [PriceTracker] Found ${priceDrops} price drops out of ${results.length} checks`);
            
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to process check results:', error);
        }
    }
    
    /**
     * Get products from storage
     */
    async getProducts() {
        try {
            const result = await chrome.storage.local.get([ExtensionConfig.storage.keys.productList]);
            return result[ExtensionConfig.storage.keys.productList] || [];
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to get products:', error);
            return [];
        }
    }
    
    /**
     * Save products to storage
     */
    async saveProducts(products) {
        try {
            await chrome.storage.local.set({
                [ExtensionConfig.storage.keys.productList]: products
            });
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to save products:', error);
        }
    }
    
    /**
     * Get price tracking data
     */
    async getTrackingData() {
        try {
            const result = await chrome.storage.local.get([this.storageKey]);
            return result[this.storageKey] || {};
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to get tracking data:', error);
            return {};
        }
    }
    
    /**
     * Save price tracking data
     */
    async saveTrackingData(data) {
        try {
            await chrome.storage.local.set({
                [this.storageKey]: data
            });
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to save tracking data:', error);
        }
    }
    
    /**
     * Get price history for a product
     */
    async getProductPriceHistory(productId) {
        try {
            const products = await this.getProducts();
            const product = products.find(p => p.id === productId);
            
            return product ? product.priceHistory || [] : [];
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to get price history:', error);
            return [];
        }
    }
    
    /**
     * Get products with recent price drops
     */
    async getProductsWithPriceDrops(daysBack = 7) {
        try {
            const products = await this.getProducts();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);
            
            return products.filter(product => {
                if (!product.priceHistory) return false;
                
                return product.priceHistory.some(entry => 
                    entry.dropped && new Date(entry.date) > cutoffDate
                );
            });
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to get products with price drops:', error);
            return [];
        }
    }
    
    /**
     * Manually trigger price check (for testing)
     */
    async triggerManualCheck() {
        console.log('🔧 [PriceTracker] Manual price check triggered');
        await this.performDailyPriceCheck();
    }
    
    /**
     * Simple delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriceTracker;
}

// Make available globally for browser environment
if (typeof window !== 'undefined') {
    window.PriceTracker = PriceTracker;
} 