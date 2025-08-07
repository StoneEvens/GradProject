// 測試頭像更新功能的工具函數

/**
 * 測試頭像更新事件
 * 在瀏覽器控制台中使用：testAvatarUpdate()
 */
export const testAvatarUpdate = () => {
  // 模擬頭像更新事件
  const testImageUrl = '/assets/icon/DefaultAvatar.jpg?test=' + Date.now();
  
  window.dispatchEvent(new CustomEvent('avatar-updated', {
    detail: { headshot_url: testImageUrl }
  }));
  
  console.log('測試頭像更新事件已觸發:', testImageUrl);
};

/**
 * 測試認證狀態變化
 */
export const testAuthChange = () => {
  window.dispatchEvent(new CustomEvent('auth-change'));
  console.log('測試認證狀態變化事件已觸發');
};

// 將測試函數添加到全局對象，方便在控制台中使用
if (typeof window !== 'undefined') {
  window.testAvatarUpdate = testAvatarUpdate;
  window.testAuthChange = testAuthChange;
}

export default {
  testAvatarUpdate,
  testAuthChange
};