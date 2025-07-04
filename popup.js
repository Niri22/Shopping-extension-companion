/**
 * Shopping Extension Popup - Clean and Organized Legacy System
 * Simple, reliable functionality with proper code organization
 */

class ShoppingExtensionPopup {
    constructor() {
        this.elements = {};
        this.currentPageInfo = null;
        this.listVisible = false;
        
        console.log('🚀 [Popup] Initializing Shopping Extension...');
        this.init();
    }
    
    // ============================================
    // INITIALIZATION SECTION
    // ============================================
    
    async init() {
        try {
            this.bindElements();
            this.setupEventListeners();
            await this.loadSavedList();
            console.log('✅ [Popup] Extension initialized successfully');
        } catch (error) {
            console.error('❌ [Popup] Initialization failed:', error);
            this.showError('Failed to initialize extension');
        }
    }
    
    bindElements() {
        // Only bind elements that exist in the current popup
        const elementMap = {
            loading: 'loading',
            result: 'result',
            error: 'error',
            titleText: 'titleText',
            priceText: 'priceText',
            urlText: 'urlText',
            errorText: 'errorText',
            addToListBtn: 'addToListBtn',
            savedList: 'savedList',
            listContainer: 'listContainer',
            clearListBtn: 'clearListBtn',
            exportListBtn: 'exportListBtn'
        };
        
        Object.entries(elementMap).forEach(([key, id]) => {
            this.elements[key] = document.getElementById(id);
            if (!this.elements[key]) {
                console.warn('⚠️ [Popup] Element not found:', id);
            }
        });
        
        // Add search and sort elements
        this.elements.searchInput = document.getElementById('searchInput');
        this.elements.sortSelect = document.getElementById('sortSelect');
        this.elements.trackCurrentBtn = document.getElementById('trackCurrentBtn');
        this.elements.refreshBtn = document.getElementById('refreshBtn');
        
        console.log('🔗 [Popup] Elements bound successfully');
    }
    
    setupEventListeners() {
        // Main action buttons
        this.elements.addToListBtn?.addEventListener('click', () => this.handleAddToList());
        
        // List management buttons
        this.elements.clearListBtn?.addEventListener('click', () => this.handleClearList());
        this.elements.exportListBtn?.addEventListener('click', () => this.handleExportList());
        this.elements.refreshBtn?.addEventListener('click', () => this.handleRefreshPrices());
        
        // Search and sort functionality
        this.elements.searchInput?.addEventListener('input', () => this.handleSearch());
        this.elements.sortSelect?.addEventListener('change', () => this.handleSort());
        this.elements.trackCurrentBtn?.addEventListener('click', () => this.handleTrackCurrent());
        
        // Search input handling
        this.elements.searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        
        console.log('👂 [Popup] Event listeners set up');
    }
    
    // ============================================
    // PAGE INFO FETCHING SECTION
    // ============================================
    
    async handleFetchInfo() {
        const url = ExtensionUtils.url.normalize(this.elements.urlInput.value);
        
        const validation = ExtensionUtils.url.validate(url);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }
        
        console.log('🔍 [Popup] Fetching info for URL:', url);
        this.showLoading();
        
