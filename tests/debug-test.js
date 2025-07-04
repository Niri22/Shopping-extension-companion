/**
 * Debug test to identify hanging issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Debug Test - Checking for hanging issues');

// Check if files exist
const filesToCheck = [
    '../utils.js',
    '../content.js',
    '../background.js',
    '../popup.js'
];

console.log('📁 Checking file existence:');
filesToCheck.forEach(file => {
    const fullPath = path.resolve(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(`   ${exists ? '✅' : '❌'} ${file} - ${fullPath}`);
});

// Try to load utils.js
console.log('\n🔧 Attempting to load utils.js...');
try {
    // Set up required globals first
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
    
    const utilsPath = path.resolve(__dirname, '../utils.js');
    if (fs.existsSync(utilsPath)) {
        console.log('   Loading utils.js...');
        require(utilsPath);
        console.log('   ✅ utils.js loaded successfully');
        
        if (typeof ExtensionUtils !== 'undefined') {
            console.log('   ✅ ExtensionUtils is available');
        } else {
            console.log('   ❌ ExtensionUtils is not defined');
        }
    } else {
        console.log('   ❌ utils.js not found');
    }
} catch (error) {
    console.log('   ❌ Error loading utils.js:', error.message);
}

// Try to load content.js
console.log('\n🔧 Attempting to load content.js...');
try {
    // Set up Chrome API mocks first
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
        location: {
            href: 'https://example.com'
        },
        addEventListener: () => {}
    };
    
    global.document = {
        readyState: 'complete',
        addEventListener: () => {}
    };
    
    const contentPath = path.resolve(__dirname, '../content.js');
    if (fs.existsSync(contentPath)) {
        console.log('   Loading content.js...');
        require(contentPath);
        console.log('   ✅ content.js loaded successfully');
        
        if (typeof SimplePageExtractor !== 'undefined') {
            console.log('   ✅ SimplePageExtractor is available');
        } else {
            console.log('   ❌ SimplePageExtractor is not defined');
        }
    } else {
        console.log('   ❌ content.js not found');
    }
} catch (error) {
    console.log('   ❌ Error loading content.js:', error.message);
}

console.log('\n🎯 Debug test completed'); 