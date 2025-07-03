/**
 * Test Compatibility Layer
 * Provides backward compatibility for existing tests with new modular architecture
 */

// Mock browser environment
if (typeof global !== 'undefined') {
    global.window = global.window || {};
    global.document = global.document || {
        getElementById: () => ({ style: {}, textContent: '', value: '' }),
        createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} }),
        body: { appendChild: () => {} }
    };
    global.chrome = global.chrome || {};
}

// Create mock Config object based on the old ExtensionConfig
const Config = {
    app: {
        name: 'WishCart',
        version: '1.1.0'
    },
    ui: {
        elements: {
            urlInput: 'urlInput',
            fetchBtn: 'fetchBtn',
            currentTabBtn: 'currentTabBtn',
            loading: 'loading',
            result: 'result',
            error: 'error',
            titleText: 'titleText',
            priceText: 'priceText',
            urlText: 'urlText',
            addToListBtn: 'addToListBtn',
            savedList: 'savedList',
            listContainer: 'listContainer',
            listToggle: 'listToggle',
            listCount: 'listCount',
            clearListBtn: 'clearListBtn',
            exportListBtn: 'exportListBtn'
        },
        timing: {
            animationDuration: 200,
            successMessageDuration: 3000,
            retryDelay: 1000,
            pageTimeout: 30000
        },
        limits: {
            titleMaxLength: 45,
            maxVisibleProducts: 50
        }
    },
    api: {
        timeouts: {
            pageLoad: 30000,
            contentScript: 5000,
            storage: 3000
        },
        retries: {
            maxAttempts: 3,
            delays: [1000, 3000, 5000]
        }
    },
    storage: {
        keys: {
            products: 'wishcart_products'
        },
        limits: {
            maxProducts: 1000,
            cacheExpiration: 24 * 60 * 60 * 1000
        }
    },
    priceDetection: {
        patterns: [
            /(?:CA|US|AU|NZ|HK|SG)\$\s*[\d,]+(?:\.\d{2})?/gi,
            /[\$€£¥₹₽]\s*[\d,]+(?:\.\d{2})?/gi,
            /[\d,]+(?:\.\d{2})?\s*[\$€£¥₹₽]/gi,
            /[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF)/gi
        ],
        excludePatterns: [
            /loading/i,
            /\.{3,}/,
            /pending/i
        ]
    },
    messages: {
        success: {
            addedToList: '✅ Product added to WishCart!',
            removedFromList: '🗑️ Product removed from WishCart',
            listCleared: '🧹 WishCart cleared successfully',
            listExported: '📤 WishCart exported successfully'
        },
        errors: {
            emptyUrl: 'Please enter a URL',
            invalidUrl: 'Please enter a valid URL',
            fetchFailed: 'Failed to fetch page information',
            noTab: 'No active tab found',
            timeout: 'Request timed out'
        },
        notFound: {
            title: 'No title found',
            price: 'No price found',
            domain: 'Unknown domain'
        },
        list: {
            addButton: '✨ Add to WishCart',
            emptyState: 'Your WishCart is empty',
            emptyHint: 'Add products using the "Add to WishCart" button above'
        }
    },
    debug: {
        enabled: true
    },
    features: {
        priceTracking: true,
        exportImport: true
    },
    performance: {
        enableCaching: true
    }
};

// Create URL utilities that match the old ExtensionUtils.url interface
const UrlUtils = {
    validate: function(url) {
        if (!url || url.trim() === '') {
            return {
                valid: false,
                error: Config.messages.errors.emptyUrl
            };
        }
        
        try {
            new URL(url);
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: Config.messages.errors.invalidUrl
            };
        }
    },

    normalize: function(url) {
        if (!url) return '';
        
        url = url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        return url;
    },

    isValid: function(url) {
        return this.validate(url).valid;
    },

    extractDomain: function(url) {
        try {
            return new URL(url).hostname;
        } catch (error) {
            return Config.messages.notFound.domain;
        }
    }
};

// Create Price utilities that match the old ExtensionUtils.price interface
const PriceUtils = {
    isValid: function(price) {
        if (!price || typeof price !== 'string') return false;
        
        const trimmedPrice = price.trim();
        const hasValidPattern = Config.priceDetection.patterns.some(pattern => 
            pattern.test(trimmedPrice)
        );
        
        const hasExcludePattern = Config.priceDetection.excludePatterns.some(pattern =>
            pattern.test(trimmedPrice)
        );
        
        return hasValidPattern && 
               !hasExcludePattern &&
               price !== Config.messages.notFound.price;
    },

    getNumericValue: function(priceString) {
        if (!priceString) return 0;
        
        const cleanedPrice = priceString.replace(/(?:CA|US|AU|NZ|HK|SG)\$|[^\d.,]/g, '');
        
        if (cleanedPrice.includes(',') && cleanedPrice.includes('.')) {
            const match = cleanedPrice.match(/[\d,]+\.?\d*/);
            return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
        } else if (cleanedPrice.includes(',')) {
            const parts = cleanedPrice.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                return parseFloat(cleanedPrice.replace(',', '.'));
            } else {
                return parseFloat(cleanedPrice.replace(/,/g, ''));
            }
        } else {
            const match = cleanedPrice.match(/\d+(?:\.\d{2})?/);
            return match ? parseFloat(match[0]) : 0;
        }
    },

    isRealistic: function(priceString) {
        const numericValue = this.getNumericValue(priceString);
        return numericValue > 0 && numericValue < 100000;
    },

    extractPrice: function(text) {
        if (!text) return null;
        
        const normalizedText = text.trim();
        
        for (const pattern of Config.priceDetection.patterns) {
            const matches = normalizedText.match(pattern);
            if (matches && matches.length > 0) {
                const priceCandidate = matches[0].trim();
                
                if (this.isValid(priceCandidate) && this.isRealistic(priceCandidate)) {
                    return priceCandidate;
                }
            }
        }
        
        return null;
    }
};

