/**
 * Migration Script for WishCart Refactoring
 * Updates test files and ensures compatibility with new modular architecture
 */

const fs = require('fs');
const path = require('path');

class TestMigrator {
    constructor() {
        this.testDir = './tests';
        this.migratedFiles = [];
        this.errors = [];
    }
    
    /**
     * Main migration function
     */
    async migrate() {
        console.log('🔄 Starting test migration for refactored architecture...');
        
        try {
            await this.updateTestFiles();
            await this.createCompatibilityLayer();
            await this.updateRunnerScript();
            
            console.log('✅ Migration completed successfully!');
            console.log(`📁 Migrated ${this.migratedFiles.length} test files`);
            
            if (this.errors.length > 0) {
                console.log('⚠️  Warnings:');
                this.errors.forEach(error => console.log(`   - ${error}`));
            }
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }
    }
    
    /**
     * Update test files to use new imports
     */
    async updateTestFiles() {
        const testFiles = fs.readdirSync(this.testDir)
            .filter(file => file.endsWith('.test.js'))
            .map(file => path.join(this.testDir, file));
        
        for (const filePath of testFiles) {
            await this.updateTestFile(filePath);
        }
    }
    
    /**
     * Update individual test file
     */
    async updateTestFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Update import paths
            const importMappings = {
                '../config.js': '../src/constants/config.js',
                '../utils.js': '../src/utils/index.js',
                '../services/': '../src/services/',
                '../popup.js': '../src/ui/PopupController.js',
                'ExtensionConfig': 'Config',
                'ExtensionUtils.url': 'UrlUtils',
                'ExtensionUtils.price': 'PriceUtils',
                'ExtensionUtils.chrome': 'ChromeUtils'
            };
            
            // Apply import mappings
            Object.entries(importMappings).forEach(([oldImport, newImport]) => {
                content = content.replace(new RegExp(oldImport, 'g'), newImport);
            });
            
            // Update specific patterns for new modular structure
            content = this.updateTestPatterns(content);
            
            // Only write if content changed
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                this.migratedFiles.push(path.basename(filePath));
                console.log(`✅ Updated: ${path.basename(filePath)}`);
            }
            
        } catch (error) {
            this.errors.push(`Failed to update ${path.basename(filePath)}: ${error.message}`);
        }
    }
    
    /**
     * Update specific test patterns for new architecture
     */
    updateTestPatterns(content) {
        // Update ExtensionConfig references
        content = content.replace(/ExtensionConfig\./g, 'Config.');
        
        // Update utility function calls
        content = content.replace(/ExtensionUtils\.url\.validate/g, 'UrlUtils.validate');
        content = content.replace(/ExtensionUtils\.url\.normalize/g, 'UrlUtils.normalize');
        content = content.replace(/ExtensionUtils\.price\.isValid/g, 'PriceUtils.isValid');
        content = content.replace(/ExtensionUtils\.price\.getNumericValue/g, 'PriceUtils.getNumericValue');
        
        // Update service instantiation patterns
        content = content.replace(/new ShoppingExtensionPopup\(\)/g, 'await createPopupController()');
        
        return content;
    }
    
    /**
     * Create compatibility layer for tests
     */
    async createCompatibilityLayer() {
        const compatibilityLayer = `
/**
 * Test Compatibility Layer
 * Provides backward compatibility for existing tests with new architecture
 */

// Import new modules
import { Config } from '../src/constants/config.js';
import UrlUtils from '../src/utils/url.js';
import PriceUtils from '../src/utils/price.js';
import ChromeUtils from '../src/utils/chrome.js';
import { ProductManager } from '../src/core/ProductManager.js';
import { PopupController } from '../src/ui/PopupController.js';
import { EventBus } from '../src/services/EventBus.js';
import { StorageService } from '../src/services/StorageService.js';
import { PerformanceManager } from '../src/services/PerformanceManager.js';

// Create compatibility exports
export const ExtensionConfig = Config;
export const ExtensionUtils = {
    url: UrlUtils,
    price: PriceUtils,
    chrome: ChromeUtils
};

// Helper function to create popup controller for tests
export async function createPopupController() {
    const eventBus = new EventBus();
    const performanceManager = new PerformanceManager(eventBus);
    const storageService = new StorageService(performanceManager, eventBus);
    const productManager = new ProductManager(storageService, eventBus);
    
    return new PopupController(productManager, eventBus);
}

// Mock Chrome APIs for testing
export function mockChromeAPIs() {
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
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                clear: jest.fn()
            }
        },
        runtime: {
            lastError: null,
            getManifest: jest.fn(() => ({ version: '1.1.0' }))
        },
        alarms: {
            create: jest.fn(),
            clear: jest.fn(),
            getAll: jest.fn()
        }
    };
}

// Setup function for tests
export function setupTestEnvironment() {
    mockChromeAPIs();
    
    // Mock DOM elements that tests might need
    if (typeof document !== 'undefined') {
        const mockElements = [
            'urlInput', 'fetchBtn', 'currentTabBtn', 'loading', 'result', 'error',
            'titleText', 'priceText', 'urlText', 'addToListBtn', 'savedList',
            'listContainer', 'listToggle', 'listCount', 'clearListBtn', 'exportListBtn'
        ];
        
        mockElements.forEach(id => {
            if (!document.getElementById(id)) {
                const element = document.createElement('div');
                element.id = id;
                document.body.appendChild(element);
            }
        });
    }
}
`;
        
        const compatibilityPath = path.join(this.testDir, 'compatibility.js');
        fs.writeFileSync(compatibilityPath, compatibilityLayer);
        console.log('✅ Created compatibility layer');
    }
    
    /**
     * Update test runner script
     */
    async updateRunnerScript() {
        const runnerPath = path.join(this.testDir, 'run-tests.js');
        
        if (fs.existsSync(runnerPath)) {
            let content = fs.readFileSync(runnerPath, 'utf8');
            
            // Add import for compatibility layer
            if (!content.includes('compatibility.js')) {
                content = `// Import compatibility layer\nimport './compatibility.js';\n\n${content}`;
                
                fs.writeFileSync(runnerPath, content);
                console.log('✅ Updated test runner');
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new TestMigrator();
    migrator.migrate();
}

module.exports = TestMigrator; 