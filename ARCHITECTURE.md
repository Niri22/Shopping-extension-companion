# Chrome Extension Architecture

## Overview

This Chrome extension has been refactored using modern JavaScript patterns with a focus on maintainability, modularity, and testability. The architecture follows object-oriented principles with clear separation of concerns.

## File Structure

```
Shopping-extension-companion/
├── manifest.json           # Extension manifest
├── config.js              # Centralized configuration
├── utils.js               # Common utility functions
├── content.js             # Content script (refactored)
├── popup.html             # Extension popup UI
├── popup.js               # Popup controller (refactored)
├── styles.css             # Styling
├── test/                  # Test suite
│   ├── content.test.js    # Content script tests
│   ├── popup.test.js      # Popup tests
│   ├── integration.test.js # Integration tests
│   ├── setup.js           # Test configuration
│   ├── run-tests.js       # Test runner
│   └── README.md          # Testing documentation
└── package.json           # Project configuration
```

## Core Components

### 1. Configuration Layer (`config.js`)

**Purpose**: Centralized configuration management
**Pattern**: Configuration object with nested namespaces

```javascript
const ExtensionConfig = {
    timing: { /* timing settings */ },
    priceExtraction: { /* price extraction rules */ },
    messages: { /* user-facing messages */ },
    ui: { /* UI element mappings */ }
};
```

**Benefits**:
- Single source of truth for all settings
- Easy to modify behavior without code changes
- Supports different environments (dev/prod)
- Type-safe configuration access

### 2. Utility Layer (`utils.js`)

**Purpose**: Common functionality shared across components
**Pattern**: Namespace object with categorized utilities

```javascript
const ExtensionUtils = {
    url: { /* URL validation & manipulation */ },
    price: { /* Price validation & formatting */ },
    dom: { /* DOM manipulation helpers */ },
    text: { /* Text processing utilities */ },
    async: { /* Async operation helpers */ },
    chrome: { /* Chrome API wrappers */ },
    log: { /* Logging utilities */ }
};
```

**Benefits**:
- Reduces code duplication
- Provides consistent API patterns
- Easier testing of isolated functions
- Better error handling

### 3. Content Script (`content.js`)

**Purpose**: Page information extraction
**Pattern**: ES6 Class with dependency injection

```javascript
class PageInfoExtractor {
    constructor() { /* initialization */ }
    
    // Public API
    extractPageInfo() { /* main entry point */ }
    extractTitle() { /* title extraction */ }
    extractPrice() { /* price extraction */ }
    
    // Private methods
    extractLoadedPrice() { /* smart price detection */ }
    extractStandardPrice() { /* fallback extraction */ }
    // ... helper methods
}
```

**Key Features**:
- **Smart Loading Detection**: Avoids placeholder content
- **Multi-Strategy Extraction**: DOM selectors, JSON-LD, meta tags, text parsing
- **Platform-Specific Selectors**: Optimized for major e-commerce sites
- **Retry Logic**: Handles dynamic content loading
- **Configuration-Driven**: Uses centralized config for selectors and patterns

### 4. Popup Controller (`popup.js`)

**Purpose**: UI management and Chrome API interaction
**Pattern**: ES6 Class with event-driven architecture

```javascript
class ExtensionPopup {
    constructor() { /* initialization */ }
    
    // Event handlers
    handleFetchInfo() { /* URL-based fetching */ }
    handleCurrentTabInfo() { /* current tab processing */ }
    
    // Core functionality
    fetchPageInfo() { /* new tab creation */ }
    retryGetPageInfo() { /* retry logic */ }
    
    // UI management
    showLoading() { /* loading state */ }
    showResult() { /* results display */ }
    showError() { /* error handling */ }
}
```

**Key Features**:
- **Progressive Retry Logic**: Multiple attempts with increasing delays
- **Smart Error Handling**: Graceful degradation with fallbacks
- **Configuration-Driven**: Uses centralized timing and message configs
- **Utility Integration**: Leverages shared utilities for common operations

