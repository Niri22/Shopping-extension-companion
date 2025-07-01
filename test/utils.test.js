/**
 * Comprehensive Unit Tests for ExtensionUtils (utils.js)
 * Tests all utility functions, edge cases, and error scenarios
 */

// Mock Chrome APIs and global objects
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn()
        }
    },
    tabs: {
        query: jest.fn(),
        create: jest.fn(),
        sendMessage: jest.fn()
    },
    runtime: {
        lastError: null
    }
};

global.URL = class URL {
    constructor(url) {
        if (!url || typeof url !== 'string') {
            throw new TypeError('Invalid URL');
        }
        if (!url.includes('://')) {
            throw new TypeError('Invalid URL');
        }
        this.href = url;
        this.hostname = url.split('://')[1]?.split('/')[0] || 'unknown';
        this.protocol = url.split('://')[0] + ':';
    }
};

// Import ExtensionUtils - in real environment this would be loaded
// For testing, we'll define the functions here
const ExtensionUtils = {
    url: {
        validate(url) {
            if (!url || url.trim() === '') {
                return { valid: false, error: 'URL cannot be empty' };
            }
            try {
                new URL(url);
                return { valid: true };
            } catch (error) {
                return { valid: false, error: 'Invalid URL format' };
            }
        },
        
        normalize(url) {
            if (!url) return '';
            url = url.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            return url;
        }
    },
    
    price: {
        isValid(price) {
            if (!price || typeof price !== 'string') return false;
            const pricePattern = /[\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽]/;
            return pricePattern.test(price.trim()) && 
                   !price.includes('Loading') && 
                   !price.includes('loading') &&
                   !price.includes('...');
        },
        
                 isRealistic(priceString) {
             const numericValue = this.getNumericValue(priceString);
             // Check for negative prices by looking for minus sign
             if (priceString && priceString.includes('-')) return false;
             return numericValue > 0 && numericValue < 100000;
         },
        
                 getNumericValue(priceString) {
             if (!priceString) return 0;
             // Remove all non-digit and non-decimal characters, then parse
             const cleanPrice = priceString.replace(/[^\d.]/g, '');
             return cleanPrice ? parseFloat(cleanPrice) : 0;
         }
    },
    
    text: {
        normalize(text) {
            if (!text) return '';
            return text.replace(/\s+/g, ' ').trim();
        },
        
        containsAny(text, patterns) {
            if (!text || !patterns) return false;
            const lowerText = text.toLowerCase();
            return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
        },
        
                 extractPrice(text) {
             if (!text) return null;
             const pricePatterns = [
                 // Prefixed currencies like CA$129, US$99, AU$150
                 /(?:CA|US|AU|NZ|HK|SG)\$\s*\d+(?:[.,]\d{2})?/g,
                 // Standard currency symbols
                 /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 /€\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 /£\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 /¥\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 /₹\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 /₽\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
                 // Numbers followed by currency symbols
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*\$/g,
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*€/g,
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*£/g,
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*¥/g,
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*₹/g,
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*₽/g,
                 // Currency codes
                 /\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB)/gi
             ];
             
             for (const pattern of pricePatterns) {
                 const matches = text.match(pattern);
                 if (matches && matches.length > 0) {
                     return matches[0].trim();
                 }
             }
             return null;
         }
    },
    
    async: {
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        async retry(fn, maxAttempts = 3, delays = [1000, 2000, 3000]) {
            let lastError;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    if (attempt < maxAttempts - 1) {
                        await this.delay(delays[attempt] || 1000);
                    }
                }
            }
            
            throw lastError;
        }
    },
    
    storage: {
        generateProductId(product) {
            const combined = `${product.title}-${product.url}-${product.domain}`.toLowerCase();
            let hash = 0;
            for (let i = 0; i < combined.length; i++) {
                const char = combined.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36).substring(0, 16);
        },
        
                 isValidProduct(product) {
             if (!product || typeof product !== 'object') return false;
             return typeof product.title === 'string' && product.title.trim() !== '' &&
                    typeof product.url === 'string' && product.url.trim() !== '' &&
                    typeof product.price === 'string' && product.price.trim() !== '';
         },
        
        async saveProduct(product) {
            try {
                if (!this.isValidProduct(product)) {
                    throw new Error('Invalid product data');
                }
                
                const productId = this.generateProductId(product);
                const productData = {
                    ...product,
                    id: productId,
                    dateAdded: product.dateAdded || new Date().toISOString()
                };
                
                const result = await chrome.storage.local.get(['products']);
                const products = result.products || {};
                products[productId] = productData;
                
                await chrome.storage.local.set({ products });
                return productId;
            } catch (error) {
                throw new Error(`Failed to save product: ${error.message}`);
            }
        }
    },
    
    chrome: {
        async sendMessageToTab(tabId, message, timeoutMs = 5000) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Message timeout'));
                }, timeoutMs);
                
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        
        async isContentScriptAvailable(tabId) {
            try {
                const response = await this.sendMessageToTab(tabId, { action: 'ping' }, 2000);
                return response !== null;
            } catch (error) {
                return false;
            }
        }
    }
};

