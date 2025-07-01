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