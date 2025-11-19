/**
 * Operation Executor
 * 
 * Executes operations from the queue by performing actual DOM manipulations,
 * navigation, form filling, and button clicks.
 */

class OperationExecutor {
  constructor() {
    this.navigate = null; // Will be injected by the operation client
    this.isExecuting = false;
    this.currentOperation = null;
  }

  /**
   * Set the navigate function from React Router
   * @param {Function} navigateFunction - useNavigate() hook result
   */
  setNavigate(navigateFunction) {
    this.navigate = navigateFunction;
    console.log('[OperationExecutor] Navigate function set');
  }

  /**
   * Execute an operation
   * @param {Object} operation - Operation to execute
   * @returns {Promise<Object>} Execution result
   */
  async execute(operation) {
    if (this.isExecuting) {
      throw new Error('Another operation is currently executing');
    }

    this.isExecuting = true;
    this.currentOperation = operation;

    console.log(`[OperationExecutor] Executing operation: ${operation.operation_id}`, operation);

    try {
      let result;

      switch (operation.type) {
        case 'navigate':
          result = await this.executeNavigate(operation.params);
          break;

        case 'fill_form':
          result = await this.executeFillForm(operation.params);
          break;

        case 'click':
          result = await this.executeClick(operation.params);
          break;

        case 'display_data':
          result = await this.executeDisplayData(operation.params);
          break;

        case 'ocr_feed_analysis':
          result = await this.executeOCRFeedAnalysis(operation.params);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      console.log(`[OperationExecutor] Operation ${operation.operation_id} completed successfully`, result);
      
      this.isExecuting = false;
      this.currentOperation = null;
      
      return {
        success: true,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[OperationExecutor] Operation ${operation.operation_id} failed:`, error);
      
      this.isExecuting = false;
      this.currentOperation = null;
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute navigation operation
   * @param {Object} params - Navigation parameters
   * @param {string} params.path - Target path
   * @param {Object} params.state - Optional state to pass
   * @returns {Promise<Object>} Result
   */
  async executeNavigate(params) {
    if (!this.navigate) {
      throw new Error('Navigate function not set. Call setNavigate() first.');
    }

    const { path, state } = params;

    if (!path) {
      throw new Error('Navigation path is required');
    }

    console.log(`[OperationExecutor] Navigating to: ${path}`, state);

    // Execute navigation
    this.navigate(path, { state: state || {} });

    // Wait a bit for navigation to complete
    await this.delay(500);

    return {
      action: 'navigate',
      path,
      state
    };
  }

  /**
   * Execute form filling operation
   * @param {Object} params - Form parameters (key-value pairs)
   * @returns {Promise<Object>} Result
   */
  async executeFillForm(params) {
    const filledFields = {};
    const failedFields = {};

    console.log('[OperationExecutor] Filling form with params:', params);

    for (const [fieldName, value] of Object.entries(params)) {
      try {
        // Try multiple selector strategies
        let element = this.findFormElement(fieldName);

        if (element) {
          // Set the value based on element type
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = Boolean(value);
          } else if (element.tagName === 'SELECT') {
            element.value = value;
          } else {
            element.value = value;
          }

          // Trigger input/change events to notify React
          this.triggerInputEvent(element);
          
          filledFields[fieldName] = value;
          console.log(`[OperationExecutor] Filled field: ${fieldName} = ${value}`);
          
          await this.delay(100); // Small delay between fields
        } else {
          failedFields[fieldName] = 'Element not found';
          console.warn(`[OperationExecutor] Could not find form element: ${fieldName}`);
        }
      } catch (error) {
        failedFields[fieldName] = error.message;
        console.error(`[OperationExecutor] Error filling field ${fieldName}:`, error);
      }
    }

    return {
      action: 'fill_form',
      filledFields,
      failedFields,
      successCount: Object.keys(filledFields).length,
      failCount: Object.keys(failedFields).length
    };
  }

  /**
   * Execute click operation
   * @param {Object} params - Click parameters
   * @param {string} params.selector - CSS selector or element identifier
   * @param {string} params.text - Optional: button text to match
   * @returns {Promise<Object>} Result
   */
  async executeClick(params) {
    const { selector, text } = params;

    console.log('[OperationExecutor] Clicking element:', params);

    let element;

    // Try to find element by selector first
    if (selector) {
      element = document.querySelector(selector);
    }

    // If not found and text is provided, search by text content
    if (!element && text) {
      element = this.findElementByText(text);
    }

    if (!element) {
      throw new Error(`Could not find element to click: ${selector || text}`);
    }

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(300);

    // Click the element
    element.click();

    console.log('[OperationExecutor] Element clicked successfully');

    await this.delay(200);

    return {
      action: 'click',
      selector: selector || `text:${text}`,
      elementTag: element.tagName,
      elementType: element.type
    };
  }

  /**
   * Execute display data operation (store data for UI to consume)
   * @param {Object} params - Data to display
   * @returns {Promise<Object>} Result
   */
  async executeDisplayData(params) {
    console.log('[OperationExecutor] Displaying data:', params);

    // Dispatch custom event with data for UI components to listen
    window.dispatchEvent(new CustomEvent('displayOperationData', {
      detail: params
    }));

    return {
      action: 'display_data',
      dataKeys: Object.keys(params),
      dataSize: JSON.stringify(params).length
    };
  }

  /**
   * Execute OCR feed analysis operation
   * @param {Object} params - OCR parameters
   * @param {string} params.purpose - Purpose of OCR (e.g., 'feed_nutrition')
   * @returns {Promise<Object>} OCR results with nutrition data
   */
  async executeOCRFeedAnalysis(params) {
    console.log('[OperationExecutor] Starting OCR feed analysis:', params);

    try {
      // 從 window 物件獲取使用者選擇的圖片
      const selectedImages = window.__selectedFeedImages;

      if (!selectedImages) {
        throw new Error('沒有找到待辨識的圖片，請先選擇圖片');
      }

      if (selectedImages.length < 2) {
        throw new Error('請選擇兩張圖片：包裝照片和營養標示照片');
      }

      console.log('[OperationExecutor] 辨識兩張圖片以找出營養標示...');

      // 使用配置好的 axios instance（包含 baseURL）
      const axiosInstance = (await import('../utils/axios.js')).default;

      // 輔助函數：將 base64 轉換為 Blob
      const base64ToBlob = (base64String, fileType) => {
        const base64Data = base64String.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: fileType });
      };

      // 輔助函數：計算營養成分資料的完整度
      const calculateNutrientScore = (nutrients) => {
        let score = 0;
        const keys = ['protein', 'fat', 'carbohydrate', 'calcium', 'phosphorus', 'magnesium', 'sodium'];

        keys.forEach(key => {
          if (nutrients[key] !== null && nutrients[key] !== undefined && nutrients[key] > 0) {
            score++;
          }
        });

        return score;
      };

      // 辨識兩張圖片
      const ocrResults = [];

      for (let i = 0; i < 2; i++) {
        try {
          const image = selectedImages[i];
          const formData = new FormData();
          const blob = base64ToBlob(image.preview, image.file.type);
          formData.append('image', blob, image.file.name);

          console.log(`[OperationExecutor] 辨識第 ${i + 1} 張圖片...`);

          const response = await axiosInstance.post('/feeds/ocr/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const nutrients = response.data.extracted_nutrients || {};
          const score = calculateNutrientScore(nutrients);

          ocrResults.push({
            index: i,
            nutrients,
            score,
            rawText: response.data.raw_text
          });

          console.log(`[OperationExecutor] 第 ${i + 1} 張圖片辨識完成，營養成分數量: ${score}`);

        } catch (error) {
          console.warn(`[OperationExecutor] 第 ${i + 1} 張圖片辨識失敗:`, error);
          ocrResults.push({
            index: i,
            nutrients: {},
            score: 0,
            error: error.message
          });
        }
      }

      // 選擇營養成分最完整的結果
      ocrResults.sort((a, b) => b.score - a.score);
      const bestResult = ocrResults[0];

      if (bestResult.score === 0) {
        throw new Error('兩張圖片都無法辨識出營養成分，請確保上傳清晰的營養標示照片');
      }

      console.log(`[OperationExecutor] 選擇第 ${bestResult.index + 1} 張圖片的辨識結果 (營養成分數量: ${bestResult.score})`);
      console.log('[OperationExecutor] 最終 OCR 結果:', bestResult.nutrients);

      // 將 OCR 結果存到 localStorage
      localStorage.setItem('feedOcrData', JSON.stringify(bestResult.nutrients));

      // 觸發自訂事件，通知 AI Chat Service OCR 完成
      window.dispatchEvent(new CustomEvent('ocrCompleted', {
        detail: {
          ocrData: bestResult.nutrients,
          rawText: bestResult.rawText,
          selectedImageIndex: bestResult.index
        }
      }));

      return {
        action: 'ocr_feed_analysis',
        success: true,
        ocrData: bestResult.nutrients,
        selectedImageIndex: bestResult.index,
        message: `OCR 辨識完成 (使用第 ${bestResult.index + 1} 張圖片)`
      };

    } catch (error) {
      console.error('[OperationExecutor] OCR analysis failed:', error);

      throw new Error(`OCR 辨識失敗：${error.message}`);
    }
  }

  /**
   * Find form element by name, id, or placeholder
   * @param {string} identifier - Field identifier
   * @returns {Element|null} Found element
   */
  findFormElement(identifier) {
    // Try by name
    let element = document.querySelector(`[name="${identifier}"]`);
    if (element) return element;

    // Try by id
    element = document.getElementById(identifier);
    if (element) return element;

    // Try by placeholder
    element = document.querySelector(`[placeholder="${identifier}"]`);
    if (element) return element;

    // Try by data attribute
    element = document.querySelector(`[data-field="${identifier}"]`);
    if (element) return element;

    return null;
  }

  /**
   * Find element by text content (for buttons, links, etc.)
   * @param {string} text - Text to search for
   * @returns {Element|null} Found element
   */
  findElementByText(text) {
    // Search in buttons
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    
    for (const button of buttons) {
      if (button.textContent.trim().includes(text)) {
        return button;
      }
    }

    return null;
  }

  /**
   * Trigger input events for React to detect changes
   * @param {Element} element - DOM element
   */
  triggerInputEvent(element) {
    // Create and dispatch events that React listens to
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);

    // Also trigger React's internal event system
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, element.value);
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
   * Cancel current operation (if possible)
   */
  cancel() {
    if (this.isExecuting) {
      console.log('[OperationExecutor] Cancelling current operation');
      this.isExecuting = false;
      this.currentOperation = null;
    }
  }

  /**
   * Get current execution status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isExecuting: this.isExecuting,
      currentOperation: this.currentOperation ? { ...this.currentOperation } : null,
      hasNavigate: this.navigate !== null
    };
  }
}

// Export singleton instance
const operationExecutor = new OperationExecutor();
export default operationExecutor;
