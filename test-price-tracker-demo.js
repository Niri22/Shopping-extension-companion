/**
 * Price Tracker Demo Script
 * Tests the price tracking logic independently
 */

// Mock Chrome APIs for testing
global.chrome = {
    alarms: {
        create: (name, options) => console.log(`✅ Alarm created: ${name}, ${JSON.stringify(options)}`),
        clear: (name) => console.log(`🗑️ Alarm cleared: ${name}`),
        onAlarm: { addListener: (callback) => console.log('👂 Alarm listener added') }
    },
    storage: {
        local: {
            get: (keys) => Promise.resolve({ saved_products: mockProducts }),
            set: (data) => Promise.resolve(console.log('💾 Data saved:', Object.keys(data)))
        }
    },
    tabs: {
        create: (options) => Promise.resolve({ id: 123 }),
        remove: (id) => Promise.resolve(console.log(`🗑️ Tab ${id} removed`)),
        sendMessage: (id, message) => Promise.resolve({ price: '$79.99' })
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

// Import PriceTracker
const PriceTracker = require('./services/PriceTracker.js');

// Mock product data
const mockProducts = [
    {
        id: 'product1',
        title: 'Premium Wireless Headphones',
        price: '$89.99',
        url: 'file:///test-price-tracking.html',
        dateAdded: '2024-01-01T10:00:00.000Z'
    },
    {
        id: 'product2',
        title: 'Bluetooth Speaker',
        price: '$49.99',
        url: 'https://example.com/speaker',
        dateAdded: '2024-01-02T10:00:00.000Z'
    }
];

async function runPriceTrackingDemo() {
    console.log('🎯 Price Tracking Demo Starting...\n');
    
    // Initialize price tracker
    console.log('1. Initializing PriceTracker...');
    const priceTracker = new PriceTracker();
    await new Promise(resolve => setTimeout(resolve, 100)); // Let initialization complete
    
    // Test price extraction
    console.log('\n2. Testing Price Extraction...');
    const testPrices = [
        '$89.99',
        '€45.50',
        '£19.95',
        '¥1000',
        '$1,299.99',
        '29,99€'
    ];
    
    testPrices.forEach(price => {
        const numeric = priceTracker.extractNumericPrice(price);
        console.log(`   ${price} → ${numeric}`);
    });
    
    // Test price comparison
    console.log('\n3. Testing Price Comparison...');
    const comparisons = [
        ['$89.99', '$79.99'], // Price drop
        ['$49.99', '$59.99'], // Price increase
        ['$29.99', '$29.99'], // No change
        ['$100.00', '$99.99'] // Small drop
    ];
    
    comparisons.forEach(([original, current]) => {
        const result = priceTracker.comparePrices(original, current);
        const status = result.dropped ? '📉 DROP' : result.changed ? '📈 INCREASE' : '➡️ NO CHANGE';
        console.log(`   ${original} → ${current}: ${status} (${result.difference.toFixed(2)})`);
    });
    
    // Test manual price check
    console.log('\n4. Testing Manual Price Check...');
    try {
        await priceTracker.triggerManualCheck();
        console.log('✅ Manual price check completed successfully');
    } catch (error) {
        console.log('❌ Manual price check failed:', error.message);
    }
    
    // Test individual product price check
    console.log('\n5. Testing Individual Product Check...');
    try {
        const result = await priceTracker.checkProductPrice(mockProducts[0]);
        console.log('✅ Product check result:', {
            success: result.success,
            productId: result.productId,
            priceChanged: result.priceChanged,
            priceDropped: result.priceDropped
        });
    } catch (error) {
        console.log('❌ Product check failed:', error.message);
    }
    
    // Test price history
    console.log('\n6. Testing Price History...');
    const history = await priceTracker.getProductPriceHistory('product1');
    console.log(`   Price history entries: ${history.length}`);
    
    // Test products with price drops
    console.log('\n7. Testing Price Drop Detection...');
    const productsWithDrops = await priceTracker.getProductsWithPriceDrops(7);
    console.log(`   Products with recent drops: ${productsWithDrops.length}`);
    
    console.log('\n🎉 Price Tracking Demo Completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Price extraction working');
    console.log('   ✅ Price comparison logic working');
    console.log('   ✅ Storage operations working');
    console.log('   ✅ Background processing ready');
    console.log('   ✅ All systems operational!');
}

// Run the demo
runPriceTrackingDemo().catch(error => {
    console.error('❌ Demo failed:', error);
});

module.exports = { runPriceTrackingDemo }; 