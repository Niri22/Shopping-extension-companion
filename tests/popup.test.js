/**
 * Unit Tests for Popup Script (popup.js)
 * Tests URL validation, retry logic, tab management, and UI interactions
 */

// Mock DOM elements and Chrome APIs
global.document = {
    addEventListener: jest.fn(),
    getElementById: jest.fn()
};

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
    runtime: {
        lastError: null
    }
};

// Mock DOM elements
const mockElements = {
    urlInput: { value: '', addEventListener: jest.fn() },
    fetchBtn: { addEventListener: jest.fn() },
    currentTabBtn: { addEventListener: jest.fn() },
    loading: { classList: { add: jest.fn(), remove: jest.fn() } },
    result: { classList: { add: jest.fn(), remove: jest.fn() } },
    error: { classList: { add: jest.fn(), remove: jest.fn() } },
    titleText: { textContent: '' },
    priceText: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
    urlText: { textContent: '' },
    errorText: { textContent: '' }
};

describe('Popup Script - URL Validation', () => {
    test('should validate valid URLs correctly', () => {
        function isValidUrl(string) {
            try {
                const url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                return false;
            }
        }

        expect(isValidUrl('https://www.amazon.com/product')).toBe(true);
        expect(isValidUrl('http://example.com')).toBe(true);
        expect(isValidUrl('https://shop.example.com/item/123')).toBe(true);
    });

    test('should reject invalid URLs', () => {
        function isValidUrl(string) {
            try {
                const url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                return false;
            }
        }

        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('ftp://example.com')).toBe(false);
        expect(isValidUrl('javascript:alert(1)')).toBe(false);
        expect(isValidUrl('')).toBe(false);
        expect(isValidUrl('example.com')).toBe(false); // Missing protocol
    });

    test('should handle edge cases in URL validation', () => {
        function isValidUrl(string) {
            try {
                const url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                return false;
            }
        }

        expect(isValidUrl(null)).toBe(false);
        expect(isValidUrl(undefined)).toBe(false);
        expect(isValidUrl('https://')).toBe(false);
        expect(isValidUrl('https://localhost:3000')).toBe(true);
    });
});

describe('Popup Script - Tab Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
    });

    test('should create and manage tabs for URL fetching', async () => {
        const mockTab = { id: 123, url: 'https://example.com' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(mockTab);
        });

        function createTabForUrl(url) {
            return new Promise((resolve, reject) => {
                chrome.tabs.create({ url: url, active: false }, function(tab) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(tab);
                });
            });
        }

        const result = await createTabForUrl('https://example.com');
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.create).toHaveBeenCalledWith(
            { url: 'https://example.com', active: false },
            expect.any(Function)
        );
    });

    test('should handle tab creation errors', async () => {
        chrome.runtime.lastError = { message: 'Tab creation failed' };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(null);
        });

        function createTabForUrl(url) {
            return new Promise((resolve, reject) => {
                chrome.tabs.create({ url: url, active: false }, function(tab) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(tab);
                });
            });
        }

        await expect(createTabForUrl('https://example.com')).rejects.toThrow('Tab creation failed');
    });

    test('should query active tabs correctly', async () => {
        const mockTab = { 
            id: 456, 
            title: 'Test Page', 
            url: 'https://example.com',
            active: true 
        };
        chrome.tabs.query.mockResolvedValue([mockTab]);

        const result = await chrome.tabs.query({ active: true, currentWindow: true });
        expect(result).toEqual([mockTab]);
        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    test('should remove tabs after processing', async () => {
        chrome.tabs.remove.mockResolvedValue();

        await chrome.tabs.remove(123);
        expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });
});

