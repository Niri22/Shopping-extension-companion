/**
 * Price Tracker Tests
 * Tests daily price checking, price comparison, and price drop detection
 */

// Mock Chrome APIs
global.chrome = {
    alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        onAlarm: {
            addListener: jest.fn()
        }
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    tabs: {
        create: jest.fn(),
        remove: jest.fn(),
        sendMessage: jest.fn()
    },
    runtime: {
        getManifest: jest.fn(() => ({ version: '1.1.0' }))
    }
};

// Mock ExtensionConfig
global.ExtensionConfig = {
    storage: {
        keys: {
            productList: 'saved_products'
        }
    }
};

// Import the PriceTracker class
const PriceTracker = require('../services/PriceTracker.js');

describe('PriceTracker Service', () => {
    let priceTracker;

    beforeEach(() => {
        jest.clearAllMocks();
        priceTracker = new PriceTracker();
    });

    describe('Initialization', () => {
        test('should initialize with correct properties', () => {
            expect(priceTracker.alarmName).toBe('dailyPriceCheck');
            expect(priceTracker.storageKey).toBe('price_tracking_data');
        });

        test('should set up daily alarm correctly', async () => {
            await priceTracker.setupDailyAlarm();

            expect(chrome.alarms.clear).toHaveBeenCalledWith('dailyPriceCheck');
            expect(chrome.alarms.create).toHaveBeenCalledWith('dailyPriceCheck', {
                delayInMinutes: 1440,
                periodInMinutes: 1440
            });
        });

        test('should handle alarm setup errors gracefully', async () => {
            chrome.alarms.create.mockRejectedValue(new Error('Alarm setup failed'));

            await expect(priceTracker.setupDailyAlarm()).resolves.not.toThrow();
        });

        test('should set up alarm listener', () => {
            priceTracker.setupAlarmListener();
            expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
        });
    });

    describe('Price Extraction and Comparison', () => {
        test('should extract numeric price correctly', () => {
            expect(priceTracker.extractNumericPrice('$29.99')).toBe(29.99);
            expect(priceTracker.extractNumericPrice('€45.50')).toBe(45.50);
            expect(priceTracker.extractNumericPrice('£19.95')).toBe(19.95);
            expect(priceTracker.extractNumericPrice('¥1000')).toBe(1000);
            expect(priceTracker.extractNumericPrice('$1,299.99')).toBe(1299.99);
            expect(priceTracker.extractNumericPrice('€1,500')).toBe(1500);
            expect(priceTracker.extractNumericPrice('29,99')).toBe(29.99); // European format
            // Canadian dollar formats
            expect(priceTracker.extractNumericPrice('CA$129')).toBe(129);
            expect(priceTracker.extractNumericPrice('CA$99.99')).toBe(99.99);
            expect(priceTracker.extractNumericPrice('CA$1,299.99')).toBe(1299.99);
            // Other prefixed currencies
            expect(priceTracker.extractNumericPrice('US$149')).toBe(149);
            expect(priceTracker.extractNumericPrice('AU$89.50')).toBe(89.50);
        });

        test('should handle invalid price strings', () => {
            expect(priceTracker.extractNumericPrice(null)).toBe(0);
            expect(priceTracker.extractNumericPrice('')).toBe(0);
            expect(priceTracker.extractNumericPrice('invalid')).toBe(0);
            expect(priceTracker.extractNumericPrice('No price found')).toBe(0);
        });

        test('should compare prices correctly for no change', () => {
            const result = priceTracker.comparePrices('$29.99', '$29.99');
            
            expect(result.changed).toBe(false);
            expect(result.dropped).toBe(false);
            expect(result.difference).toBe(0);
        });

        test('should detect price drops', () => {
            const result = priceTracker.comparePrices('$39.99', '$29.99');
            
            expect(result.changed).toBe(true);
            expect(result.dropped).toBe(true);
            expect(result.difference).toBeCloseTo(10, 2);
        });

        test('should detect price increases', () => {
            const result = priceTracker.comparePrices('$29.99', '$39.99');
            
            expect(result.changed).toBe(true);
            expect(result.dropped).toBe(false);
            expect(result.difference).toBeCloseTo(10, 2);
        });

        test('should handle small price changes (less than 1 cent)', () => {
            const result = priceTracker.comparePrices('$29.99', '$29.995');
            
            expect(result.changed).toBe(false);
            expect(result.dropped).toBe(false);
        });

        test('should handle invalid prices in comparison', () => {
            const result1 = priceTracker.comparePrices(null, '$29.99');
            const result2 = priceTracker.comparePrices('$29.99', null);
            const result3 = priceTracker.comparePrices('No price found', '$29.99');
            
            expect(result1.changed).toBe(false);
            expect(result2.changed).toBe(false);
            expect(result3.changed).toBe(false);
        });
    });

    describe('Storage Operations', () => {
        const mockProducts = [
            {
                id: 'product1',
                title: 'Test Product 1',
                price: '$29.99',
                url: 'https://example.com/product1',
                dateAdded: '2024-01-01T10:00:00.000Z'
            },
            {
                id: 'product2',
                title: 'Test Product 2',
                price: '$49.99',
                url: 'https://example.com/product2',
                dateAdded: '2024-01-02T10:00:00.000Z'
            }
        ];

        test('should get products from storage', async () => {
            chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

            const products = await priceTracker.getProducts();

            expect(products).toEqual(mockProducts);
            expect(chrome.storage.local.get).toHaveBeenCalledWith(['saved_products']);
        });

        test('should handle empty products list', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const products = await priceTracker.getProducts();

            expect(products).toEqual([]);
        });

        test('should handle storage errors when getting products', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const products = await priceTracker.getProducts();

            expect(products).toEqual([]);
        });

        test('should save products to storage', async () => {
            chrome.storage.local.set.mockResolvedValue();

            await priceTracker.saveProducts(mockProducts);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                saved_products: mockProducts
            });
        });

        test('should get tracking data from storage', async () => {
            const mockTrackingData = { product1: { checks: [] } };
            chrome.storage.local.get.mockResolvedValue({ price_tracking_data: mockTrackingData });

            const data = await priceTracker.getTrackingData();

            expect(data).toEqual(mockTrackingData);
        });

        test('should save tracking data to storage', async () => {
            const trackingData = { product1: { checks: [] } };
            chrome.storage.local.set.mockResolvedValue();

            await priceTracker.saveTrackingData(trackingData);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                price_tracking_data: trackingData
            });
        });
    });

    describe('Price Checking Operations', () => {
        const mockProduct = {
            id: 'product1',
            title: 'Test Product',
            price: '$39.99',
            url: 'https://example.com/product',
            dateAdded: '2024-01-01T10:00:00.000Z'
        };

        test('should extract price from tab successfully', async () => {
            const mockResponse = { price: '$29.99' };
            chrome.tabs.sendMessage.mockResolvedValue(mockResponse);

            // Mock the delay function to avoid actual delays
            jest.spyOn(priceTracker, 'delay').mockResolvedValue();

            const price = await priceTracker.extractPriceFromTab(123);

            expect(price).toBe('$29.99');
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
                action: 'getProductPrice'
            });
        }, 5000);

        test('should handle failed price extraction from tab', async () => {
            chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

            // Mock the delay function to avoid actual delays
            jest.spyOn(priceTracker, 'delay').mockResolvedValue();

            const price = await priceTracker.extractPriceFromTab(123);

            expect(price).toBeNull();
        }, 5000);

        test('should handle no price found response', async () => {
            chrome.tabs.sendMessage.mockResolvedValue({ price: 'No price found' });

            // Mock the delay function to avoid actual delays
            jest.spyOn(priceTracker, 'delay').mockResolvedValue();

            const price = await priceTracker.extractPriceFromTab(123);

            expect(price).toBeNull();
        }, 5000);

        test('should check product price successfully', async () => {
            const mockTab = { id: 123 };
            chrome.tabs.create.mockResolvedValue(mockTab);
            chrome.tabs.sendMessage.mockResolvedValue({ price: '$29.99' });
            chrome.tabs.remove.mockResolvedValue();

            // Mock the delay function to avoid actual delays
            jest.spyOn(priceTracker, 'delay').mockResolvedValue();

            const result = await priceTracker.checkProductPrice(mockProduct);

            expect(result.success).toBe(true);
            expect(result.productId).toBe('product1');
            expect(result.originalPrice).toBe('$39.99');
            expect(result.currentPrice).toBe('$29.99');
            expect(result.priceDropped).toBe(true);
            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'https://example.com/product',
                active: false
            });
            expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
        }, 5000);

        test('should handle errors during product price check', async () => {
            chrome.tabs.create.mockRejectedValue(new Error('Failed to create tab'));

            await expect(priceTracker.checkProductPrice(mockProduct)).rejects.toThrow('Failed to create tab');
        });
    });

    describe('Daily Price Check Process', () => {
        test('should handle empty product list', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            await priceTracker.performDailyPriceCheck();

            expect(chrome.storage.local.get).toHaveBeenCalled();
            // Should not attempt to check any prices
            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });

        test('should process multiple products', async () => {
            const mockProducts = [
                {
                    id: 'product1',
                    title: 'Product 1',
                    price: '$29.99',
                    url: 'https://example.com/product1'
                },
                {
                    id: 'product2',
                    title: 'Product 2',
                    price: '$49.99',
                    url: 'https://example.com/product2'
                }
            ];

            chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });
            chrome.tabs.create.mockResolvedValue({ id: 123 });
            chrome.tabs.sendMessage.mockResolvedValue({ price: '$25.99' });
            chrome.tabs.remove.mockResolvedValue();
            chrome.storage.local.set.mockResolvedValue();

            // Mock the delay function to avoid actual delays
            jest.spyOn(priceTracker, 'delay').mockResolvedValue();

            await priceTracker.performDailyPriceCheck();

            expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
            expect(chrome.tabs.remove).toHaveBeenCalledTimes(2);
        }, 10000);
    });

    describe('Price History and Analysis', () => {
        test('should get price history for a product', async () => {
            const mockProducts = [{
                id: 'product1',
                title: 'Test Product',
                priceHistory: [
                    { price: '$39.99', date: '2024-01-01', dropped: false },
                    { price: '$29.99', date: '2024-01-02', dropped: true }
                ]
            }];

            chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

            const history = await priceTracker.getProductPriceHistory('product1');

            expect(history).toHaveLength(2);
            expect(history[1].dropped).toBe(true);
        });

        test('should return empty history for non-existent product', async () => {
            chrome.storage.local.get.mockResolvedValue({ saved_products: [] });

            const history = await priceTracker.getProductPriceHistory('nonexistent');

            expect(history).toEqual([]);
        });

        test('should get products with recent price drops', async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

            const mockProducts = [
                {
                    id: 'product1',
                    title: 'Product with drop',
                    priceHistory: [
                        { price: '$29.99', date: recentDate.toISOString(), dropped: true }
                    ]
                },
                {
                    id: 'product2',
                    title: 'Product without drop',
                    priceHistory: [
                        { price: '$49.99', date: recentDate.toISOString(), dropped: false }
                    ]
                }
            ];

            chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

            const productsWithDrops = await priceTracker.getProductsWithPriceDrops(7);

            expect(productsWithDrops).toHaveLength(1);
            expect(productsWithDrops[0].id).toBe('product1');
        });

        test('should filter out old price drops', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

            const mockProducts = [{
                id: 'product1',
                title: 'Product with old drop',
                priceHistory: [
                    { price: '$29.99', date: oldDate.toISOString(), dropped: true }
                ]
            }];

            chrome.storage.local.get.mockResolvedValue({ saved_products: mockProducts });

            const productsWithDrops = await priceTracker.getProductsWithPriceDrops(7);

            expect(productsWithDrops).toHaveLength(0);
        });
    });

    describe('Result Processing', () => {
        test('should process check results and update products', async () => {
            const mockProducts = [{
                id: 'product1',
                title: 'Test Product',
                price: '$39.99',
                priceHistory: []
            }];

            const mockResults = [{
                productId: 'product1',
                success: true,
                originalPrice: '$39.99',
                currentPrice: '$29.99',
                priceChanged: true,
                priceDropped: true,
                priceDifference: 10,
                checkDate: '2024-01-15T10:00:00.000Z'
            }];

            chrome.storage.local.get
                .mockResolvedValueOnce({ saved_products: mockProducts }) // getProducts call
                .mockResolvedValueOnce({}); // getTrackingData call

            chrome.storage.local.set.mockResolvedValue();

            await priceTracker.processCheckResults(mockResults);

            // Verify product was updated
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                saved_products: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'product1',
                        price: '$29.99',
                        lastPriceUpdate: '2024-01-15T10:00:00.000Z',
                        priceHistory: expect.arrayContaining([
                            expect.objectContaining({
                                price: '$29.99',
                                dropped: true
                            })
                        ])
                    })
                ])
            });

            // Verify tracking data was saved
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                price_tracking_data: expect.objectContaining({
                    product1: expect.objectContaining({
                        checks: expect.arrayContaining([
                            expect.objectContaining({
                                priceDropped: true,
                                difference: 10
                            })
                        ])
                    })
                })
            });
        });

        test('should limit price history to 10 entries', async () => {
            const longHistory = Array.from({ length: 12 }, (_, i) => ({
                price: `$${30 + i}.99`,
                date: `2024-01-${i + 1}T10:00:00.000Z`,
                dropped: i % 2 === 0
            }));

            const mockProducts = [{
                id: 'product1',
                title: 'Test Product',
                price: '$39.99',
                priceHistory: longHistory
            }];

            const mockResults = [{
                productId: 'product1',
                success: true,
                currentPrice: '$25.99',
                priceChanged: true,
                priceDropped: true,
                checkDate: '2024-01-15T10:00:00.000Z'
            }];

            chrome.storage.local.get
                .mockResolvedValueOnce({ saved_products: mockProducts })
                .mockResolvedValueOnce({});

            chrome.storage.local.set.mockResolvedValue();

            await priceTracker.processCheckResults(mockResults);

            const savedProducts = chrome.storage.local.set.mock.calls[0][0].saved_products;
            expect(savedProducts[0].priceHistory).toHaveLength(10);
        });

        test('should skip failed check results', async () => {
            const mockProducts = [{
                id: 'product1',
                title: 'Test Product',
                price: '$39.99'
            }];

            const mockResults = [{
                productId: 'product1',
                success: false,
                error: 'Failed to check price'
            }];

            chrome.storage.local.get
                .mockResolvedValueOnce({ saved_products: mockProducts })
                .mockResolvedValueOnce({});

            chrome.storage.local.set.mockResolvedValue();

            await priceTracker.processCheckResults(mockResults);

            // Product should not be updated
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                saved_products: mockProducts // Unchanged
            });
        });
    });

    describe('Manual Operations', () => {
        test('should trigger manual price check', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            await priceTracker.triggerManualCheck();

            expect(chrome.storage.local.get).toHaveBeenCalled();
        });

        test('should provide delay utility', async () => {
            const start = Date.now();
            await priceTracker.delay(100);
            const end = Date.now();

            expect(end - start).toBeGreaterThanOrEqual(100);
        });
    });
}); 