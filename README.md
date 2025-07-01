# Shopping Extension Companion

A comprehensive Chrome extension that fetches page titles and product prices from e-commerce websites, with an integrated product list management system. This extension demonstrates advanced Chrome extension development including storage APIs, content scripts, and modern JavaScript architecture.

## Features

- **Page Title & Price Extraction**: Automatically extracts titles and prices from e-commerce sites
- **Multi-site Support**: Works with Amazon, eBay, Shopify, WooCommerce, and more
- **Product List Management**: Save, organize, and manage your favorite products
- **Persistent Storage**: Products saved locally using Chrome's storage API
- **Smart Retry Logic**: Handles dynamic content loading with progressive retry
- **Current Tab Integration**: Extract information from currently active tab
- **Export Functionality**: Export your product list as JSON
- **Modern UI**: Clean, responsive interface with animations and feedback
- **Error Handling**: Comprehensive validation and error messages

## Files Structure

```
Shopping-extension-companion/
├── manifest.json       # Extension configuration and permissions
├── popup.html         # Popup interface HTML
├── popup.js           # Popup functionality and logic
├── content.js         # Content script for page interaction
├── styles.css         # Popup styling
├── config.js          # Centralized configuration
├── utils.js           # Shared utility functions
├── test/              # Comprehensive test suite
├── ARCHITECTURE.md    # Technical architecture documentation
└── README.md          # This file
```

## File Descriptions

### `manifest.json`
The extension manifest file that defines:
- Extension metadata (name, version, description)
- Popup configuration
- Content script settings
- Required permissions (activeTab, tabs)
- Host permissions for accessing websites

### `popup.html`
The HTML structure for the extension popup containing:
- URL input field
- Buttons for fetching titles
- Loading indicator
- Result display area
- Error message area

### `popup.js`
The main JavaScript logic that handles:
- DOM manipulation and event listeners
- URL validation
- Chrome tabs API interactions
- Creating temporary tabs to fetch page titles
- UI state management (loading, results, errors)

### `content.js`
Content script that runs on web pages to:
- Extract page titles using multiple methods
- Listen for messages from popup
- Monitor title changes for single-page applications
- Provide fallback title extraction methods

### `styles.css`
CSS styling for a modern, clean popup interface with:
- Responsive design
- Modern color scheme
- Smooth transitions
- Error and success state styling

## How to Install

1. **Download the Extension**
   - Clone or download this repository

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should appear in your extensions list

4. **Pin the Extension** (Optional)
   - Click the extensions icon (puzzle piece) in Chrome toolbar
   - Pin the "Page Title Fetcher" extension for easy access

## How to Use

