/**
 * Background Script - Service Worker
 * Handles background tasks including daily price checking
 */

// Import required scripts
importScripts('config.js', 'utils.js', 'services/PriceTracker.js');

// Global price tracker instance
let priceTracker = null;

/**
 * Initialize the extension background services
 */
async function initializeExtension() {
    console.log('🚀 [Background] Initializing extension background services...');
    
    try {
        // Initialize price tracker
        priceTracker = new PriceTracker();
        
        console.log('✅ [Background] Extension services initialized successfully');
    } catch (error) {
        console.error('❌ [Background] Failed to initialize extension services:', error);
    }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('📦 [Background] Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        console.log('🎉 [Background] Welcome! Extension installed for the first time');
    } else if (details.reason === 'update') {
        console.log('🔄 [Background] Extension updated to version:', chrome.runtime.getManifest().version);
    }
    
    // Initialize services
    initializeExtension();
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 [Background] Extension startup detected');
    initializeExtension();
});

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 [Background] Received message:', request);
    
    // Handle async operations
    (async () => {
        try {
            switch (request.action) {
                case 'triggerPriceCheck':
                    if (priceTracker) {
                        await priceTracker.triggerManualCheck();
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Price tracker not initialized' });
                    }
                    break;
                
                case 'manualPriceCheck':
                    if (priceTracker) {
                        await priceTracker.triggerManualCheck();
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Price tracker not initialized' });
                    }
                    break;
                    
                case 'getPriceHistory':
                    if (priceTracker && request.productId) {
                        const history = await priceTracker.getProductPriceHistory(request.productId);
                        sendResponse({ success: true, history });
                    } else {
                        sendResponse({ success: false, error: 'Invalid request' });
                    }
                    break;
                    
                case 'getProductsWithPriceDrops':
                    if (priceTracker) {
                        const products = await priceTracker.getProductsWithPriceDrops(request.daysBack || 7);
                        sendResponse({ success: true, products });
                    } else {
                        sendResponse({ success: false, error: 'Price tracker not initialized' });
                    }
                    break;

                case 'sendSaleNotification':
                    if (request.productInfo) {
                        await sendSaleNotification(request.productInfo);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Product info required' });
                    }
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('❌ [Background] Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    
    // Return true to indicate we'll send a response asynchronously
    return true;
});

/**
 * Enhanced notification system for sale alerts
 */
async function sendSaleNotification(productInfo) {
    console.log('🔔 [Background] Sending sale notification:', productInfo);
    
    try {
        // Determine notification type based on sale info
        let notificationTitle = '🏷️ Sale Alert!';
        let notificationMessage = '';
        let iconPath = 'icon-128.png';
        
        if (typeof productInfo.price === 'object' && productInfo.price.isOnSale) {
            const saleInfo = productInfo.price;
            
            // Customize notification based on sale type
            switch (saleInfo.saleType) {
                case 'flash':
                    notificationTitle = '⚡ Flash Sale Alert!';
                    notificationMessage = `${productInfo.title} is on FLASH SALE for ${saleInfo.currentPrice}`;
                    break;
                case 'clearance':
                    notificationTitle = '🔥 Clearance Sale!';
                    notificationMessage = `${productInfo.title} is on CLEARANCE for ${saleInfo.currentPrice}`;
                    break;
                case 'daily':
                    notificationTitle = '📅 Daily Deal!';
                    notificationMessage = `${productInfo.title} is today's deal for ${saleInfo.currentPrice}`;
                    break;
                case 'seasonal':
                    notificationTitle = '🎉 Seasonal Sale!';
                    notificationMessage = `${productInfo.title} is on seasonal sale for ${saleInfo.currentPrice}`;
                    break;
                default:
                    notificationTitle = '🏷️ Sale Alert!';
                    notificationMessage = `${productInfo.title} is on sale for ${saleInfo.currentPrice}`;
            }
            
            // Add discount information if available
            if (saleInfo.discount) {
                notificationMessage += ` (${saleInfo.discount.formatted})`;
            }
            
            // Add original price if available
            if (saleInfo.originalPrice) {
                notificationMessage += ` - was ${saleInfo.originalPrice}`;
            }
            
        } else {
            // Regular price notification
            notificationTitle = '💰 Price Update';
            notificationMessage = `${productInfo.title} - ${productInfo.price}`;
        }
        
        // Create notification
        const notificationId = `sale-${Date.now()}`;
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: iconPath,
            title: notificationTitle,
            message: notificationMessage,
            contextMessage: productInfo.domain || 'Product Alert',
            priority: 2,
            requireInteraction: true
        });
        
        console.log('✅ [Background] Sale notification sent successfully');
        
        // Store notification for click handling
        await chrome.storage.local.set({
            [`notification_${notificationId}`]: {
                url: productInfo.url,
                productInfo: productInfo,
                timestamp: Date.now()
            }
        });
        
    } catch (error) {
        console.error('❌ [Background] Failed to send sale notification:', error);
    }
}

/**
 * Handle notification clicks
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
    console.log('🔔 [Background] Notification clicked:', notificationId);
    
    try {
        // Get notification data
        const result = await chrome.storage.local.get([`notification_${notificationId}`]);
        const notificationData = result[`notification_${notificationId}`];
        
        if (notificationData && notificationData.url) {
            // Open the product page
            await chrome.tabs.create({ url: notificationData.url, active: true });
            
            // Clear the notification
            await chrome.notifications.clear(notificationId);
            
            // Clean up storage
            await chrome.storage.local.remove([`notification_${notificationId}`]);
        }
        
    } catch (error) {
        console.error('❌ [Background] Error handling notification click:', error);
    }
});

/**
 * Handle notification button clicks
 */
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    console.log('🔔 [Background] Notification button clicked:', notificationId, buttonIndex);
    
    try {
        const result = await chrome.storage.local.get([`notification_${notificationId}`]);
        const notificationData = result[`notification_${notificationId}`];
        
        if (notificationData) {
            if (buttonIndex === 0) {
                // "View Product" button
                await chrome.tabs.create({ url: notificationData.url, active: true });
            } else if (buttonIndex === 1) {
                // "Dismiss" button - just clear the notification
                await chrome.notifications.clear(notificationId);
            }
            
            // Clean up storage
            await chrome.storage.local.remove([`notification_${notificationId}`]);
        }
        
    } catch (error) {
        console.error('❌ [Background] Error handling notification button click:', error);
    }
});

