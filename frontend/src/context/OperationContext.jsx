/**
 * Operation Context
 * 
 * React Context for accessing operation client throughout the component tree.
 * Provides UI state management and easy access to operation client functionality.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import operationClient from '../services/operationClient';

const OperationContext = createContext();

/**
 * Hook to access operation context
 */
export const useOperation = () => {
  const context = useContext(OperationContext);
  if (!context) {
    throw new Error('useOperation must be used within an OperationProvider');
  }
  return context;
};

/**
 * Operation Provider Component
 */
export const OperationProvider = ({ children }) => {
  const [queueState, setQueueState] = useState({
    size: 0,
    isEmpty: true,
    operations: [],
    isProcessing: false
  });

  const [confirmationRequired, setConfirmationRequired] = useState(null);
  const [lastExecutedOperation, setLastExecutedOperation] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);

  /**
   * Update queue state from operation client
   */
  const updateQueueState = useCallback(() => {
    const state = operationClient.getQueueState();
    setQueueState(state);
  }, []);

  /**
   * Handle operation client events
   */
  useEffect(() => {
    // Queue changed
    const handleQueueChanged = () => {
      updateQueueState();
    };

    // Confirmation required
    const handleConfirmationRequired = (operation) => {
      console.log('[OperationContext] Confirmation required for:', operation);
      setConfirmationRequired(operation);
    };

    // Execution started
    const handleExecutionStarted = (operation) => {
      console.log('[OperationContext] Execution started:', operation);
      updateQueueState();
    };

    // Execution completed
    const handleExecutionCompleted = ({ operation, result }) => {
      console.log('[OperationContext] Execution completed:', operation);
      setLastExecutedOperation({ operation, result, timestamp: new Date() });
      
      // Add to history
      setExecutionHistory(prev => [
        { operation, result, status: 'completed', timestamp: new Date() },
        ...prev.slice(0, 19) // Keep last 20
      ]);
      
      updateQueueState();
      setConfirmationRequired(null); // Clear confirmation
    };

    // Execution failed
    const handleExecutionFailed = ({ operation, error }) => {
      console.error('[OperationContext] Execution failed:', operation, error);
      
      // Add to history
      setExecutionHistory(prev => [
        { operation, error, status: 'failed', timestamp: new Date() },
        ...prev.slice(0, 19)
      ]);
      
      updateQueueState();
    };

    // All cancelled
    const handleAllCancelled = () => {
      console.log('[OperationContext] All operations cancelled');
      setConfirmationRequired(null);
      updateQueueState();
    };

    // Register event listeners
    operationClient.on('queueChanged', handleQueueChanged);
    operationClient.on('confirmationRequired', handleConfirmationRequired);
    operationClient.on('executionStarted', handleExecutionStarted);
    operationClient.on('executionCompleted', handleExecutionCompleted);
    operationClient.on('executionFailed', handleExecutionFailed);
    operationClient.on('allCancelled', handleAllCancelled);

    // Initial state
    updateQueueState();

    // Cleanup
    return () => {
      operationClient.off('queueChanged', handleQueueChanged);
      operationClient.off('confirmationRequired', handleConfirmationRequired);
      operationClient.off('executionStarted', handleExecutionStarted);
      operationClient.off('executionCompleted', handleExecutionCompleted);
      operationClient.off('executionFailed', handleExecutionFailed);
      operationClient.off('allCancelled', handleAllCancelled);
    };
  }, [updateQueueState]);

  /**
   * Add an operation to the queue
   */
  const addOperation = useCallback((operation) => {
    return operationClient.addOperation(operation);
  }, []);

  /**
   * Add multiple operations
   */
  const addOperations = useCallback((operations) => {
    return operationClient.addOperations(operations);
  }, []);

  /**
   * Execute the next operation
   */
  const executeNext = useCallback(async (skipConfirmation = false) => {
    return await operationClient.executeNext(skipConfirmation);
  }, []);

  /**
   * Execute all operations
   */
  const executeAll = useCallback(async (skipConfirmations = false) => {
    return await operationClient.executeAll(skipConfirmations);
  }, []);

  /**
   * Cancel all operations
   */
  const cancelAll = useCallback(() => {
    operationClient.cancelAll();
  }, []);

  /**
   * Cancel specific operation
   */
  const cancelOperation = useCallback((operationId) => {
    return operationClient.cancelOperation(operationId);
  }, []);

  /**
   * Confirm and execute the operation that requires confirmation
   */
  const confirmAndExecute = useCallback(async () => {
    if (!confirmationRequired) {
      return { success: false, error: 'No operation requires confirmation' };
    }
    
    const result = await operationClient.executeNext(true); // Skip confirmation check
    setConfirmationRequired(null);
    return result;
  }, [confirmationRequired]);

  /**
   * Reject the operation that requires confirmation
   */
  const rejectOperation = useCallback(() => {
    if (confirmationRequired) {
      operationClient.cancelOperation(confirmationRequired.operation_id);
      setConfirmationRequired(null);
    }
  }, [confirmationRequired]);

  /**
   * Get next operation without executing
   */
  const peekNext = useCallback(() => {
    return operationClient.peekNext();
  }, []);

  /**
   * Set auto-execute mode
   */
  const setAutoExecute = useCallback((enabled) => {
    operationClient.setAutoExecute(enabled);
  }, []);

  /**
   * Check if client is ready
   */
  const isReady = useCallback(() => {
    return operationClient.isReady();
  }, []);

  /**
   * Clear execution history
   */
  const clearHistory = useCallback(() => {
    setExecutionHistory([]);
  }, []);

  const value = {
    // State
    queueState,
    confirmationRequired,
    lastExecutedOperation,
    executionHistory,
    
    // Methods
    addOperation,
    addOperations,
    executeNext,
    executeAll,
    cancelAll,
    cancelOperation,
    confirmAndExecute,
    rejectOperation,
    peekNext,
    setAutoExecute,
    isReady,
    clearHistory,
    
    // Direct access to client (use sparingly)
    operationClient
  };

  return (
    <OperationContext.Provider value={value}>
      {children}
    </OperationContext.Provider>
  );
};

export default OperationContext;
