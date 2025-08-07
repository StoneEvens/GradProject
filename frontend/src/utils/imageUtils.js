/**
 * 圖片處理工具函數
 * 用於優化圖片選擇、壓縮和預覽功能
 */

/**
 * 壓縮圖片
 * @param {File} file - 原始圖片檔案
 * @param {Object} options - 壓縮選項
 * @returns {Promise<File>} 壓縮後的圖片檔案
 */
export const compressImage = (file, options = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    type = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 計算壓縮後的尺寸
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // 設置 canvas 尺寸
      canvas.width = width;
      canvas.height = height;

      // 繪製並壓縮圖片
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // 創建新的 File 對象
            const compressedFile = new File([blob], file.name, {
              type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('圖片壓縮失敗'));
          }
        },
        type,
        quality
      );
    };

    img.onerror = () => reject(new Error('圖片加載失敗'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 驗證圖片檔案
 * @param {File} file - 要驗證的檔案
 * @param {Object} options - 驗證選項
 * @returns {Object} 驗證結果
 */
export const validateImageFile = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  } = options;

  if (!file) {
    return { valid: false, error: '請選擇檔案' };
  }

  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `圖片大小不能超過 ${(maxSize / 1024 / 1024).toFixed(1)}MB` 
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: '請選擇支援的圖片格式 (JPEG, PNG, GIF, WebP)' 
    };
  }

  return { valid: true };
};

/**
 * 快速創建圖片預覽 URL
 * @param {File} file - 圖片檔案
 * @returns {string} 預覽 URL
 */
export const createImagePreview = (file) => {
  return URL.createObjectURL(file);
};

/**
 * 釋放預覽 URL
 * @param {string} url - 要釋放的 URL
 */
export const revokeImagePreview = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * 處理圖片選擇的通用函數
 * @param {Event} event - file input change event
 * @param {Object} options - 處理選項
 * @returns {Promise<Object>} 處理結果
 */
export const handleImageSelection = async (event, options = {}) => {
  const {
    compress = true,
    compressOptions = {},
    validationOptions = {},
    onProgress
  } = options;

  const file = event.target.files[0];
  
  if (!file) {
    return { success: false, error: '未選擇檔案' };
  }

  // 驗證檔案
  const validation = validateImageFile(file, validationOptions);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    onProgress?.(10, '正在處理圖片...');

    let processedFile = file;
    
    // 壓縮圖片（如果需要）
    if (compress) {
      onProgress?.(50, '正在壓縮圖片...');
      processedFile = await compressImage(file, compressOptions);
    }

    // 創建預覽
    onProgress?.(80, '正在生成預覽...');
    const previewUrl = createImagePreview(processedFile);

    onProgress?.(100, '處理完成');

    return {
      success: true,
      originalFile: file,
      processedFile,
      previewUrl,
      compressionRatio: file.size / processedFile.size
    };
  } catch (error) {
    console.error('圖片處理失敗:', error);
    return { 
      success: false, 
      error: '圖片處理失敗: ' + error.message 
    };
  }
};

/**
 * 創建 progress callback 函數
 * @param {Function} setProgress - 設置進度的函數
 * @param {Function} setMessage - 設置訊息的函數
 * @returns {Function} progress callback
 */
export const createProgressCallback = (setProgress, setMessage) => {
  return (progress, message) => {
    setProgress?.(progress);
    setMessage?.(message);
  };
};

export default {
  compressImage,
  validateImageFile,
  createImagePreview,
  revokeImagePreview,
  handleImageSelection,
  createProgressCallback
};