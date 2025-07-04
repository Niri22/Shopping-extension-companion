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
        console.log('💰 [Content] Starting enhanced price extraction...');
        
        // Try different extraction methods with sale detection
        const methods = [
            () => this.extractSalePriceInfo(),
            () => this.extractPriceFromSelectors(),
            () => this.extractPriceFromStructuredData(),
            () => this.extractPriceFromMeta(),
            () => this.extractPriceFromText()
        ];
        
        for (const method of methods) {
            try {
                const priceInfo = method();
                if (priceInfo && this.isValidPriceInfo(priceInfo)) {
                    console.log('✅ [Content] Found valid price info:', priceInfo);
                    return priceInfo;
                }
            } catch (error) {
                console.log('⚠️ [Content] Price method failed:', error.message);
                continue;
            }
        }
        
        console.log('❌ [Content] No price found');
        return 'No price found';
    }

    extractSalePriceInfo() {
        console.log('🏷️ [Content] Looking for sale price information...');
        
        const priceInfo = {
            currentPrice: null,
            originalPrice: null,
            discount: null,
            isOnSale: false,
            currency: null,
            displayText: null,
            saleType: null // 'percentage', 'amount', 'clearance', 'flash'
        };
        
        // Strategy 1: Look for explicit sale price structures
        const saleStructures = this.findSalePriceStructures();
        if (saleStructures.length > 0) {
            const bestStructure = this.selectBestSaleStructure(saleStructures);
            if (bestStructure) {
                return this.extractFromSaleStructure(bestStructure);
            }
        }
        
        // Strategy 2: Look for individual price elements
        const currentPrice = this.findCurrentPrice();
        if (currentPrice) {
            priceInfo.currentPrice = currentPrice;
            priceInfo.displayText = currentPrice;
            
            // Look for original price nearby
            const originalPrice = this.findOriginalPrice();
            if (originalPrice && originalPrice !== currentPrice) {
                priceInfo.originalPrice = originalPrice;
                priceInfo.isOnSale = true;
                priceInfo.discount = this.calculateDiscount(originalPrice, currentPrice);
                priceInfo.saleType = this.detectSaleType();
                priceInfo.displayText = this.formatSaleDisplay(priceInfo);
            }
            
            return priceInfo;
        }
        
        return null;
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
        // Enhanced price patterns including prefixed currencies
        const pricePatterns = [
            // Prefixed currencies like CA$129, US$99, AU$150
            /(?:CA|US|AU|NZ|HK|SG)\$\s*\d+(?:[.,]\d{2})?/g,
            // Standard currency symbols
            /[\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?/g,
            // Numbers followed by currency symbols
            /\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽]/g,
            // Numbers followed by currency codes
            /\d+(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB)/gi
        ];
        
        const pageText = document.body.textContent || '';
        
        for (const pattern of pricePatterns) {
            const matches = pageText.match(pattern);
            if (matches && matches.length > 0) {
                // Return the first reasonable price found
                for (const match of matches) {
                    const price = this.cleanPriceText(match);
                    if (price && this.isPriceRealistic(price)) {
                        return price;
                    }
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
        // Enhanced pattern to include CA$, US$, AU$, etc. and currency codes
        return /(?:CA|US|AU|NZ|HK|SG)\$|[\$€£¥₹₽]|\d+[.,]\d{2}|(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB)/.test(text);
    }
    
    cleanPriceText(text) {
        if (!text) return null;
        
        // Enhanced regex to handle CA$, US$, AU$ and other prefixed currencies
        const pricePatterns = [
            // Prefixed currencies like CA$129, US$99, AU$150
            /((?:CA|US|AU|NZ|HK|SG)\$\s*\d+(?:[.,]\d{2})?)/,
            // Standard currency symbols
            /([\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?)/,
            // Numbers followed by currency symbols
            /(\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽])/,
            // Numbers followed by currency codes
            /(\d+(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB))/i
        ];
        
        for (const pattern of pricePatterns) {
            const priceMatch = text.match(pattern);
            if (priceMatch) {
                return priceMatch[1].trim();
            }
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

    // Enhanced Sale Price Detection Methods
    findSalePriceStructures() {
        const structures = [];
        
        // Common sale price container patterns
        const containerSelectors = [
            '.price-section', '.pricing', '.price-info', '.price-container',
            '.product-price', '.price-box', '.price-wrap', '.cost-section',
            '.sale-section', '.discount-section', '.offer-section',
            '[class*="price"]', '[class*="cost"]', '[class*="sale"]',
            '[data-price-container]', '[data-sale-info]'
        ];
        
        containerSelectors.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
                if (this.isElementVisible(container)) {
                    const structure = this.analyzePriceStructure(container);
                    if (structure.hasMultiplePrices || structure.hasSaleIndicators) {
                        structures.push(structure);
                    }
                }
            });
        });
        
        return structures;
    }

    analyzePriceStructure(container) {
        const structure = {
            container: container,
            prices: [],
            hasMultiplePrices: false,
            saleIndicators: [],
            hasSaleIndicators: false,
            discountInfo: null
        };
        
        // Find all price-like elements within container
        const allElements = container.querySelectorAll('*');
        
        allElements.forEach(element => {
            const text = this.getElementText(element);
            if (!text) return;
            
            // Check for prices
            if (this.containsPrice(text)) {
                const cleanPrice = this.cleanPriceText(text);
                if (cleanPrice && this.isValidPrice(cleanPrice)) {
                    structure.prices.push({
                        element: element,
                        text: text,
                        cleanPrice: cleanPrice,
                        isStrikethrough: this.isStrikethrough(element),
                        isHighlighted: this.isHighlighted(element),
                        position: this.getElementPosition(element),
                        fontSize: this.getFontSize(element)
                    });
                }
            }
            
            // Check for sale indicators
            const lowerText = text.toLowerCase();
            if (this.isSaleIndicator(lowerText)) {
                structure.saleIndicators.push({
                    element: element,
                    text: text,
                    type: this.getSaleIndicatorType(lowerText)
                });
            }
        });
        
        structure.hasMultiplePrices = structure.prices.length > 1;
        structure.hasSaleIndicators = structure.saleIndicators.length > 0;
        
        return structure;
    }

    extractFromSaleStructure(structure) {
        const priceInfo = {
            currentPrice: null,
            originalPrice: null,
            discount: null,
            isOnSale: false,
            currency: null,
            displayText: null,
            saleType: null
        };
        
        // Sort prices by visual importance
        const sortedPrices = this.sortPricesByImportance(structure.prices);
        
        if (sortedPrices.length >= 2) {
            // Multiple prices - determine current vs original
            const { currentPrice, originalPrice } = this.identifyCurrentAndOriginalPrices(sortedPrices);
            
            priceInfo.currentPrice = currentPrice.cleanPrice;
            priceInfo.originalPrice = originalPrice.cleanPrice;
            priceInfo.isOnSale = true;
            priceInfo.discount = this.calculateDiscount(priceInfo.originalPrice, priceInfo.currentPrice);
            priceInfo.saleType = this.determineSaleType(structure.saleIndicators);
            priceInfo.displayText = this.formatSaleDisplay(priceInfo);
            
        } else if (sortedPrices.length === 1) {
            // Single price - check for sale indicators
            priceInfo.currentPrice = sortedPrices[0].cleanPrice;
            priceInfo.displayText = priceInfo.currentPrice;
            
            if (structure.hasSaleIndicators) {
                priceInfo.isOnSale = true;
                priceInfo.saleType = this.determineSaleType(structure.saleIndicators);
                priceInfo.displayText += ' (ON SALE)';
            }
        }
        
        return priceInfo;
    }

    findCurrentPrice() {
        // Comprehensive selectors for current/sale prices
        const currentPriceSelectors = [
            // Explicit sale price selectors
            '.sale-price', '.current-price', '.now-price', '.special-price',
            '.price-current', '.price-now', '.discounted-price', '.offer-price',
            
            // Site-specific selectors
            '.a-price .a-offscreen', '.a-price-whole', '#priceblock_dealprice',
            '.display-price', '.u-flL .notranslate',
            '.price-current', '.price-display', '.price-group .price',
            
            // Generic selectors
            '.price:not(.original-price):not(.was-price):not(.regular-price)',
            '[data-current-price]', '[data-sale-price]'
        ];
        
        for (const selector of currentPriceSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                const text = this.getElementText(element);
                if (text && this.containsPrice(text)) {
                    const price = this.cleanPriceText(text);
                    if (price) return price;
                }
            }
        }
        
        return null;
    }

    findOriginalPrice() {
        // Comprehensive selectors for original/was prices
        const originalPriceSelectors = [
            '.original-price', '.was-price', '.regular-price', '.list-price',
            '.price-original', '.price-was', '.msrp', '.retail-price',
            '.strikethrough', '.line-through', '.crossed-out', 's',
            '[style*="text-decoration: line-through"]',
            '[data-original-price]', '[data-was-price]'
        ];
        
        for (const selector of originalPriceSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                const text = this.getElementText(element);
                if (text && this.containsPrice(text)) {
                    const price = this.cleanPriceText(text);
                    if (price) return price;
                }
            }
        }
        
        return null;
    }

    calculateDiscount(originalPrice, currentPrice) {
        try {
            const original = this.extractNumericValue(originalPrice);
            const current = this.extractNumericValue(currentPrice);
            
            if (original && current && original > current) {
                const savings = original - current;
                const percentage = Math.round((savings / original) * 100);
                return {
                    percentage: percentage,
                    amount: savings,
                    formatted: `${percentage}% (Save $${savings.toFixed(2)})`
                };
            }
        } catch (error) {
            console.log('⚠️ [Content] Error calculating discount:', error);
        }
        
        return null;
    }

    detectSaleType() {
        const saleKeywords = this.findSaleKeywords();
        
        if (saleKeywords.includes('flash') || saleKeywords.includes('lightning')) return 'flash';
        if (saleKeywords.includes('clearance') || saleKeywords.includes('final')) return 'clearance';
        if (saleKeywords.includes('daily') || saleKeywords.includes('today')) return 'daily';
        if (saleKeywords.includes('weekend') || saleKeywords.includes('holiday')) return 'seasonal';
        if (saleKeywords.includes('bundle') || saleKeywords.includes('combo')) return 'bundle';
        
        return 'general';
    }

    findSaleKeywords() {
        const keywords = [];
        const text = document.body.textContent.toLowerCase();
        
        const saleTerms = [
            'flash sale', 'lightning deal', 'daily deal', 'clearance',
            'final sale', 'weekend sale', 'holiday sale', 'bundle deal',
            'combo offer', 'limited time', 'today only', 'special offer'
        ];
        
        saleTerms.forEach(term => {
            if (text.includes(term)) {
                keywords.push(term.split(' ')[0]);
            }
        });
        
        return keywords;
    }

    formatSaleDisplay(priceInfo) {
        if (!priceInfo.isOnSale) {
            return priceInfo.currentPrice;
        }
        
        let display = priceInfo.currentPrice;
        
        if (priceInfo.originalPrice) {
            display += ` (was ${priceInfo.originalPrice})`;
        }
        
        if (priceInfo.discount) {
            display += ` - ${priceInfo.discount.formatted}`;
        }
        
        if (priceInfo.saleType && priceInfo.saleType !== 'general') {
            display += ` [${priceInfo.saleType.toUpperCase()} SALE]`;
        }
        
        return display;
    }

    // Helper methods for sale detection
    isSaleIndicator(text) {
        const saleTerms = [
            'sale', 'off', 'save', 'discount', 'deal', 'offer',
            'clearance', 'special', 'promo', 'flash', 'limited',
            'was', 'now', 'orig', 'reg', 'msrp', '%'
        ];
        
        return saleTerms.some(term => text.includes(term));
    }

    getSaleIndicatorType(text) {
        if (text.includes('%') || text.includes('off')) return 'percentage';
        if (text.includes('save') || text.includes('$')) return 'amount';
        if (text.includes('flash') || text.includes('lightning')) return 'flash';
        if (text.includes('clearance') || text.includes('final')) return 'clearance';
        if (text.includes('was') || text.includes('orig')) return 'comparison';
        return 'generic';
    }

    isStrikethrough(element) {
        const style = window.getComputedStyle(element);
        return style.textDecoration.includes('line-through') ||
               element.tagName.toLowerCase() === 's' ||
               element.classList.contains('strikethrough') ||
               element.classList.contains('line-through') ||
               element.classList.contains('crossed-out');
    }

    isHighlighted(element) {
        const style = window.getComputedStyle(element);
        const classList = element.classList;
        
        return classList.contains('highlighted') ||
               classList.contains('featured') ||
               classList.contains('sale-price') ||
               classList.contains('current-price') ||
               classList.contains('special-price') ||
               style.fontWeight === 'bold' ||
               style.fontWeight === '700' ||
               style.color === 'red' ||
               style.color.includes('rgb(255, 0, 0)');
    }

    getFontSize(element) {
        const style = window.getComputedStyle(element);
        return parseInt(style.fontSize) || 12;
    }

    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    extractNumericValue(priceString) {
        if (!priceString) return null;
        
        // Handle different currency formats
        const cleanString = priceString
            .replace(/[^\d.,]/g, '') // Remove non-numeric chars except . and ,
            .replace(/,(?=\d{3})/g, '') // Remove thousands separators
            .replace(/,/g, '.'); // Convert comma decimals to dots
        
        const number = parseFloat(cleanString);
        return isNaN(number) ? null : number;
    }

    sortPricesByImportance(prices) {
        return prices.sort((a, b) => {
            // Current prices (not strikethrough, highlighted) come first
            if (!a.isStrikethrough && b.isStrikethrough) return -1;
            if (a.isStrikethrough && !b.isStrikethrough) return 1;
            
            // Highlighted prices are more important
            if (a.isHighlighted && !b.isHighlighted) return -1;
            if (!a.isHighlighted && b.isHighlighted) return 1;
            
            // Larger font sizes are more important
            if (a.fontSize > b.fontSize) return -1;
            if (a.fontSize < b.fontSize) return 1;
            
            // Position-based sorting
            return a.position.top - b.position.top || a.position.left - b.position.left;
        });
    }

    identifyCurrentAndOriginalPrices(sortedPrices) {
        const currentPrice = sortedPrices.find(p => !p.isStrikethrough && p.isHighlighted) ||
                           sortedPrices.find(p => !p.isStrikethrough) ||
                           sortedPrices[0];
        
        const originalPrice = sortedPrices.find(p => p.isStrikethrough) ||
                            sortedPrices.find(p => p !== currentPrice) ||
                            sortedPrices[1];
        
        return { currentPrice, originalPrice };
    }

    determineSaleType(saleIndicators) {
        if (!saleIndicators || saleIndicators.length === 0) return 'general';
        
        const types = saleIndicators.map(indicator => indicator.type);
        
        if (types.includes('flash')) return 'flash';
        if (types.includes('clearance')) return 'clearance';
        if (types.includes('percentage')) return 'percentage';
        if (types.includes('amount')) return 'amount';
        
        return 'general';
    }

    selectBestSaleStructure(structures) {
        if (structures.length === 0) return null;
        if (structures.length === 1) return structures[0];
        
        return structures.reduce((best, current) => {
            const currentScore = this.scorePriceStructure(current);
            const bestScore = this.scorePriceStructure(best);
            
            return currentScore > bestScore ? current : best;
        });
    }

    scorePriceStructure(structure) {
        let score = 0;
        
        // Multiple prices indicate a sale structure
        score += structure.prices.length * 3;
        
        // Sale indicators add credibility
        score += structure.saleIndicators.length * 2;
        
        // Strikethrough prices strongly indicate sales
        score += structure.prices.filter(p => p.isStrikethrough).length * 5;
        
        // Highlighted prices are important
        score += structure.prices.filter(p => p.isHighlighted).length * 3;
        
        // Bonus for having both current and original prices
        const hasStrikethrough = structure.prices.some(p => p.isStrikethrough);
        const hasHighlighted = structure.prices.some(p => p.isHighlighted);
        if (hasStrikethrough && hasHighlighted) score += 10;
        
        return score;
    }

    isValidPriceInfo(priceInfo) {
        if (typeof priceInfo === 'string') {
            return this.isValidPrice(priceInfo);
        }
        
        if (typeof priceInfo === 'object' && priceInfo !== null) {
            return priceInfo.currentPrice && this.isValidPrice(priceInfo.currentPrice);
        }
        
        return false;
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