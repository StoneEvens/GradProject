/**
 * Operation Client Service
 * 
 * Main interface for the AI Agent operation system.
 * Manages the queue and coordinates operation execution with optional user confirmation.
 */

import operationQueue from './operationQueue';
import operationExecutor from './operationExecutor';

class OperationClient {
  constructor() {
    this.isInitialized = false;
    this.isProcessing = false;
    this.autoExecute = false; // Whether to auto-execute without user trigger
    this.confirmationCallbacks = {}; // Callbacks for confirmation dialogs
    this.eventListeners = {}; // Custom event listeners

    // 自動執行白名單：這些操作類型無論 autoExecute 設定如何都會自動執行
    this.autoExecuteWhitelist = [
      'ocr_feed_analysis'  // OCR 辨識需要立即執行
    ];

    // Bind methods
    this.handleQueueChange = this.handleQueueChange.bind(this);
  }

  /**
   * Initialize the operation client
   * @param {Object} config - Configuration object
   * @param {Function} config.navigate - React Router navigate function
   * @param {boolean} config.autoExecute - Auto-execute operations without user confirmation
   */
  initialize(config = {}) {
    if (this.isInitialized) {
      console.warn('[OperationClient] Already initialized');
      return;
    }

    const { navigate, autoExecute = false } = config;

    if (!navigate) {
      console.warn('[OperationClient] Navigate function not provided. Navigation operations will fail.');
    } else {
      operationExecutor.setNavigate(navigate);
    }

    this.autoExecute = autoExecute;

    // Listen to queue changes
    operationQueue.addListener(this.handleQueueChange);

    this.isInitialized = true;
    console.log('[OperationClient] Initialized', { autoExecute });
  }

  /**
   * Add an operation to the queue
   * @param {Object} operation - Operation object
   * @returns {boolean} Success status
   */
  addOperation(operation) {
    if (!this.isInitialized) {
      console.error('[OperationClient] Not initialized. Call initialize() first.');
      return false;
    }

    // 轉換後端格式到前端格式
    // 後端: {operation_name, operation_data}
    // 前端: {operation_id, type, params}
    let normalizedOperation = operation;

    if (operation.operation_name && !operation.type) {
      // 解析 operation_data（可能是 JSON 字串）
      let params = {};
      if (operation.operation_data) {
        try {
          params = typeof operation.operation_data === 'string'
            ? JSON.parse(operation.operation_data)
            : operation.operation_data;
        } catch (e) {
          console.error('[OperationClient] Failed to parse operation_data:', e);
          params = {};
        }
      }

      normalizedOperation = {
        operation_id: `op_${operation.operation_name}_${Date.now()}`,
        type: operation.operation_name,
        params: params,
        requires_confirmation: operation.requires_confirmation || false
      };

      console.log('[OperationClient] Converted backend operation format:', {
        from: operation,
        to: normalizedOperation
      });
    }

    const success = operationQueue.enqueue(normalizedOperation);

    if (success) {
      this.emit('operationAdded', normalizedOperation);

      // 檢查是否需要自動執行
      const shouldAutoExecute =
        this.autoExecute || // 全域設定啟用
        this.autoExecuteWhitelist.includes(normalizedOperation.type); // 或在白名單中

      if (shouldAutoExecute && !this.isProcessing) {
        console.log(`[OperationClient] Auto-executing operation: ${normalizedOperation.type}`);
        this.executeNext();
      }
    }

    return success;
  }

