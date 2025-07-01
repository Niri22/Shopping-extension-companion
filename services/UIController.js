/**
 * UI Controller Service
 * Optimized UI management with virtual DOM concepts, efficient rendering, and state management
 */

class UIController {
    constructor(performanceManager, eventBus) {
        this.performanceManager = performanceManager;
        this.eventBus = eventBus;
        this.elements = new Map();
        this.state = new Map();
        this.renderQueue = new Set();
        this.isRendering = false;
        
        this.init();
    }
    
    init() {
        this.bindElements();
        this.setupEventListeners();
        this.setupIntersectionObserver();
    }
    
    /**
     * Optimized element binding with caching
     */
    bindElements() {
        const elementIds = Object.values(ExtensionConfig.ui.elements);
        
        // Use performance manager for batched DOM queries
        this.performanceManager.batchDOMUpdates(elementIds.map(id => () => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
            return element;
        }));
    }
    
    /**
     * Get element with caching
     */
    getElement(id) {
        if (!this.elements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        }
        return this.elements.get(id);
    }
    
    /**
     * Set up event listeners with delegation and debouncing
     */
    setupEventListeners() {
        // Use event delegation for better performance
        document.addEventListener('click', this.performanceManager.debounce('click-handler', 
            (e) => this.handleClick(e), 50));
        
        document.addEventListener('input', this.performanceManager.debounce('input-handler',
            (e) => this.handleInput(e), 300));
        
        // Listen to storage events for UI updates
        this.eventBus.on('storage:products:updated', (products) => {
            this.updateProductList(products);
        });
        
        this.eventBus.on('storage:product:saved', (product) => {
            this.showSuccessMessage(ExtensionConfig.messages.success.addedToList);
        });
    }
    
    /**
     * Set up intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        const listContainer = this.getElement('savedList');
        if (listContainer) {
            this.performanceManager.lazyLoad([listContainer], (element) => {
                this.loadVisibleListItems(element);
            });
        }
    }
    
    /**
     * Handle click events with delegation
     */
    handleClick(event) {
        const target = event.target;
        const action = target.dataset.action;
        
        if (!action) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        switch (action) {
            case 'fetch-info':
                this.handleFetchInfo();
                break;
            case 'current-tab':
                this.handleCurrentTabInfo();
                break;
            case 'add-to-list':
                this.handleAddToList();
                break;
            case 'toggle-list':
                this.toggleList();
                break;
            case 'clear-list':
                this.handleClearList();
                break;
            case 'export-list':
                this.handleExportList();
                break;
            case 'visit-product':
                this.handleVisitProduct(target.dataset.url);
                break;
            case 'remove-product':
                this.handleRemoveProduct(target.dataset.productId);
                break;
        }
    }
    
    /**
     * Handle input events with debouncing
     */
    handleInput(event) {
        const target = event.target;
        
        if (target.id === 'urlInput') {
            this.validateUrl(target.value);
        }
    }
    
    /**
     * Optimized state management
     */
    setState(key, value) {
        const oldValue = this.state.get(key);
        if (oldValue !== value) {
            this.state.set(key, value);
            this.scheduleRender(key);
        }
    }
    
    getState(key) {
        return this.state.get(key);
    }
    
    /**
     * Schedule efficient rendering
     */
    scheduleRender(component) {
        this.renderQueue.add(component);
        
        if (!this.isRendering) {
            this.isRendering = true;
            requestAnimationFrame(() => {
                this.processRenderQueue();
                this.isRendering = false;
            });
        }
    }
    
    /**
     * Process render queue efficiently
     */
    processRenderQueue() {
        this.performanceManager.measure('processRenderQueue', () => {
            for (const component of this.renderQueue) {
                this.renderComponent(component);
            }
            this.renderQueue.clear();
        });
    }
    
    /**
     * Render specific components
     */
    renderComponent(component) {
        switch (component) {
            case 'productList':
                this.renderProductList();
                break;
            case 'listCount':
                this.renderListCount();
                break;
            case 'loadingState':
                this.renderLoadingState();
                break;
            case 'resultState':
                this.renderResultState();
                break;
        }
    }
    
    /**
     * Optimized product list rendering with virtual scrolling
     */
    async renderProductList() {
        const listElement = this.getElement('savedList');
        const products = this.getState('products') || [];
        
        if (!listElement) return;
        
        return this.performanceManager.measureAsync('renderProductList', async () => {
            if (products.length === 0) {
                listElement.innerHTML = this.createEmptyListHTML();
                return;
            }
            
            // Use document fragment for efficient DOM manipulation
            const fragment = document.createDocumentFragment();
            
            // Implement virtual scrolling for large lists
            const visibleProducts = this.getVisibleProducts(products);
            
            for (const product of visibleProducts) {
                const itemElement = this.createProductElement(product);
                fragment.appendChild(itemElement);
            }
            
            // Replace content efficiently
            listElement.innerHTML = '';
            listElement.appendChild(fragment);
            
            // Set up lazy loading for images if any
            this.setupImageLazyLoading(listElement);
        });
    }
    
    /**
     * Create product element with optimized HTML generation
     */
    createProductElement(product) {
        const template = document.createElement('div');
        template.className = 'list-item';
        template.dataset.productId = product.id;
        
        const dateAdded = new Date(product.dateAdded).toLocaleDateString();
        const truncatedTitle = this.truncateText(product.title, 50);
        const truncatedUrl = this.truncateText(product.url, 40);
        
        template.innerHTML = `
            <div class="item-header">
                <h4 class="item-title" title="${this.escapeHtml(product.title)}">${this.escapeHtml(truncatedTitle)}</h4>
                <span class="item-price">${this.escapeHtml(product.price)}</span>
            </div>
            <div class="item-url" title="${this.escapeHtml(product.url)}">${this.escapeHtml(truncatedUrl)}</div>
            <div class="item-date">Added: ${dateAdded}</div>
            <div class="item-actions">
                <button class="visit-btn" data-action="visit-product" data-url="${this.escapeHtml(product.url)}">Visit</button>
                <button class="remove-btn" data-action="remove-product" data-product-id="${product.id}">Remove</button>
            </div>
        `;
        
        return template;
    }
    
    /**
     * Get visible products for virtual scrolling
     */
    getVisibleProducts(products) {
        // For now, return all products. In a real implementation,
        // this would calculate which items are visible based on scroll position
        return products;
    }
    
    /**
     * Set up lazy loading for images
     */
    setupImageLazyLoading(container) {
        const images = container.querySelectorAll('img[data-src]');
        if (images.length > 0) {
            this.performanceManager.lazyLoad(Array.from(images), (img) => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }
    
    /**
     * Update product list efficiently
     */
    async updateProductList(products) {
        this.setState('products', products);
        this.setState('listCount', products.length);
    }
    
    /**
     * Render list count with animation
     */
    renderListCount() {
        const countElement = this.getElement('listCount');
        const count = this.getState('listCount') || 0;
        
        if (countElement && countElement.textContent !== count.toString()) {
            // Animate count change
            countElement.style.transform = 'scale(1.2)';
            countElement.textContent = count;
            
            setTimeout(() => {
                countElement.style.transform = 'scale(1)';
            }, 200);
        }
    }
    
    /**
     * Show loading state with optimized UI
     */
    showLoading() {
        this.setState('loadingState', true);
        this.hideAllSections();
        this.getElement('loading')?.classList.remove('hidden');
    }
    
    /**
     * Show result with optimized rendering
     */
    showResult(title, price, url) {
        this.setState('loadingState', false);
        this.setState('resultData', { title, price, url });
        
        this.hideAllSections();
        this.scheduleRender('resultState');
    }
    
    /**
     * Render result state
     */
    renderResultState() {
        const resultElement = this.getElement('result');
        const resultData = this.getState('resultData');
        
        if (!resultElement || !resultData) return;
        
        resultElement.classList.remove('hidden');
        
        // Update text content efficiently
        this.updateElementText('titleText', resultData.title);
        this.updateElementText('priceText', resultData.price);
        this.updateElementText('urlText', resultData.url);
        
        // Update add to list button state
        this.updateAddToListButton(resultData);
        
        // Highlight price if found
        const priceElement = this.getElement('priceText');
        if (priceElement) {
            priceElement.classList.toggle('price-found', 
                ExtensionUtils.price.isValid(resultData.price));
        }
    }
    
    /**
     * Update element text content efficiently
     */
    updateElementText(elementId, text) {
        const element = this.getElement(elementId);
        if (element && element.textContent !== text) {
            element.textContent = text;
        }
    }
    
    /**
     * Update add to list button state
     */
    updateAddToListButton(resultData) {
        const addButton = this.getElement('addToListBtn');
        if (!addButton) return;
        
        const currentPageInfo = {
            title: resultData.title,
            price: resultData.price,
            url: resultData.url,
            domain: new URL(resultData.url).hostname
        };
        
        const isValid = ExtensionUtils.storage.isValidProduct(currentPageInfo);
        addButton.disabled = !isValid;
        addButton.textContent = isValid ? 
            ExtensionConfig.messages.list.addButton : 
            'Cannot Add (Invalid Product)';
        
        // Store current page info for later use
        this.setState('currentPageInfo', currentPageInfo);
    }
    
    /**
     * Show error with auto-hide
     */
    showError(message) {
        this.hideAllSections();
        const errorElement = this.getElement('error');
        const errorTextElement = this.getElement('errorText');
        
        if (errorElement && errorTextElement) {
            errorTextElement.textContent = message;
            errorElement.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorElement.classList.add('hidden');
            }, 5000);
        }
    }
    
    /**
     * Show success message with animation
     */
    showSuccessMessage(message) {
        // Remove existing success message
        const existing = document.querySelector('.success-message');
        if (existing) {
            existing.remove();
        }
        
        // Create and show new success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        // Insert after result section
        const resultSection = this.getElement('result');
        if (resultSection && resultSection.parentNode) {
            resultSection.parentNode.insertBefore(successDiv, resultSection.nextSibling);
            
            // Auto-remove with animation
            setTimeout(() => {
                successDiv.style.opacity = '0';
                setTimeout(() => {
                    if (successDiv.parentNode) {
                        successDiv.remove();
                    }
                }, 300);
            }, 3000);
        }
    }
    
    /**
     * Hide all sections efficiently
     */
    hideAllSections() {
        const sections = ['loading', 'result', 'error'];
        sections.forEach(section => {
            const element = this.getElement(section);
            if (element) {
                element.classList.add('hidden');
            }
        });
    }
    
    /**
     * Toggle list with smooth animation
     */
    toggleList() {
        const listVisible = this.getState('listVisible') || false;
        const newState = !listVisible;
        
        this.setState('listVisible', newState);
        
        const listContainer = this.getElement('listContainer');
        const listToggle = this.getElement('listToggle');
        
        if (listContainer && listToggle) {
            if (newState) {
                listContainer.classList.remove('hidden');
                listToggle.classList.add('expanded');
            } else {
                listContainer.classList.add('hidden');
                listToggle.classList.remove('expanded');
            }
        }
    }
    
    /**
     * Validate URL input with real-time feedback
     */
    validateUrl(url) {
        const inputElement = this.getElement('urlInput');
        const fetchButton = this.getElement('fetchBtn');
        
        if (!inputElement || !fetchButton) return;
        
        const isValid = ExtensionUtils.url.isValid(url);
        
        inputElement.classList.toggle('invalid', url && !isValid);
        fetchButton.disabled = !isValid;
    }
    
    // Helper methods
    
    createEmptyListHTML() {
        return `
            <div class="empty-list">
                <p>${ExtensionConfig.messages.list.empty}</p>
                <p class="hint">Add products using the "Add to List" button above</p>
            </div>
        `;
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Dispose of the controller and clean up resources
     */
    dispose() {
        this.elements.clear();
        this.state.clear();
        this.renderQueue.clear();
        
        // Remove event listeners
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('input', this.handleInput);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
} else {
    window.UIController = UIController;
} 