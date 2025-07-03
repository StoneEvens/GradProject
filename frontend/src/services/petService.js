import axios from '../utils/axios';

// 取得當前用戶的所有寵物資料
export const getUserPets = async () => {
  const res = await axios.get('/pets/my-pets/');
  return res.data.data;
};

// 創建新寵物
export const createPet = async (petData) => {
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
  
  // 添加寵物頭像
  if (petData.headshot) {
    formData.append('headshot', petData.headshot);
  }
  
  const res = await axios.post('/pets/create/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data.data;
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

// 取得寵物的疾病檔案
export const getPetIllnessArchives = async (petId) => {
  const res = await axios.get(`/pets/${petId}/illness-archives/`);
  return res.data.data;
}; 