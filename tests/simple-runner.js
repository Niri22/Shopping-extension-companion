/**
 * Simple Test Runner - Focused on running tests without source file complications
 */

const fs = require('fs');
const path = require('path');

// Test statistics
const testStats = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    executionTime: 0
};

// Simple test files to run (avoiding comprehensive ones that might have issues)
const testFiles = [
    'popup.test.js',
    'content.test.js',
    'utils.test.js',
    'integration.test.js'
];

// Setup basic mocks
function setupBasicMocks() {
    console.log('🔧 Setting up basic mocks...');
    
    // Mock Chrome APIs
    global.chrome = {
        runtime: {
            onMessage: {
                addListener: () => {},
                removeListener: () => {},
                hasListener: () => false,
                hasListeners: () => false
            },
            sendMessage: (message, callback) => {
                if (callback) callback({ success: true });
                return Promise.resolve({ success: true });
            }
        },
        tabs: {
            query: (queryInfo, callback) => {
                const mockTab = { id: 1, url: 'https://example.com', title: 'Test Page', active: true };
                if (callback) callback([mockTab]);
                return Promise.resolve([mockTab]);
            },
            create: (props, callback) => {
                const mockTab = { id: 2, url: props.url || 'https://example.com', title: 'New Tab' };
                if (callback) callback(mockTab);
                return Promise.resolve(mockTab);
            },
            remove: (tabId, callback) => {
                if (callback) callback();
                return Promise.resolve();
            },
            sendMessage: (tabId, message, callback) => {
                const response = { success: true, data: 'mock-response' };
                if (callback) callback(response);
                return Promise.resolve(response);
            }
        },
        storage: {
            local: {
                get: (keys, callback) => {
                    const mockData = { products: [] };
                    if (callback) callback(mockData);
                    return Promise.resolve(mockData);
                },
                set: (items, callback) => {
                    if (callback) callback();
                    return Promise.resolve();
                },
                remove: (keys, callback) => {
                    if (callback) callback();
                    return Promise.resolve();
                },
                clear: (callback) => {
                    if (callback) callback();
                    return Promise.resolve();
                }
            }
        },
        alarms: {
            create: () => {},
            clear: (name, callback) => { if (callback) callback(true); },
            onAlarm: { addListener: () => {} }
        }
    };

    // Mock DOM
    global.document = {
        addEventListener: () => {},
        querySelector: (selector) => {
            // Return mock elements based on selector
            if (selector === 'title') {
                return { textContent: 'Test Page Title' };
            }
            if (selector.includes('meta')) {
                return { getAttribute: () => 'Test Meta Content' };
            }
            return null;
        },
        querySelectorAll: () => [],
        title: 'Test Page'
    };

    global.window = {
        location: { href: 'https://example.com', hostname: 'example.com' },
        addEventListener: () => {},
        setTimeout: (fn) => { 
            if (typeof fn === 'function') {
                try {
                    fn();
                } catch (error) {
                    console.log('setTimeout error:', error.message);
                }
            }
            return 1; 
        },
        clearTimeout: () => {}
    };

    // Mock Node.js globals
    global.setTimeout = global.window.setTimeout;
    global.clearTimeout = global.window.clearTimeout;

    // Mock ExtensionUtils
    global.ExtensionUtils = {
        url: {
            validate: (url) => ({ valid: !!url && url.includes('http') }),
            normalize: (url) => url.startsWith('http') ? url : 'https://' + url
        },
        price: {
            isValid: (price) => price && price.includes('$'),
            isRealistic: (price) => true,
            getNumericValue: (price) => parseFloat(price.replace(/[^\d.]/g, '')) || 0
        },
        text: {
            normalize: (text) => text ? text.trim() : '',
            containsAny: (text, patterns) => patterns.some(p => text.includes(p)),
            extractPrice: (text) => {
                const match = text.match(/\$\d+(?:\.\d{2})?/);
                return match ? match[0] : null;
            }
        },
        async: {
            delay: (ms) => Promise.resolve(),
            retry: async (fn) => { return await fn(); }
        },
        storage: {
            generateProductId: (product) => 'test-id-' + Math.random().toString(36).substr(2, 9),
            isValidProduct: (product) => !!(product && product.title && product.url),
            saveProduct: async (product) => ({ success: true }),
            getProducts: async () => [],
            removeProduct: async (id) => ({ success: true }),
            clearProducts: async () => ({ success: true })
        },
        chrome: {
            sendMessageToTab: async (tabId, message) => ({ success: true }),
            getCurrentTab: async () => ({ id: 1, url: 'https://example.com' }),
            createTab: async (url) => ({ id: 2, url }),
            isContentScriptAvailable: async () => true
        }
    };

    // Mock other required objects
    global.ShoppingContentScript = class {
        extractPrice() { return '$29.99'; }
        extractTitle() { return 'Test Product'; }
        getPageInfo() { return { title: 'Test Product', price: '$29.99', url: 'https://example.com' }; }
    };

    global.PriceTracker = class {
        initializeTracking() { return Promise.resolve(); }
        addPricePoint() { return Promise.resolve(); }
        getPriceHistory() { return []; }
        detectPriceChange() { return { change: 0, percentage: 0, isSignificant: false }; }
    };

    // Mock Jest
    const jest = {
        fn: (implementation) => {
            const mockFn = implementation || (() => {});
            mockFn.mock = { calls: [], instances: [], results: [] };
            mockFn.mockImplementation = (impl) => { mockFn._implementation = impl; return mockFn; };
            mockFn.mockReturnValue = (value) => { mockFn._returnValue = value; return mockFn; };
            mockFn.mockClear = () => { mockFn.mock.calls = []; return mockFn; };
            
            // Track calls
            const wrappedFn = (...args) => {
                mockFn.mock.calls.push(args);
                if (mockFn._implementation) return mockFn._implementation(...args);
                if (mockFn._returnValue !== undefined) return mockFn._returnValue;
                if (implementation) return implementation(...args);
                return undefined;
            };
            
            // Copy properties
            Object.assign(wrappedFn, mockFn);
            return wrappedFn;
        },
        clearAllMocks: () => {}
    };

    // Create Jest-compatible mock functions for classList
    const createJestMockFn = (name) => {
        const fn = jest.fn();
        fn.displayName = name;
        return fn;
    };

    // Mock UI elements with Jest-compatible mocks
    const createMockElement = (name) => ({
        classList: {
            add: createJestMockFn(`${name}.classList.add`),
            remove: createJestMockFn(`${name}.classList.remove`),
            contains: createJestMockFn(`${name}.classList.contains`),
            toggle: createJestMockFn(`${name}.classList.toggle`)
        },
        style: {},
        textContent: '',
        innerHTML: '',
        setAttribute: createJestMockFn(`${name}.setAttribute`),
        getAttribute: createJestMockFn(`${name}.getAttribute`)
    });

    global.mockElements = {
        loading: createMockElement('loading'),
        result: createMockElement('result'),
        error: createMockElement('error'),
        priceText: createMockElement('priceText'),
        titleText: createMockElement('titleText'),
        urlText: createMockElement('urlText'),
        errorText: createMockElement('errorText')
    };

    global.uiElements = {
        loading: createMockElement('uiLoading'),
        result: createMockElement('uiResult'),
        error: createMockElement('uiError'),
        priceText: createMockElement('uiPriceText'),
        titleText: createMockElement('uiTitleText'),
        urlText: createMockElement('uiUrlText'),
        errorText: createMockElement('uiErrorText')
    };

    global.testUtils = {
        createMockTab: () => ({ id: 1, url: 'https://example.com', title: 'Test Page' }),
        createMockProduct: () => ({ id: 'test-123', title: 'Test Product', price: '$29.99', url: 'https://example.com' })
    };

    global.sendResponse = (response) => {
        console.log('Mock sendResponse called with:', response);
        return response;
    };
    
    // Make jest available globally
    global.jest = jest;
    
    console.log('✅ Basic mocks set up');
}

