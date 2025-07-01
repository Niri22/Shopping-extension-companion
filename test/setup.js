/**
 * Jest Setup File
 * Global test configuration and mocks for Chrome Extension testing
 */

// Mock Chrome Extension APIs globally
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
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
      remove: jest.fn(),
      clear: jest.fn()
    }
  }
};

// Mock DOM APIs
global.document = {
  title: '',
  readyState: 'complete',
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  createElement: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

global.window = {
  location: {
    href: 'https://example.com/product',
    hostname: 'example.com',
    protocol: 'https:'
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock URL constructor for older environments
if (!global.URL) {
  global.URL = class URL {
    constructor(url) {
      if (!url || typeof url !== 'string') {
        throw new TypeError('Invalid URL');
      }
      
      // Simple URL parsing for testing
      const match = url.match(/^(https?):\/\/(.+)/);
      if (!match) {
        throw new TypeError('Invalid URL');
      }
      
      this.protocol = match[1] + ':';
      this.hostname = match[2].split('/')[0];
      this.href = url;
    }
    
    static createObjectURL = jest.fn(() => 'blob:mock-url');
    static revokeObjectURL = jest.fn();
  };
}

// Mock Blob for file operations
global.Blob = jest.fn((content, options) => ({
  size: content ? content.join('').length : 0,
  type: options?.type || 'text/plain'
}));

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Setup global test utilities
global.testUtils = {
  // Helper to create mock DOM elements
  createMockElement: (tag, attributes = {}) => ({
    tagName: tag.toUpperCase(),
    className: attributes.className || '',
    id: attributes.id || '',
    textContent: attributes.textContent || '',
    getAttribute: jest.fn((attr) => attributes[attr]),
    setAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    parentElement: attributes.parentElement || null,
    ...attributes
  }),

  // Helper to create mock Chrome tab
  createMockTab: (overrides = {}) => ({
    id: 123,
    title: 'Test Page',
    url: 'https://example.com',
    active: true,
    ...overrides
  }),

  // Helper to reset all mocks
  resetAllMocks: () => {
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
  },

  // Helper to simulate async delays in tests
  delay: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
};

// Reset mocks before each test
beforeEach(() => {
  testUtils.resetAllMocks();
});

// Custom matchers for better assertions
expect.extend({
  toBeValidPrice(received) {
    const priceRegex = /[\$€£¥₹₽¢]\s*[\d,]+\.?\d*|[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|INR)/;
    const pass = typeof received === 'string' && priceRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid price`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid price format`,
        pass: false
      };
    }
  },

  toBeValidUrl(received) {
    try {
      const url = new URL(received);
      const pass = url.protocol === 'http:' || url.protocol === 'https:';
      
      if (pass) {
        return {
          message: () => `expected ${received} not to be a valid URL`,
          pass: true
        };
      } else {
        return {
          message: () => `expected ${received} to be a valid HTTP/HTTPS URL`,
          pass: false
        };
      }
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false
      };
    }
  }
}); 