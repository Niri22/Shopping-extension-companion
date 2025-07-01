/**
 * Extension Utilities - Simple and Reliable Legacy System
 * Focus on proven functionality without complex caching or service architecture
 */

const ExtensionUtils = {
    /**
     * URL utilities for validation and normalization
     */
    url: {
        /**
         * Validates a URL string
         * @param {string} url - URL to validate
         * @returns {object} - Validation result with valid flag and error message
         */
        validate(url) {
            if (!url || url.trim() === '') {
                return {
                    valid: false,
                    error: ExtensionConfig.messages.errors.emptyUrl
                };
            }
            
            try {
                new URL(url);
                return { valid: true };
            } catch (error) {
                return {
                    valid: false,
                    error: ExtensionConfig.messages.errors.invalidUrl
                };
            }
        },
        
        /**
         * Normalizes a URL by adding protocol if missing
         * @param {string} url - URL to normalize
         * @returns {string} - Normalized URL
         */
        normalize(url) {
            if (!url) return '';
            
            url = url.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            return url;
        }
    },
    
    /**
     * Price utilities for validation and parsing
     */
    price: {
        /**
         * Checks if a price string appears to be valid
         * @param {string} price - Price string to validate
         * @returns {boolean} - True if price appears valid
         */
        isValid(price) {
            if (!price || typeof price !== 'string') return false;
            
            // Enhanced pattern to include CA$, US$, AU$, etc.
            const pricePatterns = [
                /(?:CA|US|AU|NZ|HK|SG)\$\s*\d+(?:[.,]\d{2})?/,
                /[\$€£¥₹₽]\s*\d+(?:[.,]\d{2})?/,
                /\d+(?:[.,]\d{2})?\s*[\$€£¥₹₽]/,
                /\d+(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB)/i
            ];
            
            const trimmedPrice = price.trim();
            const hasValidPattern = pricePatterns.some(pattern => pattern.test(trimmedPrice));
            
            return hasValidPattern && 
                   !price.includes('Loading') && 
                   !price.includes('loading') &&
                   !price.includes('...') &&
                   price !== ExtensionConfig.messages.notFound.price;
        },
        
        /**
         * Checks if price seems realistic (not too high/low)
         * @param {string} priceString - Price to check
         * @returns {boolean} - True if realistic
         */
        isRealistic(priceString) {
            const numericValue = this.getNumericValue(priceString);
            return numericValue > 0 && numericValue < 100000; // Between $0 and $100,000
        },
        
        /**
         * Extracts numeric value from price string
         * @param {string} priceString - Price string
         * @returns {number} - Numeric value
         */
        getNumericValue(priceString) {
            if (!priceString) return 0;
            
            // Remove currency prefixes (CA$, US$, etc.) and symbols
            const cleanedPrice = priceString.replace(/(?:CA|US|AU|NZ|HK|SG)\$|[^\d.,]/g, '');
            
            // Handle different number formats
            if (cleanedPrice.includes(',') && cleanedPrice.includes('.')) {
                // Format like 1,299.99 - comma as thousands separator
                const match = cleanedPrice.match(/[\d,]+\.?\d*/);
                return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
            } else if (cleanedPrice.includes(',')) {
                // Could be either thousands separator or decimal separator
                const parts = cleanedPrice.split(',');
                if (parts.length === 2 && parts[1].length <= 2) {
                    // Likely decimal separator (e.g., "29,99")
                    return parseFloat(cleanedPrice.replace(',', '.'));
                } else {
                    // Likely thousands separator (e.g., "1,299")
                    return parseFloat(cleanedPrice.replace(/,/g, ''));
                }
            } else {
                // Simple number with just dots
                const match = cleanedPrice.match(/\d+(?:\.\d{2})?/);
                return match ? parseFloat(match[0]) : 0;
            }
        }
    },
    
    /**
     * DOM utilities for element interaction
     */
    dom: {
        /**
         * Safely gets text content from an element
         * @param {string} selector - CSS selector
         * @param {Document} doc - Document to search in
         * @returns {string|null} - Text content or null
         */
        getElementText(selector, doc = document) {
            try {
                const element = doc.querySelector(selector);
                return element ? element.textContent.trim() : null;
            } catch (error) {
                return null;
            }
        },
        
        /**
         * Safely gets attribute value from an element
         * @param {string} selector - CSS selector
         * @param {string} attribute - Attribute name
         * @param {Document} doc - Document to search in
         * @returns {string|null} - Attribute value or null
         */
        getElementAttribute(selector, attribute, doc = document) {
            try {
                const element = doc.querySelector(selector);
                return element ? element.getAttribute(attribute) : null;
            } catch (error) {
                return null;
            }
        },
        
        /**
         * Checks if an element is visible
         * @param {Element} element - Element to check
         * @returns {boolean} - True if visible
         */
        isVisible(element) {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        }
    },
    
    /**
     * Text utilities for cleaning and parsing
     */
    text: {
        /**
         * Normalizes text by removing extra whitespace
         * @param {string} text - Text to normalize
         * @returns {string} - Normalized text
         */
        normalize(text) {
            if (!text) return '';
            return text.replace(/\s+/g, ' ').trim();
        },
        
        /**
         * Checks if text contains any of the given patterns
         * @param {string} text - Text to check
         * @param {Array<string>} patterns - Patterns to look for
         * @returns {boolean} - True if any pattern found
         */
        containsAny(text, patterns) {
            if (!text || !patterns) return false;
            const lowerText = text.toLowerCase();
            return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
        },
        
        /**
         * Extracts price from text using regex
         * @param {string} text - Text to search
         * @returns {string|null} - Extracted price or null
         */
        extractPrice(text) {
            if (!text) return null;
            
            const pricePatterns = [
                // Prefixed currencies like CA$129, US$99, AU$150
                /(?:CA|US|AU|NZ|HK|SG)\$\s*\d+(?:[.,]\d{2})?/g,
                // Standard currency symbols
                /\$\s*\d+(?:[.,]\d{2})?/g,
                /€\s*\d+(?:[.,]\d{2})?/g,
                /£\s*\d+(?:[.,]\d{2})?/g,
                /¥\s*\d+(?:[.,]\d{2})?/g,
                /₹\s*\d+(?:[.,]\d{2})?/g,
                /₽\s*\d+(?:[.,]\d{2})?/g,
                // Numbers followed by currency symbols
                /\d+(?:[.,]\d{2})?\s*\$/g,
                /\d+(?:[.,]\d{2})?\s*€/g,
                /\d+(?:[.,]\d{2})?\s*£/g,
                /\d+(?:[.,]\d{2})?\s*¥/g,
                /\d+(?:[.,]\d{2})?\s*₹/g,
                /\d+(?:[.,]\d{2})?\s*₽/g,
                // Currency codes
                /\d+(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB)/gi
            ];
            
            for (const pattern of pricePatterns) {
                const matches = text.match(pattern);
                if (matches && matches.length > 0) {
                    return matches[0].trim();
                }
            }
            
            return null;
        }
    },
    
    /**
     * Async utilities for delays and retries
     */
    async: {
        /**
         * Creates a delay
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} - Promise that resolves after delay
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        /**
         * Retries a function with exponential backoff
         * @param {Function} fn - Function to retry
         * @param {number} maxAttempts - Maximum attempts
         * @param {Array<number>} delays - Delay array in ms
         * @returns {Promise} - Promise that resolves with result
         */
        async retry(fn, maxAttempts = 3, delays = [1000, 2000, 3000]) {
            let lastError;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    if (attempt < maxAttempts - 1) {
                        await this.delay(delays[attempt] || delays[delays.length - 1]);
                    }
                }
            }
            
            throw lastError;
        }
    },
    
    /**
     * Simple and Reliable Storage utilities for managing saved products
     */
    storage: {
        /**
         * Saves a product to the stored list with proper duplicate handling
         * @param {object} product - Product object with title, price, url, domain
         * @returns {Promise<boolean>} - Success status
         */
        async saveProduct(product) {
            try {
                console.log('💾 [Storage] Saving product:', product);
                
                // This will throw if there's an error, which we want to catch
                const existingProducts = await this._getProductsOrThrow();
                console.log('📋 [Storage] Current products count:', existingProducts.length);
                
                const productId = this.generateProductId(product);
                console.log('🔑 [Storage] Generated ID:', productId);
                
                // Check if product already exists by ID
                const existingIndex = existingProducts.findIndex(p => p.id === productId);
                console.log('🔍 [Storage] Existing index:', existingIndex);
                
                let updatedProducts;
                
                if (existingIndex !== -1) {
                    // Update existing product
                    console.log('🔄 [Storage] Updating existing product');
                    updatedProducts = [...existingProducts];
                    updatedProducts[existingIndex] = {
                        ...product,
                        id: productId,
                        dateAdded: existingProducts[existingIndex].dateAdded, // Preserve original date
                        dateUpdated: new Date().toISOString()
                    };
                } else {
                    // Add new product at the beginning
                    console.log('➕ [Storage] Adding new product');
                    const newProduct = {
                        ...product,
                        id: productId,
                        dateAdded: new Date().toISOString(),
                        dateUpdated: new Date().toISOString()
                    };
                    
                    updatedProducts = [newProduct, ...existingProducts];
                    
                    // Limit the number of stored products
                    if (updatedProducts.length > ExtensionConfig.storage.maxItems) {
                        updatedProducts = updatedProducts.slice(0, ExtensionConfig.storage.maxItems);
                        console.log('✂️ [Storage] Trimmed to max items:', ExtensionConfig.storage.maxItems);
                    }
                }
                
                // Save to Chrome storage
                await chrome.storage.local.set({
                    [ExtensionConfig.storage.keys.productList]: updatedProducts
                });
                
                console.log('✅ [Storage] Successfully saved. New count:', updatedProducts.length);
                return true;
                
            } catch (error) {
                console.error('❌ [Storage] Failed to save product:', error);
                ExtensionUtils.log.error('Failed to save product', error);
                return false;
            }
        },
        
        /**
         * Gets all saved products
         * @returns {Promise<Array>} - Array of saved products
         */
        async getProducts() {
            try {
                const result = await chrome.storage.local.get([ExtensionConfig.storage.keys.productList]);
                const products = result[ExtensionConfig.storage.keys.productList] || [];
                console.log('📋 [Storage] Retrieved products count:', products.length);
                return products;
            } catch (error) {
                console.error('❌ [Storage] Failed to get products:', error);
                ExtensionUtils.log.error('Failed to get products', error);
                return [];
            }
        },
        
        /**
         * Internal method to get products that throws errors (for saveProduct)
         * @returns {Promise<Array>} - Array of saved products
         */
        async _getProductsOrThrow() {
            const result = await chrome.storage.local.get([ExtensionConfig.storage.keys.productList]);
            const products = result[ExtensionConfig.storage.keys.productList] || [];
            console.log('📋 [Storage] Retrieved products count:', products.length);
            return products;
        },
        
        /**
         * Removes a product from the stored list
         * @param {string} productId - ID of the product to remove
         * @returns {Promise<boolean>} - Success status
         */
        async removeProduct(productId) {
            try {
                console.log('🗑️ [Storage] Removing product ID:', productId);
                
                const existingProducts = await this.getProducts();
                const filteredProducts = existingProducts.filter(p => p.id !== productId);
                
                await chrome.storage.local.set({
                    [ExtensionConfig.storage.keys.productList]: filteredProducts
                });
                
                console.log('✅ [Storage] Product removed. New count:', filteredProducts.length);
                return true;
            } catch (error) {
                console.error('❌ [Storage] Failed to remove product:', error);
                ExtensionUtils.log.error('Failed to remove product', error);
                return false;
            }
        },
        
        /**
         * Clears all saved products
         * @returns {Promise<boolean>} - Success status
         */
        async clearProducts() {
            try {
                console.log('🧹 [Storage] Clearing all products');
                
                await chrome.storage.local.set({
                    [ExtensionConfig.storage.keys.productList]: []
                });
                
                console.log('✅ [Storage] All products cleared');
                return true;
            } catch (error) {
                console.error('❌ [Storage] Failed to clear products:', error);
                ExtensionUtils.log.error('Failed to clear products', error);
                return false;
            }
        },
        
        /**
         * Exports products as JSON
         * @returns {Promise<string>} - JSON string of products
         */
        async exportProducts() {
            try {
                console.log('📤 [Storage] Exporting products');
                const products = await this.getProducts();
                return JSON.stringify(products, null, 2);
            } catch (error) {
                console.error('❌ [Storage] Failed to export products:', error);
                ExtensionUtils.log.error('Failed to export products', error);
                return '[]';
            }
        },
        
        /**
         * Generates a unique ID for a product based on URL and title
         * @param {object} product - Product object
         * @returns {string} - Unique product ID
         */
        generateProductId(product) {
            // Create a unique identifier using URL (primary) + title (secondary)
            let identifier;
            
            if (product.url && product.url.trim()) {
                // Use full URL as primary identifier
                identifier = product.url.trim();
            } else {
                // Fallback to title + domain combination
                identifier = `${product.title || 'untitled'}-${product.domain || 'unknown'}`;
            }
            
            // Create a more robust hash using URL + title for uniqueness
            const combined = `${identifier}|${product.title || ''}`;
            
            // Use a simple hash function for better uniqueness
            let hash = 0;
            for (let i = 0; i < combined.length; i++) {
                const char = combined.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            
            // Convert to positive number and then to base36 for shorter ID
            const cleanId = Math.abs(hash).toString(36).substring(0, 16);
            
            console.log('🔑 [Storage] Generated ID for:', identifier, '→', cleanId);
            return cleanId;
        },
        
        /**
         * Validates a product object
         * @param {object} product - Product to validate
         * @returns {boolean} - True if valid
         */
        isValidProduct(product) {
            const isValid = product && 
                           product.title && 
                           product.title.trim() !== '' &&
                           product.title !== ExtensionConfig.messages.notFound.title &&
                           product.title !== 'No title found';
            
            console.log('✅ [Storage] Product validation:', isValid, 'for:', product?.title);
            return isValid;
        }
    },

    /**
     * Chrome extension specific utilities with improved error handling
     */
    chrome: {
        /**
         * Safely sends a message to a tab with timeout and retry
         * @param {number} tabId - ID of the tab
         * @param {object} message - Message to send
         * @param {number} timeoutMs - Timeout in milliseconds
         * @returns {Promise} - Promise that resolves with the response
         */
        sendMessageToTab(tabId, message, timeoutMs = 5000) {
            return new Promise((resolve, reject) => {
                console.log('📤 [Chrome] Sending message to tab:', tabId, message);
                
                // Set up timeout
                const timeoutId = setTimeout(() => {
                    console.log('⏰ [Chrome] Message timeout for tab:', tabId);
                    resolve(null); // Return null instead of rejecting for timeout
                }, timeoutMs);
                
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    clearTimeout(timeoutId);
                    
                    if (chrome.runtime.lastError) {
                        console.log('⚠️ [Chrome] Message error:', chrome.runtime.lastError.message);
                        // Don't reject for content script errors, return null
                        resolve(null);
                    } else {
                        console.log('✅ [Chrome] Message response:', response);
                        resolve(response);
                    }
                });
            });
        },
        
        /**
         * Gets the current active tab
         * @returns {Promise<object>} - Promise that resolves with the active tab
         */
        async getCurrentTab() {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const tab = tabs[0];
                console.log('📋 [Chrome] Current tab:', tab?.url);
                return tab;
            } catch (error) {
                console.error('❌ [Chrome] Failed to get current tab:', error);
                return null;
            }
        },
        
        /**
         * Creates a new tab
         * @param {string} url - URL for the new tab
         * @param {boolean} active - Whether the tab should be active
         * @returns {Promise<object>} - Promise that resolves with the new tab
         */
        createTab(url, active = false) {
            return new Promise((resolve, reject) => {
                console.log('🆕 [Chrome] Creating tab:', url);
                
                chrome.tabs.create({ url, active }, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ [Chrome] Failed to create tab:', chrome.runtime.lastError.message);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('✅ [Chrome] Tab created:', tab.id);
                        resolve(tab);
                    }
                });
            });
        },
        
        /**
         * Checks if content script is available in a tab
         * @param {number} tabId - ID of the tab
         * @returns {Promise<boolean>} - True if content script responds
         */
        async isContentScriptAvailable(tabId) {
            try {
                const response = await this.sendMessageToTab(tabId, { action: 'ping' }, 2000);
                return response !== null;
            } catch (error) {
                return false;
            }
        }
    },
    
    /**
     * Logging utilities
     */
    log: {
        /**
         * Logs a message if debug mode is enabled
         * @param {string} level - Log level (debug, info, warn, error)
         * @param {string} message - Message to log
         * @param {...any} args - Additional arguments
         */
        write(level, message, ...args) {
            if (ExtensionConfig.debug.enabled) {
                const timestamp = new Date().toISOString();
                console[level](`[${timestamp}] ${message}`, ...args);
            }
        },
        
        debug(message, ...args) { this.write('debug', message, ...args); },
        info(message, ...args) { this.write('info', message, ...args); },
        warn(message, ...args) { this.write('warn', message, ...args); },
        error(message, ...args) { this.write('error', message, ...args); }
    }
};

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionUtils;
} 