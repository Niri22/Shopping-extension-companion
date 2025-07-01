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
        const elementIds = Object.values(ExtensionConfig.ui.elements);
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
            if (!this.elements[id]) {
                console.warn('⚠️ [Popup] Element not found:', id);
            }
        });
        
        console.log('🔗 [Popup] Elements bound successfully');
    }
    
    setupEventListeners() {
        // Main action buttons
        this.elements.fetchBtn?.addEventListener('click', () => this.handleFetchInfo());
        this.elements.currentTabBtn?.addEventListener('click', () => this.handleCurrentTabInfo());
        this.elements.addToListBtn?.addEventListener('click', () => this.handleAddToList());
        
        // List management buttons
        this.elements.listToggle?.addEventListener('click', () => this.toggleList());
        this.elements.clearListBtn?.addEventListener('click', () => this.handleClearList());
        this.elements.exportListBtn?.addEventListener('click', () => this.handleExportList());
        
        // URL input handling
        this.elements.urlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleFetchInfo();
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
        if (this.elements.priceText) this.elements.priceText.textContent = price;
        if (this.elements.urlText) this.elements.urlText.textContent = url;
        
        // Store current page info for adding to list
        this.currentPageInfo = {
            title,
            price,
            url,
            domain: this.extractDomain(url)
        };
        
        // Update add to list button state
        this.updateAddToListButton();
        
        // Highlight price if found
        if (this.elements.priceText) {
            this.elements.priceText.classList.toggle('price-found', ExtensionUtils.price.isValid(price));
        }
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
        const truncatedTitle = product.title.length > 50 ? 
            product.title.substring(0, 50) + '...' : product.title;
        const truncatedUrl = product.url.length > 40 ? 
            product.url.substring(0, 40) + '...' : product.url;
        
        return `
            <div class="list-item" data-product-id="${product.id}">
                <div class="item-header">
                    <h4 class="item-title" title="${product.title}">${truncatedTitle}</h4>
                    <span class="item-price">${product.price}</span>
                </div>
                <div class="item-url" title="${product.url}">${truncatedUrl}</div>
                <div class="item-date">Added: ${dateAdded}</div>
                <div class="item-actions">
                    <button class="visit-btn" data-url="${product.url}">Visit</button>
                    <button class="remove-btn" data-product-id="${product.id}">Remove</button>
                </div>
            </div>
        `;
    }
    
    setupListEventListeners() {
        // Remove buttons
        this.elements.savedList?.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                this.handleRemoveFromList(productId);
            });
        });
        
        // Visit buttons
        this.elements.savedList?.querySelectorAll('.visit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
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
    
    toggleList() {
        this.listVisible = !this.listVisible;
        
        if (this.elements.listContainer && this.elements.listToggle) {
            if (this.listVisible) {
                this.elements.listContainer.classList.remove('hidden');
                this.elements.listToggle.classList.add('expanded');
            } else {
                this.elements.listContainer.classList.add('hidden');
                this.elements.listToggle.classList.remove('expanded');
            }
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
        if (this.elements.listCount) {
            this.elements.listCount.textContent = count;
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
