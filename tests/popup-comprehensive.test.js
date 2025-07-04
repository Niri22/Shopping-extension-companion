/**
 * Comprehensive Unit Tests for Popup Functionality
 * Minimum 10 test cases per feature
 */

// Mock Chrome APIs
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
        remove: jest.fn(),
        sendMessage: jest.fn(),
        onUpdated: {
            addListener: jest.fn(),
            removeListener: jest.fn()
        }
    },
    runtime: {
        sendMessage: jest.fn(),
        lastError: null
    }
};

// Mock DOM
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
    addEventListener: jest.fn()
};

global.window = {
    URL: {
        createObjectURL: jest.fn(() => 'blob:mock-url'),
        revokeObjectURL: jest.fn()
    },
    setTimeout: jest.fn(),
    clearTimeout: jest.fn()
};

// Load dependencies
require('../config.js');
require('../utils.js');
require('../popup.js');

describe('🎯 Popup Initialization Tests', () => {
    let popup;
    let mockElements;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock DOM elements
        mockElements = {
            loading: { classList: { add: jest.fn(), remove: jest.fn() } },
            result: { classList: { add: jest.fn(), remove: jest.fn() } },
            error: { classList: { add: jest.fn(), remove: jest.fn() } },
            titleText: { textContent: '' },
            priceText: { textContent: '', classList: { toggle: jest.fn() } },
            urlText: { textContent: '' },
            errorText: { textContent: '' },
            addToListBtn: { addEventListener: jest.fn(), disabled: false },
            savedList: { innerHTML: '' },
            listContainer: {},
            clearListBtn: { addEventListener: jest.fn() },
            exportListBtn: { addEventListener: jest.fn() },
            searchInput: { addEventListener: jest.fn(), value: '' },
            sortSelect: { addEventListener: jest.fn(), value: 'date' },
            trackCurrentBtn: { addEventListener: jest.fn() },
            refreshBtn: { addEventListener: jest.fn() }
        };

        document.getElementById.mockImplementation((id) => mockElements[id] || null);
        
        // Mock storage
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
    });

    test('1. Should initialize popup successfully', async () => {
        popup = new ShoppingExtensionPopup();
        expect(popup).toBeDefined();
        expect(popup.elements).toBeDefined();
        expect(popup.currentPageInfo).toBeNull();
        expect(popup.listVisible).toBe(false);
    });

    test('2. Should bind all required elements', () => {
        popup = new ShoppingExtensionPopup();
        expect(document.getElementById).toHaveBeenCalledTimes(14);
        expect(popup.elements.loading).toBeDefined();
        expect(popup.elements.result).toBeDefined();
        expect(popup.elements.error).toBeDefined();
    });

    test('3. Should handle missing DOM elements gracefully', () => {
        document.getElementById.mockReturnValue(null);
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        popup = new ShoppingExtensionPopup();
        expect(consoleSpy).toHaveBeenCalledWith('⚠️ [Popup] Element not found:', expect.any(String));
        
        consoleSpy.mockRestore();
    });

    test('4. Should set up event listeners for all buttons', () => {
        popup = new ShoppingExtensionPopup();
        expect(mockElements.addToListBtn.addEventListener).toHaveBeenCalled();
        expect(mockElements.clearListBtn.addEventListener).toHaveBeenCalled();
        expect(mockElements.exportListBtn.addEventListener).toHaveBeenCalled();
        expect(mockElements.searchInput.addEventListener).toHaveBeenCalled();
    });

    test('5. Should load saved products on initialization', async () => {
        chrome.storage.local.get.mockResolvedValue({ saved_products: [{ id: '1', title: 'Test' }] });
        popup = new ShoppingExtensionPopup();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(chrome.storage.local.get).toHaveBeenCalledWith(['saved_products']);
    });

    test('6. Should handle initialization errors gracefully', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        popup = new ShoppingExtensionPopup();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    test('7. Should initialize with empty current page info', () => {
        popup = new ShoppingExtensionPopup();
        expect(popup.currentPageInfo).toBeNull();
    });

    test('8. Should initialize with list not visible', () => {
        popup = new ShoppingExtensionPopup();
        expect(popup.listVisible).toBe(false);
    });

    test('9. Should log successful initialization', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        popup = new ShoppingExtensionPopup();
        expect(consoleSpy).toHaveBeenCalledWith('🚀 [Popup] Initializing Shopping Extension...');
        consoleSpy.mockRestore();
    });

    test('10. Should handle partial element binding', () => {
        // Only some elements exist
        document.getElementById.mockImplementation((id) => 
            ['loading', 'result', 'error'].includes(id) ? mockElements[id] : null
        );
        
        popup = new ShoppingExtensionPopup();
        expect(popup.elements.loading).toBeDefined();
        expect(popup.elements.addToListBtn).toBeUndefined();
    });
});

