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
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
    const res = await axios.get(`/pets/${petId}/abnormal-posts/`, {
      params: {
        date: formattedDate,
        check_exists: true
      }
    });
    
    // 檢查該日期是否已有記錄
    const posts = res.data.data || [];
    const existingPost = posts.find(post => {
      const postDate = new Date(post.record_date).toISOString().split('T')[0];
      return postDate === formattedDate;
    });
    
    return !!existingPost; // 返回 boolean
  } catch (error) {
    console.error('檢查異常記錄存在失敗:', error);
    return false; // 發生錯誤時假設沒有記錄
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
  getPetIllnessArchives,
  getSymptoms,
  createAbnormalPost,
  updateAbnormalPost,
  deleteAbnormalPost,
  checkAbnormalPostExists
}; 