# 🛍️ WishCart - Smart Shopping Companion

**WishCart** is a modern Chrome extension that transforms your online shopping experience with intelligent wishlist management and **automatic daily price tracking**.

## Features

### 🛒 Core Shopping Features
- **Smart Product Detection**: Automatically identifies and extracts product information
- **Intelligent Price Tracking**: Advanced price extraction from major e-commerce sites
- **WishCart Management**: Save and organize products in your personal wishlist
- **Daily Price Monitoring**: Automatic 24/7 price tracking with drop notifications
- **Multi-Currency Support**: Supports USD, EUR, GBP, CAD, and many more currencies
- **Duplicate Prevention**: Smart detection prevents duplicate products in your WishCart

### ⚡ Advanced Features
- **Multi-Strategy Extraction**: Advanced algorithms using CSS selectors, structured data, and meta tags
- **Robust Error Handling**: Smart retry logic with exponential backoff for reliability
- **Performance Optimized**: Intelligent caching and efficient storage management
- **Cross-Tab Synchronization**: Seamlessly works across all browser tabs
- **Data Export**: Export your WishCart to JSON format for backup

### 🎯 Automatic Price Tracking
- **24/7 Monitoring**: Continuous price surveillance without manual intervention
- **Smart Price Drop Alerts**: Intelligent detection of meaningful price reductions
- **Detailed Price History**: Complete price timeline (last 10 changes per product)
- **Currency-Aware Comparison**: Handles various formats and ignores minor fluctuations
- **Background Intelligence**: All monitoring happens silently in the background

## 🚀 How WishCart Works

### 🛍️ Basic Shopping Flow
1. **Install WishCart** in Chrome Browser
2. **Click the WishCart icon** in your toolbar  
3. **Browse any product page** or enter a product URL
4. **Get current product info** with one click
5. **Add to WishCart** with the "✨ Add to WishCart" button
6. **Manage your collection** in the beautiful, modern interface

### 📈 Automatic Price Tracking
1. **Add products** to your WishCart as usual
2. **Automatic monitoring begins** - WishCart sets up 24-hour price surveillance
3. **Review price history** - see complete price trends and changes
4. **Discover price drops** - get insights on when products become cheaper
5. **Manual price checks** - trigger immediate updates when needed

## Technical Implementation

### Architecture
- **Popup Script** (`popup.js`): Main UI and user interactions
- **Content Script** (`content.js`): Page information extraction
- **Background Script** (`background.js`): Daily price tracking service
- **Price Tracker** (`services/PriceTracker.js`): Core price monitoring logic
- **Utilities** (`utils.js`): Shared helper functions
- **Configuration** (`config.js`): Centralized settings

### Price Tracking Logic
```javascript
// Daily alarm setup (24 hours)
chrome.alarms.create('dailyPriceCheck', {
    delayInMinutes: 1440,
    periodInMinutes: 1440
});

// Price comparison with smart detection
const priceComparison = this.comparePrices(originalPrice, currentPrice);
if (priceComparison.dropped) {
    // Price has dropped - update product and history
}
```

### Storage Structure
```javascript
// Product with price tracking
{
    id: 'product_123',
    title: 'Product Name',
    price: '$29.99',
    url: 'https://example.com/product',
    dateAdded: '2024-01-01T10:00:00.000Z',
    lastPriceUpdate: '2024-01-15T10:00:00.000Z',
    priceHistory: [
        {
            price: '$39.99',
            date: '2024-01-01T10:00:00.000Z',
            dropped: false
        },
        {
            price: '$29.99',
            date: '2024-01-15T10:00:00.000Z',
            dropped: true
        }
    ]
}
```

## 🌐 Supported Shopping Sites

WishCart works seamlessly across major e-commerce platforms:
- **🛒 Amazon** - All product pages with pricing information
- **🏪 eBay** - Auction listings and Buy It Now items
- **💼 Shopify Stores** - Thousands of Shopify-powered websites
- **🛍️ WooCommerce** - WordPress-based online stores
- **🏬 Target, Best Buy, Walmart** - Major retail websites
- **🌟 And Many More** - Any site with structured product data

## Permissions