/**
 * Enhanced price change detection with sale alerts
 */
async function detectPriceChanges(products) {
    console.log('🔍 [Background] Detecting price changes for sale alerts...');
    
    for (const product of products) {
        try {
            // Get current price info from the product page
            const tabs = await chrome.tabs.query({ url: product.url });
            
            if (tabs.length > 0) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'getProductPrice'
                });
                
                if (response && response.price) {
                    // Check if the new price indicates a sale
                    const newPriceInfo = response.price;
                    
                    if (typeof newPriceInfo === 'object' && newPriceInfo.isOnSale) {
                        // Send sale notification
                        await sendSaleNotification({
                            title: product.title,
                            price: newPriceInfo,
                            url: product.url,
                            domain: product.domain
                        });
                    }
                }
            }
            
        } catch (error) {
            console.log('⚠️ [Background] Error checking price for product:', product.title, error);
        }
    }
}

/**
 * Handle extension errors
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('⏸️ [Background] Extension suspended');
});

// Initialize on script load
console.log('🔧 [Background] Background script loaded');
console.log('🔧 [Background] Chrome APIs available:', {
    alarms: !!chrome.alarms,
    storage: !!chrome.storage,
    notifications: !!chrome.notifications,
    runtime: !!chrome.runtime
});
initializeExtension(); 