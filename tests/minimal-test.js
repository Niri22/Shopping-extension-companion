/**
 * Minimal test to isolate hanging issues
 */

console.log('🔍 Starting minimal test...');

// Mock Chrome APIs first
global.chrome = {
    runtime: {
        onMessage: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
            hasListeners: () => false
        }
    }
};

global.window = {
    location: { href: 'https://example.com' },
    addEventListener: () => {}
};

global.document = {
    readyState: 'complete',
    addEventListener: () => {}
};

// Mock setTimeout to prevent hanging
global.setTimeout = (fn, delay) => {
    console.log(`⏰ setTimeout called with delay: ${delay}ms`);
    if (typeof fn === 'function') {
        // Call function immediately in test environment
        try {
            fn();
        } catch (error) {
            console.log('❌ setTimeout function error:', error.message);
        }
    }
    return 1;
};

console.log('✅ Mocks set up');

// Test basic functionality
try {
    console.log('📋 Testing basic expect functionality...');
    
    // Simple expect function
    const expect = (actual) => ({
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
            }
        }
    });
    
    // Test cases
    expect(1).toBe(1);
    expect('hello').toBe('hello');
    expect([1, 2, 3]).toEqual([1, 2, 3]);
    
    console.log('✅ Basic expect tests passed');
    
} catch (error) {
    console.log('❌ Basic test failed:', error.message);
}

// Test ExtensionUtils loading
try {
    console.log('📋 Testing ExtensionUtils loading...');
    
    global.ExtensionConfig = {
        messages: {
            errors: {
                emptyUrl: 'URL cannot be empty',
                invalidUrl: 'Invalid URL format'
            },
            notFound: {
                price: 'No price found'
            }
        }
    };
    
    const utilsPath = require('path').resolve(__dirname, '../utils.js');
    const utilsModule = require(utilsPath);
    
    if (utilsModule && utilsModule.url && utilsModule.url.validate) {
        console.log('✅ ExtensionUtils loaded successfully');
        
        // Test URL validation
        const result = utilsModule.url.validate('https://example.com');
        if (result.valid) {
            console.log('✅ URL validation works');
        } else {
            console.log('❌ URL validation failed');
        }
    } else {
        console.log('❌ ExtensionUtils not properly loaded');
    }
    
} catch (error) {
    console.log('❌ ExtensionUtils loading failed:', error.message);
}

console.log('🎯 Minimal test completed');
process.exit(0); 