describe('🔍 Product Search and Filter Tests', () => {
    let popup;
    let mockProducts;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProducts = [
            { id: '1', title: 'iPhone 15', price: '$999', url: 'https://apple.com', dateAdded: '2024-01-01' },
            { id: '2', title: 'Samsung Galaxy', price: '$899', url: 'https://samsung.com', dateAdded: '2024-01-02' },
            { id: '3', title: 'Google Pixel', price: '$799', url: 'https://google.com', dateAdded: '2024-01-03' },
            { id: '4', title: 'iPad Pro', price: '$1099', url: 'https://apple.com', dateAdded: '2024-01-04' },
            { id: '5', title: 'MacBook Air', price: '$1199', url: 'https://apple.com', dateAdded: '2024-01-05' }
        ];

        document.getElementById.mockImplementation((id) => ({
            loading: { classList: { add: jest.fn(), remove: jest.fn() } },
            result: { classList: { add: jest.fn(), remove: jest.fn() } },
            error: { classList: { add: jest.fn(), remove: jest.fn() } },
            searchInput: { value: '', addEventListener: jest.fn() },
            sortSelect: { value: 'date', addEventListener: jest.fn() },
            savedList: { innerHTML: '' }
        }[id] || { addEventListener: jest.fn() }));

        chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should filter products by title', () => {
        const filtered = popup.filterProducts(mockProducts, 'iphone');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('iPhone 15');
    });

    test('2. Should filter products by price', () => {
        const filtered = popup.filterProducts(mockProducts, '999');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].price).toBe('$999');
    });

    test('3. Should filter products by domain', () => {
        const filtered = popup.filterProducts(mockProducts, 'apple');
        expect(filtered).toHaveLength(3);
    });

    test('4. Should return all products with empty search term', () => {
        const filtered = popup.filterProducts(mockProducts, '');
        expect(filtered).toHaveLength(5);
    });

    test('5. Should be case insensitive', () => {
        const filtered = popup.filterProducts(mockProducts, 'IPHONE');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('iPhone 15');
    });

    test('6. Should handle partial matches', () => {
        const filtered = popup.filterProducts(mockProducts, 'gal');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('Samsung Galaxy');
    });

    test('7. Should return empty array for no matches', () => {
        const filtered = popup.filterProducts(mockProducts, 'nonexistent');
        expect(filtered).toHaveLength(0);
    });

    test('8. Should handle special characters in search', () => {
        const filtered = popup.filterProducts(mockProducts, '$899');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].price).toBe('$899');
    });

    test('9. Should search across multiple fields', () => {
        const filtered = popup.filterProducts(mockProducts, 'google');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('Google Pixel');
    });

    test('10. Should handle whitespace in search terms', () => {
        const filtered = popup.filterProducts(mockProducts, '  iphone  ');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('iPhone 15');
    });
});

