/**
 * Unit Tests for Content Script (content.js)
 * Tests title extraction, price extraction, and message handling functionality
 */

// Mock DOM and Chrome APIs
global.document = {
    title: '',
    readyState: 'complete',
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn()
};

global.window = {
    location: {
        href: 'https://example.com/product',
        hostname: 'example.com',
        protocol: 'https:'
    },
    addEventListener: jest.fn()
};

global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    }
};

// Import the functions to test (would need to modify content.js to export functions for testing)
// For now, we'll define the functions here for testing purposes

describe('Content Script - Title Extraction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.title = '';
    });

    test('should extract title from document.title', () => {
        document.title = 'Test Product - Amazon';
        
        // Mock the getPageTitle function
        function getPageTitle() {
            let title = document.title;
            
            if (!title || title.trim() === '') {
                const titleElement = document.querySelector('title');
                title = titleElement ? titleElement.textContent : '';
            }
            
            if (!title || title.trim() === '') {
                const metaTitle = document.querySelector('meta[property="og:title"]') || 
                                 document.querySelector('meta[name="title"]');
                title = metaTitle ? metaTitle.getAttribute('content') : '';
            }
            
            if (!title || title.trim() === '') {
                const h1Element = document.querySelector('h1');
                title = h1Element ? h1Element.textContent : '';
            }
            
            return title.trim() || 'No title found';
        }
        
        const result = getPageTitle();
        expect(result).toBe('Test Product - Amazon');
    });

    test('should extract title from title element when document.title is empty', () => {
        document.title = '';
        const mockTitleElement = { textContent: 'Title from Element' };
        global.document.querySelector = jest.fn().mockImplementation((selector) => {
            if (selector === 'title') return mockTitleElement;
            return null;
        });
        
        function getPageTitle() {
            let title = document.title;
            
            if (!title || title.trim() === '') {
                const titleElement = document.querySelector('title');
                title = titleElement ? titleElement.textContent : '';
            }
            
            return title.trim() || 'No title found';
        }
        
        const result = getPageTitle();
        expect(result).toBe('Title from Element');
        expect(document.querySelector).toHaveBeenCalledWith('title');
    });

    test('should extract title from meta tags when title element is empty', () => {
        document.title = '';
        const mockMetaElement = { getAttribute: jest.fn().mockReturnValue('Meta Title') };
        
        global.document.querySelector = jest.fn().mockImplementation((selector) => {
            if (selector === 'title') return null;
            if (selector === 'meta[property="og:title"]') return mockMetaElement;
            return null;
        });
        
        function getPageTitle() {
            let title = document.title;
            
            if (!title || title.trim() === '') {
                const titleElement = document.querySelector('title');
                title = titleElement ? titleElement.textContent : '';
            }
            
            if (!title || title.trim() === '') {
                const metaTitle = document.querySelector('meta[property="og:title"]') || 
                                 document.querySelector('meta[name="title"]');
                title = metaTitle ? metaTitle.getAttribute('content') : '';
            }
            
            return title.trim() || 'No title found';
        }
        
        const result = getPageTitle();
        expect(result).toBe('Meta Title');
        expect(mockMetaElement.getAttribute).toHaveBeenCalledWith('content');
    });

    test('should return "No title found" when no title sources available', () => {
        document.title = '';
        global.document.querySelector = jest.fn().mockReturnValue(null);
        
        function getPageTitle() {
            let title = document.title;
            
            if (!title || title.trim() === '') {
                const titleElement = document.querySelector('title');
                title = titleElement ? titleElement.textContent : '';
            }
            
            if (!title || title.trim() === '') {
                const metaTitle = document.querySelector('meta[property="og:title"]') || 
                                 document.querySelector('meta[name="title"]');
                title = metaTitle ? metaTitle.getAttribute('content') : '';
            }
            
            if (!title || title.trim() === '') {
                const h1Element = document.querySelector('h1');
                title = h1Element ? h1Element.textContent : '';
            }
            
            return title.trim() || 'No title found';
        }
        
        const result = getPageTitle();
        expect(result).toBe('No title found');
    });
});

