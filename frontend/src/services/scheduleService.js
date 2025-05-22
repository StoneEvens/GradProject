import { authAxios } from './authService';

// 使用硬編碼的默認 API URL 而不是依賴 process.env
const API_URL = 'http://localhost:8000/api/v1';

// 獲取用戶行程
export const getUserSchedules = async () => {
  try {
    const response = await authAxios.get('/accounts/plans/today/');
    return response.data.data || [];
  } catch (error) {
    console.error('獲取行程失敗:', error);
    throw error;
  }
};

// 新增用戶行程
export const addUserSchedule = async (scheduleData) => {
  try {
    // 將時間和標題轉換為後端期望的格式
    const formattedData = {
      title: scheduleData.title,
      description: scheduleData.description || "",
      date: formatDateTimeForAPI(scheduleData.time)
    };
    
    const response = await authAxios.post('/accounts/plans/create/', formattedData);
    return response.data.data;
  } catch (error) {
    console.error('新增行程失敗:', error);
    throw error;
  }
};

// 標記行程為已完成
export const markScheduleAsCompleted = async (scheduleId) => {
  try {
    const response = await authAxios.patch(
      `/accounts/plans/${scheduleId}/complete/`,
      {}  // 不需要發送數據，因為後端會直接將 is_completed 設為 true
    );
    return response.data.data;
  } catch (error) {
    console.error('標記行程完成失敗:', error);
    throw error;
  }
};

// 刪除行程
export const deleteSchedule = async (scheduleId) => {
  try {
    await authAxios.delete(`/accounts/plans/${scheduleId}/`);
    return true;
  } catch (error) {
    console.error('刪除行程失敗:', error);
    throw error;
  }
};

// 將時間格式化為後端期望的格式
const formatDateTimeForAPI = (time) => {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  // 設置時間
  const dateObj = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes
  );
  
  // 返回 ISO 格式的日期時間
  return dateObj.toISOString();
}; 