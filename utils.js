/**
 * Utility Functions for Chrome Extension
 * Common helper functions used across different parts of the extension
 */

const ExtensionUtils = {
    
    /**
     * URL validation and manipulation
     */
    url: {
        /**
         * Validates if a string is a valid HTTP/HTTPS URL
         * @param {string} url - The URL to validate
         * @returns {object} - Validation result with valid flag and error message
         */
        validate(url) {
            if (!url || typeof url !== 'string') {
                return { 
                    valid: false, 
                    error: ExtensionConfig.messages.errors.emptyUrl 
                };
            }
            
            try {
                const urlObj = new URL(url.trim());
                if (!['http:', 'https:'].includes(urlObj.protocol)) {
                    return { 
                        valid: false, 
                        error: ExtensionConfig.messages.errors.invalidUrl 
                    };
                }
                return { valid: true };
            } catch (error) {
                return { 
                    valid: false, 
                    error: ExtensionConfig.messages.errors.invalidUrl 
                };
            }
        },
        
        /**
         * Normalizes a URL by trimming whitespace and ensuring proper format
         * @param {string} url - The URL to normalize
         * @returns {string} - Normalized URL
         */
        normalize(url) {
            if (!url) return '';
            return url.trim();
        }
    },
    
    /**
     * Price validation and formatting utilities
     */
    price: {
        /**
         * Checks if a price string represents a valid, loaded price
         * @param {string} price - The price string to validate
         * @returns {boolean} - True if price is valid and loaded
         */
        isValid(price) {
            return price && 
                   price !== ExtensionConfig.messages.notFound.price &&
                   price !== ExtensionConfig.messages.loading.pageLoading &&
                   price !== ExtensionConfig.messages.loading.dynamicContent;
        },
        
        /**
         * Validates that a price is realistic (within reasonable bounds)
         * @param {string} priceString - The price string to validate
         * @returns {boolean} - True if price is realistic
         */
        isRealistic(priceString) {
            const numericValue = parseFloat(priceString.replace(/[^\d.]/g, ''));
            const config = ExtensionConfig.priceExtraction.validation;
            return numericValue >= config.minPrice && numericValue <= config.maxPrice;
        },
        
        /**
         * Extracts numeric value from price string
         * @param {string} priceString - The price string
         * @returns {number} - Numeric value of the price
         */
        getNumericValue(priceString) {
            if (!priceString) return 0;
            return parseFloat(priceString.replace(/[^\d.]/g, '')) || 0;
        }
    },
    
    /**
     * DOM manipulation utilities
     */
    dom: {
        /**
         * Safely gets text content from an element
         * @param {string} selector - CSS selector for the element
         * @param {Document} doc - Document to search in (defaults to document)
         * @returns {string} - Text content or empty string
         */
        getElementText(selector, doc = document) {
            try {
                const element = doc.querySelector(selector);
                return element?.textContent?.trim() || '';
            } catch (error) {
                return '';
            }
        },
        
        /**
         * Safely gets attribute content from an element
         * @param {string} selector - CSS selector for the element
         * @param {string} attribute - Attribute name to get
         * @param {Document} doc - Document to search in (defaults to document)
         * @returns {string} - Attribute content or empty string
         */
        getElementAttribute(selector, attribute, doc = document) {
            try {
                const element = doc.querySelector(selector);
                return element?.getAttribute(attribute)?.trim() || '';
            } catch (error) {
                return '';
            }
        },
        
        /**
         * Checks if an element is visible
         * @param {Element} element - The element to check
         * @returns {boolean} - True if element is visible
         */
        isVisible(element) {
            if (!element) return false;
            return element.offsetParent !== null && 
                   element.offsetWidth > 0 && 
                   element.offsetHeight > 0;
        }
    },
    
    /**
     * Text processing utilities
     */
    text: {
        /**
         * Normalizes text by trimming and collapsing whitespace
         * @param {string} text - Text to normalize
         * @returns {string} - Normalized text
         */
        normalize(text) {
            if (!text || typeof text !== 'string') return '';
            return text.trim().replace(/\s+/g, ' ');
        },
        
        /**
         * Checks if text contains any of the specified patterns
         * @param {string} text - Text to check
         * @param {string[]} patterns - Array of patterns to look for
         * @returns {boolean} - True if any pattern is found
         */
        containsAny(text, patterns) {
            if (!text || !Array.isArray(patterns)) return false;
            const lowerText = text.toLowerCase();
            return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
        },
        
        /**
         * Extracts price using regex patterns
         * @param {string} text - Text to extract price from
         * @returns {string|null} - Extracted price or null
         */
        extractPrice(text) {
            if (!text || typeof text !== 'string') return null;
            
            const normalizedText = this.normalize(text);
            const patterns = ExtensionConfig.priceExtraction.patterns;
            
            for (const pattern of patterns) {
                const matches = normalizedText.match(pattern);
                if (matches && matches.length > 0) {
                    const price = matches[0].trim();
                    if (/\d/.test(price)) {
                        return price;
                    }
                }
            }
            
            return null;
        }
    },
    
    /**
     * Async utilities
     */
    async: {
        /**
         * Creates a delay promise
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} - Promise that resolves after the delay
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        /**
         * Implements retry logic with progressive delays
         * @param {Function} fn - Function to retry
         * @param {number} maxAttempts - Maximum number of attempts
         * @param {number[]} delays - Array of delay times between attempts
         * @returns {Promise} - Promise that resolves with the result
         */
        async retry(fn, maxAttempts = 3, delays = [1000, 2000, 3000]) {
            let lastError;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    
                    if (attempt < maxAttempts - 1) {
                        const delay = delays[attempt] || delays[delays.length - 1];
                        await this.delay(delay);
                    }
                }
            }
            
            throw lastError;
        }
    },
    
    /**
     * Chrome extension specific utilities
     */
    chrome: {
        /**
         * Safely sends a message to a tab
         * @param {number} tabId - ID of the tab
         * @param {object} message - Message to send
         * @returns {Promise} - Promise that resolves with the response
         */
        sendMessageToTab(tabId, message) {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
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
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            return tabs[0];
        },
        
        /**
         * Creates a new tab
         * @param {string} url - URL for the new tab
         * @param {boolean} active - Whether the tab should be active
         * @returns {Promise<object>} - Promise that resolves with the new tab
         */
        createTab(url, active = false) {
            return new Promise((resolve, reject) => {
                chrome.tabs.create({ url, active }, (tab) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(tab);
                    }
                });
            });
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
            if (!ExtensionConfig.debug.enabled) return;
            
            const logLevel = ExtensionConfig.debug.logLevel;
            const levels = ['debug', 'info', 'warn', 'error'];
            const currentLevelIndex = levels.indexOf(logLevel);
            const messageLevelIndex = levels.indexOf(level);
            
            if (messageLevelIndex >= currentLevelIndex) {
                console[level](`[${ExtensionConfig.name}] ${message}`, ...args);
            }
        },
        
        debug(message, ...args) { this.write('debug', message, ...args); },
        info(message, ...args) { this.write('info', message, ...args); },
        warn(message, ...args) { this.write('warn', message, ...args); },
        error(message, ...args) { this.write('error', message, ...args); }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionUtils;
}

// Make available globally for browser environment
if (typeof window !== 'undefined') {
    window.ExtensionUtils = ExtensionUtils;
} 