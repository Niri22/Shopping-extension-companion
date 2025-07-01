/**
 * Popup Entry Point - Optimized Service-Based Architecture
 * Initializes the new performance-optimized application controller
 */

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize the main application controller with all services
        window.app = new AppController();
        
        // Wait for initialization to complete
        await window.app.services.get('eventBus').waitFor('app:initialized', 5000);
        
        console.log('✅ Application initialized with optimized architecture');
        
        // Optional: Display performance stats in debug mode
        if (ExtensionConfig.debug.enabled) {
            const stats = await window.app.getStats();
            console.log('📊 Application Stats:', stats);
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        
        // Fallback to legacy mode if new architecture fails
        console.warn('🔄 Falling back to legacy mode...');
        window.legacyPopup = new LegacyExtensionPopup();
    }
});

// Legacy fallback class (simplified version of original)
class LegacyExtensionPopup {
    constructor() {
        this.elements = {};
        this.currentPageInfo = null;
        this.listVisible = false;
        this.init();
    }
    
    init() {
        this.bindElements();
        this.setupEventListeners();
        this.loadSavedList();
    }
    
    bindElements() {
        const elementIds = Object.values(ExtensionConfig.ui.elements);
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    setupEventListeners() {
        this.elements.fetchBtn.addEventListener('click', () => this.handleFetchInfo());
        this.elements.currentTabBtn.addEventListener('click', () => this.handleCurrentTabInfo());
        this.elements.addToListBtn.addEventListener('click', () => this.handleAddToList());
        this.elements.listToggle.addEventListener('click', () => this.toggleList());
        this.elements.clearListBtn.addEventListener('click', () => this.handleClearList());
        this.elements.exportListBtn.addEventListener('click', () => this.handleExportList());
        
        this.elements.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleFetchInfo();
            }
        });
    }
    
    async handleFetchInfo() {
        const url = ExtensionUtils.url.normalize(this.elements.urlInput.value);
        
        const validation = ExtensionUtils.url.validate(url);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }
        
        this.showLoading();
        
        try {
            const pageInfo = await this.fetchPageInfo(url);
            this.showResult(pageInfo.title, pageInfo.price, url);
        } catch (error) {
            this.showError(`${ExtensionConfig.messages.errors.fetchFailed}: ${error.message}`);
        }
    }
    
    async handleCurrentTabInfo() {
        this.showLoading();
        
        try {
            const tab = await ExtensionUtils.chrome.getCurrentTab();
            if (!tab?.id) {
                this.showError(ExtensionConfig.messages.errors.noTab);
                return;
            }

            const result = await this.retryGetPageInfo(tab);
            this.showResult(result.title, result.price, result.url);
            
        } catch (error) {
            await this.handleCurrentTabError(error);
        }
    }
    
    async fetchPageInfo(url) {
        const tab = await ExtensionUtils.chrome.createTab(url, false);
        return new Promise((resolve, reject) => {
            this.setupTabListener(tab, resolve, reject);
        });
    }
    
    setupTabListener(tab, resolve, reject) {
        const tabId = tab.id;
        let timeoutId = setTimeout(() => {
            chrome.tabs.remove(tabId);
            reject(new Error(ExtensionConfig.messages.errors.timeout));
        }, ExtensionConfig.timing.pageTimeout);
        
        const onTabUpdated = (updatedTabId, changeInfo, updatedTab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onTabUpdated);
                clearTimeout(timeoutId);
                
                this.getPageInfoFromTab(tabId, updatedTab, resolve);
            }
        };
        
        chrome.tabs.onUpdated.addListener(onTabUpdated);
    }
    
    async getPageInfoFromTab(tabId, tab, resolve) {
        try {
            const response = await ExtensionUtils.chrome.sendMessageToTab(tabId, { action: 'getPageInfo' });
            chrome.tabs.remove(tabId);
            
            resolve({
                title: response?.title || tab.title || ExtensionConfig.messages.notFound.title,
                price: response?.price || ExtensionConfig.messages.notFound.price
            });
        } catch (error) {
            chrome.tabs.remove(tabId);
            resolve({
                title: tab.title || ExtensionConfig.messages.notFound.title,
                price: ExtensionConfig.messages.notFound.price
            });
        }
    }
    
    async retryGetPageInfo(tab) {
        let bestResponse = null;
        let lastError = null;

        const config = ExtensionConfig.timing;
        
        for (let attempt = 0; attempt < config.maxRetryAttempts; attempt++) {
            try {
                const response = await ExtensionUtils.chrome.sendMessageToTab(tab.id, { action: 'getPageInfo' });
                
                if (response) {
                    if (ExtensionUtils.price.isValid(response.price)) {
                        return response; // Success - return immediately
                    } else if (response.title) {
                        bestResponse = response; // Keep best response so far
                    }
                }
            } catch (error) {
                lastError = error;
                ExtensionUtils.log.debug(`Attempt ${attempt + 1} failed`, error.message);
            }

            // Wait before next attempt (except on last attempt)
            if (attempt < config.maxRetryAttempts - 1) {
                await ExtensionUtils.async.delay(config.retryDelays[attempt]);
            }
        }

        // Return best response or fallback
        return bestResponse || {
            title: tab.title || ExtensionConfig.messages.notFound.title,
            price: `${ExtensionConfig.messages.notFound.price} - ${ExtensionConfig.messages.errors.contentScriptError}`,
            url: tab.url
        };
    }
    

    
    async handleCurrentTabError(error) {
        try {
            const tab = await ExtensionUtils.chrome.getCurrentTab();
            if (tab?.title && tab?.url) {
                this.showResult(tab.title, `${ExtensionConfig.messages.notFound.price} - ${ExtensionConfig.messages.errors.extensionError}`, tab.url);
            } else {
                this.showError(ExtensionConfig.messages.errors.noTab);
            }
        } catch (fallbackError) {
            this.showError(`${ExtensionConfig.messages.errors.fetchFailed}: ${error.message}`);
        }
    }
    

    
    showLoading() {
        this.hideAllSections();
        this.elements.loading.classList.remove('hidden');
    }
    
    showResult(title, price, url) {
        this.hideAllSections();
        this.elements.result.classList.remove('hidden');
        
        this.elements.titleText.textContent = title;
        this.elements.priceText.textContent = price;
        this.elements.urlText.textContent = url;
        
        // Store current page info for adding to list
        this.currentPageInfo = {
            title,
            price,
            url,
            domain: new URL(url).hostname
        };
        
        // Enable/disable add to list button based on validity
        const isValidProduct = ExtensionUtils.storage.isValidProduct(this.currentPageInfo);
        this.elements.addToListBtn.disabled = !isValidProduct;
        this.elements.addToListBtn.textContent = isValidProduct ? 
            ExtensionConfig.messages.list.addButton : 
            'Cannot Add (Invalid Product)';
        
        // Highlight price if found
        this.elements.priceText.classList.toggle('price-found', ExtensionUtils.price.isValid(price));
    }
    
    showError(message) {
        this.hideAllSections();
        this.elements.error.classList.remove('hidden');
        this.elements.errorText.textContent = message;
    }
    
    hideAllSections() {
        ['loading', 'result', 'error'].forEach(section => {
            this.elements[section].classList.add('hidden');
        });
    }
    
    // List management methods
    async handleAddToList() {
        if (!this.currentPageInfo || !ExtensionUtils.storage.isValidProduct(this.currentPageInfo)) {
            this.showError('No valid product information to add');
            return;
        }
        
        try {
            const success = await ExtensionUtils.storage.saveProduct(this.currentPageInfo);
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.addedToList);
                await this.loadSavedList();
                
                // Disable the button temporarily to prevent duplicate adds
                this.elements.addToListBtn.disabled = true;
                this.elements.addToListBtn.textContent = 'Added!';
                
                setTimeout(() => {
                    if (this.currentPageInfo) {
                        this.elements.addToListBtn.disabled = false;
                        this.elements.addToListBtn.textContent = ExtensionConfig.messages.list.addButton;
                    }
                }, 2000);
            } else {
                this.showError('Failed to add product to list');
            }
        } catch (error) {
            this.showError(`Error adding to list: ${error.message}`);
        }
    }
    
    async loadSavedList() {
        try {
            const products = await ExtensionUtils.storage.getProducts();
            this.renderList(products);
            this.updateListCount(products.length);
        } catch (error) {
            ExtensionUtils.log.error('Failed to load saved list', error);
        }
    }
    
    renderList(products) {
        const listElement = this.elements.savedList;
        
        if (products.length === 0) {
            listElement.innerHTML = `
                <div class="empty-list">
                    <p>${ExtensionConfig.messages.list.empty}</p>
                    <p class="hint">Add products using the "Add to List" button above</p>
                </div>
            `;
            return;
        }
        
        listElement.innerHTML = products.map(product => this.createListItemHTML(product)).join('');
        
        // Add event listeners for remove and visit buttons
        listElement.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                this.handleRemoveFromList(productId);
            });
        });
        
        listElement.querySelectorAll('.visit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                this.handleVisitProduct(url);
            });
        });
    }
    
    createListItemHTML(product) {
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
    
    async handleRemoveFromList(productId) {
        try {
            const success = await ExtensionUtils.storage.removeProduct(productId);
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.removedFromList);
                await this.loadSavedList();
            } else {
                this.showError('Failed to remove product from list');
            }
        } catch (error) {
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
        
        if (this.listVisible) {
            this.elements.listContainer.classList.remove('hidden');
            this.elements.listToggle.classList.add('expanded');
        } else {
            this.elements.listContainer.classList.add('hidden');
            this.elements.listToggle.classList.remove('expanded');
        }
    }
    
    async handleClearList() {
        if (!confirm('Are you sure you want to clear all saved products? This action cannot be undone.')) {
            return;
        }
        
        try {
            const success = await ExtensionUtils.storage.clearProducts();
            
            if (success) {
                this.showSuccessMessage(ExtensionConfig.messages.success.listCleared);
                await this.loadSavedList();
            } else {
                this.showError('Failed to clear list');
            }
        } catch (error) {
            this.showError(`Error clearing list: ${error.message}`);
        }
    }
    
    async handleExportList() {
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
            this.showError(`Error exporting list: ${error.message}`);
        }
    }
    
    updateListCount(count) {
        this.elements.listCount.textContent = count;
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
        const resultSection = this.elements.result;
        resultSection.parentNode.insertBefore(successDiv, resultSection.nextSibling);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ExtensionPopup();
}); 