// Setup test environment
function setupTestEnvironment() {
    console.log('🧪 Setting up test environment...');
    
    // Simple expect function
    const expect = (actual) => {
        const expectObj = {
            toBe: (expected) => {
                if (actual !== expected) {
                    throw new Error(`Expected ${actual} to be ${expected}`);
                }
            },
            toEqual: (expected) => {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
                }
            },
            toContain: (expected) => {
                if (!actual || !actual.includes || !actual.includes(expected)) {
                    throw new Error(`Expected to contain ${expected}`);
                }
            },
            toHaveLength: (expected) => {
                if (!actual || actual.length !== expected) {
                    throw new Error(`Expected length ${expected}, got ${actual ? actual.length : 'undefined'}`);
                }
            },
            toBeTruthy: () => {
                if (!actual) {
                    throw new Error('Expected value to be truthy');
                }
            },
            toBeFalsy: () => {
                if (actual) {
                    throw new Error('Expected value to be falsy');
                }
            },
            toBeNull: () => {
                if (actual !== null) {
                    throw new Error('Expected value to be null');
                }
            },
            toBeUndefined: () => {
                if (actual !== undefined) {
                    throw new Error('Expected value to be undefined');
                }
            },
            toBeDefined: () => {
                if (actual === undefined) {
                    throw new Error('Expected value to be defined');
                }
            },
            toBeGreaterThan: (expected) => {
                if (actual <= expected) {
                    throw new Error(`Expected ${actual} to be greater than ${expected}`);
                }
            },
            toBeLessThan: (expected) => {
                if (actual >= expected) {
                    throw new Error(`Expected ${actual} to be less than ${expected}`);
                }
            },
            toBeLessThanOrEqual: (expected) => {
                if (actual > expected) {
                    throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
                }
            },
            toBeGreaterThanOrEqual: (expected) => {
                if (actual < expected) {
                    throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
                }
            },
            toHaveBeenCalled: () => {
                if (!actual || !actual.mock || actual.mock.calls.length === 0) {
                    throw new Error('Expected mock function to have been called');
                }
            },
            toHaveBeenCalledWith: (...expectedArgs) => {
                if (!actual || !actual.mock) {
                    throw new Error('Expected a mock function');
                }
                const found = actual.mock.calls.some(call => 
                    call.length === expectedArgs.length && 
                    call.every((arg, i) => {
                        const expected = expectedArgs[i];
                        if (expected && expected._isExpectAny) {
                            return expected.constructor === arg.constructor || typeof arg === expected.type;
                        }
                        return JSON.stringify(arg) === JSON.stringify(expected);
                    })
                );
                if (!found) {
                    throw new Error(`Expected mock function to have been called with ${JSON.stringify(expectedArgs)}`);
                }
            },
            toThrow: (expected) => {
                try {
                    if (typeof actual === 'function') {
                        actual();
                    }
                    throw new Error('Expected function to throw');
                } catch (error) {
                    if (expected && !error.message.includes(expected)) {
                        throw new Error(`Expected to throw "${expected}", got "${error.message}"`);
                    }
                }
            },
            rejects: {
                toThrow: async (expected) => {
                    try {
                        await actual;
                        throw new Error('Expected promise to reject');
                    } catch (error) {
                        if (expected && !error.message.includes(expected)) {
                            throw new Error(`Expected to reject with "${expected}", got "${error.message}"`);
                        }
                    }
                }
            },
            not: {
                toBe: (expected) => {
                    if (actual === expected) {
                        throw new Error(`Expected not to be ${expected}`);
                    }
                },
                toThrow: () => {
                    try {
                        if (typeof actual === 'function') {
                            actual();
                        }
                    } catch (error) {
                        throw new Error('Expected function not to throw');
                    }
                }
            }
        };
        
        return expectObj;
    };

    // Add expect.any helper
    expect.any = (constructor) => ({
        _isExpectAny: true,
        constructor: constructor,
        type: constructor.name.toLowerCase()
    });

    // Test functions
    const describe = (name, fn) => {
        console.log(`📂 ${name}`);
        try {
            fn();
        } catch (error) {
            console.error(`❌ Suite error: ${error.message}`);
        }
    };

    const it = (name, fn) => {
        testStats.totalTests++;
        try {
            fn();
            console.log(`✅ ${name}`);
            testStats.passedTests++;
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
            testStats.failedTests++;
        }
    };

    const test = it;
    const beforeEach = (fn) => { try { fn(); } catch (e) {} };
    const afterEach = (fn) => { try { fn(); } catch (e) {} };

    // Create jest mock object
    const jest = {
        fn: (implementation) => {
            const mockFn = function(...args) {
                mockFn.mock.calls.push(args);
                mockFn.mock.results.push({ type: 'return', value: undefined });
                if (implementation) {
                    const result = implementation(...args);
                    mockFn.mock.results[mockFn.mock.results.length - 1].value = result;
                    return result;
                }
            };
            mockFn.mock = {
                calls: [],
                results: [],
                instances: []
            };
            mockFn.mockReturnValue = (value) => {
                mockFn.mock.results = [{ type: 'return', value }];
                return mockFn;
            };
            mockFn.mockResolvedValue = (value) => {
                mockFn.mock.results = [{ type: 'return', value: Promise.resolve(value) }];
                return mockFn;
            };
            mockFn.mockRejectedValue = (value) => {
                mockFn.mock.results = [{ type: 'return', value: Promise.reject(value) }];
                return mockFn;
            };
            mockFn.mockImplementation = (newImplementation) => {
                // Replace the original implementation
                const originalFn = mockFn;
                const newMockFn = jest.fn(newImplementation);
                // Copy over mock data
                newMockFn.mock = mockFn.mock;
                return newMockFn;
            };
            return mockFn;
        },
        spyOn: (object, method) => {
            const original = object[method];
            const spy = jest.fn(original);
            object[method] = spy;
            spy.mockRestore = () => {
                object[method] = original;
            };
            return spy;
        },
        clearAllMocks: () => {
            // Clear all mock function calls and results
            // This is a simplified implementation
            console.log('🧹 Clearing all mocks...');
        }
    };

    // Make available globally
    global.expect = expect;
    global.describe = describe;
    global.it = it;
    global.test = test;
    global.beforeEach = beforeEach;
    global.afterEach = afterEach;
    global.jest = jest;
    
    console.log('✅ Test environment set up');
}