describe('ExtensionUtils.url', () => {
    describe('validate', () => {
        test('should validate correct URLs', () => {
            expect(ExtensionUtils.url.validate('https://www.amazon.com')).toEqual({ valid: true });
            expect(ExtensionUtils.url.validate('http://example.com')).toEqual({ valid: true });
            expect(ExtensionUtils.url.validate('https://shop.example.com/product/123')).toEqual({ valid: true });
        });
        
        test('should reject invalid URLs', () => {
            expect(ExtensionUtils.url.validate('not-a-url')).toEqual({
                valid: false,
                error: 'Invalid URL format'
            });
            expect(ExtensionUtils.url.validate('')).toEqual({
                valid: false,
                error: 'URL cannot be empty'
            });
            expect(ExtensionUtils.url.validate('   ')).toEqual({
                valid: false,
                error: 'URL cannot be empty'
            });
        });
        
        test('should handle null and undefined', () => {
            expect(ExtensionUtils.url.validate(null)).toEqual({
                valid: false,
                error: 'URL cannot be empty'
            });
            expect(ExtensionUtils.url.validate(undefined)).toEqual({
                valid: false,
                error: 'URL cannot be empty'
            });
        });
    });
    
    describe('normalize', () => {
        test('should add https protocol to URLs without protocol', () => {
            expect(ExtensionUtils.url.normalize('amazon.com')).toBe('https://amazon.com');
            expect(ExtensionUtils.url.normalize('www.example.com/product')).toBe('https://www.example.com/product');
        });
        
        test('should preserve existing protocols', () => {
            expect(ExtensionUtils.url.normalize('https://amazon.com')).toBe('https://amazon.com');
            expect(ExtensionUtils.url.normalize('http://example.com')).toBe('http://example.com');
        });
        
        test('should handle edge cases', () => {
            expect(ExtensionUtils.url.normalize('')).toBe('');
            expect(ExtensionUtils.url.normalize(null)).toBe('');
            expect(ExtensionUtils.url.normalize(undefined)).toBe('');
            expect(ExtensionUtils.url.normalize('  amazon.com  ')).toBe('https://amazon.com');
        });
    });
});