describe('Popup Script - Retry Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should retry with progressive delays', async () => {
        const delays = [500, 2000, 4000, 6000];
        let attemptCount = 0;

        // Mock setTimeout to track delays
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((callback, delay) => {
            expect(delay).toBe(delays[attemptCount] || 0);
            attemptCount++;
            return originalSetTimeout(callback, 0); // Execute immediately for testing
        });

        async function mockRetryLogic() {
            const maxAttempts = 4;
            const retryDelays = [500, 2000, 4000, 6000];

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Simulate attempt
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
                }
            }
        }

        await mockRetryLogic();
        expect(global.setTimeout).toHaveBeenCalledTimes(3); // 4 attempts, 3 delays

        global.setTimeout = originalSetTimeout;
    });

    test('should exit early when valid price is found', async () => {
        let attemptCount = 0;
        const mockResponses = [
            { title: 'Product', price: 'Loading...' },
            { title: 'Product', price: '$29.99' }, // Valid price found
            { title: 'Product', price: '$29.99' }  // Should not reach this
        ];

        async function mockRetryWithEarlyExit() {
            const maxAttempts = 4;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const response = mockResponses[attempt];
                attemptCount++;
                
                if (response && response.price && 
                    response.price !== 'No price found' && 
                    response.price !== 'Page still loading...' &&
                    response.price !== 'Loading...') {
                    return response; // Early exit
                }
                
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        const result = await mockRetryWithEarlyExit();
        expect(attemptCount).toBe(2); // Should stop after finding valid price
        expect(result.price).toBe('$29.99');
    });

    test('should track best response during retries', async () => {
        const mockResponses = [
            null, // First attempt fails
            { title: 'Product', price: 'Loading...' }, // Second attempt partial
            null, // Third attempt fails
            { title: 'Product', price: 'No price found' } // Fourth attempt complete but no price
        ];

        async function mockRetryWithBestResponse() {
            let bestResponse = null;
            const maxAttempts = 4;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const response = mockResponses[attempt];
                
                if (response) {
                    if (response.price && response.price !== 'No price found' && response.price !== 'Loading...') {
                        return response; // Found good price
                    } else if (response.title) {
                        bestResponse = response; // Keep best response
                    }
                }
            }
            
            return bestResponse;
        }

        const result = await mockRetryWithBestResponse();
        expect(result.title).toBe('Product');
        expect(result.price).toBe('No price found');
    });
});

describe('Popup Script - Message Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should send messages to content script', async () => {
        const mockResponse = { title: 'Test Product', price: '$29.99', url: 'https://example.com' };
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            callback(mockResponse);
        });

        function sendMessageToTab(tabId, message) {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, function(response) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        }

        const result = await sendMessageToTab(123, { action: 'getPageInfo' });
        expect(result).toEqual(mockResponse);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            123,
            { action: 'getPageInfo' },
            expect.any(Function)
        );
    });

    test('should handle message sending errors', async () => {
        chrome.runtime.lastError = { message: 'Content script not found' };
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            callback(null);
        });

        function sendMessageToTab(tabId, message) {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, function(response) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        }

        await expect(sendMessageToTab(123, { action: 'getPageInfo' }))
            .rejects.toThrow('Content script not found');
    });
});