  /**
   * Add multiple operations at once
   * @param {Array} operations - Array of operation objects
   * @returns {Object} Result with success and failed counts
   */
  addOperations(operations) {
    if (!Array.isArray(operations)) {
      console.error('[OperationClient] Operations must be an array');
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    operations.forEach(op => {
      if (this.addOperation(op)) {
        successCount++;
      } else {
        failedCount++;
      }
    });

    console.log(`[OperationClient] Added ${successCount} operations, ${failedCount} failed`);

    return { success: successCount, failed: failedCount };
  }

  /**
   * Execute the first operation in the queue
   * @param {boolean} skipConfirmation - Skip confirmation even if required
   * @returns {Promise<Object>} Execution result
   */
  async executeNext(skipConfirmation = false) {
    if (!this.isInitialized) {
      throw new Error('OperationClient not initialized');
    }

    if (this.isProcessing) {
      console.warn('[OperationClient] Already processing an operation');
      return { success: false, error: 'Already processing' };
    }

    const operation = operationQueue.peek();

    if (!operation) {
      console.log('[OperationClient] No operations in queue');
      return { success: false, error: 'Queue is empty' };
    }

    // Check if confirmation is required
    if (operation.requires_confirmation && !skipConfirmation) {
      console.log('[OperationClient] Operation requires confirmation:', operation.operation_id);
      this.emit('confirmationRequired', operation);
      return { success: false, error: 'Confirmation required', needsConfirmation: true };
    }

    this.isProcessing = true;
    operationQueue.updateOperationStatus(operation.operation_id, 'executing');
    
    this.emit('executionStarted', operation);

    try {
      // Execute the operation
      const result = await operationExecutor.execute(operation);

      // Update operation status
      if (result.success) {
        operationQueue.updateOperationStatus(operation.operation_id, 'completed', { result: result.result });
        
        // Remove from queue after successful execution
        operationQueue.dequeue();
        
        this.emit('executionCompleted', { operation, result });
        
        console.log(`[OperationClient] Successfully executed operation: ${operation.operation_id}`);
      } else {
        operationQueue.updateOperationStatus(operation.operation_id, 'failed', { error: result.error });
        
        this.emit('executionFailed', { operation, error: result.error });
        
        console.error(`[OperationClient] Failed to execute operation: ${operation.operation_id}`, result.error);
      }

      this.isProcessing = false;

      // Auto-execute next if enabled and queue not empty
      if (this.autoExecute && !operationQueue.isEmpty()) {
        setTimeout(() => this.executeNext(), 500);
      }

      return result;

    } catch (error) {
      console.error('[OperationClient] Execution error:', error);
      
      operationQueue.updateOperationStatus(operation.operation_id, 'failed', { error: error.message });
      
      this.emit('executionFailed', { operation, error: error.message });
      
      this.isProcessing = false;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute all operations in the queue sequentially
   * @param {boolean} skipConfirmations - Skip all confirmations
   * @returns {Promise<Object>} Execution summary
   */
  async executeAll(skipConfirmations = false) {
    const results = {
      total: operationQueue.size(),
      succeeded: 0,
      failed: 0,
      details: []
    };

    console.log(`[OperationClient] Executing all ${results.total} operations`);

    while (!operationQueue.isEmpty()) {
      const result = await this.executeNext(skipConfirmations);
      
      results.details.push(result);
      
      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
        
        // Stop on error if confirmation was needed
        if (result.needsConfirmation) {
          break;
        }
      }

      // Small delay between operations
      await this.delay(300);
    }

    console.log('[OperationClient] Execution completed:', results);
    this.emit('batchExecutionCompleted', results);

    return results;
  }

  /**
   * Cancel the current operation and clear the queue
   */
  cancelAll() {
    console.log('[OperationClient] Cancelling all operations');
    
    operationExecutor.cancel();
    operationQueue.clear();
    this.isProcessing = false;
    
    this.emit('allCancelled');
  }

  /**
   * Cancel a specific operation by ID
   * @param {string} operationId - Operation ID to cancel
   * @returns {boolean} Success status
   */
  cancelOperation(operationId) {
    const success = operationQueue.removeById(operationId);
    
    if (success) {
      console.log(`[OperationClient] Cancelled operation: ${operationId}`);
      this.emit('operationCancelled', operationId);
    }
    
    return success;
  }

  /**
   * Get the current queue state
   * @returns {Object} Queue state
   */
  getQueueState() {
    return {
      size: operationQueue.size(),
      isEmpty: operationQueue.isEmpty(),
      operations: operationQueue.getAll(),
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get the next operation without executing
   * @returns {Object|null} Next operation
   */
  peekNext() {
    return operationQueue.peek();
  }

  /**
   * Check if client is ready to execute operations
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.isInitialized && operationExecutor.getStatus().hasNavigate;
  }

  /**
   * Set auto-execute mode
   * @param {boolean} enabled - Enable auto-execute
   */
  setAutoExecute(enabled) {
    this.autoExecute = enabled;
    console.log(`[OperationClient] Auto-execute ${enabled ? 'enabled' : 'disabled'}`);
    
    // If enabled and queue has operations, start executing
    if (enabled && !this.isProcessing && !operationQueue.isEmpty()) {
      this.executeNext();
    }
  }

  /**
   * Handle queue change events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  handleQueueChange(event, data) {
    console.log(`[OperationClient] Queue event: ${event}`, data);
    this.emit('queueChanged', { event, data });
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[OperationClient] Event listener error (${event}):`, error);
        }
      });
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the operation client
   */
  reset() {
    this.cancelAll();
    this.eventListeners = {};
    this.isProcessing = false;
    console.log('[OperationClient] Reset completed');
  }
}

// Export singleton instance
const operationClient = new OperationClient();
export default operationClient;