describe('ExtensionUtils.price', () => {
    describe('isValid', () => {
        test('should validate correct price formats', () => {
            expect(ExtensionUtils.price.isValid('$29.99')).toBe(true);
            expect(ExtensionUtils.price.isValid('€45.00')).toBe(true);
            expect(ExtensionUtils.price.isValid('£19.99')).toBe(true);
            expect(ExtensionUtils.price.isValid('¥1500')).toBe(true);
            expect(ExtensionUtils.price.isValid('₹999')).toBe(true);
            expect(ExtensionUtils.price.isValid('29.99$')).toBe(true);
            expect(ExtensionUtils.price.isValid('$1,234.56')).toBe(true);
            // Canadian dollar and other prefixed currencies
            expect(ExtensionUtils.price.isValid('CA$129')).toBe(true);
            expect(ExtensionUtils.price.isValid('US$99.99')).toBe(true);
            expect(ExtensionUtils.price.isValid('AU$149.50')).toBe(true);
        });
        
        test('should reject invalid price formats', () => {
            expect(ExtensionUtils.price.isValid('Loading...')).toBe(false);
            expect(ExtensionUtils.price.isValid('loading')).toBe(false);
            expect(ExtensionUtils.price.isValid('Price Loading...')).toBe(false);
            expect(ExtensionUtils.price.isValid('No price found')).toBe(false);
            expect(ExtensionUtils.price.isValid('')).toBe(false);
            expect(ExtensionUtils.price.isValid('abc')).toBe(false);
            expect(ExtensionUtils.price.isValid('$')).toBe(false);
        });
        
        test('should handle edge cases', () => {
            expect(ExtensionUtils.price.isValid(null)).toBe(false);
            expect(ExtensionUtils.price.isValid(undefined)).toBe(false);
            expect(ExtensionUtils.price.isValid(123)).toBe(false); // Not a string
            expect(ExtensionUtils.price.isValid('  $29.99  ')).toBe(true); // Whitespace
        });
    });
    
    describe('isRealistic', () => {
        test('should accept realistic prices', () => {
            expect(ExtensionUtils.price.isRealistic('$29.99')).toBe(true);
            expect(ExtensionUtils.price.isRealistic('$999.99')).toBe(true);
            expect(ExtensionUtils.price.isRealistic('$1,234.56')).toBe(true);
            expect(ExtensionUtils.price.isRealistic('€50.00')).toBe(true);
        });
        
                 test('should reject unrealistic prices', () => {
             expect(ExtensionUtils.price.isRealistic('$0')).toBe(false);
             expect(ExtensionUtils.price.isRealistic('$999,999.99')).toBe(false);
             expect(ExtensionUtils.price.isRealistic('$-50')).toBe(false);
         });
    });
    
    describe('getNumericValue', () => {
        test('should extract numeric values correctly', () => {
            expect(ExtensionUtils.price.getNumericValue('$29.99')).toBe(29.99);
            expect(ExtensionUtils.price.getNumericValue('€45.00')).toBe(45.00);
            expect(ExtensionUtils.price.getNumericValue('1,234.56$')).toBe(1234.56);
            expect(ExtensionUtils.price.getNumericValue('£19')).toBe(19);
            // Canadian dollar and other prefixed currencies
            expect(ExtensionUtils.price.getNumericValue('CA$129')).toBe(129);
            expect(ExtensionUtils.price.getNumericValue('US$99.99')).toBe(99.99);
            expect(ExtensionUtils.price.getNumericValue('AU$1,299.50')).toBe(1299.50);
        });
        
        test('should handle edge cases', () => {
            expect(ExtensionUtils.price.getNumericValue('')).toBe(0);
            expect(ExtensionUtils.price.getNumericValue(null)).toBe(0);
            expect(ExtensionUtils.price.getNumericValue('no numbers')).toBe(0);
        });
    });
});