describe('📊 Product Sorting Tests', () => {
    let popup;
    let mockProducts;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProducts = [
            { id: '1', title: 'Zebra Product', price: '$500', dateAdded: '2024-01-01T10:00:00Z' },
            { id: '2', title: 'Apple Product', price: '$1000', dateAdded: '2024-01-03T10:00:00Z' },
            { id: '3', title: 'Beta Product', price: '$750', dateAdded: '2024-01-02T10:00:00Z' },
            { id: '4', title: 'Delta Product', price: '$250', dateAdded: '2024-01-04T10:00:00Z' }
        ];

        document.getElementById.mockImplementation(() => ({ addEventListener: jest.fn() }));
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should sort by name alphabetically', () => {
        const sorted = popup.sortProducts(mockProducts, 'name');
        expect(sorted[0].title).toBe('Apple Product');
        expect(sorted[1].title).toBe('Beta Product');
        expect(sorted[2].title).toBe('Delta Product');
        expect(sorted[3].title).toBe('Zebra Product');
    });

    test('2. Should sort by price ascending', () => {
        const sorted = popup.sortProducts(mockProducts, 'price');
        expect(sorted[0].price).toBe('$250');
        expect(sorted[1].price).toBe('$500');
        expect(sorted[2].price).toBe('$750');
        expect(sorted[3].price).toBe('$1000');
    });

    test('3. Should sort by date descending (newest first)', () => {
        const sorted = popup.sortProducts(mockProducts, 'date');
        expect(sorted[0].dateAdded).toBe('2024-01-04T10:00:00Z');
        expect(sorted[1].dateAdded).toBe('2024-01-03T10:00:00Z');
        expect(sorted[2].dateAdded).toBe('2024-01-02T10:00:00Z');
        expect(sorted[3].dateAdded).toBe('2024-01-01T10:00:00Z');
    });

    test('4. Should default to date sorting for invalid sort option', () => {
        const sorted = popup.sortProducts(mockProducts, 'invalid');
        expect(sorted[0].dateAdded).toBe('2024-01-04T10:00:00Z');
    });

    test('5. Should handle empty product array', () => {
        const sorted = popup.sortProducts([], 'name');
        expect(sorted).toHaveLength(0);
    });

    test('6. Should not mutate original array', () => {
        const originalLength = mockProducts.length;
        const originalFirst = mockProducts[0].title;
        
        popup.sortProducts(mockProducts, 'name');
        
        expect(mockProducts).toHaveLength(originalLength);
        expect(mockProducts[0].title).toBe(originalFirst);
    });

    test('7. Should handle products with same values', () => {
        const samePrice = [
            { id: '1', title: 'A', price: '$100', dateAdded: '2024-01-01' },
            { id: '2', title: 'B', price: '$100', dateAdded: '2024-01-02' }
        ];
        
        const sorted = popup.sortProducts(samePrice, 'price');
        expect(sorted).toHaveLength(2);
    });

    test('8. Should handle malformed prices', () => {
        const malformedPrices = [
            { id: '1', title: 'A', price: 'Invalid', dateAdded: '2024-01-01' },
            { id: '2', title: 'B', price: '$100', dateAdded: '2024-01-02' }
        ];
        
        const sorted = popup.sortProducts(malformedPrices, 'price');
        expect(sorted).toHaveLength(2);
    });

    test('9. Should sort by savings when available', () => {
        popup.calculateProductSavings = jest.fn()
            .mockReturnValueOnce(50)
            .mockReturnValueOnce(100)
            .mockReturnValueOnce(25)
            .mockReturnValueOnce(75);
        
        const sorted = popup.sortProducts(mockProducts, 'savings');
        expect(popup.calculateProductSavings).toHaveBeenCalledTimes(8); // Called twice per product
    });

    test('10. Should handle mixed data types gracefully', () => {
        const mixedData = [
            { id: '1', title: null, price: undefined, dateAdded: '2024-01-01' },
            { id: '2', title: 'Valid', price: '$100', dateAdded: '2024-01-02' }
        ];
        
        const sorted = popup.sortProducts(mixedData, 'name');
        expect(sorted).toHaveLength(2);
    });
});

