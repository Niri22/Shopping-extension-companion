# Daily Price Tracking Feature

## Overview

The Daily Price Tracking feature automatically monitors prices for all products in your wishlist and detects price drops. This feature runs in the background using Chrome's alarms API to check prices every 24 hours.

## How It Works

### 1. Automatic Setup
- When the extension is installed or updated, a daily alarm is automatically created
- The alarm triggers every 24 hours to perform price checks
- No user configuration required - it works automatically

### 2. Price Checking Process
```javascript
// For each product in the wishlist:
1. Create a background tab with the product URL
2. Wait for page to load (5 seconds)
3. Extract current price using content script
4. Compare with stored price
5. Update product data if price changed
6. Close the background tab
7. Add 2-second delay before next product (respectful crawling)
```

### 3. Price Comparison Logic
- Extracts numeric values from price strings (handles currency symbols)
- Supports multiple formats: `$29.99`, `€45,50`, `£19.95`, `¥1000`, `$1,299.99`
- Ignores changes smaller than 1 cent to avoid false positives
- Detects both price drops and increases

### 4. Data Storage
- Updates product price if changed
- Maintains price history (last 10 entries per product)
- Stores tracking metadata for analysis
- All data stored locally using Chrome storage API

## Technical Implementation

### Core Components

#### PriceTracker Service (`services/PriceTracker.js`)
```javascript
class PriceTracker {
    // Sets up 24-hour recurring alarm
    async setupDailyAlarm()
    
    // Main price checking workflow
    async performDailyPriceCheck()
    
    // Checks individual product price
    async checkProductPrice(product)
    
    // Compares prices and detects changes
    comparePrices(originalPrice, currentPrice)
    
    // Extracts numeric value from price strings
    extractNumericPrice(priceString)
}
```

#### Background Script (`background.js`)
```javascript
// Initialize price tracker on extension startup
chrome.runtime.onInstalled.addListener(() => {
    priceTracker = new PriceTracker();
});

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyPriceCheck') {
        priceTracker.performDailyPriceCheck();
    }
});
```

### Data Structures

#### Enhanced Product Object
```javascript
{
    id: 'product_123',
    title: 'Wireless Headphones',
    price: '$79.99',                    // Current price
    url: 'https://example.com/product',
    dateAdded: '2024-01-01T10:00:00.000Z',
    lastPriceUpdate: '2024-01-15T10:00:00.000Z',  // When price was last updated
    priceHistory: [                     // Last 10 price changes
        {
            price: '$89.99',
            date: '2024-01-01T10:00:00.000Z',
            dropped: false
        },
        {
            price: '$79.99',
            date: '2024-01-15T10:00:00.000Z',
            dropped: true               // Price dropped from previous
        }
    ]
}
```

#### Price Tracking Data
```javascript
{
    product_123: {
        productId: 'product_123',
        checks: [                       // Last 30 check records
            {
                date: '2024-01-15T10:00:00.000Z',
                originalPrice: '$89.99',
                currentPrice: '$79.99',
                priceDropped: true,
                difference: 10.00
            }
        ]
    }
}
```

## API Methods

### Background Script Messages
```javascript
// Trigger manual price check
chrome.runtime.sendMessage({
    action: 'triggerPriceCheck'
});

// Get price history for a product
chrome.runtime.sendMessage({
    action: 'getPriceHistory',
    productId: 'product_123'
});

// Get products with recent price drops
chrome.runtime.sendMessage({
    action: 'getProductsWithPriceDrops',
    daysBack: 7
});
```

### Response Format
```javascript
// Price history response
{
    success: true,
    history: [
        {
            price: '$79.99',
            date: '2024-01-15T10:00:00.000Z',
            dropped: true
        }
    ]
}

// Products with price drops
{
    success: true,
    products: [
        {
            id: 'product_123',
            title: 'Wireless Headphones',
            price: '$79.99',
            priceHistory: [...]
        }
    ]
}
```

## Features

### ✅ Implemented
- **Daily automatic price checking** (24-hour intervals)
- **Price drop detection** with percentage calculations
- **Price history tracking** (last 10 entries per product)
- **Multi-currency support** (USD, EUR, GBP, JPY, etc.)
- **Smart price parsing** (handles commas, different formats)
- **Background tab management** (respectful crawling with delays)
- **Error handling** (network failures, tab errors, extraction failures)
- **Data persistence** (local storage with Chrome API)
- **Manual triggering** (for testing and immediate checks)