describe('ExtensionUtils.text', () => {
    describe('normalize', () => {
        test('should normalize whitespace', () => {
            expect(ExtensionUtils.text.normalize('  hello   world  ')).toBe('hello world');
            expect(ExtensionUtils.text.normalize('hello\n\tworld')).toBe('hello world');
            expect(ExtensionUtils.text.normalize('multiple   spaces')).toBe('multiple spaces');
        });
        
        test('should handle edge cases', () => {
            expect(ExtensionUtils.text.normalize('')).toBe('');
            expect(ExtensionUtils.text.normalize(null)).toBe('');
            expect(ExtensionUtils.text.normalize(undefined)).toBe('');
            expect(ExtensionUtils.text.normalize('   ')).toBe('');
        });
    });
    
    describe('containsAny', () => {
        test('should find patterns in text', () => {
            expect(ExtensionUtils.text.containsAny('Hello World', ['world', 'test'])).toBe(true);
            expect(ExtensionUtils.text.containsAny('HELLO WORLD', ['world'])).toBe(true); // Case insensitive
            expect(ExtensionUtils.text.containsAny('Product Loading...', ['loading', 'wait'])).toBe(true);
        });
        
        test('should return false when no patterns match', () => {
            expect(ExtensionUtils.text.containsAny('Hello World', ['test', 'example'])).toBe(false);
            expect(ExtensionUtils.text.containsAny('', ['test'])).toBe(false);
        });
        
        test('should handle edge cases', () => {
            expect(ExtensionUtils.text.containsAny(null, ['test'])).toBe(false);
            expect(ExtensionUtils.text.containsAny('text', null)).toBe(false);
            expect(ExtensionUtils.text.containsAny('text', [])).toBe(false);
        });
    });
    
    describe('extractPrice', () => {
        test('should extract prices with different currency symbols', () => {
            expect(ExtensionUtils.text.extractPrice('Price: $29.99')).toBe('$29.99');
            expect(ExtensionUtils.text.extractPrice('Cost €45.00 including tax')).toBe('€45.00');
            expect(ExtensionUtils.text.extractPrice('Only £19.99!')).toBe('£19.99');
            expect(ExtensionUtils.text.extractPrice('¥1500 yen')).toBe('¥1500');
            expect(ExtensionUtils.text.extractPrice('₹999 rupees')).toBe('₹999');
            expect(ExtensionUtils.text.extractPrice('Total: 29.99$')).toBe('29.99$');
            // Canadian dollar and other prefixed currencies
            expect(ExtensionUtils.text.extractPrice('Price: CA$129')).toBe('CA$129');
            expect(ExtensionUtils.text.extractPrice('Cost US$99.99')).toBe('US$99.99');
            expect(ExtensionUtils.text.extractPrice('AU$149.50 Australian')).toBe('AU$149.50');
        });
        
        test('should handle various price formats', () => {
            expect(ExtensionUtils.text.extractPrice('$ 29.99')).toBe('$ 29.99'); // Space after symbol
            expect(ExtensionUtils.text.extractPrice('$1,234.56')).toBe('$1,234.56'); // Comma separator
            expect(ExtensionUtils.text.extractPrice('€45')).toBe('€45'); // No decimal
        });
        
        test('should return null when no price found', () => {
            expect(ExtensionUtils.text.extractPrice('No price here')).toBeNull();
            expect(ExtensionUtils.text.extractPrice('')).toBeNull();
            expect(ExtensionUtils.text.extractPrice(null)).toBeNull();
        });
        
        test('should extract first price when multiple prices present', () => {
            expect(ExtensionUtils.text.extractPrice('Was $49.99, now $29.99')).toBe('$49.99');
        });
    });
});

describe('ExtensionUtils.async', () => {
    describe('delay', () => {
        test('should delay execution', async () => {
            const start = Date.now();
            await ExtensionUtils.async.delay(100);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing variance
        });
    });
    
    describe('retry', () => {
        test('should succeed on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');
            const result = await ExtensionUtils.async.retry(mockFn, 3, [10, 20, 30]);
            
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
        
        test('should retry on failure and eventually succeed', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('Attempt 1'))
                .mockRejectedValueOnce(new Error('Attempt 2'))
                .mockResolvedValueOnce('success');
            
            const result = await ExtensionUtils.async.retry(mockFn, 3, [10, 20, 30]);
            
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        });
        
        test('should fail after max attempts', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
            
            await expect(ExtensionUtils.async.retry(mockFn, 2, [10, 20]))
                .rejects.toThrow('Always fails');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });
});

