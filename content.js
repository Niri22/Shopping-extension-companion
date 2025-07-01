/**
 * Content Script - Page Information Extractor
 * Extracts titles and prices from web pages with intelligent fallback strategies
 */

class PageInfoExtractor {
    constructor() {
        this.loadingState = {
            domLoaded: document.readyState === 'complete',
            windowLoaded: false,
            dynamicContentReady: false
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.trackLoadingState();
    }
    
    setupEventListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            return this.handleMessage(request, sender, sendResponse);
        });
    }
    
    trackLoadingState() {
        // Track DOM ready state
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.loadingState.domLoaded = true;
            });
        }
        
        // Track window load state
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
                this.loadingState.windowLoaded = true;
            });
        } else {
            this.loadingState.windowLoaded = true;
        }
        
        // Set dynamic content ready after a delay
        setTimeout(() => {
            this.loadingState.dynamicContentReady = true;
        }, ExtensionConfig.timing.dynamicContentDelay);
    }
    
    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'getPageTitle':
                sendResponse({
                    title: this.extractTitle(),
                    url: window.location.href
                });
                return true;
                
            case 'getProductPrice':
                sendResponse({
                    price: this.extractPrice(),
                    url: window.location.href
                });
                return true;
                
            case 'getPageInfo':
                const pageInfo = this.extractPageInfo();
                sendResponse(pageInfo);
                return true;
                
            default:
                return false;
        }
    }
    
    extractPageInfo() {
        const title = this.extractTitle();
        let price = this.extractPrice();
        
        // Provide loading state feedback
        if (price === ExtensionConfig.messages.notFound.price && !this.loadingState.dynamicContentReady) {
            if (!this.loadingState.windowLoaded) {
                price = ExtensionConfig.messages.loading.pageLoading;
            } else if (!this.loadingState.dynamicContentReady) {
                price = ExtensionConfig.messages.loading.dynamicContent;
            }
        }
        
        return {
            title,
            price,
            url: window.location.href,
            domain: window.location.hostname,
            protocol: window.location.protocol,
            loadingState: { ...this.loadingState }
        };
    }
    
    extractTitle() {
        const strategies = [
            () => document.title,
            () => this.getElementText('title'),
            () => this.getMetaContent('meta[property="og:title"]'),
            () => this.getMetaContent('meta[name="title"]'),
            () => this.getElementText('h1')
        ];
        
        for (const strategy of strategies) {
            const title = strategy();
            if (title && title.trim()) {
                return title.trim();
            }
        }
        
        return ExtensionConfig.messages.notFound.title;
    }
    
    extractPrice() {
        // Try loaded price first (avoids loading placeholders)
        const loadedPrice = this.extractLoadedPrice();
        if (loadedPrice && loadedPrice !== ExtensionConfig.messages.notFound.price) {
            return loadedPrice;
        }
        
        // Fallback to standard extraction
        return this.extractStandardPrice();
    }
    
    extractLoadedPrice() {
        const allSelectors = this.getAllPriceSelectors();
        
        for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                if (this.hasLoadingIndicators(element)) {
                    continue;
                }
                
                const priceText = this.getElementPriceText(element);
                const cleanedPrice = this.cleanPriceText(priceText);
                
                if (cleanedPrice && this.isValidLoadedPrice(cleanedPrice, priceText)) {
                    return cleanedPrice;
                }
            }
        }
        
        return null;
    }
    
    extractStandardPrice() {
        // Try DOM selectors
        const selectorPrice = this.extractPriceFromSelectors();
        if (selectorPrice) return selectorPrice;
        
        // Try structured data
        const jsonLdPrice = this.extractPriceFromJsonLd();
        if (jsonLdPrice) return jsonLdPrice;
        
        // Try meta tags
        const metaPrice = this.extractPriceFromMetaTags();
        if (metaPrice) return metaPrice;
        
        // Try page text search
        const textPrice = this.extractPriceFromPageText();
        if (textPrice) return textPrice;
        
        return ExtensionConfig.messages.notFound.price;
    }
    
    extractPriceFromSelectors() {
        const allSelectors = this.getAllPriceSelectors();
        
        for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                const priceText = this.getElementPriceText(element);
                const cleanedPrice = this.cleanPriceText(priceText);
                
                if (cleanedPrice) {
                    return cleanedPrice;
                }
            }
        }
        
        return null;
    }
    
    extractPriceFromJsonLd() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                const price = this.findPriceInJsonData(data);
                if (price) return price;
            } catch (error) {
                // Invalid JSON, continue to next script
                continue;
            }
        }
        
        return null;
    }
    
    extractPriceFromMetaTags() {
        const metaSelectors = ExtensionConfig.priceExtraction.metaSelectors;
        
        for (const selector of metaSelectors) {
            const price = this.getMetaContent(selector);
            if (price) {
                const cleanedPrice = this.cleanPriceText(price);
                if (cleanedPrice) return cleanedPrice;
            }
        }
        
        return null;
    }
    
    extractPriceFromPageText() {
        const textContent = document.body.textContent || '';
        const lines = textContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.length < 100);
        
        for (const line of lines) {
            const cleanedPrice = this.cleanPriceText(line);
            if (cleanedPrice && this.isPriceRealistic(cleanedPrice)) {
                return cleanedPrice;
            }
        }
        
        return null;
    }
    
    // Helper methods
    getAllPriceSelectors() {
        const selectors = ExtensionConfig.priceExtraction.selectors;
        return [
            ...selectors.generic,
            ...selectors.amazon,
            ...selectors.ebay,
            ...selectors.shopify,
            ...selectors.woocommerce,
            ...selectors.common
        ];
    }
    
    getElementText(selector) {
        const element = document.querySelector(selector);
        return element?.textContent || '';
    }
    
    getMetaContent(selector) {
        const element = document.querySelector(selector);
        return element?.getAttribute('content') || '';
    }
    
    getElementPriceText(element) {
        return element.textContent || 
               element.getAttribute('content') || 
               element.value || '';
    }
    
    cleanPriceText(text) {
        return ExtensionUtils.text.extractPrice(text);
    }
    
    hasLoadingIndicators(element) {
        let currentElement = element;
        let levels = 0;
        
        while (currentElement && levels < 3) {
            const className = currentElement.className || '';
            const id = currentElement.id || '';
            const textContent = currentElement.textContent || '';
            
            const indicators = ExtensionConfig.priceExtraction.loadingIndicators;
            for (const indicator of indicators) {
                if (className.toLowerCase().includes(indicator) ||
                    id.toLowerCase().includes(indicator) ||
                    textContent.toLowerCase().includes(indicator)) {
                    return true;
                }
            }
            
            currentElement = currentElement.parentElement;
            levels++;
        }
        
        return false;
    }
    
    isValidLoadedPrice(cleanedPrice, originalText) {
        const lowerOriginal = originalText.toLowerCase();
        const config = ExtensionConfig.priceExtraction;
        
        // Check for invalid text patterns
        if (ExtensionUtils.text.containsAny(lowerOriginal, config.invalidTexts)) {
            return false;
        }
        
        // Check minimum digit count
        if (cleanedPrice.replace(/[^\d]/g, '').length < config.validation.minDigits) {
            return false;
        }
        
        // Check for unrealistic prices
        return ExtensionUtils.price.isRealistic(cleanedPrice);
    }
    
    isPriceRealistic(price) {
        return ExtensionUtils.price.isRealistic(price);
    }
    
    findPriceInJsonData(data) {
        if (!data || typeof data !== 'object') return null;
        
        // Direct price properties
        if (data.price !== undefined) {
            return String(data.price);
        }
        
        if (data.lowPrice !== undefined) {
            return String(data.lowPrice);
        }
        
        // Offers array
        if (data.offers && Array.isArray(data.offers)) {
            for (const offer of data.offers) {
                if (offer.price !== undefined) {
                    return String(offer.price);
                }
            }
        }
        
        // Single offer object
        if (data.offers && data.offers.price !== undefined) {
            return String(data.offers.price);
        }
        
        // Recursive search
        for (const key in data) {
            if (data.hasOwnProperty(key) && typeof data[key] === 'object') {
                const result = this.findPriceInJsonData(data[key]);
                if (result) return result;
            }
        }
        
        return null;
    }
}

// Initialize the page info extractor
const pageInfoExtractor = new PageInfoExtractor();

// Legacy function exports for backward compatibility
function getPageTitle() {
    return pageInfoExtractor.extractTitle();
}

function getProductPrice() {
    return pageInfoExtractor.extractPrice();
} 