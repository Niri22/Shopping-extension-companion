/**
 * Extension Configuration
 * Centralized configuration for the Chrome extension
 */

const ExtensionConfig = {
    // General settings
    version: '1.1.0',
    name: 'Page Title & Price Fetcher',
    
    // Timing configurations
    timing: {
        pageTimeout: 15000,        // 15 seconds for page loading
        dynamicContentDelay: 3000, // 3 seconds for dynamic content
        retryDelays: [500, 2000, 4000, 6000], // Progressive retry delays
        maxRetryAttempts: 4
    },
    
    // Price extraction configuration
    priceExtraction: {
        // CSS selectors organized by platform
        selectors: {
            generic: [
                '[data-testid*="price"]',
                '[data-cy*="price"]',
                '[class*="price"]',
                '[id*="price"]',
                '[itemprop="price"]',
                '[itemprop="lowPrice"]',
                '[itemprop="highPrice"]'
            ],
            amazon: [
                '.a-price-whole',
                '.a-price .a-offscreen',
                '#priceblock_dealprice',
                '#priceblock_ourprice',
                '.a-price-range'
            ],
            ebay: [
                '.u-flL.condText',
                '.notranslate'
            ],
            shopify: [
                '.price',
                '.product-price',
                '.money'
            ],
            woocommerce: [
                '.woocommerce-Price-amount',
                '.amount'
            ],
            common: [
                '.current-price',
                '.sale-price',
                '.regular-price',
                '.price-current',
                '.price-now',
                '.offer-price',
                '.final-price'
            ]
        },
        
        // Meta tag selectors for price extraction
        metaSelectors: [
            'meta[property="product:price:amount"]',
            'meta[property="og:price:amount"]',
            'meta[name="price"]',
            'meta[itemprop="price"]'
        ],
        
        // Regular expressions for price pattern matching
        patterns: [
            /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*/g,
            /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|\$|€|£|¥|₹|₽|¢)/gi,
            /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
        ],
        
        // Loading indicators to avoid
        loadingIndicators: [
            'loading', 'spinner', 'skeleton', 'placeholder',
            'fetching', 'updating', 'calculating'
        ],
        
        // Invalid text patterns
        invalidTexts: [
            'loading', 'fetching', 'calculating', 'updating',
            '...', '---', 'tbd', 'n/a', 'null', 'undefined',
            'coming soon', 'check back', 'price pending'
        ],
        
        // Price validation limits
        validation: {
            minDigits: 2,
            maxPrice: 999999,
            minPrice: 0.01
        }
    },
    
    // Title extraction configuration
    titleExtraction: {
        // Strategies for title extraction (in order of preference)
        strategies: [
            'document.title',
            'title_element',
            'og_title_meta',
            'title_meta',
            'h1_element'
        ],
        
        // Meta selectors for title extraction
        metaSelectors: [
            'meta[property="og:title"]',
            'meta[name="title"]'
        ]
    },
    
    // UI configuration
    ui: {
        // CSS classes
        classes: {
            hidden: 'hidden',
            priceFound: 'price-found',
            loading: 'loading',
            error: 'error',
            listItem: 'list-item',
            removeBtn: 'remove-btn'
        },
        
        // Element IDs
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
            errorText: 'errorText',
            addToListBtn: 'addToListBtn',
            savedList: 'savedList',
            listContainer: 'listContainer',
            listToggle: 'listToggle',
            clearListBtn: 'clearListBtn',
            exportListBtn: 'exportListBtn',
            listCount: 'listCount'
        }
    },
    
    // Error messages
    messages: {
        errors: {
            invalidUrl: 'Please enter a valid URL (include http:// or https://)',
            emptyUrl: 'Please enter a URL',
            noTab: 'Unable to get current tab information',
            timeout: 'Timeout: Page took too long to load',
            fetchFailed: 'Failed to fetch page information',
            contentScriptError: 'Content script not responding',
            extensionError: 'Extension error'
        },
        
        loading: {
            pageLoading: 'Page still loading...',
            dynamicContent: 'Loading dynamic content...'
        },
        
        notFound: {
            title: 'No title found',
            price: 'No price found'
        },
        
        success: {
            addedToList: 'Product added to your list!',
            removedFromList: 'Product removed from list',
            listCleared: 'List cleared successfully',
            listExported: 'List exported successfully'
        },
        
        list: {
            empty: 'Your product list is empty',
            title: 'Saved Products',
            addButton: 'Add to List',
            removeButton: 'Remove',
            clearAll: 'Clear All',
            exportList: 'Export List',
            showList: 'Show List',
            hideList: 'Hide List'
        }
    },
    
    // Chrome extension permissions and manifest settings
    permissions: {
        required: ['tabs', 'activeTab', 'storage'],
        optional: []
    },
    
    // Storage configuration
    storage: {
        keys: {
            productList: 'saved_products',
            settings: 'extension_settings'
        },
        maxItems: 100, // Maximum number of saved products
        maxTitleLength: 100,
        maxPriceLength: 20
    },
    
    // Performance optimization settings
    performance: {
        enableCaching: true,
        cacheTimeout: 300000, // 5 minutes
        maxCacheSize: 100,
        enableDebouncing: true,
        debounceDelay: 300,
        enableVirtualScrolling: true,
        batchSize: 20,
        enableLazyLoading: true,
        memoryThreshold: 50 // MB
    },
    
    // Debug settings
    debug: {
        enabled: false,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        enablePerformanceLogging: false
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionConfig;
}

// Make available globally for browser environment
if (typeof window !== 'undefined') {
    window.ExtensionConfig = ExtensionConfig;
} 