        try {
            const pageInfo = await this.fetchPageInfoFromURL(url);
            this.showResult(pageInfo.title, pageInfo.price, url);
        } catch (error) {
            console.error('❌ [Popup] Failed to fetch page info:', error);
            this.showError(`${ExtensionConfig.messages.errors.fetchFailed}: ${error.message}`);
        }
    }
    
    async handleCurrentTabInfo() {
        console.log('📋 [Popup] Getting current tab info...');
        this.showLoading();
        
        try {
            const tab = await ExtensionUtils.chrome.getCurrentTab();
            if (!tab?.id) {
                this.showError(ExtensionConfig.messages.errors.noTab);
                return;
            }
            
            console.log('📋 [Popup] Current tab:', tab.url);
            const result = await this.getPageInfoFromCurrentTab(tab);
            this.showResult(result.title, result.price, result.url);
            
        } catch (error) {
            console.error('❌ [Popup] Current tab error:', error);
            await this.handleCurrentTabError(error);
        }
    }
    
    async fetchPageInfoFromURL(url) {
        return new Promise((resolve, reject) => {
            console.log('🆕 [Popup] Creating temporary tab for:', url);
            
            chrome.tabs.create({ url, active: false }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                this.setupTabListener(tab, resolve, reject);
            });
        });
    }
    
    setupTabListener(tab, resolve, reject) {
        const tabId = tab.id;
        console.log('⏱️ [Popup] Setting up listener for tab:', tabId);
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
            chrome.tabs.remove(tabId);
            reject(new Error(ExtensionConfig.messages.errors.timeout));
        }, ExtensionConfig.timing.pageTimeout);
        
        // Listen for tab completion
        const onTabUpdated = (updatedTabId, changeInfo, updatedTab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onTabUpdated);
                clearTimeout(timeoutId);
                
                console.log('✅ [Popup] Tab loaded, extracting info...');
                this.extractInfoFromTab(tabId, updatedTab, resolve);
            }
        };
        
        chrome.tabs.onUpdated.addListener(onTabUpdated);
    }
    
    async extractInfoFromTab(tabId, tab, resolve) {
        try {
            const response = await ExtensionUtils.chrome.sendMessageToTab(tabId, { action: 'getPageInfo' }, 10000);
            chrome.tabs.remove(tabId);
            
            resolve({
                title: response?.title || tab.title || ExtensionConfig.messages.notFound.title,
                price: response?.price || ExtensionConfig.messages.notFound.price
            });
        } catch (error) {
            chrome.tabs.remove(tabId);
            console.log('⚠️ [Popup] Content script failed, using tab info');
            resolve({
                title: tab.title || ExtensionConfig.messages.notFound.title,
                price: ExtensionConfig.messages.notFound.price
            });
        }
    }
    
    // ============================================
    // CURRENT TAB HANDLING WITH IMPROVED TIMEOUT LOGIC
    // ============================================
    
    async getPageInfoFromCurrentTab(tab) {
        console.log('🔄 [Popup] Starting current tab extraction with retry logic...');
        
        // First, check if content script is available
        const isAvailable = await ExtensionUtils.chrome.isContentScriptAvailable(tab.id);
        console.log('📡 [Popup] Content script available:', isAvailable);
        
        if (!isAvailable) {
            console.log('⚠️ [Popup] Content script not available, using tab info only');
            return {
                title: tab.title || ExtensionConfig.messages.notFound.title,
                price: `${ExtensionConfig.messages.notFound.price} - Content script not available`,
                url: tab.url
            };
        }
        
        // Try to get page info with retry logic
        const maxAttempts = 3;
        const delays = [1000, 3000, 5000]; // 1s, 3s, 5s
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`🔄 [Popup] Attempt ${attempt + 1}/${maxAttempts}`);
            
            try {
                const response = await ExtensionUtils.chrome.sendMessageToTab(
                    tab.id, 
                    { action: 'getPageInfo' }, 
                    5000 // 5 second timeout per attempt
                );
                
                if (response && response.title) {
                    console.log('✅ [Popup] Got response:', response);
                    
                    // Check if we got a good price or if we should retry
                    if (ExtensionUtils.price.isValid(response.price)) {
                        console.log('💰 [Popup] Valid price found, returning result');
                        return {
                            title: response.title,
                            price: response.price,
                            url: tab.url
                        };
                    } else if (attempt === maxAttempts - 1) {
                        // Last attempt, return what we have
                        console.log('⏰ [Popup] Last attempt, returning available data');
                        return {
                            title: response.title,
                            price: response.price || ExtensionConfig.messages.notFound.price,
                            url: tab.url
                        };
                    } else {
                        console.log('⏳ [Popup] Price not ready, waiting before retry...');
                        await ExtensionUtils.async.delay(delays[attempt]);
                    }
                } else {
                    console.log('❌ [Popup] No response, will retry...');
                    if (attempt < maxAttempts - 1) {
                        await ExtensionUtils.async.delay(delays[attempt]);
                    }
                }
            } catch (error) {
                console.log(`⚠️ [Popup] Attempt ${attempt + 1} failed:`, error.message);
                if (attempt < maxAttempts - 1) {
                    await ExtensionUtils.async.delay(delays[attempt]);
                }
            }
        }
        
        // All attempts failed, return tab info
        console.log('🔄 [Popup] All attempts failed, using tab info');
        return {
            title: tab.title || ExtensionConfig.messages.notFound.title,
            price: `${ExtensionConfig.messages.notFound.price} - Unable to extract from page`,
            url: tab.url
        };
    }
    
    async handleCurrentTabError(error) {
        console.log('🔄 [Popup] Handling current tab error:', error.message);
        
        try {
            const tab = await ExtensionUtils.chrome.getCurrentTab();
            if (tab?.title && tab?.url) {
                this.showResult(
                    tab.title, 
                    `${ExtensionConfig.messages.notFound.price} - ${ExtensionConfig.messages.errors.extensionError}`, 
                    tab.url
                );
            } else {
                this.showError(ExtensionConfig.messages.errors.noTab);
            }
        } catch (fallbackError) {
            this.showError(`${ExtensionConfig.messages.errors.fetchFailed}: ${error.message}`);
        }
    }
    
    // ============================================
    // UI STATE MANAGEMENT SECTION
    // ============================================
    
    showLoading() {
        this.hideAllSections();
        this.elements.loading?.classList.remove('hidden');
        console.log('⏳ [Popup] Showing loading state');
    }
    
    showResult(title, price, url) {
        console.log('📋 [Popup] Showing result:', { title, price, url });
        
        this.hideAllSections();
        this.elements.result?.classList.remove('hidden');
        
        // Update UI elements
        if (this.elements.titleText) this.elements.titleText.textContent = title;
        
        // Enhanced price display for sale information
        if (this.elements.priceText) {
            const priceDisplay = this.formatPriceDisplay(price);
            this.elements.priceText.innerHTML = priceDisplay.html;
            this.elements.priceText.className = `price-text ${priceDisplay.className}`;
        }
        
        if (this.elements.urlText) this.elements.urlText.textContent = url;
        
        // Store current page info for adding to list
        this.currentPageInfo = {
            title,
            price: this.extractPriceForStorage(price),
            url,
            domain: this.extractDomain(url),
            saleInfo: this.extractSaleInfo(price)
        };
        
        // Update add to list button state
        this.updateAddToListButton();
    }

    formatPriceDisplay(price) {
        // Handle enhanced price info structure
        if (typeof price === 'object' && price !== null) {
            if (price.isOnSale) {
                return {
                    html: this.createSalePriceHTML(price),
                    className: 'price-found sale-price'
                };
            } else {
                return {
                    html: `<span class="current-price">${price.currentPrice || price.displayText}</span>`,
                    className: 'price-found'
                };
            }
        } else if (typeof price === 'string') {
            const isValid = ExtensionUtils.price.isValid(price);
            return {
                html: `<span class="current-price">${price}</span>`,
                className: isValid ? 'price-found' : 'price-not-found'
            };
        }
        
        return {
            html: '<span class="current-price">No price found</span>',
            className: 'price-not-found'
        };
    }

    createSalePriceHTML(priceInfo) {
        let html = `<div class="sale-price-container">`;
        
        // Current price (prominently displayed)
        html += `<span class="current-price">${priceInfo.currentPrice}</span>`;
        
        // Original price (strikethrough)
        if (priceInfo.originalPrice) {
            html += `<span class="original-price">${priceInfo.originalPrice}</span>`;
        }
        
        // Discount information
        if (priceInfo.discount) {
            html += `<span class="discount-badge">${priceInfo.discount.formatted}</span>`;
        }
        
        // Sale type badge
        if (priceInfo.saleType && priceInfo.saleType !== 'general') {
            html += `<span class="sale-type-badge">${priceInfo.saleType.toUpperCase()}</span>`;
        }
        
        html += `</div>`;
        return html;
    }

    extractPriceForStorage(price) {
        // Extract the current price for storage
        if (typeof price === 'object' && price !== null) {
            return price.currentPrice || price.displayText || 'No price found';
        }
        return price;
    }

    extractSaleInfo(price) {
        // Extract sale information for storage
        if (typeof price === 'object' && price !== null && price.isOnSale) {
            return {
                isOnSale: true,
                originalPrice: price.originalPrice,
                discount: price.discount,
                saleType: price.saleType
            };
        }
        return { isOnSale: false };
    }
    
    showError(message) {
        console.log('❌ [Popup] Showing error:', message);
        
        this.hideAllSections();
        this.elements.error?.classList.remove('hidden');
        if (this.elements.errorText) {
            this.elements.errorText.textContent = message;
        }
    }
    
    hideAllSections() {
        ['loading', 'result', 'error'].forEach(section => {
            this.elements[section]?.classList.add('hidden');
        });
    }
    
    updateAddToListButton() {
        if (!this.elements.addToListBtn) return;
        
        const isValid = ExtensionUtils.storage.isValidProduct(this.currentPageInfo);
        this.elements.addToListBtn.disabled = !isValid;
        this.elements.addToListBtn.textContent = isValid ? 
            ExtensionConfig.messages.list.addButton : 
            'Cannot Add (Invalid Product)';
    }
    
    // ============================================
    // WISHLIST MANAGEMENT SECTION
    // ============================================
    
    async handleAddToList() {
        if (!this.currentPageInfo || !ExtensionUtils.storage.isValidProduct(this.currentPageInfo)) {
            this.showError('No valid product information to add');
            return;
        }
        
        console.log('💾 [Popup] Adding product to list:', this.currentPageInfo);
        
        try {
            const success = await ExtensionUtils.storage.saveProduct(this.currentPageInfo);
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.addedToList);
                await this.loadSavedList();
                
                // Temporarily disable button
                this.elements.addToListBtn.disabled = true;
                this.elements.addToListBtn.textContent = 'Added!';
                
                setTimeout(() => {
                    if (this.currentPageInfo) {
                        this.updateAddToListButton();
                    }
                }, 2000);
            } else {
                this.showError('Failed to add product to list');
            }
        } catch (error) {
            console.error('❌ [Popup] Failed to add to list:', error);
            this.showError(`Error adding to list: ${error.message}`);
        }
    }
    
    async loadSavedList() {
        try {
            console.log('📋 [Popup] Loading saved products...');
            const products = await ExtensionUtils.storage.getProducts();
            console.log('📋 [Popup] Loaded products:', products.length);
            
            this.renderProductList(products);
            this.updateListCount(products.length);
            await this.updateStatistics(products);
        } catch (error) {
            console.error('❌ [Popup] Failed to load saved list:', error);
        }
    }
    
    renderProductList(products) {
        if (!this.elements.savedList) return;
        
        if (products.length === 0) {
            this.elements.savedList.innerHTML = `
                <div class="empty-list">
                    <p>${ExtensionConfig.messages.list.empty}</p>
                    <p class="hint">Add products using the "Add to List" button above</p>
                </div>
            `;
            return;
        }
        
        this.elements.savedList.innerHTML = products
            .map(product => this.createProductItemHTML(product))
            .join('');
        
        this.setupListEventListeners();
    }
    
    createProductItemHTML(product) {
        const dateAdded = new Date(product.dateAdded).toLocaleDateString();
        const truncatedTitle = product.title.length > 45 ? 
            product.title.substring(0, 45) + '...' : product.title;
        const domain = this.extractDomain(product.url);
        
        return `
            <div class="list-item" data-product-id="${product.id}">
                <div class="item-content">
                    <div class="item-details">
                        <div class="item-main">
                            <h4 class="item-title" title="${product.title}">${truncatedTitle}</h4>
                            <span class="item-price">${product.price}</span>
                        </div>
                        <div class="item-meta">
                            <span class="item-domain">${domain}</span>
                            <span class="item-date">${dateAdded}</span>
                        </div>
                    </div>
                    
                    <div class="item-actions">
                        <button class="remove-btn" data-product-id="${product.id}" title="Remove from wishlist">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                            <span>Remove</span>
                        </button>
                        
                        <button class="visit-btn" data-url="${product.url}" title="Visit product page">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            <span>View</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupListEventListeners() {
        // Remove buttons
        this.elements.savedList?.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Get product ID from button element (not the clicked target which might be child element)
                const productId = btn.dataset.productId;
                this.handleRemoveFromList(productId);
            });
        });
        
        // Visit buttons
        this.elements.savedList?.querySelectorAll('.visit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Get URL from button element (not the clicked target which might be child element)
                const url = btn.dataset.url;
                this.handleVisitProduct(url);
            });
        });
    }
    
    async handleRemoveFromList(productId) {
        console.log('🗑️ [Popup] Removing product:', productId);
        
        try {
            const success = await ExtensionUtils.storage.removeProduct(productId);
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.removedFromList);
                await this.loadSavedList();
            } else {
                this.showError('Failed to remove product from list');
            }
        } catch (error) {
            console.error('❌ [Popup] Failed to remove product:', error);
            this.showError(`Error removing from list: ${error.message}`);
        }
    }
    
    async handleVisitProduct(url) {
        try {
            await chrome.tabs.create({ url, active: true });
        } catch (error) {
            this.showError(`Failed to open URL: ${error.message}`);
        }
    }
    
    async handleClearList() {
        if (!confirm('Are you sure you want to clear all saved products? This action cannot be undone.')) {
            return;
        }
        
        console.log('🧹 [Popup] Clearing all products');
        
        try {
            const success = await ExtensionUtils.storage.clearProducts();
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.listCleared);
                await this.loadSavedList();
            } else {
                this.showError('Failed to clear list');
            }
        } catch (error) {
            console.error('❌ [Popup] Failed to clear list:', error);
            this.showError(`Error clearing list: ${error.message}`);
        }
    }
    
    async handleExportList() {
        console.log('📤 [Popup] Exporting products');
        
        try {
            const jsonData = await ExtensionUtils.storage.exportProducts();
            
            // Create and download file
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shopping-list-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccessMessage(ExtensionConfig.messages.success.listExported);
        } catch (error) {
            console.error('❌ [Popup] Failed to export list:', error);
            this.showError(`Error exporting list: ${error.message}`);
        }
    }
    
    updateListCount(count) {
        // The listCount element no longer exists in the new design
        // This method is kept for compatibility but does nothing
        console.log('📊 [Popup] Product count:', count);
    }
    
    // ============================================
    // STATISTICS SECTION
    // ============================================
    
    async updateStatistics(products) {
        try {
            // Get tracking data for price drop calculations
            const trackingData = await this.getTrackingData();
            
            // Calculate statistics
            const totalProducts = products.length;
            const { totalSaved, totalDrops } = this.calculateSavingsAndDrops(products, trackingData);
            
            // Update UI elements
            this.updateStatElement('totalProducts', totalProducts);
            this.updateStatElement('totalSaved', `$${totalSaved.toFixed(2)}`);
            this.updateStatElement('totalDrops', totalDrops);
            
        } catch (error) {
            console.error('❌ [Popup] Failed to update statistics:', error);
        }
    }
    
    async getTrackingData() {
        try {
            const result = await chrome.storage.local.get(['price_tracking_data']);
            return result.price_tracking_data || {};
        } catch (error) {
            console.error('❌ [Popup] Failed to get tracking data:', error);
            return {};
        }
    }
    
    calculateSavingsAndDrops(products, trackingData) {
        let totalSaved = 0;
        let totalDrops = 0;
        
        products.forEach(product => {
            const productTracking = trackingData[product.id];
            if (productTracking && productTracking.priceHistory) {
                // Calculate savings from price drops
                const history = productTracking.priceHistory;
                for (let i = 1; i < history.length; i++) {
                    const currentPrice = this.extractNumericPrice(history[i].price);
                    const previousPrice = this.extractNumericPrice(history[i-1].price);
                    
                    if (currentPrice < previousPrice) {
                        totalSaved += (previousPrice - currentPrice);
                        totalDrops++;
                    }
                }
            }
        });
        
        return { totalSaved, totalDrops };
    }
    
    extractNumericPrice(priceString) {
        if (!priceString) return 0;
        
        // Remove currency symbols and extract number
        const cleanPrice = priceString.replace(/[^\d.,]/g, '');
        const numericPrice = parseFloat(cleanPrice.replace(',', ''));
        
        return isNaN(numericPrice) ? 0 : numericPrice;
    }
    
    updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    // ============================================
    // SEARCH AND SORT SECTION
    // ============================================
    
    async handleSearch() {
        const searchTerm = this.elements.searchInput?.value.toLowerCase().trim() || '';
        console.log('🔍 [Popup] Searching for:', searchTerm);
        
        try {
            const allProducts = await ExtensionUtils.storage.getProducts();
            const filteredProducts = this.filterProducts(allProducts, searchTerm);
            const sortedProducts = this.sortProducts(filteredProducts, this.elements.sortSelect?.value || 'date');
            
            this.renderProductList(sortedProducts);
            await this.updateStatistics(allProducts); // Keep stats for all products
        } catch (error) {
            console.error('❌ [Popup] Search failed:', error);
        }
    }
    
    async handleSort() {
        const sortBy = this.elements.sortSelect?.value || 'date';
        const searchTerm = this.elements.searchInput?.value.toLowerCase().trim() || '';
        console.log('🔄 [Popup] Sorting by:', sortBy);
        
        try {
            const allProducts = await ExtensionUtils.storage.getProducts();
            const filteredProducts = this.filterProducts(allProducts, searchTerm);
            const sortedProducts = this.sortProducts(filteredProducts, sortBy);
            
            this.renderProductList(sortedProducts);
        } catch (error) {
            console.error('❌ [Popup] Sort failed:', error);
        }
    }
    
    filterProducts(products, searchTerm) {
        if (!searchTerm) return products;
        
        return products.filter(product => {
            const searchableText = [
                product.title,
                product.price,
                this.extractDomain(product.url)
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }
    
    sortProducts(products, sortBy) {
        const sortedProducts = [...products];
        
        switch (sortBy) {
            case 'name':
                sortedProducts.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'price':
                sortedProducts.sort((a, b) => {
                    const priceA = this.extractNumericPrice(a.price);
                    const priceB = this.extractNumericPrice(b.price);
                    return priceA - priceB;
                });
                break;
            case 'savings':
                sortedProducts.sort((a, b) => {
                    const savingsA = this.calculateProductSavings(a);
                    const savingsB = this.calculateProductSavings(b);
                    return savingsB - savingsA; // Highest savings first
                });
                break;
            case 'date':
            default:
                sortedProducts.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                break;
        }
        
        return sortedProducts;
    }
    
    calculateProductSavings(product) {
        // This would need tracking data to calculate actual savings
        // For now, return 0 as placeholder
        return 0;
    }
    
    async handleTrackCurrent() {
        console.log('➕ [Popup] Track current product clicked');
        
        try {
            this.showLoading();
            
            const tab = await ExtensionUtils.chrome.getCurrentTab();
            if (!tab?.id) {
                this.showError('No active tab found');
                return;
            }
            
            console.log('📋 [Popup] Getting current tab info for tracking:', tab.url);
            const result = await this.getPageInfoFromCurrentTab(tab);
            
            // Create product object
            const product = {
                title: result.title,
                price: result.price,
                url: result.url,
                dateAdded: new Date().toISOString()
            };
            
            // Generate ID for the product
            product.id = ExtensionUtils.generateId();
            
            // Add to list directly
            const success = await ExtensionUtils.storage.addProduct(product);
            
            if (success) {
                this.showSuccessMessage('Product tracked successfully!');
                await this.loadSavedList();
                this.hideAllSections();
            } else {
                this.showError('Failed to track product');
            }
            
        } catch (error) {
            console.error('❌ [Popup] Track current failed:', error);
            this.showError(`Failed to track current product: ${error.message}`);
        }
    }
    
    async handleRefreshPrices() {
        console.log('🔄 [Popup] Manual price refresh triggered');
        
        try {
            this.showLoading();
            
            // Get all products
            const products = await ExtensionUtils.storage.getProducts();
            
            if (products.length === 0) {
                this.showError('No products to refresh');
                return;
            }
            
            // Trigger manual price check via background script
            const response = await chrome.runtime.sendMessage({
                action: 'manualPriceCheck',
                products: products
            });
            
            if (response && response.success) {
                this.showSuccessMessage(`Price check completed for ${products.length} products!`);
                await this.loadSavedList(); // Refresh the display
                this.hideAllSections();
            } else {
                this.showError('Failed to refresh prices');
            }
            
        } catch (error) {
            console.error('❌ [Popup] Manual price refresh failed:', error);
            this.showError(`Failed to refresh prices: ${error.message}`);
        }
    }
    
    // ============================================
    // UTILITY METHODS SECTION
    // ============================================
    
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (error) {
            return 'unknown';
        }
    }
    
    showSuccessMessage(message) {
        // Remove any existing success message
        const existingMessage = document.querySelector('.success-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create and show new success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        // Insert after the result section
        if (this.elements.result) {
            this.elements.result.parentNode.insertBefore(successDiv, this.elements.result.nextSibling);
        }
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }
}

// ============================================
// SINGLE INITIALIZATION POINT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 [Popup] DOM loaded, initializing extension...');
        
        // Initialize the clean, organized popup system
        window.shoppingExtension = new ShoppingExtensionPopup();
        
        console.log('✅ [Popup] Shopping extension initialized successfully');
        
    } catch (error) {
        console.error('❌ [Popup] Failed to initialize extension:', error);
        
        // Show error message to user
        document.body.innerHTML = `
            <div style="padding: 20px; color: red; text-align: center;">
                <h3>Extension Failed to Initialize</h3>
                <p>Error: ${error.message}</p>
                <p>Please reload the extension in chrome://extensions/</p>
            </div>
        `;
    }
});
