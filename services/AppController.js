/**
 * Application Controller
 * Main orchestrator that manages all services and coordinates application flow
 */

class AppController {
    constructor() {
        this.services = new Map();
        this.isInitialized = false;
        this.errorHandler = this.createErrorHandler();
        
        this.init();
    }
    
    async init() {
        try {
            await this.initializeServices();
            await this.setupServiceCommunication();
            await this.bindEventHandlers();
            
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
            
            if (!currentPageInfo || !storage.isValidProduct(currentPageInfo)) {
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