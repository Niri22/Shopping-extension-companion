/**
 * Event Bus Service
 * Provides decoupled communication between components using pub/sub pattern
 */

class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.middleware = [];
        this.debugMode = false;
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options (priority, context)
     * @returns {Function} - Unsubscribe function
     */
    on(event, callback, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const listener = {
            callback,
            priority: options.priority || 0,
            context: options.context || null,
            id: Date.now() + Math.random()
        };
        
        const listeners = this.events.get(event);
        listeners.push(listener);
        
        // Sort by priority (higher priority first)
        listeners.sort((a, b) => b.priority - a.priority);
        
        this.debug(`Subscribed to event: ${event}`, listener);
        
        // Return unsubscribe function
        return () => this.off(event, listener.id);
    }
    
    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options
     * @returns {Function} - Unsubscribe function
     */
    once(event, callback, options = {}) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback.apply(options.context || null, args);
        }, options);
        
        return unsubscribe;
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {string|Function} callbackOrId - Callback function or listener ID
     */
    off(event, callbackOrId) {
        if (!this.events.has(event)) return;
        
        const listeners = this.events.get(event);
        const index = listeners.findIndex(listener => 
            listener.id === callbackOrId || listener.callback === callbackOrId
        );
        
        if (index !== -1) {
            const removed = listeners.splice(index, 1)[0];
            this.debug(`Unsubscribed from event: ${event}`, removed);
        }
        
        // Clean up empty event arrays
        if (listeners.length === 0) {
            this.events.delete(event);
        }
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     * @returns {Promise<Array>} - Array of results from listeners
     */
    async emit(event, ...args) {
        this.debug(`Emitting event: ${event}`, args);
        
        // Apply middleware
        const eventData = { event, args, cancelled: false };
        
        for (const middleware of this.middleware) {
            await middleware(eventData);
            if (eventData.cancelled) {
                this.debug(`Event cancelled by middleware: ${event}`);
                return [];
            }
        }
        
        const listeners = this.events.get(event) || [];
        const results = [];
        
        for (const listener of listeners) {
            try {
                const result = await this.callListener(listener, eventData.args);
                results.push(result);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
                results.push({ error });
            }
        }
        
        this.debug(`Event ${event} processed by ${listeners.length} listeners`);
        return results;
    }
    
    /**
     * Emit an event synchronously
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     * @returns {Array} - Array of results from listeners
     */
    emitSync(event, ...args) {
        this.debug(`Emitting sync event: ${event}`, args);
        
        const listeners = this.events.get(event) || [];
        const results = [];
        
        for (const listener of listeners) {
            try {
                const result = listener.callback.apply(listener.context, args);
                results.push(result);
            } catch (error) {
                console.error(`Error in sync event listener for ${event}:`, error);
                results.push({ error });
            }
        }
        
        return results;
    }
    
    /**
     * Call a listener with proper context and error handling
     */
    async callListener(listener, args) {
        const { callback, context } = listener;
        
        if (context) {
            return await callback.apply(context, args);
        } else {
            return await callback(...args);
        }
    }
    
    /**
     * Add middleware for event processing
     * @param {Function} middleware - Middleware function
     */
    use(middleware) {
        this.middleware.push(middleware);
    }
    
    /**
     * Remove middleware
     * @param {Function} middleware - Middleware function to remove
     */
    removeMiddleware(middleware) {
        const index = this.middleware.indexOf(middleware);
        if (index !== -1) {
            this.middleware.splice(index, 1);
        }
    }
    
    /**
     * Get all event names
     * @returns {Array<string>} - Array of event names
     */
    getEvents() {
        return Array.from(this.events.keys());
    }
    
    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} - Number of listeners
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
    
    /**
     * Check if an event has listeners
     * @param {string} event - Event name
     * @returns {boolean} - True if event has listeners
     */
    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }
    
    /**
     * Remove all listeners for an event or all events
     * @param {string} [event] - Specific event name (optional)
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
            this.debug(`Removed all listeners for event: ${event}`);
        } else {
            this.events.clear();
            this.debug('Removed all event listeners');
        }
    }
    
    /**
     * Create a namespaced event bus
     * @param {string} namespace - Namespace prefix
     * @returns {Object} - Namespaced event bus methods
     */
    namespace(namespace) {
        const prefixEvent = (event) => `${namespace}:${event}`;
        
        return {
            on: (event, callback, options) => this.on(prefixEvent(event), callback, options),
            once: (event, callback, options) => this.once(prefixEvent(event), callback, options),
            off: (event, callbackOrId) => this.off(prefixEvent(event), callbackOrId),
            emit: (event, ...args) => this.emit(prefixEvent(event), ...args),
            emitSync: (event, ...args) => this.emitSync(prefixEvent(event), ...args)
        };
    }
    
    /**
     * Create a promise that resolves when an event is emitted
     * @param {string} event - Event name
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} - Promise that resolves with event data
     */
    waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);
            
            const unsubscribe = this.once(event, (...args) => {
                clearTimeout(timer);
                resolve(args);
            });
        });
    }
    
    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * Debug logging
     */
    debug(message, data) {
        if (this.debugMode) {
            console.log(`[EventBus] ${message}`, data || '');
        }
    }
    
    /**
     * Get statistics about the event bus
     * @returns {Object} - Statistics object
     */
    getStats() {
        const events = this.getEvents();
        const totalListeners = events.reduce((sum, event) => sum + this.listenerCount(event), 0);
        
        return {
            eventCount: events.length,
            totalListeners,
            middlewareCount: this.middleware.length,
            events: events.map(event => ({
                name: event,
                listenerCount: this.listenerCount(event)
            }))
        };
    }
    
    /**
     * Dispose of the event bus and clean up resources
     */
    dispose() {
        this.removeAllListeners();
        this.middleware.length = 0;
        this.debug('Event bus disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
} else {
    window.EventBus = EventBus;
} 