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
 * Handle extension errors
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('⏸️ [Background] Extension suspended');
});

// Initialize on script load
console.log('🔧 [Background] Background script loaded');
initializeExtension(); 