/**
 * PriceTracker - Test Version
 * Modified for testing: 5-minute checks, notify when price remains the same
 */
class PriceTracker {
    constructor() {
        this.alarmName = 'productionPriceCheck';
        this.storageKey = 'price_tracking_data';
        this.setupAlarmListener();
        this.setupProductionAlarm();
    }

    /**
     * Set up 12-hour alarm for production
     */
    async setupProductionAlarm() {
        try {
            // Clear existing alarm
            await chrome.alarms.clear(this.alarmName);
            
            // Create new alarm - check every 12 hours (720 minutes)
            await chrome.alarms.create(this.alarmName, {
                delayInMinutes: 720,
                periodInMinutes: 720
            });
            
            console.log('✅ [PriceTracker] Production alarm set up - checking every 12 hours');
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to set up production alarm:', error);
        }
    }

    /**
     * Set up alarm listener to handle price checks
     */
    setupAlarmListener() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === this.alarmName) {
                console.log('⏰ [PriceTracker] Production alarm triggered - checking prices');
                this.performPriceCheck();
            }
        });
    }

    /**
     * Perform price check - notify when price remains the same
     */
    async performPriceCheck() {
        try {
            console.log('🔍 [PriceTracker] Starting test price check...');
            
            // Get saved products
            const products = await this.getProducts();
            if (!products || products.length === 0) {
                console.log('📭 [PriceTracker] No products to check');
                return;
            }

            console.log(`📊 [PriceTracker] Checking ${products.length} products`);
            
            // Get tracking data
            const trackingData = await this.getTrackingData();
            
            // Check each product
            for (const product of products) {
                await this.checkProductForSamePrice(product, trackingData);
            }
            
            console.log('✅ [PriceTracker] Test price check completed');
        } catch (error) {
            console.error('❌ [PriceTracker] Test price check failed:', error);
        }
    }

    /**
     * Check if product price remains the same and notify
     */
    async checkProductForSamePrice(product, trackingData) {
        try {
            const productId = product.id;
            const currentPrice = product.price;
            const lastCheck = trackingData[productId];
            
            console.log(`🔍 [PriceTracker] Checking product: ${product.title}`);
            console.log(`💰 Current price: ${currentPrice}`);
            
            if (lastCheck && lastCheck.lastPrice) {
                console.log(`📈 Last recorded price: ${lastCheck.lastPrice}`);
                
                // Check if price is the same
                if (currentPrice === lastCheck.lastPrice) {
                    console.log('🔄 [PriceTracker] Price remained the same - sending notification');
                    
                    // Send notification for same price
                    await this.sendSamePriceNotification(product, currentPrice);
                    
                    // Update check count
                    trackingData[productId] = {
                        ...lastCheck,
                        lastCheckTime: new Date().toISOString(),
                        samePrice: true,
                        sameCount: (lastCheck.sameCount || 0) + 1
                    };
                } else {
                    console.log('💱 [PriceTracker] Price changed - updating tracking data');
                    
                    // Price changed, update tracking data
                    trackingData[productId] = {
                        lastPrice: currentPrice,
                        lastCheckTime: new Date().toISOString(),
                        samePrice: false,
                        sameCount: 0
                    };
                }
            } else {
                console.log('🆕 [PriceTracker] First time checking this product');
                
                // For testing: send notification even for first time (so we can see it working)
                console.log('🧪 [PriceTracker] Sending test notification for first-time product');
                await this.sendSamePriceNotification(product, currentPrice);
                
                // First time checking this product
                trackingData[productId] = {
                    lastPrice: currentPrice,
                    lastCheckTime: new Date().toISOString(),
                    samePrice: false,
                    sameCount: 0
                };
            }
            
            // Save updated tracking data
            await this.saveTrackingData(trackingData);
            
        } catch (error) {
            console.error(`❌ [PriceTracker] Error checking product ${product.title}:`, error);
        }
    }

    /**
     * Send notification when price remains the same
     */
    async sendSamePriceNotification(product, price) {
        try {
            console.log(`🔔 [PriceTracker] Attempting to send notification for ${product.title}`);
            
            // Check if notifications API is available
            if (!chrome.notifications) {
                console.error('❌ [PriceTracker] chrome.notifications API not available');
                return;
            }
            
            // Create notification
            const notificationOptions = {
                type: 'basic',
                iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent PNG
                title: '🔄 WishCart - Price Unchanged',
                message: `${product.title} is still ${price}. Checked at ${new Date().toLocaleTimeString()}`
            };
            
            console.log('📋 [PriceTracker] Notification options:', notificationOptions);
            
            // Create notification with callback
            const notificationId = `same-price-${product.id}-${Date.now()}`;
            chrome.notifications.create(notificationId, notificationOptions, (createdId) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ [PriceTracker] Notification creation failed:', chrome.runtime.lastError);
                } else {
                    console.log(`✅ [PriceTracker] Notification created successfully with ID: ${createdId}`);
                    
                    // Debug: Also try to show a Chrome notification permission status
                    chrome.notifications.getPermissionLevel((level) => {
                        console.log(`🔐 [PriceTracker] Notification permission level: ${level}`);
                    });
                }
            });
            
            console.log(`📢 [PriceTracker] Notification request sent for ${product.title} - price unchanged: ${price}`);
            
        } catch (error) {
            console.error('❌ [PriceTracker] Failed to send notification:', error);
        }
    }

    /**
     * Get saved products from storage
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
     * Get tracking data from storage
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
     * Save tracking data to storage
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
     * Manual trigger for testing
     */
    async triggerManualCheck() {
        console.log('🔧 [PriceTracker] Manual check triggered');
        await this.performPriceCheck();
    }

    /**
     * Get price history for a product (placeholder)
     */
    async getProductPriceHistory(productId) {
        const trackingData = await this.getTrackingData();
        return trackingData[productId] || null;
    }

    /**
     * Get products with price drops (placeholder)
     */
    async getProductsWithPriceDrops(daysBack = 7) {
        return [];
    }
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriceTracker;
} 