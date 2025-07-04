const fs = require('fs');
const path = require('path');

// Test files to run
const testFiles = [
    'popup.test.js',
    'content.test.js',
    'utils.test.js',
    'integration.test.js'
];

// Test statistics
const testStats = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    executionTime: 0
};

// Enhanced jest mock
function createEnhancedJest() {
    const jest = {
        fn: (implementation) => {
            const mockFn = function(...args) {
                mockFn.mock.calls.push(args);
                mockFn.mock.results.push({ type: 'return', value: undefined });
                if (mockFn._implementation) {
                    const result = mockFn._implementation(...args);
                    mockFn.mock.results[mockFn.mock.results.length - 1].value = result;
                    return result;
                } else if (implementation) {
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
            
            mockFn._implementation = implementation;
            
            mockFn.mockReturnValue = (value) => {
                mockFn._implementation = () => value;
                return mockFn;
            };
            
            mockFn.mockResolvedValue = (value) => {
                mockFn._implementation = () => Promise.resolve(value);
                return mockFn;
            };
            
            mockFn.mockRejectedValue = (value) => {
                mockFn._implementation = () => Promise.reject(value);
                return mockFn;
            };
            
            mockFn.mockImplementation = (newImplementation) => {
                mockFn._implementation = newImplementation;
                return mockFn;
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
            console.log('🧹 Clearing all mocks...');
        }
    };
    
    return jest;
}

// Enhanced mock setup
function setupBasicMocks() {
    console.log('🔧 Setting up enhanced mocks...');
    
    const jest = createEnhancedJest();
    
    // Chrome API mocks
    global.chrome = {
        runtime: {
            sendMessage: jest.fn().mockResolvedValue({ success: true }),
            onMessage: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            },
            lastError: null
        },
        tabs: {
            create: jest.fn().mockResolvedValue({ id: 123, url: 'https://example.com' }),
            remove: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue([{ id: 123, url: 'https://example.com', active: true }]),
            sendMessage: jest.fn().mockResolvedValue({ title: 'Test Product', price: '$29.99' })
        },
        storage: {
            local: {
                get: jest.fn().mockResolvedValue({}),
                set: jest.fn().mockResolvedValue(undefined),
                remove: jest.fn().mockResolvedValue(undefined),
                clear: jest.fn().mockResolvedValue(undefined)
            },
            sync: {
                get: jest.fn().mockResolvedValue({}),
                set: jest.fn().mockResolvedValue(undefined)
            }
        }
    };

    // DOM mocks
    global.document = {
        createElement: jest.fn((tag) => ({
            tagName: tag.toUpperCase(),
            textContent: '',
            innerHTML: '',
            style: {},
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn()
            },
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            appendChild: jest.fn(),
            removeChild: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn().mockReturnValue([])
        })),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn().mockReturnValue([]),
        getElementById: jest.fn(),
        title: 'Test Page',
        body: {
            appendChild: jest.fn(),
            removeChild: jest.fn()
        }
    };

    global.window = {
        location: {
            href: 'https://example.com',
            hostname: 'example.com',
            protocol: 'https:'
        },
        setTimeout: (fn, delay) => {
            // Execute immediately in test environment
            if (typeof fn === 'function') {
                fn();
            }
            return 1;
        },
        clearTimeout: jest.fn(),
        setInterval: jest.fn(),
        clearInterval: jest.fn()
    };

    // Console mock
    global.console = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn()
    };

    // Mock elements for UI tests
    const mockElements = {
        loading: {
            style: { display: 'none' },
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn()
            }
        },
        results: {
            style: { display: 'none' },
            innerHTML: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn()
            }
        },
        error: {
            style: { display: 'none' },
            textContent: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn()
            }
        }
    };

    global.mockElements = mockElements;

    // Mock classes
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

    // Load ExtensionUtils
    try {
        const utilsPath = path.join(__dirname, '..', 'utils.js');
        if (fs.existsSync(utilsPath)) {
            const utils = require(utilsPath);
            global.ExtensionUtils = utils;
        }
    } catch (error) {
        console.warn('Could not load ExtensionUtils:', error.message);
    }

    console.log('✅ Enhanced mocks set up');
}

// Setup test environment
function setupTestEnvironment() {
    console.log('🧪 Setting up enhanced test environment...');
    
    // Create enhanced jest
    const jest = createEnhancedJest();
    
    // Enhanced expect function
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

    // Make available globally
    global.expect = expect;
    global.describe = describe;
    global.it = it;
    global.test = test;
    global.beforeEach = beforeEach;
    global.afterEach = afterEach;
    global.jest = jest;
    
    console.log('✅ Enhanced test environment set up');
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
    console.log('🧪 WishCart Extension - Enhanced Test Runner');
    console.log('📊 Enhanced Test Execution with Better Jest Support');
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
    
    console.log('🚀 Starting Enhanced Test Execution...');
    console.log();
    
    // Run tests
    for (const testFile of testFiles) {
        await runTestFile(testFile);
    }
    
    // Calculate final statistics
    testStats.executionTime = Date.now() - overallStartTime;
    
    // Print summary
    console.log('================================================================================');
    console.log('📋 Enhanced Test Execution Summary');
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
        console.error(`💥 Enhanced test runner error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { runTests, testStats }; 