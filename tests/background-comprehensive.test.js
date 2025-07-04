/**
 * Comprehensive Unit Tests for Background Script
 * Minimum 10 test cases per feature
 */

// Mock Chrome APIs
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn(),
        onInstalled: {
            addListener: jest.fn()
        }
    },
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
        sendMessage: jest.fn(),
        create: jest.fn(),
        onUpdated: {
            addListener: jest.fn()
        }
    },
    alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        clearAll: jest.fn(),
        get: jest.fn(),
        getAll: jest.fn(),
        onAlarm: {
            addListener: jest.fn()
        }
    },
    notifications: {
        create: jest.fn(),
        clear: jest.fn(),
        onClicked: {
            addListener: jest.fn()
        }
    }
};

// Load dependencies
require('../config.js');
require('../background.js');

describe('🔄 Price Tracking Tests', () => {
    let backgroundScript;

    beforeEach(() => {
        jest.clearAllMocks();
        backgroundScript = new ShoppingBackgroundScript();
    });

    test('1. Should start price tracking for new product', async () => {
        const product = {
            id: 'test-123',
            title: 'Test Product',
            price: '$99.99',
            url: 'https://example.com/product'
        };

        chrome.storage.local.set.mockResolvedValue();
        chrome.alarms.create.mockImplementation();

        await backgroundScript.startPriceTracking(product);

        expect(chrome.storage.local.set).toHaveBeenCalled();
        expect(chrome.alarms.create).toHaveBeenCalledWith(
            `price-check-${product.id}`,
            { periodInMinutes: 60 }
        );
    });

    test('2. Should stop price tracking for product', async () => {
        const productId = 'test-123';

        chrome.storage.local.get.mockResolvedValue({
            price_tracking_data: {
                [productId]: { isTracking: true }
            }
        });
        chrome.storage.local.set.mockResolvedValue();
        chrome.alarms.clear.mockImplementation();

        await backgroundScript.stopPriceTracking(productId);

        expect(chrome.alarms.clear).toHaveBeenCalledWith(`price-check-${productId}`);
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('3. Should check price for single product', async () => {
        const productId = 'test-123';
        const product = {
            id: productId,
            url: 'https://example.com/product',
            price: '$99.99'
        };

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [product],
            price_tracking_data: {
                [productId]: { 
                    priceHistory: [{ price: 99.99, timestamp: Date.now() }],
                    lastChecked: Date.now() - 3600000 // 1 hour ago
                }
            }
        });

        chrome.tabs.create.mockImplementation((options, callback) => {
            callback({ id: 123 });
        });

        chrome.tabs.sendMessage.mockResolvedValue({ price: '$89.99' });

        await backgroundScript.checkPriceForProduct(productId);

        expect(chrome.tabs.create).toHaveBeenCalled();
        expect(chrome.tabs.sendMessage).toHaveBeenCalled();
    });

    test('4. Should detect price drops', async () => {
        const productId = 'test-123';
        const oldPrice = 99.99;
        const newPrice = 89.99;

        const result = backgroundScript.detectPriceChange(oldPrice, newPrice);

        expect(result.hasChanged).toBe(true);
        expect(result.changeType).toBe('decrease');
        expect(result.percentageChange).toBe(-10);
    });

    test('5. Should detect price increases', async () => {
        const oldPrice = 99.99;
        const newPrice = 109.99;

        const result = backgroundScript.detectPriceChange(oldPrice, newPrice);

        expect(result.hasChanged).toBe(true);
        expect(result.changeType).toBe('increase');
        expect(result.percentageChange).toBe(10);
    });

    test('6. Should handle no price change', async () => {
        const oldPrice = 99.99;
        const newPrice = 99.99;

        const result = backgroundScript.detectPriceChange(oldPrice, newPrice);

        expect(result.hasChanged).toBe(false);
        expect(result.changeType).toBe('none');
        expect(result.percentageChange).toBe(0);
    });

    test('7. Should update price history', async () => {
        const productId = 'test-123';
        const newPrice = 89.99;

        chrome.storage.local.get.mockResolvedValue({
            price_tracking_data: {
                [productId]: {
                    priceHistory: [{ price: 99.99, timestamp: Date.now() - 3600000 }]
                }
            }
        });

        chrome.storage.local.set.mockResolvedValue();

        await backgroundScript.updatePriceHistory(productId, newPrice);

        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('8. Should handle price tracking errors', async () => {
        const productId = 'test-123';

        chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await backgroundScript.checkPriceForProduct(productId);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('9. Should limit price history size', async () => {
        const productId = 'test-123';
        const maxHistorySize = 100;

        // Create history with more than max size
        const largeHistory = Array(150).fill().map((_, i) => ({
            price: 99.99 + i,
            timestamp: Date.now() - i * 3600000
        }));

        chrome.storage.local.get.mockResolvedValue({
            price_tracking_data: {
                [productId]: { priceHistory: largeHistory }
            }
        });

        chrome.storage.local.set.mockResolvedValue();

        await backgroundScript.updatePriceHistory(productId, 89.99);

        const setCall = chrome.storage.local.set.mock.calls[0][0];
        const updatedHistory = setCall.price_tracking_data[productId].priceHistory;

        expect(updatedHistory.length).toBeLessThanOrEqual(maxHistorySize);
    });

    test('10. Should handle multiple concurrent price checks', async () => {
        const productIds = ['test-1', 'test-2', 'test-3'];

        chrome.storage.local.get.mockResolvedValue({
            saved_products: productIds.map(id => ({
                id,
                url: `https://example.com/product-${id}`,
                price: '$99.99'
            }))
        });

        chrome.tabs.create.mockImplementation((options, callback) => {
            callback({ id: Math.random() });
        });

        chrome.tabs.sendMessage.mockResolvedValue({ price: '$89.99' });

        const promises = productIds.map(id => backgroundScript.checkPriceForProduct(id));
        await Promise.all(promises);

        expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
    });
});

describe('🔔 Notification System Tests', () => {
    let backgroundScript;

    beforeEach(() => {
        jest.clearAllMocks();
        backgroundScript = new ShoppingBackgroundScript();
    });

    test('1. Should create price drop notification', async () => {
        const product = {
            id: 'test-123',
            title: 'Test Product',
            price: '$89.99'
        };
        const oldPrice = 99.99;
        const newPrice = 89.99;

        chrome.notifications.create.mockImplementation();

        await backgroundScript.createPriceDropNotification(product, oldPrice, newPrice);

        expect(chrome.notifications.create).toHaveBeenCalledWith(
            `price-drop-${product.id}`,
            expect.objectContaining({
                type: 'basic',
                iconUrl: expect.any(String),
                title: expect.stringContaining('Price Drop'),
                message: expect.stringContaining(product.title)
            })
        );
    });

    test('2. Should create price increase notification', async () => {
        const product = {
            id: 'test-123',
            title: 'Test Product',
            price: '$109.99'
        };
        const oldPrice = 99.99;
        const newPrice = 109.99;

        chrome.notifications.create.mockImplementation();

        await backgroundScript.createPriceIncreaseNotification(product, oldPrice, newPrice);

        expect(chrome.notifications.create).toHaveBeenCalledWith(
            `price-increase-${product.id}`,
            expect.objectContaining({
                type: 'basic',
                title: expect.stringContaining('Price Increase'),
                message: expect.stringContaining(product.title)
            })
        );
    });

    test('3. Should handle notification click', async () => {
        const notificationId = 'price-drop-test-123';
        const productId = 'test-123';

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [{
                id: productId,
                url: 'https://example.com/product'
            }]
        });

        chrome.tabs.create.mockImplementation();

        await backgroundScript.handleNotificationClick(notificationId);

        expect(chrome.tabs.create).toHaveBeenCalledWith({
            url: 'https://example.com/product'
        });
    });

    test('4. Should clear old notifications', async () => {
        const notificationIds = ['old-1', 'old-2', 'old-3'];

        chrome.notifications.clear.mockImplementation();

        await backgroundScript.clearOldNotifications(notificationIds);

        expect(chrome.notifications.clear).toHaveBeenCalledTimes(3);
    });

    test('5. Should format notification message', () => {
        const product = { title: 'Test Product' };
        const oldPrice = 99.99;
        const newPrice = 89.99;
        const savings = 10;

        const message = backgroundScript.formatNotificationMessage(product, oldPrice, newPrice, savings);

        expect(message).toContain(product.title);
        expect(message).toContain('$89.99');
        expect(message).toContain('$10');
    });

    test('6. Should handle notification errors', async () => {
        const product = { id: 'test-123', title: 'Test Product' };

        chrome.notifications.create.mockImplementation((id, options, callback) => {
            callback();
            chrome.runtime.lastError = { message: 'Notification error' };
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await backgroundScript.createPriceDropNotification(product, 99.99, 89.99);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('7. Should throttle notification frequency', async () => {
        const product = { id: 'test-123', title: 'Test Product' };

        // Mock recent notification
        chrome.storage.local.get.mockResolvedValue({
            notification_history: {
                [product.id]: Date.now() - 1000 // 1 second ago
            }
        });

        chrome.notifications.create.mockImplementation();

        await backgroundScript.createPriceDropNotification(product, 99.99, 89.99);

        // Should not create notification due to throttling
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });

    test('8. Should allow notifications after throttle period', async () => {
        const product = { id: 'test-123', title: 'Test Product' };

        // Mock old notification
        chrome.storage.local.get.mockResolvedValue({
            notification_history: {
                [product.id]: Date.now() - 3600000 // 1 hour ago
            }
        });

        chrome.notifications.create.mockImplementation();

        await backgroundScript.createPriceDropNotification(product, 99.99, 89.99);

        expect(chrome.notifications.create).toHaveBeenCalled();
    });

    test('9. Should handle notification permissions', async () => {
        // Mock permission denied
        chrome.notifications.create.mockImplementation((id, options, callback) => {
            chrome.runtime.lastError = { message: 'Permission denied' };
            callback();
        });

        const product = { id: 'test-123', title: 'Test Product' };

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        await backgroundScript.createPriceDropNotification(product, 99.99, 89.99);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('10. Should batch multiple notifications', async () => {
        const products = [
            { id: 'test-1', title: 'Product 1' },
            { id: 'test-2', title: 'Product 2' },
            { id: 'test-3', title: 'Product 3' }
        ];

        chrome.notifications.create.mockImplementation();

        const promises = products.map(product => 
            backgroundScript.createPriceDropNotification(product, 99.99, 89.99)
        );

        await Promise.all(promises);

        expect(chrome.notifications.create).toHaveBeenCalledTimes(3);
    });
});

describe('⏰ Alarm Management Tests', () => {
    let backgroundScript;

    beforeEach(() => {
        jest.clearAllMocks();
        backgroundScript = new ShoppingBackgroundScript();
    });

    test('1. Should create periodic price check alarm', () => {
        const productId = 'test-123';
        const intervalMinutes = 60;

        chrome.alarms.create.mockImplementation();

        backgroundScript.createPriceCheckAlarm(productId, intervalMinutes);

        expect(chrome.alarms.create).toHaveBeenCalledWith(
            `price-check-${productId}`,
            { periodInMinutes: intervalMinutes }
        );
    });

    test('2. Should clear specific alarm', () => {
        const productId = 'test-123';

        chrome.alarms.clear.mockImplementation();

        backgroundScript.clearPriceCheckAlarm(productId);

        expect(chrome.alarms.clear).toHaveBeenCalledWith(`price-check-${productId}`);
    });

    test('3. Should clear all alarms', () => {
        chrome.alarms.clearAll.mockImplementation();

        backgroundScript.clearAllAlarms();

        expect(chrome.alarms.clearAll).toHaveBeenCalled();
    });

    test('4. Should handle alarm events', async () => {
        const alarm = { name: 'price-check-test-123' };

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [{
                id: 'test-123',
                url: 'https://example.com/product'
            }]
        });

        const checkPriceSpy = jest.spyOn(backgroundScript, 'checkPriceForProduct').mockResolvedValue();

        await backgroundScript.handleAlarm(alarm);

        expect(checkPriceSpy).toHaveBeenCalledWith('test-123');
    });

    test('5. Should ignore non-price-check alarms', async () => {
        const alarm = { name: 'other-alarm' };

        const checkPriceSpy = jest.spyOn(backgroundScript, 'checkPriceForProduct');

        await backgroundScript.handleAlarm(alarm);

        expect(checkPriceSpy).not.toHaveBeenCalled();
    });

    test('6. Should get all active alarms', async () => {
        const mockAlarms = [
            { name: 'price-check-test-1', periodInMinutes: 60 },
            { name: 'price-check-test-2', periodInMinutes: 60 }
        ];

        chrome.alarms.getAll.mockImplementation((callback) => {
            callback(mockAlarms);
        });

        const alarms = await backgroundScript.getAllActiveAlarms();

        expect(alarms).toEqual(mockAlarms);
    });

    test('7. Should handle alarm creation errors', () => {
        const productId = 'test-123';

        chrome.alarms.create.mockImplementation(() => {
            chrome.runtime.lastError = { message: 'Alarm creation failed' };
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        backgroundScript.createPriceCheckAlarm(productId, 60);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('8. Should validate alarm intervals', () => {
        const productId = 'test-123';
        const invalidInterval = 0;

        chrome.alarms.create.mockImplementation();

        backgroundScript.createPriceCheckAlarm(productId, invalidInterval);

        // Should use default interval
        expect(chrome.alarms.create).toHaveBeenCalledWith(
            `price-check-${productId}`,
            { periodInMinutes: 60 }
        );
    });

    test('9. Should handle multiple alarm operations', async () => {
        const productIds = ['test-1', 'test-2', 'test-3'];

        chrome.alarms.create.mockImplementation();

        productIds.forEach(id => {
            backgroundScript.createPriceCheckAlarm(id, 60);
        });

        expect(chrome.alarms.create).toHaveBeenCalledTimes(3);
    });

    test('10. Should cleanup orphaned alarms', async () => {
        const mockAlarms = [
            { name: 'price-check-deleted-product' },
            { name: 'price-check-active-product' }
        ];

        chrome.alarms.getAll.mockImplementation((callback) => {
            callback(mockAlarms);
        });

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [{ id: 'active-product' }]
        });

        chrome.alarms.clear.mockImplementation();

        await backgroundScript.cleanupOrphanedAlarms();

        expect(chrome.alarms.clear).toHaveBeenCalledWith('price-check-deleted-product');
    });
});

describe('📨 Message Handling Tests', () => {
    let backgroundScript;

    beforeEach(() => {
        jest.clearAllMocks();
        backgroundScript = new ShoppingBackgroundScript();
    });

    test('1. Should handle startTracking message', async () => {
        const message = {
            action: 'startTracking',
            data: { id: 'test-123', title: 'Test Product' }
        };
        const mockSendResponse = jest.fn();

        chrome.storage.local.set.mockResolvedValue();
        chrome.alarms.create.mockImplementation();

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('2. Should handle stopTracking message', async () => {
        const message = {
            action: 'stopTracking',
            data: { productId: 'test-123' }
        };
        const mockSendResponse = jest.fn();

        chrome.storage.local.get.mockResolvedValue({
            price_tracking_data: { 'test-123': { isTracking: true } }
        });
        chrome.storage.local.set.mockResolvedValue();
        chrome.alarms.clear.mockImplementation();

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('3. Should handle checkPrices message', async () => {
        const message = { action: 'checkPrices' };
        const mockSendResponse = jest.fn();

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [{ id: 'test-123' }]
        });

        const checkPriceSpy = jest.spyOn(backgroundScript, 'checkPriceForProduct').mockResolvedValue();

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(checkPriceSpy).toHaveBeenCalledWith('test-123');
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('4. Should handle getTrackingData message', async () => {
        const message = { action: 'getTrackingData' };
        const mockSendResponse = jest.fn();

        const mockData = { 'test-123': { priceHistory: [] } };
        chrome.storage.local.get.mockResolvedValue({
            price_tracking_data: mockData
        });

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
            success: true,
            data: mockData
        });
    });

    test('5. Should handle unknown message types', async () => {
        const message = { action: 'unknownAction' };
        const mockSendResponse = jest.fn();

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
            success: false,
            error: 'Unknown action: unknownAction'
        });
    });

    test('6. Should handle malformed messages', async () => {
        const message = null;
        const mockSendResponse = jest.fn();

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
            success: false,
            error: 'Invalid message format'
        });
    });

    test('7. Should handle message processing errors', async () => {
        const message = { action: 'startTracking', data: { id: 'test-123' } };
        const mockSendResponse = jest.fn();

        chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
            success: false,
            error: 'Storage error'
        });
    });

    test('8. Should validate message sender', async () => {
        const message = { action: 'startTracking' };
        const sender = { id: 'invalid-extension-id' };
        const mockSendResponse = jest.fn();

        await backgroundScript.handleMessage(message, sender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized sender'
        });
    });

    test('9. Should handle async message processing', async () => {
        const message = { action: 'checkPrices' };
        const mockSendResponse = jest.fn();

        chrome.storage.local.get.mockResolvedValue({
            saved_products: [{ id: 'test-123' }]
        });

        // Mock async price check
        const checkPriceSpy = jest.spyOn(backgroundScript, 'checkPriceForProduct')
            .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

        await backgroundScript.handleMessage(message, {}, mockSendResponse);

        expect(checkPriceSpy).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('10. Should handle concurrent message processing', async () => {
        const messages = [
            { action: 'startTracking', data: { id: 'test-1' } },
            { action: 'startTracking', data: { id: 'test-2' } },
            { action: 'startTracking', data: { id: 'test-3' } }
        ];

        const mockSendResponse = jest.fn();
        chrome.storage.local.set.mockResolvedValue();
        chrome.alarms.create.mockImplementation();

        const promises = messages.map(message => 
            backgroundScript.handleMessage(message, {}, mockSendResponse)
        );

        await Promise.all(promises);

        expect(mockSendResponse).toHaveBeenCalledTimes(3);
    });
});

console.log('✅ Comprehensive Background Script Tests: 30+ test cases covering all major features'); 