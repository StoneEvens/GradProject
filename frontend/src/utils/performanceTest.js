/**
 * 圖片處理性能測試工具
 */

/**
 * 測試圖片處理性能
 * @param {File} file - 測試檔案
 * @returns {Promise<Object>} 性能測試結果
 */
export const testImageProcessingPerformance = async (file) => {
  const startTime = performance.now();
  
  console.log('🔍 開始圖片處理性能測試...');
  console.log(`📁 原始檔案大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📐 檔案類型: ${file.type}`);

  try {
    // 測試 URL.createObjectURL (快速方法)
    const urlStart = performance.now();
    const objectUrl = URL.createObjectURL(file);
    const urlTime = performance.now() - urlStart;
    
    // 測試 FileReader.readAsDataURL (慢方法)
    const readerStart = performance.now();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const readerTime = performance.now() - readerStart;
    
    // 測試壓縮
    const compressStart = performance.now();
    const { compressImage } = await import('./imageUtils.js');
    const compressedFile = await compressImage(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8
    });
    const compressTime = performance.now() - compressStart;
    
    const totalTime = performance.now() - startTime;
    
    const results = {
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionRatio: file.size / compressedFile.size,
      spaceSaved: file.size - compressedFile.size,
      times: {
        createObjectURL: urlTime,
        readAsDataURL: readerTime,
        compression: compressTime,
        total: totalTime
      },
      performance: {
        urlVsReader: readerTime / urlTime,
        compressionOverhead: compressTime / urlTime
      }
    };
    
    // 清理 URL
    URL.revokeObjectURL(objectUrl);
    
    // 輸出結果
    console.log('📊 性能測試結果:');
    console.log(`⚡ URL.createObjectURL: ${urlTime.toFixed(2)}ms`);
    console.log(`🐌 FileReader.readAsDataURL: ${readerTime.toFixed(2)}ms`);
    console.log(`🗜️ 圖片壓縮: ${compressTime.toFixed(2)}ms`);
    console.log(`⏱️ 總時間: ${totalTime.toFixed(2)}ms`);
    console.log(`📉 壓縮後大小: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`💾 節省空間: ${(results.spaceSaved / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🔄 壓縮比: ${results.compressionRatio.toFixed(2)}x`);
    console.log(`⚠️ FileReader比URL慢 ${results.performance.urlVsReader.toFixed(1)}倍`);
    
    return results;
  } catch (error) {
    console.error('❌ 性能測試失敗:', error);
    throw error;
  }
};

/**
 * 創建測試檔案
 * @param {number} sizeMB - 檔案大小 (MB)
 * @returns {Promise<File>} 測試檔案
 */
export const createTestFile = (sizeMB = 5) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const size = Math.sqrt(sizeMB * 1024 * 1024 / 4); // 估算需要的像素尺寸
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    
    // 創建彩色漸變填充
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(0.25, '#4ECDC4');
    gradient.addColorStop(0.5, '#45B7D1');
    gradient.addColorStop(0.75, '#96CEB4');
    gradient.addColorStop(1, '#FECA57');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // 添加一些隨機圖案增加複雜度
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        Math.random() * 50 + 10,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 60%)`;
      ctx.fill();
    }
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `test-${sizeMB}mb.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      resolve(file);
    }, 'image/jpeg', 0.9);
  });
};

/**
 * 在控制台運行完整性能測試
 */
export const runPerformanceTest = async () => {
  console.log('🚀 開始圖片處理性能測試套件...');
  
  try {
    // 測試不同大小的檔案
    const testSizes = [1, 3, 5, 10]; // MB
    
    for (const size of testSizes) {
      console.log(`\n📋 測試 ${size}MB 檔案...`);
      const testFile = await createTestFile(size);
      await testImageProcessingPerformance(testFile);
    }
    
    console.log('\n✅ 性能測試完成！');
    console.log('💡 建議: 使用 URL.createObjectURL 而非 FileReader.readAsDataURL');
    console.log('💡 建議: 大於 2MB 的圖片建議先壓縮');
    
  } catch (error) {
    console.error('❌ 性能測試套件失敗:', error);
  }
};

// 將測試函數添加到全局對象
if (typeof window !== 'undefined') {
  window.testImagePerformance = testImageProcessingPerformance;
  window.createTestFile = createTestFile;
  window.runImagePerformanceTest = runPerformanceTest;
}

export default {
  testImageProcessingPerformance,
  createTestFile,
  runPerformanceTest
};