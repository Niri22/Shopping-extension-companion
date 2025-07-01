/**
 * Popup Script - Chrome Extension UI Controller
 * Manages the extension popup interface and communication with content scripts
 */

class ExtensionPopup {
    constructor() {
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.setupEventListeners();
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
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ExtensionPopup();
}); 