## Design Patterns Used

### 1. **Configuration Pattern**
- Centralized configuration object
- Environment-specific settings
- Runtime configuration access

### 2. **Utility Pattern**
- Namespace organization
- Pure functions where possible
- Consistent error handling

### 3. **Class-Based Architecture**
- Clear encapsulation
- Private/public method distinction
- Dependency injection ready

### 4. **Strategy Pattern**
- Multiple extraction strategies
- Fallback mechanisms
- Platform-specific implementations

### 5. **Observer Pattern**
- Event-driven UI updates
- Chrome API event handling
- DOM event management

## Data Flow

```
User Input → Popup Controller → Chrome APIs → Content Script → Page DOM
     ↑                                                            ↓
UI Updates ← Result Processing ← Message Passing ← Data Extraction
```

### 1. **URL-Based Flow**:
1. User enters URL in popup
2. Popup validates URL using utilities
3. New tab created with URL
4. Content script injected and executed
5. Page information extracted
6. Results returned to popup
7. UI updated with results

### 2. **Current Tab Flow**:
1. User clicks current tab button
2. Popup gets active tab reference
3. Message sent to content script
4. Retry logic handles loading states
5. Best available result returned
6. UI updated with results

## Error Handling Strategy

### 1. **Graceful Degradation**
```javascript
// Always provide fallback values
title: response?.title || tab.title || ExtensionConfig.messages.notFound.title
```

### 2. **Progressive Retry**
```javascript
// Multiple attempts with increasing delays
for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // ... attempt logic
    await ExtensionUtils.async.delay(delays[attempt]);
}
```

### 3. **Centralized Error Messages**
```javascript
// Consistent error messaging
this.showError(ExtensionConfig.messages.errors.invalidUrl);
```

## Testing Architecture

### 1. **Unit Tests**
- Individual component testing
- Mock Chrome APIs
- Isolated function testing

### 2. **Integration Tests**
- Cross-component workflows
- End-to-end scenarios
- Error condition testing

### 3. **Test Utilities**
- Custom Jest matchers
- Mock factories
- Test data generators

## Performance Optimizations

### 1. **Smart Loading Detection**
- Avoids extracting placeholder content
- Waits for dynamic content to load
- Progressive timeout handling

### 2. **Efficient DOM Queries**
- Cached selectors
- Platform-specific optimizations
- Minimal DOM traversal

### 3. **Async Optimization**
- Parallel processing where possible
- Progressive delays in retry logic
- Timeout management

## Extensibility

### 1. **Adding New E-commerce Sites**
```javascript
// Add to config.js
ExtensionConfig.priceExtraction.selectors.newSite = [
    '.new-site-price',
    '.new-site-amount'
];
```

### 2. **Adding New Extraction Strategies**
```javascript
// Add to PageInfoExtractor class
extractPriceFromNewSource() {
    // Implementation
}
```

### 3. **Adding New UI Features**
```javascript
// Add to ExtensionPopup class
handleNewFeature() {
    // Implementation
}
```

## Security Considerations

### 1. **Content Script Isolation**
- Runs in isolated world
- Limited DOM access
- Secure message passing

### 2. **URL Validation**
- Strict protocol checking
- Input sanitization
- XSS prevention

### 3. **Permission Management**
- Minimal required permissions
- Secure Chrome API usage
- No eval() or unsafe operations

## Future Improvements

### 1. **Caching Layer**
- Local storage for extracted data
- Cache invalidation strategies
- Performance monitoring

### 2. **Advanced Price Detection**
- Machine learning integration
- OCR for image prices
- Historical price tracking

### 3. **Multi-language Support**
- Internationalization framework
- Currency conversion
- Localized error messages

This architecture provides a solid foundation for maintaining and extending the Chrome extension while ensuring reliability, performance, and user experience. 