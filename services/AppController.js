/**
 * Application Controller
 * Main orchestrator that manages all services and coordinates application flow
 */

class AppController {
    constructor() {
        this.services = new Map();
        this.isInitialized = false;
        this.errorHandler = {
            handle: (error, context = 'Unknown error') => {
                console.error(`[AppController] ${context}:`, error);
                
                // Emit error event for other components
                this.emit('app:error', { error, context });
                
                // Log to performance manager if available
                const performance = this.services.get('performance');
                if (performance) {
                    console.log('Error occurred, triggering memory optimization');
                    performance.optimizeMemory();
                }
            }
        };
    }
    
    async init() {
        try {
            await this.initializeServices();
            await this.setupServiceCommunication();
            await this.bindEventHandlers();
            await this.initializeUI();
            
            this.isInitialized = true;
            this.emit('app:initialized');
            
            console.log('Application initialized successfully');
        } catch (error) {
            this.errorHandler.handle(error, 'Application initialization failed');
        }
    }
    
    /**
     * Initialize all services in the correct order
     */
    async initializeServices() {
        // Initialize core services first
        this.services.set('performance', new PerformanceManager());
        this.services.set('eventBus', new EventBus());
        
        // Initialize dependent services
        const performanceManager = this.services.get('performance');
        const eventBus = this.services.get('eventBus');
        
        this.services.set('storage', new StorageService(performanceManager, eventBus));
        this.services.set('ui', new UIController(performanceManager, eventBus));
        
        // Enable debug mode if configured
        if (ExtensionConfig.debug.enabled) {
            eventBus.setDebugMode(true);
        }
    }
    
    /**
     * Set up communication between services
     */
    async setupServiceCommunication() {
        const eventBus = this.services.get('eventBus');
        
        // Set up cross-service event handlers
        eventBus.on('storage:products:updated', async (products) => {
            await this.handleProductsUpdated(products);
        });
        
        eventBus.on('storage:error', (errorData) => {
            this.errorHandler.handle(errorData.error, `Storage error in ${errorData.operation}`);
        });
        
        eventBus.on('ui:action', async (action) => {
            await this.handleUIAction(action);
        });
    }
    
    /**
     * Bind event handlers for the main application logic
     */
    async bindEventHandlers() {
        const ui = this.services.get('ui');
        
        // Override UI controller methods to add application logic
        ui.handleFetchInfo = () => this.handleFetchInfo();
        ui.handleCurrentTabInfo = () => this.handleCurrentTabInfo();
        ui.handleAddToList = () => this.handleAddToList();
        ui.handleClearList = () => this.handleClearList();
        ui.handleExportList = () => this.handleExportList();
        ui.handleVisitProduct = (url) => this.handleVisitProduct(url);
        ui.handleRemoveProduct = (productId) => this.handleRemoveProduct(productId);
    }
    
    /**
     * Initialize UI with saved data
     */
    async initializeUI() {
        const storage = this.services.get('storage');
        const ui = this.services.get('ui');
        
        try {
            // Load saved products and update UI
            const products = await storage.getProducts();
            await ui.updateProductList(products);
            
            console.log(`✅ Loaded ${products.length} saved products`);
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to initialize UI with saved data');
        }
    }
    
