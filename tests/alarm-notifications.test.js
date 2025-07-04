/**
 * Alarm Notifications Tests
 * Tests the alarm-based price tracking and notification system
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
    notifications: {
        create: jest.fn(),
        getPermissionLevel: jest.fn()
    },
    runtime: {
        lastError: null
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

describe('Alarm Notification System', () => {
    let priceTracker;

    beforeEach(() => {
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
        priceTracker = new PriceTracker();
    });

    describe('Alarm Setup', () => {
        test('should initialize with correct alarm name and storage key', () => {
            expect(priceTracker.alarmName).toBe('productionPriceCheck');
            expect(priceTracker.storageKey).toBe('price_tracking_data');
        });

        test('should set up 12-hour production alarm correctly', async () => {
            await priceTracker.setupProductionAlarm();

            expect(chrome.alarms.clear).toHaveBeenCalledWith('productionPriceCheck');
            expect(chrome.alarms.create).toHaveBeenCalledWith('productionPriceCheck', {
                delayInMinutes: 720,  // 12 hours
                periodInMinutes: 720  // 12 hours
            });
        });

        test('should handle alarm setup errors gracefully', async () => {
            chrome.alarms.create.mockRejectedValue(new Error('Alarm setup failed'));

            await expect(priceTracker.setupProductionAlarm()).resolves.not.toThrow();
        });

        test('should set up alarm listener', () => {
            priceTracker.setupAlarmListener();
            expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
        });
    });

    describe('Price Check Logic', () => {
        beforeEach(() => {
            // Mock the methods that performPriceCheck calls
            priceTracker.getProducts = jest.fn();
            priceTracker.getTrackingData = jest.fn();
            priceTracker.checkProductForSamePrice = jest.fn();
        });

        test('should handle empty product list', async () => {
            priceTracker.getProducts.mockResolvedValue([]);

            await priceTracker.performPriceCheck();

            expect(priceTracker.getProducts).toHaveBeenCalled();
            expect(priceTracker.getTrackingData).not.toHaveBeenCalled();
        });

        test('should check all products when products exist', async () => {
            const mockProducts = [
                { id: 'p1', title: 'Product 1', price: '$99.99' },
                { id: 'p2', title: 'Product 2', price: '$199.99' }
            ];
            
            priceTracker.getProducts.mockResolvedValue(mockProducts);
            priceTracker.getTrackingData.mockResolvedValue({});

            await priceTracker.performPriceCheck();

            expect(priceTracker.getProducts).toHaveBeenCalled();
            expect(priceTracker.getTrackingData).toHaveBeenCalled();
            expect(priceTracker.checkProductForSamePrice).toHaveBeenCalledTimes(2);
            expect(priceTracker.checkProductForSamePrice).toHaveBeenCalledWith(mockProducts[0], {});
            expect(priceTracker.checkProductForSamePrice).toHaveBeenCalledWith(mockProducts[1], {});
        });

        test('should handle price check errors gracefully', async () => {
            priceTracker.getProducts.mockRejectedValue(new Error('Storage error'));

            await expect(priceTracker.performPriceCheck()).resolves.not.toThrow();
        });
    });

    describe('Same Price Detection', () => {
        beforeEach(() => {
            priceTracker.sendSamePriceNotification = jest.fn();
            priceTracker.saveTrackingData = jest.fn();
        });

        test('should send notification when price remains the same', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$99.99' };
            const trackingData = {
                'p1': {
                    lastPrice: '$99.99',
                    lastCheckTime: '2024-01-01T10:00:00.000Z',
                    sameCount: 2
                }
            };

            await priceTracker.checkProductForSamePrice(product, trackingData);

            expect(priceTracker.sendSamePriceNotification).toHaveBeenCalledWith(product, '$99.99');
            expect(priceTracker.saveTrackingData).toHaveBeenCalled();
            
            // Check that tracking data was updated
            const saveCall = priceTracker.saveTrackingData.mock.calls[0][0];
            expect(saveCall['p1'].samePrice).toBe(true);
            expect(saveCall['p1'].sameCount).toBe(3);
        });

        test('should not send notification when price changes', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$89.99' };
            const trackingData = {
                'p1': {
                    lastPrice: '$99.99',
                    lastCheckTime: '2024-01-01T10:00:00.000Z',
                    sameCount: 2
                }
            };

            await priceTracker.checkProductForSamePrice(product, trackingData);

            expect(priceTracker.sendSamePriceNotification).not.toHaveBeenCalled();
            expect(priceTracker.saveTrackingData).toHaveBeenCalled();
            
            // Check that tracking data was updated for price change
            const saveCall = priceTracker.saveTrackingData.mock.calls[0][0];
            expect(saveCall['p1'].lastPrice).toBe('$89.99');
            expect(saveCall['p1'].samePrice).toBe(false);
            expect(saveCall['p1'].sameCount).toBe(0);
        });

        test('should handle first-time product check', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$99.99' };
            const trackingData = {};

            await priceTracker.checkProductForSamePrice(product, trackingData);

            // Should send notification for first-time (for testing purposes)
            expect(priceTracker.sendSamePriceNotification).toHaveBeenCalledWith(product, '$99.99');
            expect(priceTracker.saveTrackingData).toHaveBeenCalled();
            
            // Check that tracking data was created
            const saveCall = priceTracker.saveTrackingData.mock.calls[0][0];
            expect(saveCall['p1'].lastPrice).toBe('$99.99');
            expect(saveCall['p1'].samePrice).toBe(false);
            expect(saveCall['p1'].sameCount).toBe(0);
        });

        test('should handle product check errors gracefully', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$99.99' };
            const trackingData = {};
            
            priceTracker.saveTrackingData.mockRejectedValue(new Error('Storage error'));

            await expect(priceTracker.checkProductForSamePrice(product, trackingData)).resolves.not.toThrow();
        });
    });

    describe('Notification Creation', () => {
        test('should create notification with correct options', async () => {
            const product = { id: 'p1', title: 'Test Laptop', price: '$999.99' };
            
            chrome.notifications.create.mockImplementation((id, options, callback) => {
                callback(id);
            });
            chrome.notifications.getPermissionLevel.mockImplementation((callback) => {
                callback('granted');
            });

            await priceTracker.sendSamePriceNotification(product, '$999.99');

            expect(chrome.notifications.create).toHaveBeenCalled();
            
            const createCall = chrome.notifications.create.mock.calls[0];
            const notificationId = createCall[0];
            const options = createCall[1];
            
            expect(notificationId).toMatch(/^same-price-p1-\d+$/);
            expect(options.type).toBe('basic');
            expect(options.title).toBe('🔄 WishCart - Price Unchanged');
            expect(options.message).toContain('Test Laptop is still $999.99');
            expect(options.iconUrl).toBeDefined();
        });

        test('should handle notification creation errors', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$99.99' };
            
            chrome.runtime.lastError = { message: 'Notification failed' };
            chrome.notifications.create.mockImplementation((id, options, callback) => {
                callback(null);
            });

            await expect(priceTracker.sendSamePriceNotification(product, '$99.99')).resolves.not.toThrow();
        });

        test('should handle missing notifications API', async () => {
            const product = { id: 'p1', title: 'Test Product', price: '$99.99' };
            
            // Temporarily remove notifications API
            const originalNotifications = chrome.notifications;
            delete chrome.notifications;

            await expect(priceTracker.sendSamePriceNotification(product, '$99.99')).resolves.not.toThrow();
            
            // Restore notifications API
            chrome.notifications = originalNotifications;
        });
    });

    describe('Storage Operations', () => {
        test('should get products from storage correctly', async () => {
            const mockProducts = [
                { id: 'p1', title: 'Product 1', price: '$99.99' }
            ];
            
            chrome.storage.local.get.mockResolvedValue({
                'saved_products': mockProducts
            });

            const products = await priceTracker.getProducts();

            expect(chrome.storage.local.get).toHaveBeenCalledWith(['saved_products']);
            expect(products).toEqual(mockProducts);
        });

        test('should return empty array when no products exist', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const products = await priceTracker.getProducts();

            expect(products).toEqual([]);
        });

        test('should get tracking data from storage correctly', async () => {
            const mockTrackingData = {
                'p1': { lastPrice: '$99.99', sameCount: 1 }
            };
            
            chrome.storage.local.get.mockResolvedValue({
                'price_tracking_data': mockTrackingData
            });

            const trackingData = await priceTracker.getTrackingData();

            expect(chrome.storage.local.get).toHaveBeenCalledWith(['price_tracking_data']);
            expect(trackingData).toEqual(mockTrackingData);
        });

        test('should save tracking data correctly', async () => {
            const trackingData = {
                'p1': { lastPrice: '$99.99', sameCount: 1 }
            };

            await priceTracker.saveTrackingData(trackingData);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                'price_tracking_data': trackingData
            });
        });

        test('should handle storage errors gracefully', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const products = await priceTracker.getProducts();
            expect(products).toEqual([]);

            const trackingData = await priceTracker.getTrackingData();
            expect(trackingData).toEqual({});
        });
    });

    describe('Manual Trigger', () => {
        test('should trigger manual price check', async () => {
            priceTracker.performPriceCheck = jest.fn();

            await priceTracker.triggerManualCheck();

            expect(priceTracker.performPriceCheck).toHaveBeenCalled();
        });
    });

    describe('Integration Tests', () => {
        test('should complete full price check cycle with notifications', async () => {
            // Setup mock data
            const mockProducts = [
                { id: 'p1', title: 'Laptop', price: '$999.99' },
                { id: 'p2', title: 'Phone', price: '$799.99' }
            ];
            
            const mockTrackingData = {
                'p1': { lastPrice: '$999.99', sameCount: 0 }, // Same price - should notify
                'p2': { lastPrice: '$699.99', sameCount: 1 }  // Price changed - no notification
            };

            chrome.storage.local.get
                .mockResolvedValueOnce({ 'saved_products': mockProducts })
                .mockResolvedValueOnce({ 'price_tracking_data': mockTrackingData });
            
            chrome.notifications.create.mockImplementation((id, options, callback) => {
                callback(id);
            });
            chrome.notifications.getPermissionLevel.mockImplementation((callback) => {
                callback('granted');
            });

            await priceTracker.performPriceCheck();

            // Should check both products
            expect(chrome.storage.local.get).toHaveBeenCalledTimes(2);
            
            // Should create notification only for same price (p1), not for price change (p2)
            expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
            
            // Should save updated tracking data
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
    });
}); 