- `activeTab`: Access current tab information
- `tabs`: Create and manage tabs for price checking
- `storage`: Save wishlist and price tracking data
- `alarms`: Schedule daily price checks

## 📥 Installation

1. **Download** or clone this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. **Click "Load unpacked"** and select the WishCart directory
5. **Pin WishCart** to your toolbar for easy access
6. **Start shopping smarter!** 🛍️

## 🧪 Testing & Quality Assurance

WishCart includes comprehensive testing to ensure reliability and performance:

### Test Coverage
- **152 total tests** across 7 test files
- **Core Features**: 100% coverage
- **Price Tracking**: 33 dedicated tests
- **Error Handling**: 95% coverage
- **Edge Cases**: 90% coverage
- **UI Interactions**: 85% coverage

### Test Categories
- **Price Tracker Tests** (33 tests): Daily checking, price comparison, history tracking
- **Utils Tests** (41 tests): URL validation, price processing, text utilities
- **Wishlist Management** (23 tests): Storage operations, UI interactions
- **Advanced Scenarios** (12 tests): Error handling, edge cases
- **Integration Tests** (8 tests): Complete workflows
- **Content Script** (19 tests): Page extraction logic
- **Popup Tests** (16 tests): UI interactions and tab management

### Running Tests
```bash
# Run all tests
cd test && node run-tests.js all

# Run specific test file
cd test && node run-tests.js file price-tracker.test.js

# Run with coverage
cd test && node run-tests.js coverage
```

## Development

### Project Structure
```
├── manifest.json           # Extension manifest
├── popup.html              # Extension popup UI
├── popup.js                # Main popup logic
├── content.js              # Page content extraction
├── background.js           # Background service worker
├── utils.js                # Utility functions
├── config.js               # Configuration settings
├── services/
│   ├── PriceTracker.js     # Daily price tracking
│   ├── StorageService.js   # Storage management
│   ├── EventBus.js         # Event system
│   └── PerformanceManager.js # Performance optimization
└── test/                   # Comprehensive test suite
    ├── price-tracker.test.js
    ├── utils.test.js
    ├── wishlist-management.test.js
    └── ...
```

### Key Features Implementation

#### Price Extraction Strategy
1. **CSS Selectors**: Target common price element classes/IDs
2. **Structured Data**: Parse JSON-LD and microdata
3. **Meta Tags**: Extract from Open Graph and other meta properties
4. **Text Analysis**: Regex-based price pattern matching

#### Price Tracking Algorithm
1. **Daily Scheduling**: Chrome alarms API for 24-hour intervals
2. **Tab Management**: Create background tabs for price checking
3. **Price Comparison**: Numeric extraction and change detection
4. **History Management**: Track last 10 price changes per product
5. **Data Persistence**: Store tracking data and price history

#### Error Handling
- **Network Failures**: Retry with exponential backoff
- **Tab Errors**: Graceful cleanup and error reporting
- **Storage Errors**: Data validation and recovery
- **Price Extraction**: Fallback strategies and validation

## 🔒 Privacy & Security

WishCart prioritizes your privacy and data security:

- **🏠 Local Storage Only**: All your data stays on your device using Chrome's secure storage
- **🚫 No External Servers**: Zero data transmission to external services or analytics
- **🛡️ Minimal Permissions**: Only essential Chrome permissions for core functionality
- **🔐 Secure by Design**: No personal data collection or tracking
- **Secure Processing**: Input validation and XSS prevention

## Browser Compatibility

- **Chrome**: Fully supported (Manifest V3)
- **Edge**: Compatible with Chromium-based Edge
- **Other Browsers**: May require manifest modifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Changelog

### Version 1.1.0 - Latest
- ✨ **New Feature**: Daily automatic price tracking
- ✨ Price drop detection and history tracking
- ✨ Background service worker for scheduled tasks
- ✨ Enhanced price extraction with comma handling
- 🔧 Added Chrome alarms permission
- 🧪 Added 33 new tests for price tracking functionality
- 📊 Improved test coverage to 152 total tests

### Version 1.0.0
- 🎉 Initial release with core functionality
- 📋 Wishlist management
- 💰 Price and title extraction
- 🔄 Retry logic and error handling
- 🧪 Comprehensive test suite (119 tests)