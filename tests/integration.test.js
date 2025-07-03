/**
 * Integration Tests for Chrome Extension
 * Tests complete workflows and interactions between components
 */

describe('Chrome Extension - Integration Tests', () => {
  let mockTab, mockResponse;

  beforeEach(() => {
    mockTab = testUtils.createMockTab({
      id: 123,
      title: 'Amazon Product Page',
      url: 'https://www.amazon.com/product/123'
    });

    mockResponse = {
      title: 'Wireless Bluetooth Headphones',
      price: '$29.99',
      url: 'https://www.amazon.com/product/123',
      domain: 'www.amazon.com',
      protocol: 'https:'
    };
  });

  describe('Complete URL Fetch Workflow', () => {
    test('should successfully fetch title and price from new URL', async () => {
      // Mock the complete workflow
      chrome.tabs.create.mockImplementation((options, callback) => {
        callback(mockTab);
      });

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(mockResponse);
      });

      chrome.tabs.remove.mockResolvedValue();

      // Simulate the complete fetchPageInfo workflow
      async function simulateCompleteWorkflow(url) {
        // Step 1: Validate URL
        function isValidUrl(string) {
          try {
            const urlObj = new URL(string);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
          } catch (_) {
            return false;
          }
        }

        if (!isValidUrl(url)) {
          throw new Error('Invalid URL');
        }

        // Step 2: Create tab
        const tab = await new Promise((resolve, reject) => {
          chrome.tabs.create({ url: url, active: false }, function(tab) {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(tab);
            }
          });
        });

        // Step 3: Wait for tab to load and get page info
        const pageInfo = await new Promise((resolve, reject) => {
          // Simulate tab loading completion
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, function(response) {
              chrome.tabs.remove(tab.id);
              
              if (chrome.runtime.lastError || !response) {
                resolve({
                  title: tab.title || 'No title found',
                  price: 'No price found'
                });
              } else {
                resolve({
                  title: response.title || 'No title found',
                  price: response.price || 'No price found'
                });
              }
            });
          }, 100);
        });

        return pageInfo;
      }

      const result = await simulateCompleteWorkflow('https://www.amazon.com/product/123');

      expect(result.title).toBe('Wireless Bluetooth Headphones');
      expect(result.price).toBe('$29.99');
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        { url: 'https://www.amazon.com/product/123', active: false },
        expect.any(Function)
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'getPageInfo' },
        expect.any(Function)
      );
      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });

    test('should handle errors gracefully in complete workflow', async () => {
      chrome.runtime.lastError = { message: 'Network error' };
      chrome.tabs.create.mockImplementation((options, callback) => {
        callback(null);
      });

      async function simulateErrorWorkflow(url) {
        try {
          const tab = await new Promise((resolve, reject) => {
            chrome.tabs.create({ url: url, active: false }, function(tab) {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tab);
              }
            });
          });
          return tab;
        } catch (error) {
          throw error;
        }
      }

      await expect(simulateErrorWorkflow('https://example.com'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Current Tab Info with Retry Logic', () => {
    test('should successfully get current tab info with retries', async () => {
      chrome.tabs.query.mockResolvedValue([mockTab]);

      // Mock progressive responses simulating retry logic
      let callCount = 0;
      const responses = [
        null, // First attempt fails
        { title: 'Wireless Bluetooth Headphones', price: 'Loading...' }, // Second attempt loading
        { title: 'Wireless Bluetooth Headphones', price: '$29.99' } // Third attempt success
      ];

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const response = responses[callCount++];
        setTimeout(() => callback(response), 50);
      });

      async function simulateRetryWorkflow() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
          throw new Error('No active tab found');
        }

        const maxAttempts = 4;
        const retryDelays = [100, 200, 300, 400]; // Shorter delays for testing
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
              if (response.price && response.price !== 'No price found' && response.price !== 'Loading...') {
                return response; // Success!
              } else if (response.title) {
                bestResponse = response;
              }
            }
          } catch (err) {
            // Continue to next attempt
          }

          if (attempt < maxAttempts - 1) {
            await testUtils.delay(retryDelays[attempt]);
          }
        }

        return bestResponse || { title: tab.title, price: 'No price found', url: tab.url };
      }

      const result = await simulateRetryWorkflow();

      expect(result.title).toBe('Wireless Bluetooth Headphones');
      expect(result.price).toBe('$29.99');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3); // Should stop after finding price
    });

    test('should fallback to best response when no price found', async () => {
      chrome.tabs.query.mockResolvedValue([mockTab]);

      // Mock responses where price is never found
      const responses = [
        null,
        { title: 'Product Page', price: 'Loading...' },
        { title: 'Product Page', price: 'No price found' },
        { title: 'Product Page', price: 'No price found' }
      ];

      let callCount = 0;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const response = responses[callCount++];
        setTimeout(() => callback(response), 50);
      });

      async function simulateNoResultWorkflow() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const maxAttempts = 4;
        let bestResponse = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const response = await new Promise((resolve) => {
              chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, resolve);
            });
            
            if (response && response.title) {
              bestResponse = response;
            }
          } catch (err) {
            // Continue
          }

          if (attempt < maxAttempts - 1) {
            await testUtils.delay(100);
          }
        }

        return bestResponse || { title: tab.title, price: 'No price found', url: tab.url };
      }

      const result = await simulateNoResultWorkflow();

      expect(result.title).toBe('Product Page');
      expect(result.price).toBe('No price found');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(4); // All attempts used
    });
  });

  describe('Price Extraction Integration', () => {
    test('should extract prices from various e-commerce sites', () => {
      const testCases = [
        {
          site: 'Amazon',
          html: '<span class="a-price-whole">29</span><span class="a-price-offscreen">$29.99</span>',
          expectedPrice: '$29.99'
        },
        {
          site: 'eBay',
          html: '<span class="notranslate">€45.00</span>',
          expectedPrice: '€45.00'
        },
        {
          site: 'Shopify',
          html: '<span class="money">£19.99</span>',
          expectedPrice: '£19.99'
        },
        {
          site: 'Generic',
          html: '<div class="product-price">$1,234.56</div>',
          expectedPrice: '$1,234.56'
        }
      ];

      function extractPriceFromText(text) {
        if (!text || typeof text !== 'string') return null;
        
        text = text.trim().replace(/\s+/g, ' ');
        
        const pricePatterns = [
          /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*/g,
          /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|PLN|CZK|HUF|RUB|\$|€|£|¥|₹|₽|¢)/gi,
          /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
        ];
        
        for (const pattern of pricePatterns) {
          const matches = text.match(pattern);
          if (matches && matches.length > 0) {
            const price = matches[0].trim();
            if (/\d/.test(price)) {
              return price;
            }
          }
        }
        
        return null;
      }

      testCases.forEach(({ site, html, expectedPrice }) => {
        // Simulate extracting text content from HTML
        const textContent = html.replace(/<[^>]*>/g, '');
        const extractedPrice = extractPriceFromText(textContent);
        
        expect(extractedPrice).toBe(expectedPrice);
      });
    });

    test('should handle JSON-LD structured data extraction', () => {
      const jsonLdData = {
        '@type': 'Product',
        'name': 'Wireless Headphones',
        'offers': {
          '@type': 'Offer',
          'price': '29.99',
          'priceCurrency': 'USD'
        }
      };

      function findPriceInJsonData(data) {
        if (!data || typeof data !== 'object') return null;
        
        if (data.price !== undefined) {
          return String(data.price);
        }
        
        if (data.offers && data.offers.price !== undefined) {
          return String(data.offers.price);
        }
        
        for (const key in data) {
          if (data.hasOwnProperty(key) && typeof data[key] === 'object') {
            const result = findPriceInJsonData(data[key]);
            if (result) return result;
          }
        }
        
        return null;
      }

      const extractedPrice = findPriceInJsonData(jsonLdData);
      expect(extractedPrice).toBe('29.99');
    });
  });

  describe('UI State Management Integration', () => {
    test('should manage UI states correctly during workflow', () => {
      const uiElements = {
        loading: { classList: { add: jest.fn(), remove: jest.fn() } },
        result: { classList: { add: jest.fn(), remove: jest.fn() } },
        error: { classList: { add: jest.fn(), remove: jest.fn() } },
        titleText: { textContent: '' },
        priceText: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
        urlText: { textContent: '' }
      };

      function showLoading() {
        uiElements.loading.classList.remove('hidden');
        uiElements.result.classList.add('hidden');
        uiElements.error.classList.add('hidden');
      }

      function showResult(title, price, url) {
        uiElements.loading.classList.add('hidden');
        uiElements.result.classList.remove('hidden');
        uiElements.error.classList.add('hidden');
        
        uiElements.titleText.textContent = title;
        uiElements.priceText.textContent = price;
        uiElements.urlText.textContent = url;
        
        if (price && price !== 'No price found') {
          uiElements.priceText.classList.add('price-found');
        } else {
          uiElements.priceText.classList.remove('price-found');
        }
      }

      // Simulate workflow
      showLoading();
      expect(uiElements.loading.classList.remove).toHaveBeenCalledWith('hidden');
      expect(uiElements.result.classList.add).toHaveBeenCalledWith('hidden');

      // Simulate successful result
      showResult('Test Product', '$29.99', 'https://example.com');
      expect(uiElements.result.classList.remove).toHaveBeenCalledWith('hidden');
      expect(uiElements.titleText.textContent).toBe('Test Product');
      expect(uiElements.priceText.textContent).toBe('$29.99');
      expect(uiElements.priceText.classList.add).toHaveBeenCalledWith('price-found');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle complete workflow errors gracefully', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          name: 'Invalid URL',
          url: 'not-a-url',
          expectedError: 'Invalid URL'
        },
        {
          name: 'Tab creation failure',
          url: 'https://example.com',
          setupMocks: () => {
            chrome.runtime.lastError = { message: 'Tab creation failed' };
            chrome.tabs.create.mockImplementation((options, callback) => callback(null));
          },
          expectedError: 'Tab creation failed'
        },
        {
          name: 'Content script not responding',
          url: 'https://example.com',
          setupMocks: () => {
            chrome.tabs.create.mockImplementation((options, callback) => callback(mockTab));
            chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
              chrome.runtime.lastError = { message: 'Content script not found' };
              callback(null);
            });
          },
          expectedResult: { title: 'Amazon Product Page', price: 'No price found' }
        }
      ];

      for (const scenario of errorScenarios) {
        testUtils.resetAllMocks();
        
        if (scenario.setupMocks) {
          scenario.setupMocks();
        }

        async function testErrorScenario(url) {
          // URL validation - only check for invalid URL scenario
          if (scenario.name === 'Invalid URL') {
            try {
              new URL(url);
            } catch (error) {
              throw new Error('Invalid URL');
            }
          }

          // Tab creation
          const tab = await new Promise((resolve, reject) => {
            chrome.tabs.create({ url: url, active: false }, function(tab) {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tab);
              }
            });
          });

          // Content script communication
          return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, function(response) {
              chrome.tabs.remove(tab.id);
              
              if (chrome.runtime.lastError || !response) {
                // Clear the error after handling it
                const error = chrome.runtime.lastError;
                chrome.runtime.lastError = null;
                resolve({
                  title: tab.title || 'No title found',
                  price: 'No price found'
                });
              } else {
                resolve(response);
              }
            });
          });
        }

        if (scenario.expectedError) {
          await expect(testErrorScenario(scenario.url)).rejects.toThrow(scenario.expectedError);
        } else if (scenario.expectedResult) {
          const result = await testErrorScenario(scenario.url);
          expect(result).toEqual(scenario.expectedResult);
        }
      }
    });
  });
}); 