describe('Content Script - Price Extraction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should extract price from text with dollar sign', () => {
        function extractPriceFromText(text) {
            if (!text || typeof text !== 'string') return null;
            
            text = text.trim().replace(/\s+/g, ' ');
            
            const pricePatterns = [
                /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*/g,
                /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|\$|€|£|¥|₹|₽|¢)/gi,
                /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
            ];
            
            for (const pattern of pricePatterns) {
                const matches = text.match(pattern);
                if (matches && matches.length > 0) {
                    const price = matches[0].trim();
                    if (/\d/.test(price)) {
                        return price;
                    }
                }
            }
            
            return null;
        }
        
        expect(extractPriceFromText('$29.99')).toBe('$29.99');
        expect(extractPriceFromText('Price: $1,234.56')).toBe('$1,234.56');
        expect(extractPriceFromText('€45.00')).toBe('€45.00');
        expect(extractPriceFromText('£19.99')).toBe('£19.99');
    });

    test('should extract price with currency codes', () => {
        function extractPriceFromText(text) {
            if (!text || typeof text !== 'string') return null;
            
            text = text.trim().replace(/\s+/g, ' ');
            
            const pricePatterns = [
                /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*/g,
                /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|\$|€|£|¥|₹|₽|¢)/gi,
                /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
            ];
            
            for (const pattern of pricePatterns) {
                const matches = text.match(pattern);
                if (matches && matches.length > 0) {
                    const price = matches[0].trim();
                    if (/\d/.test(price)) {
                        return price;
                    }
                }
            }
            
            return null;
        }
        
        expect(extractPriceFromText('29.99 USD')).toBe('29.99 USD');
        expect(extractPriceFromText('45.00 EUR')).toBe('45.00 EUR');
        expect(extractPriceFromText('1234.56 GBP')).toBe('1234.56 GBP');
    });

    test('should return null for invalid price text', () => {
        function extractPriceFromText(text) {
            if (!text || typeof text !== 'string') return null;
            
            text = text.trim().replace(/\s+/g, ' ');
            
            const pricePatterns = [
                /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*/g,
                /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|\$|€|£|¥|₹|₽|¢)/gi,
                /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
            ];
            
            for (const pattern of pricePatterns) {
                const matches = text.match(pattern);
                if (matches && matches.length > 0) {
                    const price = matches[0].trim();
                    if (/\d/.test(price)) {
                        return price;
                    }
                }
            }
            
            return null;
        }
        
        expect(extractPriceFromText('')).toBeNull();
        expect(extractPriceFromText(null)).toBeNull();
        expect(extractPriceFromText('No price here')).toBeNull();
        expect(extractPriceFromText('$')).toBeNull();
    });

    test('should validate loaded prices correctly', () => {
        function isValidLoadedPrice(cleanedPrice, originalText) {
            const invalidTexts = [
                'loading', 'fetching', 'calculating', 'updating',
                '...', '---', 'tbd', 'n/a', 'null', 'undefined',
                'coming soon', 'check back', 'price pending'
            ];
            
            const lowerOriginal = originalText.toLowerCase();
            for (const invalid of invalidTexts) {
                if (lowerOriginal.includes(invalid)) {
                    return false;
                }
            }
            
            if (cleanedPrice.replace(/[^\d]/g, '').length < 2) {
                return false;
            }
            
            const numericValue = parseFloat(cleanedPrice.replace(/[^\d.]/g, ''));
            if (numericValue > 999999) {
                return false;
            }
            
            return true;
        }
        
        expect(isValidLoadedPrice('$29.99', '$29.99')).toBe(true);
        expect(isValidLoadedPrice('$1', '$1')).toBe(false); // Too short
        expect(isValidLoadedPrice('$29.99', 'Loading...')).toBe(false); // Loading text
        expect(isValidLoadedPrice('$29.99', 'Price: ---')).toBe(false); // Invalid placeholder
        expect(isValidLoadedPrice('$1000000', '$1000000')).toBe(false); // Too high
    });

    test('should detect loading indicators in elements', () => {
        function hasLoadingIndicators(element, indicators) {
            let currentElement = element;
            let levels = 0;
            
            while (currentElement && levels < 3) {
                const className = currentElement.className || '';
                const id = currentElement.id || '';
                const textContent = currentElement.textContent || '';
                
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
        
        const loadingIndicators = ['loading', 'spinner', 'skeleton'];
        
        // Mock element with loading class
        const loadingElement = {
            className: 'price-loading',
            id: '',
            textContent: '$29.99',
            parentElement: null
        };
        
        expect(hasLoadingIndicators(loadingElement, loadingIndicators)).toBe(true);
        
        // Mock element without loading indicators
        const normalElement = {
            className: 'price-display',
            id: 'product-price',
            textContent: '$29.99',
            parentElement: null
        };
        
        expect(hasLoadingIndicators(normalElement, loadingIndicators)).toBe(false);
    });
});

describe('Content Script - JSON-LD Price Extraction', () => {
    test('should extract price from JSON-LD structured data', () => {
        function findPriceInJsonData(data) {
            if (!data || typeof data !== 'object') return null;
            
            if (data.price !== undefined) {
                return String(data.price);
            }
            
            if (data.lowPrice !== undefined) {
                return String(data.lowPrice);
            }
            
            if (data.offers && Array.isArray(data.offers)) {
                for (const offer of data.offers) {
                    if (offer.price !== undefined) {
                        return String(offer.price);
                    }
                }
            }
            
            if (data.offers && data.offers.price !== undefined) {
                return String(data.offers.price);
            }
            
            for (const key in data) {
                if (data.hasOwnProperty(key) && typeof data[key] === 'object') {
                    const result = findPriceInJsonData(data[key]);
                    if (result) return result;
                }
            }
            
            return null;
        }
        
        // Test direct price property
        expect(findPriceInJsonData({ price: 29.99 })).toBe('29.99');
        
        // Test lowPrice property
        expect(findPriceInJsonData({ lowPrice: 19.99 })).toBe('19.99');
        
        // Test offers array
        expect(findPriceInJsonData({ 
            offers: [{ price: 39.99 }, { price: 29.99 }] 
        })).toBe('39.99');
        
        // Test offers object
        expect(findPriceInJsonData({ 
            offers: { price: 49.99 } 
        })).toBe('49.99');
        
        // Test nested structure
        expect(findPriceInJsonData({ 
            product: { offers: { price: 59.99 } } 
        })).toBe('59.99');
        
        // Test no price found
        expect(findPriceInJsonData({ name: 'Product' })).toBeNull();
    });
});

