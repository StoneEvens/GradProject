/**
 * Operation Queue Manager
 * 
 * Manages a FIFO queue of operations to be executed by the operation client.
 * Each operation is an atomic step that the AI agent wants to perform.
 */

class OperationQueue {
  constructor() {
    this.queue = [];
    this.maxSize = 100; // Prevent infinite queue growth
    this.listeners = []; // Event listeners for queue changes
  }

  /**
   * Add an operation to the queue
   * @param {Object} operation - Operation object
   * @param {string} operation.operation_id - Unique identifier
   * @param {string} operation.type - Operation type (navigate|fill_form|click|display_data)
   * @param {Object} operation.params - Operation parameters
   * @param {boolean} operation.requires_confirmation - Whether to pause before execution
   * @returns {boolean} Success status
   */
  enqueue(operation) {
    // Validate operation structure
    if (!this.validateOperation(operation)) {
      console.error('Invalid operation structure:', operation);
      return false;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxSize) {
      console.warn('Operation queue is full. Removing oldest operation.');
      this.queue.shift();
    }

    // Add timestamp and status
    const enhancedOperation = {
      ...operation,
      addedAt: new Date().toISOString(),
      status: 'pending', // pending | executing | completed | failed | cancelled
      result: null,
      error: null
    };

    this.queue.push(enhancedOperation);
    console.log(`[OperationQueue] Enqueued operation: ${operation.operation_id}`, enhancedOperation);
    
    this.notifyListeners('enqueue', enhancedOperation);
    return true;
  }

  /**
   * Peek at the first operation without removing it
   * @returns {Object|null} First operation or null if queue is empty
   */
  peek() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Remove and return the first operation
   * @returns {Object|null} First operation or null if queue is empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const operation = this.queue.shift();
    console.log(`[OperationQueue] Dequeued operation: ${operation.operation_id}`);
    
    this.notifyListeners('dequeue', operation);
    return operation;
  }

  /**
   * Get the current size of the queue
   * @returns {number} Queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Get all operations in the queue (without removing)
   * @returns {Array} Copy of queue array
   */
  getAll() {
    return [...this.queue];
  }

  /**
   * Clear all operations from the queue
   */
  clear() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`[OperationQueue] Cleared ${clearedCount} operations`);
    
    this.notifyListeners('clear', { count: clearedCount });
  }

  /**
   * Update the status of an operation
   * @param {string} operationId - Operation ID
   * @param {string} status - New status
   * @param {Object} data - Additional data (result or error)
   */
  updateOperationStatus(operationId, status, data = {}) {
    const operation = this.queue.find(op => op.operation_id === operationId);
    
    if (operation) {
      operation.status = status;
      
      if (data.result !== undefined) {
        operation.result = data.result;
      }
      
      if (data.error !== undefined) {
        operation.error = data.error;
      }
      
      console.log(`[OperationQueue] Updated operation ${operationId} status to ${status}`);
      this.notifyListeners('statusUpdate', operation);
    }
  }

  /**
   * Remove a specific operation by ID
   * @param {string} operationId - Operation ID to remove
   * @returns {boolean} Success status
   */
  removeById(operationId) {
    const index = this.queue.findIndex(op => op.operation_id === operationId);
    
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`[OperationQueue] Removed operation: ${operationId}`);
      this.notifyListeners('remove', removed);
      return true;
    }
    
    return false;
  }

  /**
   * Validate operation structure
   * @param {Object} operation - Operation to validate
   * @returns {boolean} Is valid
   */
  validateOperation(operation) {
    if (!operation || typeof operation !== 'object') {
      return false;
    }

    // Required fields
    if (!operation.operation_id || typeof operation.operation_id !== 'string') {
      return false;
    }

    const validTypes = ['navigate', 'fill_form', 'click', 'display_data', 'ocr_feed_analysis'];
    if (!operation.type || !validTypes.includes(operation.type)) {
      return false;
    }

    if (!operation.params || typeof operation.params !== 'object') {
      return false;
    }

    if (operation.requires_confirmation !== undefined && 
        typeof operation.requires_confirmation !== 'boolean') {
      return false;
    }

    return true;
  }

  /**
   * Add event listener for queue changes
   * @param {Function} callback - Callback function (event, data) => {}
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of queue changes
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[OperationQueue] Listener error:', error);
      }
    });
  }
}

// Export singleton instance
const operationQueue = new OperationQueue();
export default operationQueue;