// Create Chrome utilities that match the old ExtensionUtils.chrome interface
const ChromeUtils = {
    sendMessageToTab: function(tabId, message, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Tab message timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            
            chrome.tabs.sendMessage(tabId, message, (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                resolve(response);
            });
        });
    },

    getCurrentTab: function() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (!tabs || tabs.length === 0) {
                    reject(new Error('No active tab found'));
                    return;
                }
                
                resolve(tabs[0]);
            });
        });
    },

    createTab: function(url, active = false) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url, active }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(tab);
            });
        });
    },

    isContentScriptAvailable: async function(tabId) {
        try {
            await this.sendMessageToTab(tabId, { action: 'ping' }, 1000);
            return true;
        } catch (error) {
            return false;
        }
    }
};

// Create compatibility exports that match the old ExtensionConfig and ExtensionUtils
const ExtensionConfig = Config;
const ExtensionUtils = {
    url: UrlUtils,
    price: PriceUtils,
    chrome: ChromeUtils,
    
    // Storage utilities
    storage: {
        async saveProduct(product) {
            const products = await this.getProducts();
            products.push(product);
            return new Promise((resolve) => {
                chrome.storage.local.set({ [Config.storage.keys.products]: products }, () => {
                    resolve(!chrome.runtime.lastError);
                });
            });
        },

        async getProducts() {
            return new Promise((resolve) => {
                chrome.storage.local.get([Config.storage.keys.products], (result) => {
                    resolve(result[Config.storage.keys.products] || []);
                });
            });
        },

        async removeProduct(productId) {
            const products = await this.getProducts();
            const filtered = products.filter(p => p.id !== productId);
            return new Promise((resolve) => {
                chrome.storage.local.set({ [Config.storage.keys.products]: filtered }, () => {
                    resolve(!chrome.runtime.lastError);
                });
            });
        },

        async clearProducts() {
            return new Promise((resolve) => {
                chrome.storage.local.remove([Config.storage.keys.products], () => {
                    resolve(!chrome.runtime.lastError);
                });
            });
        },

        generateProductId(product) {
            const timestamp = Date.now();
            const hash = this.hashString(product.url + product.title);
            return `product_${hash}_${timestamp}`;
        },

        hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        },

        isValidProduct(product) {
            return product && 
                   typeof product === 'object' &&
                   product.title && 
                   product.url &&
                   UrlUtils.isValid(product.url);
        }
    },

    // Text utilities
    text: {
        normalize(text) {
            if (!text) return '';
            return text.replace(/\s+/g, ' ').trim();
        },

        extractPrice(text) {
            return PriceUtils.extractPrice(text);
        }
    },

    // General utilities
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async retry(fn, maxAttempts = 3, delays = [1000, 2000, 3000]) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    throw error;
                }
                await this.delay(delays[attempt] || 1000);
            }
        }
    }
};

// Mock Chrome APIs for testing
function mockChromeAPIs() {
    global.chrome = {
        tabs: {
            query: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            sendMessage: jest.fn(),
            onUpdated: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            }
        },
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                clear: jest.fn(),
                remove: jest.fn()
            }
        },
        runtime: {
            lastError: null,
            getManifest: jest.fn(() => ({ version: '1.1.0' }))
        },
        alarms: {
            create: jest.fn(),
            clear: jest.fn(),
            getAll: jest.fn()
        }
    };
}

// Setup function for tests
function setupTestEnvironment() {
    mockChromeAPIs();
    
    // Mock DOM elements that tests might need
    if (typeof document !== 'undefined') {
        const mockElements = [
            'urlInput', 'fetchBtn', 'currentTabBtn', 'loading', 'result', 'error',
            'titleText', 'priceText', 'urlText', 'addToListBtn', 'savedList',
            'listContainer', 'listToggle', 'listCount', 'clearListBtn', 'exportListBtn'
        ];
        
        mockElements.forEach(id => {
            if (!document.getElementById(id)) {
                const element = document.createElement('div');
                element.id = id;
                element.style = {};
                element.textContent = '';
                element.value = '';
                element.addEventListener = jest.fn();
                element.click = jest.fn();
                document.body.appendChild(element);
            }
        });
    }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionConfig,
        ExtensionUtils,
        mockChromeAPIs,
        setupTestEnvironment
    };
}

// Make available globally for tests
if (typeof global !== 'undefined') {
    global.ExtensionConfig = ExtensionConfig;
    global.ExtensionUtils = ExtensionUtils;
    global.mockChromeAPIs = mockChromeAPIs;
    global.setupTestEnvironment = setupTestEnvironment;
} 