    /**
     * Handle fetching info from URL
     */
    async handleFetchInfo() {
        const ui = this.services.get('ui');
        const performance = this.services.get('performance');
        
        try {
            const urlInput = ui.getElement('urlInput');
            const url = urlInput?.value?.trim();
            
            if (!url) {
                ui.showError(ExtensionConfig.messages.errors.emptyUrl);
                return;
            }
            
            if (!ExtensionUtils.url.isValid(url)) {
                ui.showError(ExtensionConfig.messages.errors.invalidUrl);
                return;
            }
            
            ui.showLoading();
            
            const result = await performance.measureAsync('fetchPageInfo', async () => {
                return await this.fetchPageInfo(url);
            });
            
            if (result.success) {
                ui.showResult(result.title, result.price, result.url);
            } else {
                ui.showError(result.error || ExtensionConfig.messages.errors.fetchFailed);
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to fetch page info');
            ui.showError(ExtensionConfig.messages.errors.fetchFailed);
        }
    }
    
    /**
     * Handle fetching info from current tab
     */
    async handleCurrentTabInfo() {
        const ui = this.services.get('ui');
        const performance = this.services.get('performance');
        
        try {
            ui.showLoading();
            
            const result = await performance.measureAsync('getCurrentTabInfo', async () => {
                return await this.getCurrentTabInfo();
            });
            
            if (result.success) {
                ui.showResult(result.title, result.price, result.url);
            } else {
                ui.showError(result.error || ExtensionConfig.messages.errors.noTab);
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to get current tab info');
            ui.showError(ExtensionConfig.messages.errors.noTab);
        }
    }
    
    /**
     * Handle adding product to list
     */
    async handleAddToList() {
        const ui = this.services.get('ui');
        const storage = this.services.get('storage');
        
        try {
            const currentPageInfo = ui.getState('currentPageInfo');
            
            if (!currentPageInfo || !ExtensionUtils.storage.isValidProduct(currentPageInfo)) {
                ui.showError('No valid product information to add');
                return;
            }
            
            const success = await storage.saveProduct(currentPageInfo);
            
            if (success) {
                // Temporarily disable button
                const addButton = ui.getElement('addToListBtn');
                if (addButton) {
                    addButton.disabled = true;
                    addButton.textContent = 'Added!';
                    
                    setTimeout(() => {
                        addButton.disabled = false;
                        addButton.textContent = ExtensionConfig.messages.list.addButton;
                    }, 2000);
                }
            } else {
                ui.showError('Failed to add product to list');
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to add product to list');
            ui.showError(`Error adding to list: ${error.message}`);
        }
    }
    
    /**
     * Handle clearing all products
     */
    async handleClearList() {
        const ui = this.services.get('ui');
        const storage = this.services.get('storage');
        
        try {
            const confirmed = confirm('Are you sure you want to clear all saved products? This action cannot be undone.');
            
            if (!confirmed) return;
            
            const success = await storage.clearProducts();
            
            if (!success) {
                ui.showError('Failed to clear list');
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to clear list');
            ui.showError(`Error clearing list: ${error.message}`);
        }
    }
    
    /**
     * Handle exporting product list
     */
    async handleExportList() {
        const ui = this.services.get('ui');
        const storage = this.services.get('storage');
        
        try {
            const jsonData = await storage.exportProducts('json');
            
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
            
            ui.showSuccessMessage(ExtensionConfig.messages.success.listExported);
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to export list');
            ui.showError(`Error exporting list: ${error.message}`);
        }
    }
    
    /**
     * Handle visiting a product URL
     */
    async handleVisitProduct(url) {
        try {
            await chrome.tabs.create({ url, active: true });
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to open URL');
            const ui = this.services.get('ui');
            ui.showError(`Failed to open URL: ${error.message}`);
        }
    }
    
    /**
     * Handle removing a product
     */
    async handleRemoveProduct(productId) {
        const ui = this.services.get('ui');
        const storage = this.services.get('storage');
        
        try {
            const success = await storage.removeProduct(productId);
            
            if (!success) {
                ui.showError('Failed to remove product from list');
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Failed to remove product');
            ui.showError(`Error removing from list: ${error.message}`);
        }
    }
    
    /**
     * Handle products updated event
     */
    async handleProductsUpdated(products) {
        const ui = this.services.get('ui');
        await ui.updateProductList(products);
    }
    

    
    /**
     * Fetch page info from URL
     */
    async fetchPageInfo(url) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
                const timeoutId = setTimeout(() => {
                    chrome.tabs.remove(tab.id);
                    resolve({ success: false, error: 'Timeout: Page took too long to load' });
                }, ExtensionConfig.timing.pageTimeout);
                
                const onTabUpdated = (updatedTabId, changeInfo, updatedTab) => {
                    if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(onTabUpdated);
                        clearTimeout(timeoutId);
                        
                        chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (response) => {
                            chrome.tabs.remove(tab.id);
                            
                            if (response) {
                                resolve({
                                    success: true,
                                    title: response.title || updatedTab.title || 'No title found',
                                    price: response.price || 'No price found',
                                    url: url
                                });
                            } else {
                                resolve({
                                    success: true,
                                    title: updatedTab.title || 'No title found',
                                    price: 'No price found',
                                    url: url
                                });
                            }
                        });
                    }
                };
                
                chrome.tabs.onUpdated.addListener(onTabUpdated);
            });
        });
    }
    
    /**
     * Get current tab info
     */
    async getCurrentTabInfo() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs[0]) {
                    resolve({ success: false, error: 'Unable to get current tab information' });
                    return;
                }
                
                const tab = tabs[0];
                
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
                    
                    resolve({
                        success: true,
                        title: response?.title || tab.title || 'No title found',
                        price: response?.price || 'No price found',
                        url: tab.url
                    });
                } catch (error) {
                    resolve({
                        success: true,
                        title: tab.title || 'No title found',
                        price: 'No price found - Extension error',
                        url: tab.url
                    });
                }
            });
        });
    }
    
    /**
     * Handle UI action
     */
    async handleUIAction(action) {
        console.log('UI Action:', action);
        // Handle specific UI actions if needed
    }
    
    /**
     * Emit events through the event bus
     */
    emit(event, data) {
        const eventBus = this.services.get('eventBus');
        if (eventBus) {
            eventBus.emit(event, data);
        }
    }
    
    /**
     * Get service instance
     */
    getService(name) {
        return this.services.get(name);
    }
    
    /**
     * Get application statistics
     */
    async getStats() {
        const storage = this.services.get('storage');
        const performance = this.services.get('performance');
        const eventBus = this.services.get('eventBus');
        
        return {
            storage: await storage.getStorageStats(),
            performance: {
                cacheStats: performance.cacheAPI.stats(),
                memoryThreshold: performance.memoryThreshold
            },
            eventBus: eventBus.getStats(),
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * Dispose of the application and clean up resources
     */
    dispose() {
        // Dispose services in reverse order
        const serviceNames = Array.from(this.services.keys()).reverse();
        
        for (const serviceName of serviceNames) {
            const service = this.services.get(serviceName);
            if (service && typeof service.dispose === 'function') {
                try {
                    service.dispose();
                } catch (error) {
                    console.warn(`Failed to dispose service ${serviceName}:`, error);
                }
            }
        }
        
        this.services.clear();
        this.isInitialized = false;
        
        console.log('Application disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppController;
} else {
    window.AppController = AppController;
} 