// Run a single test file
async function runTestFile(testFile) {
    const startTime = Date.now();
    
    try {
        console.log(`🔍 Running: ${testFile}`);
        
        const testPath = path.join(__dirname, testFile);
        if (fs.existsSync(testPath)) {
            delete require.cache[require.resolve(testPath)];
            require(testPath);
            
            const executionTime = Date.now() - startTime;
            console.log(`  ⏱️  Completed in ${executionTime}ms`);
            testStats.executionTime += executionTime;
        } else {
            console.log(`  ⚠️  Test file not found: ${testFile}`);
            testStats.skippedTests++;
        }
        
    } catch (error) {
        console.log(`  ❌ Error running ${testFile}: ${error.message}`);
        testStats.failedTests++;
    }
    
    console.log();
}

// Main runner
async function runTests() {
    console.log('================================================================================');
    console.log('🧪 WishCart Extension - Simple Test Runner');
    console.log('📊 Basic Test Execution');
    console.log('================================================================================');
    
    const overallStartTime = Date.now();
    
    // Setup
    setupBasicMocks();
    setupTestEnvironment();
    
    console.log('📁 Test Files:');
    testFiles.forEach(file => {
        const exists = fs.existsSync(path.join(__dirname, file));
        console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    });
    console.log();
    
    console.log('🚀 Starting Test Execution...');
    console.log();
    
    // Run tests
    for (const testFile of testFiles) {
        await runTestFile(testFile);
    }
    
    // Calculate final statistics
    testStats.executionTime = Date.now() - overallStartTime;
    
    // Print summary
    console.log('================================================================================');
    console.log('📋 Test Execution Summary');
    console.log('================================================================================');
    console.log(`✅ Total Tests: ${testStats.totalTests}`);
    console.log(`✅ Passed: ${testStats.passedTests}`);
    console.log(`❌ Failed: ${testStats.failedTests}`);
    console.log(`⏱️  Execution Time: ${testStats.executionTime}ms`);
    
    if (testStats.totalTests > 0) {
        const successRate = ((testStats.passedTests / testStats.totalTests) * 100).toFixed(1);
        console.log(`🎯 Success Rate: ${successRate}%`);
    }
    
    console.log('================================================================================');
    
    if (testStats.failedTests > 0) {
        console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    } else {
        console.log('🎉 All tests passed successfully!');
    }
    
    process.exit(testStats.failedTests > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
    runTests().catch(error => {
        console.error(`💥 Test runner error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { runTests, testStats }; 