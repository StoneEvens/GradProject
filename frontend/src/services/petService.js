import axios from '../utils/axios';

// 取得當前用戶的所有寵物資料
export const getUserPets = async () => {
  const res = await axios.get('/pets/my-pets/');
  return res.data.data;
};

// 創建新寵物
export const createPet = async (formData) => {
  try {
    const res = await axios.post('/pets/create/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  } catch (error) {
    // 記錄詳細錯誤信息
    console.error('創建寵物 API 錯誤:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // 重新拋出錯誤，讓上層可以處理
    throw error;
  }
};

// 更新寵物資料
export const updatePet = async (petId, petData) => {
  const formData = new FormData();
  
  // 添加寵物基本資料
  if (petData.pet_name) formData.append('pet_name', petData.pet_name);
  if (petData.pet_type) formData.append('pet_type', petData.pet_type);
  if (petData.breed) formData.append('breed', petData.breed);
  if (petData.age) formData.append('age', petData.age);
  if (petData.weight) formData.append('weight', petData.weight);
  if (petData.height) formData.append('height', petData.height);
  if (petData.pet_stage) formData.append('pet_stage', petData.pet_stage);
  if (petData.predicted_adult_weight) formData.append('predicted_adult_weight', petData.predicted_adult_weight);
  if (petData.description !== undefined) formData.append('description', petData.description || '');
  
  // 添加寵物頭像
  if (petData.headshot) {
    formData.append('headshot', petData.headshot);
  }
  
  const res = await axios.put(`/pets/${petId}/update/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data.data;
};

// 刪除寵物
export const deletePet = async (petId) => {
  const res = await axios.delete(`/pets/${petId}/delete/`);
  return res.data;
};

// 取得寵物的異常貼文
export const getPetAbnormalPosts = async (petId) => {
  const res = await axios.get(`/pets/${petId}/abnormal-posts/`);
  return res.data.data;
};

// 取得寵物的異常貼文預覽
export const getPetAbnormalPostsPreview = async (petId) => {
  const res = await axios.get(`/pets/${petId}/abnormal-posts/preview/`);
  return res.data.data;
};

// 取得特定異常貼文詳情
export const getAbnormalPostDetail = async (petId, postId) => {
  const res = await axios.get(`/pets/${petId}/abnormal-post/${postId}/`);
  return res.data.data;
};

// 取得公開異常記錄詳情（無需認證）
export const getPublicAbnormalPostDetail = async (postId) => {
  const res = await axios.get(`/pets/abnormal-post/${postId}/public/`);
  return res.data.data;
};

// 取得寵物的疾病檔案
export const getPetIllnessArchives = async (petId) => {
  const res = await axios.get(`/pets/${petId}/illness-archives/`);
  return res.data.data;
};

// 獲取所有症狀列表
export const getSymptoms = async () => {
  try {
    const res = await axios.get('/pets/symptoms/');
    return res.data.data;
  } catch (error) {
    console.error('獲取症狀列表失敗:', error);
    throw error;
  }
};

// 創建異常記錄
export const createAbnormalPost = async (postData) => {
  try {
    const res = await axios.post('/pets/abnormal-posts/create/', postData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.data.data;
  } catch (error) {
    console.error('創建異常記錄失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 更新異常記錄
export const updateAbnormalPost = async (petId, postId, postData) => {
  try {
    const res = await axios.put(`/pets/${petId}/abnormal-post/${postId}/update/`, postData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.data.data;
  } catch (error) {
    console.error('更新異常記錄失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 刪除異常記錄
export const deleteAbnormalPost = async (petId, postId) => {
  try {
    const res = await axios.delete(`/pets/${petId}/abnormal-post/${postId}/delete/`);
    return res.data;
  } catch (error) {
    console.error('刪除異常記錄失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 檢查指定日期是否已有異常記錄
export const checkAbnormalPostExists = async (petId, date) => {
  try {
    // 格式化日期為 YYYY-MM-DD，避免時區問題
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const res = await axios.get(`/pets/${petId}/abnormal-posts/`, {
      params: {
        date: formattedDate,
        check_exists: true
      }
    });
    
    // 檢查該日期是否已有記錄
    let posts = [];
    
    // 處理不同的 API 回傳格式
    if (Array.isArray(res.data)) {
      posts = res.data;
    } else if (res.data.data && Array.isArray(res.data.data)) {
      posts = res.data.data;
    } else if (res.data.data && Array.isArray(res.data.data.results)) {
      posts = res.data.data.results;
    } else if (res.data.results && Array.isArray(res.data.results)) {
      posts = res.data.results;
    } else if (res.data.data && res.data.data.count !== undefined) {
      // 可能是分頁格式，但沒有 results
      posts = [];
    } else {
      posts = [];
    }
    
    const existingPost = posts.find(post => {
      // 使用 UTC 方法避免時區問題
      const postDateObj = new Date(post.record_date);
      const postDate = `${postDateObj.getUTCFullYear()}-${String(postDateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(postDateObj.getUTCDate()).padStart(2, '0')}`;
      return postDate === formattedDate;
    });
    
    return !!existingPost; // 返回 boolean
  } catch (error) {
    console.error('檢查異常記錄存在失敗:', error);
    return false; // 發生錯誤時假設沒有記錄
  }
};

// 根據症狀和日期範圍搜尋寵物的異常記錄
export const searchAbnormalPostsByConditions = async (petId, symptoms, startDate, endDate) => {
  try {
    const params = {};
    
    // 加入日期範圍參數
    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式
    }
    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式
    }
    
    // 加入症狀參數 (如果有選擇症狀的話)
    if (symptoms && symptoms.length > 0) {
      params.symptoms = symptoms.join(','); // 用逗號分隔的症狀字串
    }
    
    const res = await axios.get(`/pets/${petId}/abnormal-posts/`, {
      params
    });
    
    return res.data.data || [];
  } catch (error) {
    console.error('搜尋異常記錄失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 生成疾病檔案內容預覽
export const generateDiseaseArchiveContent = async (diseaseArchiveData) => {
  try {
    const res = await axios.post('/pets/disease-archive/generate-content/', diseaseArchiveData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 設置 60 秒超時，因為 GPT API 可能需要較長時間
    });
    return res.data.data;
  } catch (error) {
    console.error('生成疾病檔案內容失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 保存疾病檔案
export const saveDiseaseArchive = async (diseaseArchiveData) => {
  try {
    const res = await axios.post('/pets/disease-archive/create/', diseaseArchiveData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.data.data;
  } catch (error) {
    console.error('保存疾病檔案失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 獲取寵物詳細資訊 (for ArchiveCard)
export const getPetDetail = async (petId) => {
  try {
    const response = await axios.get(`/pets/${petId}/detail/`);
    return response.data.data; // 直接返回 data 部分
  } catch (error) {
    console.error('獲取寵物詳細資訊失敗:', error);
    throw error;
  }
};

// 驗證單個異常記錄是否存在
export const checkAbnormalPostExistsById = async (postId, petId) => {
  try {
    // 如果提供了 petId，使用包含 petId 的路徑
    const url = petId 
      ? `/pets/${petId}/abnormal-post/${postId}/`
      : `/pets/abnormal-post/${postId}/public/`;
    
    const res = await axios.get(url);
    return res.status === 200 && res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return false; // 記錄不存在
    }
    console.error(`驗證異常記錄 ${postId} 存在性失敗:`, error);
    // 不要拋出錯誤，返回 false 表示驗證失敗
    return false;
  }
};

// 批量驗證異常記錄是否存在
export const validateAbnormalPostsExist = async (postIds, petId = null) => {
  try {
    // 驗證輸入參數
    if (!Array.isArray(postIds)) {
      console.error('validateAbnormalPostsExist: postIds must be an array');
      return { validIds: [], invalidIds: [] };
    }
    
    // 過濾出有效的ID
    const validPostIds = postIds.filter(id => id != null && id !== undefined && id !== '');
    
    if (validPostIds.length === 0) {
      return { validIds: [], invalidIds: [] };
    }
    
    console.log('驗證異常記錄ID:', validPostIds, 'petId:', petId);
    
    const results = await Promise.allSettled(
      validPostIds.map(id => checkAbnormalPostExistsById(id, petId))
    );
    
    const validIds = [];
    const invalidIds = [];
    
    results.forEach((result, index) => {
      const postId = validPostIds[index];
      if (result.status === 'fulfilled' && result.value) {
        validIds.push(postId);
      } else {
        console.log(`異常記錄 ${postId} 驗證失敗:`, result.reason || 'Record not found');
        invalidIds.push(postId);
      }
    });
    
    console.log('驗證結果 - 有效:', validIds, '無效:', invalidIds);
    return { validIds, invalidIds };
  } catch (error) {
    console.error('批量驗證異常記錄失敗:', error);
    throw error;
  }
};

// 獲取我的疾病檔案預覽列表
export const getMyDiseaseArchivesPreview = async () => {
  try {
    const res = await axios.get('/pets/my-disease-archives/preview/');
    return res.data.data;
  } catch (error) {
    console.error('獲取疾病檔案預覽列表失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 獲取疾病檔案詳細資訊
export const getDiseaseArchiveDetail = async (archiveId) => {
  try {
    const res = await axios.get(`/pets/disease-archive/${archiveId}/`);
    return res.data.data;
  } catch (error) {
    console.error('獲取疾病檔案詳細資訊失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// 獲取所有公開疾病檔案預覽（用於社群頁面寵物論壇）
export const getPublicDiseaseArchivesPreview = async (params = {}) => {
  try {
    const { offset = 0, limit = 10 } = params;
    const res = await axios.get('/pets/disease-archives/public/preview/', {
      params: { offset, limit }
    });
    return {
      success: true,
      data: res.data.data
    };
  } catch (error) {
    console.error('獲取公開疾病檔案預覽列表失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: null
    };
  }
};

// 獲取用戶公開疾病檔案預覽（用於用戶個人頁面論壇部分）
export const getUserPublicDiseaseArchivesPreview = async (userId = null, params = {}) => {
  try {
    const { offset = 0, limit = 10 } = params;
    let url;
    
    if (userId) {
      // 獲取指定用戶的公開檔案
      url = `/pets/users/${userId}/disease-archives/public/preview/`;
    } else {
      // 獲取當前用戶的公開檔案
      url = '/pets/my-public-disease-archives/preview/';
    }
    
    const res = await axios.get(url, {
      params: { offset, limit }
    });
    return {
      success: true,
      data: res.data.data
    };
  } catch (error) {
    console.error('獲取用戶公開疾病檔案預覽列表失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: null
    };
  }
};


// 公開發布疾病檔案
export const publishDiseaseArchive = async (archiveId) => {
  try {
    const res = await axios.post(`/pets/disease-archive/${archiveId}/publish/`);
    return {
      success: true,
      data: res.data.data,
      message: res.data.message
    };
  } catch (error) {
    console.error('發布疾病檔案失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: null
    };
  }
};

// 更新疾病檔案
export const updateDiseaseArchive = async (archiveId, updateData) => {
  try {
    const res = await axios.put(`/pets/disease-archive/${archiveId}/update/`, updateData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return {
      success: true,
      data: res.data.data,
      message: res.data.message || '疾病檔案已更新'
    };
  } catch (error) {
    console.error('更新疾病檔案失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: null
    };
  }
};

// 刪除疾病檔案
export const deleteDiseaseArchive = async (archiveId) => {
  try {
    const res = await axios.delete(`/pets/disease-archive/${archiveId}/delete/`);
    return {
      success: true,
      data: res.data.data,
      message: res.data.message || '疾病檔案已刪除'
    };
  } catch (error) {
    console.error('刪除疾病檔案失敗:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: null
    };
  }
};

export default {
  getUserPets,
  createPet,
  updatePet,
  deletePet,
  getPetAbnormalPosts,
  getPetAbnormalPostsPreview,
  getAbnormalPostDetail,
  getPublicAbnormalPostDetail,
  getPetIllnessArchives,
  getSymptoms,
  createAbnormalPost,
  updateAbnormalPost,
  deleteAbnormalPost,
  checkAbnormalPostExists,
  checkAbnormalPostExistsById,
  searchAbnormalPostsByConditions,
  generateDiseaseArchiveContent,
  saveDiseaseArchive,
  getPetDetail,
  validateAbnormalPostsExist,
  getMyDiseaseArchivesPreview,
  getDiseaseArchiveDetail,
  getPublicDiseaseArchivesPreview,
  getUserPublicDiseaseArchivesPreview,
  publishDiseaseArchive,
  updateDiseaseArchive,
  deleteDiseaseArchive
}; 