### 🔄 Configurable Options
- **Check frequency**: Currently 24 hours (can be modified in code)
- **Price history limit**: 10 entries (configurable)
- **Tracking data limit**: 30 check records (configurable)
- **Delay between checks**: 2 seconds (respectful crawling)

## Error Handling

### Network Issues
- Graceful handling of tab creation failures
- Timeout protection for unresponsive pages
- Retry logic for temporary failures

### Price Extraction Failures
- Fallback to "No price found" when extraction fails
- Validation of extracted prices before comparison
- Handling of dynamic pricing and loading states

### Storage Errors
- Validation of data before storage operations
- Recovery from corrupted data
- Cleanup of old tracking data

## Performance Considerations

### Resource Management
- **Background tabs**: Created invisibly, automatically closed
- **Memory usage**: Limited price history and tracking data
- **Network usage**: Respectful delays between requests
- **Storage usage**: Efficient data structures, automatic cleanup

### Optimization Features
- **Delay function**: Prevents overwhelming target websites
- **Data limits**: Automatic cleanup of old history/tracking data
- **Error recovery**: Continues processing even if individual products fail
- **Async processing**: Non-blocking operations

## Testing

### Comprehensive Test Suite (33 tests)

#### Initialization Tests (4 tests)
- Alarm setup and configuration
- Error handling during initialization
- Event listener setup

#### Price Extraction & Comparison (7 tests)
- Numeric price extraction from various formats
- Price change detection (drops, increases, no change)
- Handling of invalid prices and edge cases

#### Storage Operations (6 tests)
- Product data retrieval and storage
- Tracking data management
- Error handling for storage failures

#### Price Checking Operations (5 tests)
- Tab-based price extraction
- Product price checking workflow
- Error handling during price checks

#### Daily Check Process (2 tests)
- Empty product list handling
- Multiple product processing

#### Price History & Analysis (4 tests)
- Price history retrieval
- Price drop filtering by date
- Historical data management

#### Result Processing (3 tests)
- Check result processing and storage
- Price history limits
- Failed check handling

#### Manual Operations (2 tests)
- Manual price check triggering
- Utility function testing

### Test Coverage
- **Price extraction**: 100% coverage of price parsing logic
- **Error scenarios**: Comprehensive error handling tests
- **Data management**: Storage and retrieval operations
- **Background processing**: Alarm and tab management
- **Integration**: End-to-end workflow testing

## Usage Examples

### Basic Usage
```javascript
// Price tracking starts automatically when products are added to wishlist
// No additional setup required

// Check if a product has recent price drops
const response = await chrome.runtime.sendMessage({
    action: 'getProductsWithPriceDrops',
    daysBack: 7
});

console.log(`Found ${response.products.length} products with recent price drops`);
```

### Manual Price Check
```javascript
// Trigger immediate price check (useful for testing)
const response = await chrome.runtime.sendMessage({
    action: 'triggerPriceCheck'
});

if (response.success) {
    console.log('Manual price check completed');
}
```

### Price History Analysis
```javascript
// Get detailed price history for a product
const response = await chrome.runtime.sendMessage({
    action: 'getPriceHistory',
    productId: 'product_123'
});

response.history.forEach(entry => {
    console.log(`${entry.date}: ${entry.price} ${entry.dropped ? '📉' : '📈'}`);
});
```

## Security & Privacy

### Data Protection
- **Local storage only**: No data sent to external servers
- **Minimal permissions**: Only necessary Chrome APIs used
- **Secure processing**: Input validation and sanitization
- **No tracking**: No user behavior tracking or analytics

### Website Respect
- **Polite crawling**: 2-second delays between requests
- **Background tabs**: Invisible to user, minimal resource usage
- **Error handling**: Graceful failure without retries on permanent errors
- **Rate limiting**: Built-in delays to prevent overwhelming websites

## Future Enhancements

### Potential Features
- **Price alerts**: Notifications when prices drop below thresholds
- **Price charts**: Visual representation of price history
- **Custom check frequency**: User-configurable check intervals
- **Bulk operations**: Export/import of price tracking data
- **Advanced filtering**: Search and filter products by price changes
- **Statistics**: Analytics on price trends and savings

### Technical Improvements
- **Intelligent scheduling**: Adaptive check frequency based on price volatility
- **Batch processing**: More efficient handling of large product lists
- **Caching**: Reduce redundant price checks for recently checked products
- **Webhooks**: Integration with external price tracking services 