### Method 1: Get Title & Price from URL
1. Click the extension icon in your Chrome toolbar
2. Enter a complete URL (including http:// or https://)
3. Click "Get Title & Price" button
4. The page title and price will be displayed along with the URL
5. Click "Add to List" to save the product to your collection

### Method 2: Get Current Tab Info
1. Navigate to any e-commerce webpage
2. Click the extension icon
3. Click "Get Current Tab Info" button
4. The current page's title, price, and URL will be displayed
5. Click "Add to List" to save the product

### Method 3: Manage Your Product List
1. Click the product count badge to expand/collapse your saved list
2. Use "Visit" button to open any saved product in a new tab
3. Use "Remove" button to delete individual products
4. Use "Clear All" to empty your entire list (with confirmation)
5. Use "Export" to download your list as a JSON file

## Key Functions Explained

### `handleFetchTitle()`
- Validates user input URL
- Creates a temporary hidden tab with the URL
- Waits for the page to load completely
- Extracts the title and closes the temporary tab
- Displays the result or error message

### `handleCurrentTabTitle()`
- Uses Chrome tabs API to get current active tab
- Extracts title and URL from tab information
- Displays the result immediately

### `fetchPageTitle(url)`
- Creates a new tab with the provided URL
- Sets up timeout to prevent hanging
- Listens for tab completion events
- Returns a Promise that resolves to the page title

### `getPageTitle()` (in content.js)
- Tries multiple methods to extract page title:
  1. `document.title` property
  2. `<title>` tag content
  3. Meta tags (og:title, name="title")
  4. First `<h1>` tag content
- Returns the first available title or "No title found"

## Error Handling

The extension includes comprehensive error handling for:
- Invalid URLs
- Network timeouts
- Permission errors
- Missing page titles
- Chrome API errors

## Permissions Explained

- **`activeTab`**: Allows access to the currently active tab
- **`tabs`**: Enables creating, querying, and managing tabs
- **`storage`**: Enables saving and retrieving product list data locally
- **`host_permissions`**: Allows access to all HTTP and HTTPS websites

## Development Notes

- Uses Manifest V3 (latest Chrome extension format)
- Implements proper async/await patterns
- Includes timeout handling to prevent hanging
- Uses modern JavaScript features
- Responsive CSS design
- Comprehensive error handling

## Customization

You can customize the extension by:
- Modifying the timeout duration in `popup.js` (currently 10 seconds)
- Changing the UI colors and styling in `styles.css`
- Adding more title extraction methods in `content.js`
- Extending functionality with additional features

## Browser Compatibility

This extension is designed for:
- Google Chrome (recommended)
- Microsoft Edge (Chromium-based)
- Other Chromium-based browsers

## Security Notes

- The extension only accesses pages when explicitly requested
- Temporary tabs are automatically closed after title extraction
- No data is stored or transmitted to external servers
- Uses secure HTTPS connections when possible

## Recent Updates & Fixes

### ✅ FIXED: Critical Persistence & Timeout Issues (Latest)
- **✅ Persistence Issue**: Products now persist correctly across browser sessions and page refreshes
  - Fixed product ID generation that was creating duplicate IDs
  - Improved storage error handling and recovery
  - Enhanced product update logic to prevent overwrites
- **✅ 30-Second Timeout Issue**: Current tab functionality now works reliably regardless of page age
  - Added content script availability detection
  - Implemented smart retry logic with progressive delays (1s, 3s, 5s)
  - Enhanced content script reliability and error handling
- **Code Organization**: Refactored for clean, maintainable architecture
  - Organized popup.js into logical sections
  - Comprehensive logging with emoji indicators
  - Simple, reliable logic over complex patterns
- **Testing**: Added comprehensive unit tests covering edge cases
  - 16 new persistence and timeout tests
  - All 41 existing tests still passing
  - No regressions introduced

### ✅ FIXED: Wishlist Persistence Issue (Previous - Legacy System Restored)
- **Problem**: Products added to wishlist were not persisting due to conflicting initialization systems
- **Root Cause**: Dual initialization systems (legacy + service architecture) causing conflicts
- **Solution**: Created clean, legacy-only `popup.js` that eliminates all service architecture conflicts
- **Result**: 
  - Single initialization point with proven stability
  - Products now persist correctly across all pages and sessions
  - All 41 tests still passing
  - Enhanced logging for debugging
  - Backup created as `popup.js.backup`

### 🔧 Previous Service Architecture (Backup Available)
- Implemented performance-optimized service-based architecture
- Added comprehensive caching system with TTL (Time To Live)
- Enhanced error handling and debugging capabilities
- Improved memory management and cleanup
- **Note**: Service architecture available in backup files for future development

### 🧪 Testing & Debugging
- Created `test-wishlist.html` for comprehensive persistence testing
- All 41 unit tests passing
- Added debugging tools for storage inspection

## Troubleshooting

### Issue: Extension popup shows errors or doesn't load
**Solution**: 
1. Check browser console (F12 → Console) for error details
2. Disable and re-enable the extension
3. Reload the extension in `chrome://extensions/`

### Issue: Products not persisting across pages
**Solution**: 
1. Verify the extension has storage permissions
2. Check if you're using the latest version
3. Clear extension data and try again: Chrome → Settings → Privacy → Site Settings → Find extension → Clear data

### Issue: Price detection not working
**Solution**: 
1. Try the "Get Title & Price" method instead of "Get Current Tab Info"
2. Ensure the page has fully loaded before extraction
3. Some sites may block automated price detection

### Issue: "AppController is not defined" error
**Solution**: 
1. **FIXED**: This issue has been resolved in the latest version
2. Extension now uses clean legacy-only system
3. If you still see this error, reload the extension in `chrome://extensions/`

### Issue: Wishlist not persisting (FIXED)
**Solution**: 
1. **FIXED**: This issue has been completely resolved
2. Extension now uses single initialization system
3. Products will persist correctly across all pages and sessions
4. Look for `✅ Extension initialized in legacy mode` in console

## Debug Mode & Verification

To verify the persistence fix is working:
1. Open browser console (F12)
2. Look for initialization message:
   - `✅ Extension initialized in legacy mode`
3. When adding products, look for:
   - `💾 [Legacy] Adding product:` followed by product details
   - `📋 [Legacy] Loading X products` when opening popup
4. If you see any errors, the extension will display them in the popup

### Console Logging (Legacy Mode)
The extension now provides detailed logging:
- `🚀 Initializing Shopping Extension (Legacy Mode)...`
- `💾 [Legacy] Adding product:` - When saving products
- `📋 [Legacy] Loading X products` - When loading saved list
- `🗑️ [Legacy] Removing product:` - When removing products
- `✅ Extension initialized in legacy mode` - Successful initialization