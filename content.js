/**
 * Content Script - Simple and Reliable Page Information Extractor
 * Handles page title and price extraction with improved timeout handling
 */

class SimplePageExtractor {
    constructor() {
        this.isReady = false;
        this.init();
    }
    
    init() {
        console.log('🚀 [Content] Initializing page extractor for:', window.location.href);
        
        this.setupMessageListener();
        this.waitForPageReady();
    }
    
    setupMessageListener() {
        // Remove any existing listeners first
        if (chrome.runtime.onMessage.hasListeners()) {
            chrome.runtime.onMessage.removeListener(this.handleMessage);
        }
        
        // Add fresh listener
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 [Content] Received message:', request);
            return this.handleMessage(request, sender, sendResponse);
        });
        
        console.log('👂 [Content] Message listener set up');
    }
    
    waitForPageReady() {
        // Simple approach: wait for DOM to be ready, then wait a bit more for dynamic content
        if (document.readyState === 'complete') {
            this.onPageReady();
        } else {
            window.addEventListener('load', () => this.onPageReady());
        }
    }
    
    onPageReady() {
        console.log('✅ [Content] Page ready, waiting for dynamic content...');
        
        // Wait a short time for dynamic content to load
        setTimeout(() => {
            this.isReady = true;
            console.log('🎯 [Content] Extractor fully ready');
        }, 2000); // 2 seconds should be enough for most dynamic content
    }
    
    handleMessage(request, sender, sendResponse) {
        console.log('🔄 [Content] Processing message:', request.action);
        
        try {
            switch (request.action) {
                case 'ping':
                    // Simple health check
                    sendResponse({ status: 'ok', ready: this.isReady });
                    return true;
                    
                case 'getPageTitle':
                    const title = this.extractTitle();
                    console.log('📄 [Content] Extracted title:', title);
                    sendResponse({
                        title: title,
                        url: window.location.href
                    });
                    return true;
                    
                case 'getProductPrice':
                    const price = this.extractPrice();
                    console.log('💰 [Content] Extracted price:', price);
                    sendResponse({
                        price: price,
                        url: window.location.href
                    });
                    return true;
                    
                case 'getPageInfo':
                    const pageInfo = this.extractPageInfo();
                    console.log('📋 [Content] Extracted page info:', pageInfo);
                    sendResponse(pageInfo);
                    return true;
                    
                default:
                    console.log('❓ [Content] Unknown action:', request.action);
                    sendResponse({ error: 'Unknown action' });
                    return false;
            }
        } catch (error) {
            console.error('❌ [Content] Error handling message:', error);
            sendResponse({ error: error.message });
            return false;
        }
    }
    
    extractPageInfo() {
        const title = this.extractTitle();
        const price = this.extractPrice();
        
        return {
            title: title,
            price: price,
            url: window.location.href,
            domain: window.location.hostname,
            ready: this.isReady,
            timestamp: new Date().toISOString()
        };
    }
    
    extractTitle() {
        // Simple, reliable title extraction
        const strategies = [
            () => document.title,
            () => this.getTextContent('title'),
            () => this.getMetaContent('meta[property="og:title"]'),
            () => this.getMetaContent('meta[name="title"]'),
            () => this.getTextContent('h1')
        ];
        
        for (const strategy of strategies) {
            try {
                const title = strategy();
                if (title && title.trim() && title.trim() !== '') {
                    return title.trim();
                }
            } catch (error) {
                console.log('⚠️ [Content] Title strategy failed:', error.message);
                continue;
            }
        }
        
        return 'No title found';
    }
    
    extractPrice() {
        console.log('💰 [Content] Starting price extraction...');
        
        // Try different extraction methods
        const methods = [
            () => this.extractPriceFromSelectors(),
            () => this.extractPriceFromStructuredData(),
            () => this.extractPriceFromMeta(),
            () => this.extractPriceFromText()
        ];
        
        for (const method of methods) {
            try {
                const price = method();
                if (price && this.isValidPrice(price)) {
                    console.log('✅ [Content] Found valid price:', price);
                    return price;
                }
            } catch (error) {
                console.log('⚠️ [Content] Price method failed:', error.message);
                continue;
            }
        }
        
        console.log('❌ [Content] No price found');
        return 'No price found';
    }
    
    extractPriceFromSelectors() {
        // Common price selectors for major e-commerce sites
        const selectors = [
            // Amazon
            '.a-price-whole', '.a-price .a-offscreen', '#priceblock_dealprice', '#priceblock_ourprice',
            // eBay
            '.u-flL.condText', '.u-flL .notranslate', '.display-price',
            // Shopify
            '.price', '.money', '.product-price', '.current-price',
            // WooCommerce
            '.woocommerce-Price-amount', '.price ins .amount', '.price .amount',
            // Generic
            '[class*="price"]', '[id*="price"]', '[data-price]', '.cost', '.value'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                if (!this.isElementVisible(element)) continue;
                
                const text = this.getElementText(element);
                if (text && this.containsPrice(text)) {
                    const price = this.cleanPriceText(text);
                    if (price) return price;
                }
            }
        }
        
        return null;
    }
    
    extractPriceFromStructuredData() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                const price = this.findPriceInData(data);
                if (price) return price;
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }
    
    extractPriceFromMeta() {
        const metaSelectors = [
            'meta[property="product:price:amount"]',
            'meta[property="og:price:amount"]',
            'meta[name="price"]',
            'meta[name="twitter:data1"]'
        ];
        
        for (const selector of metaSelectors) {
            const content = this.getMetaContent(selector);
            if (content && this.containsPrice(content)) {
                const price = this.cleanPriceText(content);
                if (price) return price;
            }
        }
        
        return null;
    }
    
    extractPriceFromText() {
        // Look for price patterns in page text
        const pricePattern = /[\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽]/g;
        const pageText = document.body.textContent || '';
        const matches = pageText.match(pricePattern);
        
        if (matches && matches.length > 0) {
            // Return the first reasonable price found
            for (const match of matches) {
                const price = this.cleanPriceText(match);
                if (price && this.isPriceRealistic(price)) {
                    return price;
                }
            }
        }
        
        return null;
    }
    
    // Helper methods
    getTextContent(selector) {
        try {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : null;
        } catch (error) {
            return null;
        }
    }
    
    getMetaContent(selector) {
        try {
            const meta = document.querySelector(selector);
            return meta ? meta.getAttribute('content') : null;
        } catch (error) {
            return null;
        }
    }
    
    getElementText(element) {
        if (!element) return null;
        
        // Try different text properties
        return element.textContent || 
               element.innerText || 
               element.getAttribute('data-price') || 
               element.getAttribute('value') || 
               null;
    }
    
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 &&
               element.offsetHeight > 0;
    }
    
    containsPrice(text) {
        if (!text) return false;
        return /[\$€£¥₹₽]|\d+[.,]\d{2}/.test(text);
    }
    
    cleanPriceText(text) {
        if (!text) return null;
        
        // Extract price using regex
        const priceMatch = text.match(/([\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽])/);
        
        if (priceMatch) {
            return priceMatch[1].trim();
        }
        
        return null;
    }
    
    isValidPrice(price) {
        if (!price || typeof price !== 'string') return false;
        
        // Check if it looks like a price
        if (!this.containsPrice(price)) return false;
        
        // Avoid loading indicators
        if (price.includes('Loading') || 
            price.includes('loading') || 
            price.includes('...') ||
            price.includes('--')) {
            return false;
        }
        
        return true;
    }
    
    isPriceRealistic(price) {
        if (!price) return false;
        
        const numericValue = parseFloat(price.replace(/[^\d.]/g, ''));
        return numericValue > 0 && numericValue < 100000; // Between $0 and $100,000
    }
    
    findPriceInData(data) {
        if (!data) return null;
        
        // Handle arrays
        if (Array.isArray(data)) {
            for (const item of data) {
                const price = this.findPriceInData(item);
                if (price) return price;
            }
            return null;
        }
        
        // Handle objects
        if (typeof data === 'object') {
            // Look for common price fields
            const priceFields = ['price', 'lowPrice', 'highPrice', 'amount', 'value'];
            
            for (const field of priceFields) {
                if (data[field]) {
                    const price = this.cleanPriceText(String(data[field]));
                    if (price) return price;
                }
            }
            
            // Look for offers
            if (data.offers) {
                return this.findPriceInData(data.offers);
            }
            
            // Recursively search other fields
            for (const key in data) {
                if (typeof data[key] === 'object') {
                    const price = this.findPriceInData(data[key]);
                    if (price) return price;
                }
            }
        }
        
        return null;
    }
}

// Initialize the extractor
let pageExtractor = null;

// Initialize when script loads
try {
    pageExtractor = new SimplePageExtractor();
    console.log('✅ [Content] Simple page extractor initialized');
} catch (error) {
    console.error('❌ [Content] Failed to initialize extractor:', error);
}

// Legacy functions for backward compatibility
function getPageTitle() {
    return pageExtractor ? pageExtractor.extractTitle() : 'No title found';
}

function getProductPrice() {
    return pageExtractor ? pageExtractor.extractPrice() : 'No price found';
} 