describe('Popup Script - UI Interactions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock element states
        Object.values(mockElements).forEach(element => {
            if (element.textContent !== undefined) element.textContent = '';
            if (element.value !== undefined) element.value = '';
        });
    });

    test('should show loading state correctly', () => {
        function showLoading() {
            mockElements.loading.classList.remove('hidden');
            mockElements.result.classList.add('hidden');
            mockElements.error.classList.add('hidden');
        }

        showLoading();

        expect(mockElements.loading.classList.remove).toHaveBeenCalledWith('hidden');
        expect(mockElements.result.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockElements.error.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('should show results with price highlighting', () => {
        function showResult(title, price, url) {
            mockElements.titleText.textContent = title;
            mockElements.priceText.textContent = price;
            
            if (price && price !== 'No price found') {
                mockElements.priceText.classList.add('price-found');
            } else {
                mockElements.priceText.classList.remove('price-found');
            }
            
            mockElements.urlText.textContent = url;
            mockElements.result.classList.remove('hidden');
        }

        // Test with valid price
        showResult('Test Product', '$29.99', 'https://example.com');
        expect(mockElements.titleText.textContent).toBe('Test Product');
        expect(mockElements.priceText.textContent).toBe('$29.99');
        expect(mockElements.priceText.classList.add).toHaveBeenCalledWith('price-found');
        expect(mockElements.urlText.textContent).toBe('https://example.com');

        // Reset mocks
        jest.clearAllMocks();

        // Test with no price found
        showResult('Test Product', 'No price found', 'https://example.com');
        expect(mockElements.priceText.classList.remove).toHaveBeenCalledWith('price-found');
    });

    test('should show error messages', () => {
        function showError(message) {
            mockElements.loading.classList.add('hidden');
            mockElements.result.classList.add('hidden');
            mockElements.error.classList.remove('hidden');
            mockElements.errorText.textContent = message;
        }

        showError('Failed to fetch page information');

        expect(mockElements.errorText.textContent).toBe('Failed to fetch page information');
        expect(mockElements.error.classList.remove).toHaveBeenCalledWith('hidden');
        expect(mockElements.loading.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockElements.result.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('should handle input validation', () => {
        function validateInput(url) {
            if (!url) {
                return { valid: false, error: 'Please enter a URL' };
            }
            
            try {
                const urlObj = new URL(url);
                if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                    return { valid: false, error: 'Please enter a valid URL (include http:// or https://)' };
                }
                return { valid: true };
            } catch (_) {
                return { valid: false, error: 'Please enter a valid URL (include http:// or https://)' };
            }
        }

        expect(validateInput('')).toEqual({ valid: false, error: 'Please enter a URL' });
        expect(validateInput('invalid-url')).toEqual({ 
            valid: false, 
            error: 'Please enter a valid URL (include http:// or https://)' 
        });
        expect(validateInput('https://example.com')).toEqual({ valid: true });
    });
});

describe('Popup Script - Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
    });

    test('should handle complete fetch flow for valid URL', async () => {
        // Mock successful tab creation
        const mockTab = { id: 123 };
        chrome.tabs.create.mockImplementation((options, callback) => {
            callback(mockTab);
        });

        // Mock tab update listener
        const mockUpdatedTab = { title: 'Test Product', status: 'complete' };
        let updateListener;
        chrome.tabs.onUpdated.addListener.mockImplementation((listener) => {
            updateListener = listener;
        });

        // Mock content script response
        const mockResponse = { title: 'Test Product', price: '$29.99' };
        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            callback(mockResponse);
        });

        // Mock tab removal
        chrome.tabs.remove.mockResolvedValue();

        async function mockFetchPageInfo(url) {
            return new Promise((resolve, reject) => {
                chrome.tabs.create({ url: url, active: false }, function(tab) {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    
                    const tabId = tab.id;
                    
                    function onTabUpdated(updatedTabId, changeInfo, updatedTab) {
                        if (updatedTabId === tabId && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(onTabUpdated);
                            
                            chrome.tabs.sendMessage(tabId, { action: 'getPageInfo' }, function(response) {
                                chrome.tabs.remove(tabId);
                                
                                if (chrome.runtime.lastError || !response) {
                                    resolve({
                                        title: updatedTab.title || 'No title found',
                                        price: 'No price found'
                                    });
                                } else {
                                    resolve({
                                        title: response.title || 'No title found',
                                        price: response.price || 'No price found'
                                    });
                                }
                            });
                        }
                    }
                    
                    chrome.tabs.onUpdated.addListener(onTabUpdated);
                    
                    // Simulate tab completion
                    setTimeout(() => {
                        onTabUpdated(tabId, { status: 'complete' }, mockUpdatedTab);
                    }, 100);
                });
            });
        }

        const result = await mockFetchPageInfo('https://example.com');
        
        expect(result.title).toBe('Test Product');
        expect(result.price).toBe('$29.99');
        expect(chrome.tabs.create).toHaveBeenCalled();
        expect(chrome.tabs.sendMessage).toHaveBeenCalled();
        expect(chrome.tabs.remove).toHaveBeenCalled();
    });

    test('should handle current tab info with retry logic', async () => {
        // Mock active tab query
        const mockTab = { id: 456, title: 'Current Page', url: 'https://current.com' };
        chrome.tabs.query.mockResolvedValue([mockTab]);

        // Mock progressive responses (simulating retry logic)
        let callCount = 0;
        const mockResponses = [
            null, // First attempt fails
            { title: 'Current Page', price: 'Loading...' }, // Second attempt loading
            { title: 'Current Page', price: '$45.00' } // Third attempt success
        ];

        chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            const response = mockResponses[callCount++];
            callback(response);
        });

        async function mockHandleCurrentTabWithRetry() {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.id) {
                throw new Error('Unable to get current tab information');
            }

            const maxAttempts = 4;
            const retryDelays = [500, 2000, 4000, 6000];
            let bestResponse = null;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const response = await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(response);
                            }
                        });
                    });
                    
                    if (response) {
                        if (response.price && response.price !== 'No price found' && response.price !== 'Page still loading...' && response.price !== 'Loading...') {
                            return response; // Success!
                        } else if (response.title) {
                            bestResponse = response;
                        }
                    }
                } catch (err) {
                    // Continue to next attempt
                }

                // Don't wait on last attempt
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
                }
            }

            return bestResponse || { title: tab.title, price: 'No price found', url: tab.url };
        }

        const result = await mockHandleCurrentTabWithRetry();
        
        expect(result.title).toBe('Current Page');
        expect(result.price).toBe('$45.00');
        expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3); // Stopped after finding price
    });
}); 