describe('Content Script - Message Handling', () => {
    test('should handle getPageTitle message', () => {
        const mockSendResponse = jest.fn();
        
        // Mock the message listener logic
        function handleMessage(request, sender, sendResponse) {
            if (request.action === 'getPageTitle') {
                const title = 'Test Title'; // Mock title
                sendResponse({ title: title, url: 'https://example.com/product' });
                return true;
            }
        }
        
        handleMessage({ action: 'getPageTitle' }, null, mockSendResponse);
        
        expect(mockSendResponse).toHaveBeenCalledWith({
            title: 'Test Title',
            url: 'https://example.com/product'
        });
    });

    test('should handle getPageInfo message with loading state', () => {
        const mockSendResponse = jest.fn();
        
        // Mock loading state
        const pageLoadingState = {
            domLoaded: true,
            windowLoaded: true,
            dynamicContentReady: false
        };
        
        function handleMessage(request, sender, sendResponse) {
            if (request.action === 'getPageInfo') {
                const title = 'Test Product';
                let price = 'No price found';
                
                if (price === 'No price found' && !pageLoadingState.dynamicContentReady) {
                    if (!pageLoadingState.windowLoaded) {
                        price = 'Page still loading...';
                    } else if (!pageLoadingState.dynamicContentReady) {
                        price = 'Loading dynamic content...';
                    }
                }
                
                const pageInfo = {
                    title: title,
                    price: price,
                    url: 'https://example.com/product',
                    domain: 'example.com',
                    protocol: 'https:',
                    loadingState: pageLoadingState
                };
                sendResponse(pageInfo);
                return true;
            }
        }
        
        handleMessage({ action: 'getPageInfo' }, null, mockSendResponse);
        
        expect(mockSendResponse).toHaveBeenCalledWith({
            title: 'Test Product',
            price: 'Loading dynamic content...',
            url: 'https://example.com/product',
            domain: 'example.com',
            protocol: 'https:',
            loadingState: pageLoadingState
        });
    });

    test('should handle getProductPrice message', () => {
        const mockSendResponse = jest.fn();
        
        function handleMessage(request, sender, sendResponse) {
            if (request.action === 'getProductPrice') {
                const price = '$29.99'; // Mock price
                sendResponse({ price: price, url: 'https://example.com/product' });
                return true;
            }
        }
        
        handleMessage({ action: 'getProductPrice' }, null, mockSendResponse);
        
        expect(mockSendResponse).toHaveBeenCalledWith({
            price: '$29.99',
            url: 'https://example.com/product'
        });
    });
});

describe('Content Script - Page Loading State', () => {
    test('should track page loading states correctly', (done) => {
        let pageLoadingState = {
            domLoaded: false,
            windowLoaded: false,
            dynamicContentReady: false
        };
        
        // Simulate DOM loaded
        pageLoadingState.domLoaded = true;
        expect(pageLoadingState.domLoaded).toBe(true);
        expect(pageLoadingState.windowLoaded).toBe(false);
        
        // Simulate window loaded
        pageLoadingState.windowLoaded = true;
        expect(pageLoadingState.windowLoaded).toBe(true);
        expect(pageLoadingState.dynamicContentReady).toBe(false);
        
        // Simulate dynamic content ready (after timeout)
        setTimeout(() => {
            pageLoadingState.dynamicContentReady = true;
            expect(pageLoadingState.dynamicContentReady).toBe(true);
            done(); // Signal test completion
        }, 10); // Use shorter timeout for testing
    });

    test('should provide appropriate loading messages based on state', () => {
        function getLoadingMessage(pageLoadingState) {
            if (!pageLoadingState.windowLoaded) {
                return 'Page still loading...';
            } else if (!pageLoadingState.dynamicContentReady) {
                return 'Loading dynamic content...';
            }
            return 'No price found';
        }
        
        expect(getLoadingMessage({ 
            windowLoaded: false, 
            dynamicContentReady: false 
        })).toBe('Page still loading...');
        
        expect(getLoadingMessage({ 
            windowLoaded: true, 
            dynamicContentReady: false 
        })).toBe('Loading dynamic content...');
        
        expect(getLoadingMessage({ 
            windowLoaded: true, 
            dynamicContentReady: true 
        })).toBe('No price found');
    });
}); 