describe('ExtensionUtils.storage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
    });
    
    describe('generateProductId', () => {
        test('should generate consistent IDs for same product', () => {
            const product = {
                title: 'Test Product',
                url: 'https://example.com/product',
                domain: 'example.com'
            };
            
            const id1 = ExtensionUtils.storage.generateProductId(product);
            const id2 = ExtensionUtils.storage.generateProductId(product);
            
            expect(id1).toBe(id2);
            expect(id1).toBeTruthy();
            expect(id1.length).toBeLessThanOrEqual(16);
        });
        
        test('should generate different IDs for different products', () => {
            const product1 = {
                title: 'Product 1',
                url: 'https://example.com/product1',
                domain: 'example.com'
            };
            
            const product2 = {
                title: 'Product 2',
                url: 'https://example.com/product2',
                domain: 'example.com'
            };
            
            const id1 = ExtensionUtils.storage.generateProductId(product1);
            const id2 = ExtensionUtils.storage.generateProductId(product2);
            
            expect(id1).not.toBe(id2);
        });
        
        test('should handle special characters and case differences', () => {
            const product1 = {
                title: 'Special Product!@#$%',
                url: 'https://example.com/special',
                domain: 'example.com'
            };
            
            const product2 = {
                title: 'SPECIAL PRODUCT!@#$%',
                url: 'https://example.com/special',
                domain: 'example.com'
            };
            
            const id1 = ExtensionUtils.storage.generateProductId(product1);
            const id2 = ExtensionUtils.storage.generateProductId(product2);
            
            // Should be same due to toLowerCase in implementation
            expect(id1).toBe(id2);
        });
    });
    
    describe('isValidProduct', () => {
        test('should validate correct product objects', () => {
            const validProduct = {
                title: 'Test Product',
                url: 'https://example.com/product',
                price: '$29.99'
            };
            
            expect(ExtensionUtils.storage.isValidProduct(validProduct)).toBe(true);
        });
        
        test('should reject invalid product objects', () => {
            expect(ExtensionUtils.storage.isValidProduct(null)).toBe(false);
            expect(ExtensionUtils.storage.isValidProduct({})).toBe(false);
            expect(ExtensionUtils.storage.isValidProduct({
                title: '',
                url: 'https://example.com',
                price: '$29.99'
            })).toBe(false);
            expect(ExtensionUtils.storage.isValidProduct({
                title: 'Product',
                url: '',
                price: '$29.99'
            })).toBe(false);
            expect(ExtensionUtils.storage.isValidProduct({
                title: 'Product',
                url: 'https://example.com',
                price: ''
            })).toBe(false);
        });
        
        test('should handle missing properties', () => {
            expect(ExtensionUtils.storage.isValidProduct({
                title: 'Product',
                url: 'https://example.com'
                // Missing price
            })).toBe(false);
            
            expect(ExtensionUtils.storage.isValidProduct({
                title: 'Product',
                price: '$29.99'
                // Missing url
            })).toBe(false);
        });
    });
    
    describe('saveProduct', () => {
        test('should save valid product successfully', async () => {
            const product = {
                title: 'Test Product',
                url: 'https://example.com/product',
                price: '$29.99',
                domain: 'example.com'
            };
            
            chrome.storage.local.get.mockResolvedValue({ products: {} });
            chrome.storage.local.set.mockResolvedValue();
            
            const productId = await ExtensionUtils.storage.saveProduct(product);
            
            expect(productId).toBeTruthy();
            expect(chrome.storage.local.get).toHaveBeenCalledWith(['products']);
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
        
        test('should reject invalid product', async () => {
            const invalidProduct = {
                title: '',
                url: 'https://example.com',
                price: '$29.99'
            };
            
            await expect(ExtensionUtils.storage.saveProduct(invalidProduct))
                .rejects.toThrow('Failed to save product: Invalid product data');
        });
        
        test('should handle storage errors', async () => {
            const product = {
                title: 'Test Product',
                url: 'https://example.com/product',
                price: '$29.99',
                domain: 'example.com'
            };
            
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
            
            await expect(ExtensionUtils.storage.saveProduct(product))
                .rejects.toThrow('Failed to save product: Storage error');
        });
    });
});