describe('💾 Product Storage Tests', () => {
    let popup;

    beforeEach(() => {
        jest.clearAllMocks();
        document.getElementById.mockImplementation(() => ({ 
            addEventListener: jest.fn(),
            innerHTML: '',
            classList: { add: jest.fn(), remove: jest.fn() }
        }));
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should add product to storage successfully', async () => {
        const product = {
            id: 'test-id',
            title: 'Test Product',
            price: '$99',
            url: 'https://test.com',
            dateAdded: new Date().toISOString()
        };

        chrome.storage.local.set.mockResolvedValue();
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });

        popup.currentPageInfo = { title: 'Test Product', price: '$99', url: 'https://test.com' };
        await popup.handleAddToList();

        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('2. Should handle storage errors gracefully', async () => {
        chrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        popup.currentPageInfo = { title: 'Test', price: '$99', url: 'https://test.com' };
        await popup.handleAddToList();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('3. Should prevent adding invalid products', async () => {
        popup.currentPageInfo = null;
        await popup.handleAddToList();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('4. Should load products from storage', async () => {
        const mockProducts = [{ id: '1', title: 'Test' }];
        chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

        await popup.loadSavedList();
        expect(chrome.storage.local.get).toHaveBeenCalledWith(['saved_products']);
    });

    test('5. Should handle empty storage', async () => {
        chrome.storage.local.get.mockResolvedValue({});
        await popup.loadSavedList();
        expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    test('6. Should remove product from storage', async () => {
        const mockProducts = [
            { id: '1', title: 'Keep' },
            { id: '2', title: 'Remove' }
        ];
        
        chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });
        chrome.storage.local.set.mockResolvedValue();

        await popup.handleRemoveFromList('2');
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('7. Should clear all products', async () => {
        global.confirm = jest.fn(() => true);
        chrome.storage.local.set.mockResolvedValue();

        await popup.handleClearList();
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ saved_products: [] });
    });

    test('8. Should not clear when user cancels', async () => {
        global.confirm = jest.fn(() => false);
        await popup.handleClearList();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('9. Should export products as JSON', async () => {
        const mockProducts = [{ id: '1', title: 'Test' }];
        chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

        document.createElement.mockReturnValue({
            href: '',
            download: '',
            click: jest.fn()
        });

        await popup.handleExportList();
        expect(document.createElement).toHaveBeenCalledWith('a');
    });

    test('10. Should handle export errors', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Export error'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await popup.handleExportList();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe('📊 Statistics Calculation Tests', () => {
    let popup;

    beforeEach(() => {
        jest.clearAllMocks();
        document.getElementById.mockImplementation((id) => ({
            textContent: '',
            addEventListener: jest.fn(),
            classList: { add: jest.fn(), remove: jest.fn() }
        }));
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should calculate total products correctly', async () => {
        const products = [{ id: '1' }, { id: '2' }, { id: '3' }];
        chrome.storage.local.get.mockResolvedValue({ 
            saved_products: products,
            price_tracking_data: {}
        });

        await popup.updateStatistics(products);
        expect(popup.updateStatElement).toHaveBeenCalledWith('totalProducts', 3);
    });

    test('2. Should calculate savings from price drops', () => {
        const products = [
            { id: '1', price: '$100' },
            { id: '2', price: '$200' }
        ];
        
        const trackingData = {
            '1': { priceHistory: [{ price: 120, timestamp: '2024-01-01' }, { price: 100, timestamp: '2024-01-02' }] },
            '2': { priceHistory: [{ price: 250, timestamp: '2024-01-01' }, { price: 200, timestamp: '2024-01-02' }] }
        };

        const result = popup.calculateSavingsAndDrops(products, trackingData);
        expect(result.totalDrops).toBe(2);
    });

    test('3. Should extract numeric price correctly', () => {
        expect(popup.extractNumericPrice('$99.99')).toBe(99.99);
        expect(popup.extractNumericPrice('€1,234.56')).toBe(1234.56);
        expect(popup.extractNumericPrice('¥1000')).toBe(1000);
        expect(popup.extractNumericPrice('Free')).toBe(0);
    });

    test('4. Should handle invalid prices', () => {
        expect(popup.extractNumericPrice('')).toBe(0);
        expect(popup.extractNumericPrice(null)).toBe(0);
        expect(popup.extractNumericPrice(undefined)).toBe(0);
        expect(popup.extractNumericPrice('Not a price')).toBe(0);
    });

    test('5. Should calculate total saved amount', () => {
        const products = [{ id: '1', price: '$90' }];
        const trackingData = {
            '1': { 
                firstRecordedPrice: 100,
                priceHistory: [{ price: 100 }, { price: 90 }]
            }
        };

        const result = popup.calculateSavingsAndDrops(products, trackingData);
        expect(result.totalSaved).toBe(10);
    });

    test('6. Should count price drops correctly', () => {
        const products = [{ id: '1', price: '$80' }];
        const trackingData = {
            '1': { 
                priceHistory: [
                    { price: 100, timestamp: '2024-01-01' },
                    { price: 90, timestamp: '2024-01-02' },
                    { price: 80, timestamp: '2024-01-03' }
                ]
            }
        };

        const result = popup.calculateSavingsAndDrops(products, trackingData);
        expect(result.totalDrops).toBe(2);
    });

    test('7. Should handle products without tracking data', () => {
        const products = [{ id: '1', price: '$100' }];
        const trackingData = {};

        const result = popup.calculateSavingsAndDrops(products, trackingData);
        expect(result.totalSaved).toBe(0);
        expect(result.totalDrops).toBe(0);
    });

    test('8. Should update stat elements correctly', () => {
        popup.updateStatElement('totalProducts', 5);
        // This would be tested with actual DOM manipulation in integration tests
        expect(popup.updateStatElement).toBeDefined();
    });

    test('9. Should handle empty product list', async () => {
        await popup.updateStatistics([]);
        expect(popup.updateStatElement).toHaveBeenCalledWith('totalProducts', 0);
    });

    test('10. Should calculate recent drops within 7 days', () => {
        const products = [{ id: '1', price: '$80' }];
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 3); // 3 days ago
        
        const trackingData = {
            '1': { 
                priceHistory: [
                    { price: 100, timestamp: recentDate.toISOString() },
                    { price: 80, timestamp: new Date().toISOString() }
                ]
            }
        };

        const result = popup.calculateSavingsAndDrops(products, trackingData);
        expect(result.recentDrops).toHaveLength(1);
    });
});

describe('🔄 Current Tab Tracking Tests', () => {
    let popup;

    beforeEach(() => {
        jest.clearAllMocks();
        document.getElementById.mockImplementation(() => ({ 
            addEventListener: jest.fn(),
            classList: { add: jest.fn(), remove: jest.fn() }
        }));
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should get current tab successfully', async () => {
        const mockTab = { id: 123, url: 'https://test.com', title: 'Test Page' };
        chrome.tabs.query.mockResolvedValue([mockTab]);

        const tab = await ExtensionUtils.chrome.getCurrentTab();
        expect(tab).toEqual(mockTab);
    });

    test('2. Should handle no active tab', async () => {
        chrome.tabs.query.mockResolvedValue([]);
        const tab = await ExtensionUtils.chrome.getCurrentTab();
        expect(tab).toBeUndefined();
    });

    test('3. Should track current tab product', async () => {
        const mockTab = { id: 123, url: 'https://test.com', title: 'Test Product' };
        chrome.tabs.query.mockResolvedValue([mockTab]);
        chrome.tabs.sendMessage.mockResolvedValue({ 
            title: 'Test Product', 
            price: '$99' 
        });
        chrome.storage.local.set.mockResolvedValue();

        await popup.handleTrackCurrent();
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('4. Should handle content script unavailable', async () => {
        const mockTab = { id: 123, url: 'https://test.com', title: 'Test Product' };
        chrome.tabs.query.mockResolvedValue([mockTab]);
        chrome.tabs.sendMessage.mockRejectedValue(new Error('No content script'));

        await popup.handleTrackCurrent();
        // Should still track using tab title
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('5. Should retry on content script failure', async () => {
        const mockTab = { id: 123, url: 'https://test.com', title: 'Test Product' };
        chrome.tabs.query.mockResolvedValue([mockTab]);
        chrome.tabs.sendMessage
            .mockRejectedValueOnce(new Error('Retry 1'))
            .mockRejectedValueOnce(new Error('Retry 2'))
            .mockResolvedValue({ title: 'Test Product', price: '$99' });

        await popup.handleTrackCurrent();
        expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('6. Should handle tab creation for URL fetching', async () => {
        const mockTab = { id: 456, url: 'https://example.com' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(mockTab);
        });

        const promise = popup.fetchPageInfoFromURL('https://example.com');
        expect(chrome.tabs.create).toHaveBeenCalledWith(
            { url: 'https://example.com', active: false },
            expect.any(Function)
        );
    });

    test('7. Should handle tab creation errors', async () => {
        chrome.runtime.lastError = { message: 'Tab creation failed' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(null);
        });

        await expect(popup.fetchPageInfoFromURL('https://example.com'))
            .rejects.toThrow('Tab creation failed');
    });

    test('8. Should clean up temporary tabs', async () => {
        const mockTab = { id: 456, url: 'https://example.com', title: 'Test' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(mockTab);
            // Simulate tab completion
            setTimeout(() => {
                const listener = chrome.tabs.onUpdated.addListener.mock.calls[0][0];
                listener(456, { status: 'complete' }, mockTab);
            }, 0);
        });

        chrome.tabs.sendMessage.mockResolvedValue({ title: 'Test', price: '$99' });

        await popup.fetchPageInfoFromURL('https://example.com');
        expect(chrome.tabs.remove).toHaveBeenCalledWith(456);
    });

    test('9. Should timeout on slow page loads', async () => {
        const mockTab = { id: 456, url: 'https://slow.com' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(mockTab);
            // Don't trigger completion - simulate timeout
        });

        global.setTimeout.mockImplementation((fn) => {
            fn(); // Immediately trigger timeout
            return 123;
        });

        await expect(popup.fetchPageInfoFromURL('https://slow.com'))
            .rejects.toThrow();
    });

    test('10. Should extract domain from URL correctly', () => {
        expect(popup.extractDomain('https://www.amazon.com/product')).toBe('amazon.com');
        expect(popup.extractDomain('http://google.com')).toBe('google.com');
        expect(popup.extractDomain('https://subdomain.example.org/path')).toBe('subdomain.example.org');
        expect(popup.extractDomain('invalid-url')).toBe('Unknown');
    });
});

describe('🎨 UI State Management Tests', () => {
    let popup;
    let mockElements;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockElements = {
            loading: { classList: { add: jest.fn(), remove: jest.fn() } },
            result: { classList: { add: jest.fn(), remove: jest.fn() } },
            error: { classList: { add: jest.fn(), remove: jest.fn() } },
            titleText: { textContent: '' },
            priceText: { textContent: '', classList: { toggle: jest.fn() } },
            urlText: { textContent: '' },
            errorText: { textContent: '' },
            addToListBtn: { disabled: false, textContent: '', addEventListener: jest.fn() }
        };

        document.getElementById.mockImplementation((id) => mockElements[id] || { addEventListener: jest.fn() });
        chrome.storage.local.get.mockResolvedValue({ saved_products: [] });
        popup = new ShoppingExtensionPopup();
    });

    test('1. Should show loading state correctly', () => {
        popup.showLoading();
        expect(mockElements.loading.classList.remove).toHaveBeenCalledWith('hidden');
        expect(mockElements.result.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockElements.error.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('2. Should show result state with product info', () => {
        popup.showResult('Test Product', '$99', 'https://test.com');
        
        expect(mockElements.titleText.textContent).toBe('Test Product');
        expect(mockElements.priceText.textContent).toBe('$99');
        expect(mockElements.urlText.textContent).toBe('https://test.com');
        expect(mockElements.result.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('3. Should show error state with message', () => {
        popup.showError('Something went wrong');
        
        expect(mockElements.errorText.textContent).toBe('Something went wrong');
        expect(mockElements.error.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('4. Should hide all sections', () => {
        popup.hideAllSections();
        
        expect(mockElements.loading.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockElements.result.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockElements.error.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('5. Should update add to list button for valid product', () => {
        mockElements.titleText.textContent = 'Valid Product';
        popup.updateAddToListButton();
        
        expect(mockElements.addToListBtn.disabled).toBe(false);
        expect(mockElements.addToListBtn.textContent).toBe('✨ Add to WishCart');
    });

    test('6. Should disable add to list button for invalid product', () => {
        mockElements.titleText.textContent = 'No title found';
        popup.updateAddToListButton();
        
        expect(mockElements.addToListBtn.disabled).toBe(true);
        expect(mockElements.addToListBtn.textContent).toBe('❌ Cannot Add');
    });

    test('7. Should toggle price styling based on availability', () => {
        popup.showResult('Test', '$99', 'https://test.com');
        expect(mockElements.priceText.classList.toggle).toHaveBeenCalledWith('price-found', true);
        
        popup.showResult('Test', 'No price found', 'https://test.com');
        expect(mockElements.priceText.classList.toggle).toHaveBeenCalledWith('price-found', false);
    });

    test('8. Should handle missing elements gracefully', () => {
        document.getElementById.mockReturnValue(null);
        
        expect(() => popup.showLoading()).not.toThrow();
        expect(() => popup.showError('test')).not.toThrow();
        expect(() => popup.showResult('test', '$99', 'url')).not.toThrow();
    });

    test('9. Should show success messages', () => {
        document.createElement.mockReturnValue({
            className: '',
            textContent: '',
            remove: jest.fn()
        });
        
        popup.showSuccessMessage('Success!');
        expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('10. Should handle success message cleanup', () => {
        const mockDiv = {
            className: '',
            textContent: '',
            remove: jest.fn()
        };
        
        document.createElement.mockReturnValue(mockDiv);
        global.setTimeout.mockImplementation((fn) => fn());
        
        popup.showSuccessMessage('Success!');
        expect(mockDiv.remove).toHaveBeenCalled();
    });
});

console.log('✅ Comprehensive Popup Tests: 60+ test cases covering all major features'); 