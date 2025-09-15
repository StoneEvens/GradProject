import { authAxios } from './authService';

// 使用硬編碼的默認 API URL 而不是依賴 process.env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// 獲取用戶行程（所有未完成的行程）
export const getUserSchedules = async () => {
  try {
    // 首先嘗試獲取所有行程的端點
    try {
      const response = await authAxios.get('/accounts/plans/');
      return response.data.data || [];
    } catch (error) {
      // 如果沒有 /accounts/plans/ 端點，使用日期範圍獲取
      console.log('嘗試使用日期範圍獲取行程...');
    }

    // 獲取從今天開始的未來30天的行程
    const today = new Date();
    const allSchedules = [];

    // 並行獲取未來30天的行程以提高效率
    const promises = [];
    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const formattedDate = formatDate(targetDate);

      promises.push(
        authAxios.get(`/accounts/plans/date/${formattedDate}/`)
          .then(response => response.data.data || [])
          .catch(() => []) // 忽略錯誤，返回空數組
      );
    }

    const results = await Promise.all(promises);
    results.forEach(daySchedules => {
      allSchedules.push(...daySchedules);
    });

    return allSchedules;
  } catch (error) {
    console.error('獲取行程失敗:', error);
    // 如果上面的方法都失敗，回退到只獲取今天的行程
    try {
      const response = await authAxios.get('/accounts/plans/today/');
      return response.data.data || [];
    } catch (fallbackError) {
      console.error('回退獲取今日行程也失敗:', fallbackError);
      throw error;
    }
  }
};

// 根據日期獲取用戶行程
export const getUserSchedulesByDate = async (date) => {
  try {
    // 格式化日期為 YYYY-MM-DD
    const formattedDate = typeof date === 'string' ? date : formatDate(date);
    const response = await authAxios.get(`/accounts/plans/date/${formattedDate}/`);
    return response.data.data || [];
  } catch (error) {
    console.error('獲取指定日期行程失敗:', error);
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
      date: scheduleData.date || formatDateForAPI(),
      start_time: scheduleData.startTime,
      end_time: scheduleData.endTime
    };
    
    const response = await authAxios.post('/accounts/plans/create/', formattedData);
    return response.data.data;
  } catch (error) {
    console.error('新增行程失敗:', error);
    throw error;
  }
};

// 獲取行程詳情
export const getScheduleDetail = async (scheduleId) => {
  try {
    const response = await authAxios.get(`/accounts/plans/${scheduleId}/edit/`);
    return response.data.data;
  } catch (error) {
    console.error('獲取行程詳情失敗:', error);
    throw error;
  }
};

// 更新行程
export const updateSchedule = async (scheduleId, scheduleData) => {
  try {
    // 將時間和標題轉換為後端期望的格式
    const formattedData = {
      title: scheduleData.title,
      description: scheduleData.description || "",
      date: scheduleData.date || formatDateForAPI(),
      start_time: scheduleData.startTime,
      end_time: scheduleData.endTime
    };
    
    const response = await authAxios.put(`/accounts/plans/${scheduleId}/edit/`, formattedData);
    return response.data.data;
  } catch (error) {
    console.error('更新行程失敗:', error);
    throw error;
  }
};

// 標記行程為已完成
export const markScheduleAsCompleted = async (scheduleId) => {
  try {
    const response = await authAxios.patch(
      `/accounts/plans/${scheduleId}/complete/`,
      { is_completed: true }
    );
    return response.data.data;
  } catch (error) {
    console.error('標記行程完成失敗:', error);
    throw error;
  }
};

// 重新開始行程（標記為未完成）
export const reopenSchedule = async (scheduleId) => {
  try {
    const response = await authAxios.patch(
      `/accounts/plans/${scheduleId}/complete/`,
      { is_completed: false }
    );
    return response.data.data;
  } catch (error) {
    console.error('重新開始行程失敗:', error);
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

// 將日期對象格式化為後端期望的格式 YYYY-MM-DD
export const formatDate = (date) => {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

// 只獲取日期部分，格式化為後端期望的格式 YYYY-MM-DD
const formatDateForAPI = () => {
  const now = new Date();
  return formatDate(now);
}; 