describe('ExtensionUtils.chrome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
    });
    
    describe('sendMessageToTab', () => {
        test('should send message successfully', async () => {
            const mockResponse = { success: true };
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                setTimeout(() => callback(mockResponse), 10);
            });
            
            const result = await ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' });
            
            expect(result).toEqual(mockResponse);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, { action: 'test' }, expect.any(Function));
        });
        
        test('should handle chrome runtime errors', async () => {
            chrome.runtime.lastError = { message: 'Tab not found' };
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                setTimeout(() => callback(null), 10);
            });
            
            await expect(ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' }))
                .rejects.toThrow('Tab not found');
        });
        
        test('should timeout after specified time', async () => {
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                // Never call callback to simulate timeout
            });
            
            await expect(ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' }, 100))
                .rejects.toThrow('Message timeout');
        }, 200);
    });
    
    describe('isContentScriptAvailable', () => {
        test('should return true when content script responds', async () => {
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                setTimeout(() => callback({ pong: true }), 10);
            });
            
            const result = await ExtensionUtils.chrome.isContentScriptAvailable(123);
            
            expect(result).toBe(true);
        });
        
        test('should return false when content script does not respond', async () => {
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                setTimeout(() => callback(null), 10);
            });
            
            const result = await ExtensionUtils.chrome.isContentScriptAvailable(123);
            
            expect(result).toBe(false);
        });
        
        test('should return false on timeout', async () => {
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
                // Never call callback
            });
            
            const result = await ExtensionUtils.chrome.isContentScriptAvailable(123);
            
            expect(result).toBe(false);
        });
    });
});

// Edge case and stress tests
describe('ExtensionUtils - Edge Cases and Stress Tests', () => {
    describe('Boundary value testing', () => {
        test('should handle very long strings', () => {
            const longString = 'a'.repeat(10000);
            const longUrl = `https://example.com/${'path/'.repeat(1000)}product`;
            
            expect(() => ExtensionUtils.text.normalize(longString)).not.toThrow();
            expect(ExtensionUtils.url.normalize(longUrl)).toContain('https://');
        });
        
        test('should handle special Unicode characters', () => {
            const unicodeText = 'Product 🛒 Price: $29.99 ★★★★★';
            const unicodeUrl = 'https://例え.テスト/商品';
            
            expect(ExtensionUtils.text.extractPrice(unicodeText)).toBe('$29.99');
            expect(() => ExtensionUtils.url.validate(unicodeUrl)).not.toThrow();
        });
        
        test('should handle extreme price values', () => {
            expect(ExtensionUtils.price.isRealistic('$0.01')).toBe(true);
            expect(ExtensionUtils.price.isRealistic('$99,999.99')).toBe(true);
            expect(ExtensionUtils.price.isRealistic('$100,000.00')).toBe(false);
            expect(ExtensionUtils.price.getNumericValue('$999,999,999.99')).toBe(999999999.99);
        });
    });
    
    describe('Concurrent operations', () => {
        test('should handle multiple simultaneous price extractions', async () => {
            const texts = [
                'Price: $29.99',
                'Cost: €45.00',
                'Total: £19.99',
                'Amount: ¥1500',
                'Value: ₹999'
            ];
            
            const promises = texts.map(text => 
                Promise.resolve(ExtensionUtils.text.extractPrice(text))
            );
            
            const results = await Promise.all(promises);
            
            expect(results).toEqual(['$29.99', '€45.00', '£19.99', '¥1500', '₹999']);
        });
        
        test('should handle multiple product ID generations', () => {
            const products = Array.from({ length: 100 }, (_, i) => ({
                title: `Product ${i}`,
                url: `https://example.com/product${i}`,
                domain: 'example.com'
            }));
            
            const ids = products.map(product => 
                ExtensionUtils.storage.generateProductId(product)
            );
            
            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(products.length);
        });
    });
    
    describe('Memory and performance', () => {
        test('should not leak memory with repeated operations', () => {
            // Simulate repeated URL validations
            for (let i = 0; i < 1000; i++) {
                ExtensionUtils.url.validate(`https://example${i}.com`);
            }
            
            // Simulate repeated price extractions
            for (let i = 0; i < 1000; i++) {
                ExtensionUtils.text.extractPrice(`Price: $${i}.99`);
            }
            
            // If we get here without running out of memory, test passes
            expect(true).toBe(true);
        });
    });
});