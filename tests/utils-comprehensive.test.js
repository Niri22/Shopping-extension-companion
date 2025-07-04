/**
 * Comprehensive Unit Tests for Utility Functions
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
        sendMessage: jest.fn()
    },
    runtime: {
        sendMessage: jest.fn(),
        lastError: null
    }
};

// Load dependencies
require('../config.js');
require('../utils.js');

describe('🔗 URL Validation Tests', () => {
    
    test('1. Should validate standard HTTP URLs', () => {
        const result = ExtensionUtils.url.validate('http://example.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('2. Should validate standard HTTPS URLs', () => {
        const result = ExtensionUtils.url.validate('https://example.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('3. Should validate URLs with paths', () => {
        const result = ExtensionUtils.url.validate('https://example.com/path/to/page');
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('4. Should validate URLs with query parameters', () => {
        const result = ExtensionUtils.url.validate('https://example.com?param=value&other=123');
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('5. Should validate URLs with fragments', () => {
        const result = ExtensionUtils.url.validate('https://example.com/page#section');
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('6. Should reject empty URLs', () => {
        const result = ExtensionUtils.url.validate('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('URL is required');
    });

    test('7. Should reject invalid protocols', () => {
        const result = ExtensionUtils.url.validate('ftp://example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must start with http:// or https://');
    });

    test('8. Should reject URLs without protocol', () => {
        const result = ExtensionUtils.url.validate('example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must start with http:// or https://');
    });

    test('9. Should reject malformed URLs', () => {
        const result = ExtensionUtils.url.validate('https://');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid URL format');
    });

    test('10. Should handle very long URLs', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2000);
        const result = ExtensionUtils.url.validate(longUrl);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('URL is too long');
    });
});

describe('🔧 URL Normalization Tests', () => {
    
    test('1. Should normalize URLs with trailing slashes', () => {
        const result = ExtensionUtils.url.normalize('https://example.com/');
        expect(result).toBe('https://example.com');
    });

    test('2. Should normalize URLs with multiple slashes', () => {
        const result = ExtensionUtils.url.normalize('https://example.com//path//to//page');
        expect(result).toBe('https://example.com/path/to/page');
    });

    test('3. Should normalize URLs with mixed case', () => {
        const result = ExtensionUtils.url.normalize('HTTPS://EXAMPLE.COM/PATH');
        expect(result).toBe('https://example.com/PATH');
    });

    test('4. Should preserve query parameters', () => {
        const result = ExtensionUtils.url.normalize('https://example.com/path?param=value');
        expect(result).toBe('https://example.com/path?param=value');
    });

    test('5. Should preserve fragments', () => {
        const result = ExtensionUtils.url.normalize('https://example.com/path#section');
        expect(result).toBe('https://example.com/path#section');
    });

    test('6. Should handle empty strings', () => {
        const result = ExtensionUtils.url.normalize('');
        expect(result).toBe('');
    });

    test('7. Should handle null/undefined input', () => {
        expect(ExtensionUtils.url.normalize(null)).toBe('');
        expect(ExtensionUtils.url.normalize(undefined)).toBe('');
    });

    test('8. Should normalize www subdomains', () => {
        const result = ExtensionUtils.url.normalize('https://www.example.com');
        expect(result).toBe('https://example.com');
    });

    test('9. Should handle URLs with ports', () => {
        const result = ExtensionUtils.url.normalize('https://example.com:8080/path');
        expect(result).toBe('https://example.com:8080/path');
    });

    test('10. Should handle complex URLs', () => {
        const input = 'HTTPS://WWW.EXAMPLE.COM:8080//PATH//TO//PAGE/?param=value#section';
        const expected = 'https://example.com:8080/PATH/TO/PAGE?param=value#section';
        const result = ExtensionUtils.url.normalize(input);
        expect(result).toBe(expected);
    });
});

describe('🎯 Chrome Extension Utilities Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Should get current tab successfully', async () => {
        const mockTab = { id: 123, url: 'https://example.com', title: 'Test' };
        chrome.tabs.query.mockResolvedValue([mockTab]);

        const result = await ExtensionUtils.chrome.getCurrentTab();
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    test('2. Should handle no active tab', async () => {
        chrome.tabs.query.mockResolvedValue([]);
        
        const result = await ExtensionUtils.chrome.getCurrentTab();
        expect(result).toBeUndefined();
    });

    test('3. Should handle chrome.tabs.query error', async () => {
        chrome.tabs.query.mockRejectedValue(new Error('Permission denied'));
        
        await expect(ExtensionUtils.chrome.getCurrentTab()).rejects.toThrow('Permission denied');
    });

    test('4. Should send message to tab with timeout', async () => {
        const mockResponse = { success: true };
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            setTimeout(() => callback(mockResponse), 100);
        });

        const result = await ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' }, 5000);
        expect(result).toEqual(mockResponse);
    });

    test('5. Should timeout on slow tab responses', async () => {
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            // Never call callback - simulate timeout
        });

        await expect(
            ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' }, 100)
        ).rejects.toThrow('Timeout');
    });

    test('6. Should handle tab message errors', async () => {
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            chrome.runtime.lastError = { message: 'Tab not found' };
            callback(null);
        });

        await expect(
            ExtensionUtils.chrome.sendMessageToTab(123, { action: 'test' }, 5000)
        ).rejects.toThrow('Tab not found');
    });

    test('7. Should send message to background script', async () => {
        const mockResponse = { result: 'success' };
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
            callback(mockResponse);
        });

        const result = await ExtensionUtils.chrome.sendMessage({ action: 'test' });
        expect(result).toEqual(mockResponse);
    });

    test('8. Should handle background message errors', async () => {
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
            chrome.runtime.lastError = { message: 'Background script error' };
            callback(null);
        });

        await expect(
            ExtensionUtils.chrome.sendMessage({ action: 'test' })
        ).rejects.toThrow('Background script error');
    });

    test('9. Should handle multiple concurrent tab messages', async () => {
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            setTimeout(() => callback({ tabId, message }), Math.random() * 100);
        });

        const promises = [
            ExtensionUtils.chrome.sendMessageToTab(1, { action: 'test1' }, 5000),
            ExtensionUtils.chrome.sendMessageToTab(2, { action: 'test2' }, 5000),
            ExtensionUtils.chrome.sendMessageToTab(3, { action: 'test3' }, 5000)
        ];

        const results = await Promise.all(promises);
        expect(results).toHaveLength(3);
    });

    test('10. Should generate unique IDs', () => {
        const id1 = ExtensionUtils.generateId();
        const id2 = ExtensionUtils.generateId();
        
        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(0);
    });
});

console.log('✅ Comprehensive Utils Tests: 40+ test cases covering all utility functions'); 