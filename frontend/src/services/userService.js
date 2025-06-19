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
export const getUserPostsPreview = async (userAccountOrId) => {
  // 如果是數字，直接使用ID；如果是字串，需要轉換
  if (typeof userAccountOrId === 'string' && isNaN(userAccountOrId)) {
    // 是user_account，需要先獲得用戶資料
    const userProfile = await getOtherUserProfile(userAccountOrId);
    const res = await axios.get(`/social/users/${userProfile.id}/posts/preview/`);
    return res.data.data;
  } else {
    // 是userId，直接調用
    const res = await axios.get(`/social/users/${userAccountOrId}/posts/preview/`);
    return res.data.data;
  }
};

// 取得用戶病程紀錄
export const getUserArchives = async (userAccountOrId) => {
  // 如果是數字，直接使用ID；如果是字串，需要轉換
  if (typeof userAccountOrId === 'string' && isNaN(userAccountOrId)) {
    // 是user_account，需要先獲得用戶資料
    const userProfile = await getOtherUserProfile(userAccountOrId);
    const res = await axios.get(`/pets/users/${userProfile.id}/archives/`);
    return res.data.data;
  } else {
    // 是userId，直接調用
    const res = await axios.get(`/pets/users/${userAccountOrId}/archives/`);
    return res.data.data;
  }
};

// 取得用戶頭像（如需單獨取得）
export const getUserImage = async () => {
  const res = await axios.get('/accounts/profile/image/');
  return res.data.data.user_image_url;
}; 