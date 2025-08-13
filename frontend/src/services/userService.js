import axios from '../utils/axios';

// 取得當前用戶個人資料
export const getUserProfile = async () => {
  const res = await axios.get('/accounts/me/');
  return res.data.data;
};

// 檢查用戶帳號是否已存在
export const checkUserAccount = async (userAccount) => {
  const res = await axios.post('/accounts/check/account/', {
    user_account: userAccount
  });
  return res.data.data.exists;
};

// 更新用戶個人資料
export const updateUserProfile = async (userData) => {
  const formData = new FormData();
  
  // 添加文字資料
  if (userData.user_account) formData.append('user_account', userData.user_account);
  if (userData.user_fullname) formData.append('user_fullname', userData.user_fullname);
  if (userData.user_intro !== undefined) formData.append('user_intro', userData.user_intro);
  
  // 添加圖片檔案
  if (userData.image) {
    formData.append('headshot', userData.image);
  }
  
  const res = await axios.put('/accounts/me/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data.data;
};

// 更新用戶隱私設定
export const updateAccountPrivacy = async (accountPrivacy) => {
  const formData = new FormData();
  formData.append('account_privacy', accountPrivacy);
  
  const res = await axios.put('/accounts/me/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data.data;
};

// 取得特定用戶的詳細資料（通過user_account）
export const getOtherUserProfile = async (userAccount) => {
  const res = await axios.get(`/accounts/user/${userAccount}/profile/`);
  return res.data.data;
};

// 取得用戶摘要資訊（追蹤數、被追蹤數、發文數）
export const getUserSummary = async (userAccountOrId) => {
  // 如果是數字，直接使用ID；如果是字串，直接使用user_account
  if (typeof userAccountOrId === 'string' && isNaN(userAccountOrId)) {
    // 是user_account，直接調用
    const res = await axios.get(`/accounts/user/${userAccountOrId}/summary/`);
    return res.data.data;
  } else {
    // 是userId，直接調用
    const res = await axios.get(`/accounts/user/${userAccountOrId}/summary/`);
    return res.data.data;
  }
};

// 取得用戶日常貼文預覽
export const getUserPostsPreview = async (userAccountOrId, params = {}) => {
  try {
    let userId;
    
    // 如果是數字，直接使用ID；如果是字串，需要轉換
    if (typeof userAccountOrId === 'string' && isNaN(userAccountOrId)) {
      // 是user_account，需要先獲得用戶資料
      const userProfile = await getOtherUserProfile(userAccountOrId);
      userId = userProfile.id;
    } else {
      // 是userId，直接使用
      userId = userAccountOrId;
    }
    
    // 構建查詢參數
    const queryParams = new URLSearchParams({
      offset: params.offset || 0,
      limit: params.limit || 15,
      ...params
    });
    
    const res = await axios.get(`/social/users/${userId}/posts/preview/?${queryParams}`);
    
    // 處理分頁格式的響應
    const responseData = res.data.data;
    
    // 如果是新的分頁格式（包含posts, has_more等）
    if (responseData && typeof responseData === 'object' && responseData.posts) {
      return {
        success: true,
        data: {
          posts: responseData.posts,
          has_more: responseData.has_more,
          total_count: responseData.total_count,
          offset: responseData.offset,
          limit: responseData.limit
        }
      };
    }
    
    // 如果有results字段，說明是舊的分頁格式
    if (responseData && typeof responseData === 'object' && responseData.results) {
      return {
        success: true,
        data: {
          posts: responseData.results,
          has_more: false
        }
      };
    }
    
    // 如果是直接的陣列格式（向後兼容）
    if (Array.isArray(responseData)) {
      return {
        success: true,
        data: {
          posts: responseData,
          has_more: false
        }
      };
    }
    
    // 其他情況返回空結果
    return {
      success: true,
      data: {
        posts: [],
        has_more: false
      }
    };
    
  } catch (error) {
    console.error('getUserPostsPreview 發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      data: {
        posts: [],
        has_more: false
      }
    };
  }
};

// 取得用戶病程紀錄
export const getUserArchives = async (userAccountOrId) => {
  try {
    let res;
    
    // 如果是數字，直接使用ID；如果是字串，需要轉換
    if (typeof userAccountOrId === 'string' && isNaN(userAccountOrId)) {
      // 是user_account，需要先獲得用戶資料
      const userProfile = await getOtherUserProfile(userAccountOrId);
      res = await axios.get(`/pets/users/${userProfile.id}/archives/`);
    } else {
      // 是userId，直接調用
      res = await axios.get(`/pets/users/${userAccountOrId}/archives/`);
    }
    
    // 處理分頁格式的響應
    const responseData = res.data.data;
    
    // 如果有results字段，說明是分頁格式
    if (responseData && typeof responseData === 'object' && responseData.results) {
      return responseData.results;
    }
    
    // 如果是直接的陣列格式
    if (Array.isArray(responseData)) {
      return responseData;
    }
    
    // 其他情況返回空陣列
    return [];
    
  } catch (error) {
    console.error('getUserArchives 發生錯誤:', error);
    throw error;
  }
};

// 取得用戶頭像（如需單獨取得）
export const getUserImage = async () => {
  const res = await axios.get('/accounts/profile/image/');
  return res.data.data.user_image_url;
}; 