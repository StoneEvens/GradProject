// 使用與authService相同的API URL
import { authAxios } from './authService';

const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * 社群相關API服務
 */
class SocialService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/social/`;
  }

  /**
   * 獲取請求標頭
   */
  getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * 搜尋用戶和貼文
   * @param {string} query - 搜尋關鍵字
   * @returns {Promise} 搜尋結果
   */
  async searchUsers(query) {
    try {
      const response = await authAxios.get(`/social/search/?q=${encodeURIComponent(query)}`);

      const result = response.data;
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '搜尋失敗');
      }
    } catch (error) {
      console.error('搜尋用戶錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: { users: [], posts: [] }
      };
    }
  }

  /**
   * 獲取搜尋建議
   * @param {string} query - 搜尋關鍵字
   * @returns {Promise} 搜尋建議
   */
  async getSearchSuggestions(query) {
    try {
      const response = await authAxios.get(`/social/search/suggestions/?q=${encodeURIComponent(query)}`);

      const result = response.data;
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '獲取搜尋建議失敗');
      }
    } catch (error) {
      console.error('獲取搜尋建議錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 追蹤或取消追蹤使用者
   * @param {string|number} userAccountOrId - 使用者帳號或ID
   * @returns {Promise} 操作結果
   */
  async followUser(userAccountOrId) {
    try {
      const response = await authAxios.post(`/accounts/follow/${userAccountOrId}/`);

      const data = response.data;
      return {
        success: true,
        data: data.data,
        message: data.message
      };
    } catch (error) {
      console.error('追蹤操作錯誤:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 測試token有效性
   */
  async testTokenValidity() {
    try {
      const response = await authAxios.get('/accounts/me/');
      
      console.log('Token test response status:', response.status);
      
      if (response.status === 200) {
        const data = response.data;
        console.log('Token is valid, user:', data.data?.username);
        return true;
      } else {
        console.log('Token is invalid or expired');
        return false;
      }
    } catch (error) {
      console.error('Token test error:', error);
      return false;
    }
  }

  /**
   * 獲取使用者追蹤狀態
   * @param {string|number} userAccountOrId - 用戶帳號或ID
   * @returns {Promise} 追蹤狀態
   */
  async getUserFollowStatus(userAccountOrId) {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Token存在:', !!token);
      console.log('Token前10字符:', token ? token.substring(0, 10) + '...' : 'null');
      
      const response = await authAxios.get(`/accounts/follow/${userAccountOrId}/`);

      console.log('Response status:', response.status);

      const data = response.data;
      return data.data;
    } catch (error) {
      console.error('獲取追蹤狀態錯誤:', error);
      throw error;
    }
  }

  /**
   * 批量獲取多個使用者的追蹤狀態
   * @param {Array<number>} userIds - 用戶ID數組
   * @returns {Promise} 追蹤狀態數組
   */
  async getUserFollowStatusBatch(userIds) {
    try {
      const response = await authAxios.post('/accounts/follow/status/batch/', { user_ids: userIds });

      const data = response.data;
      return data.data.follow_status;
    } catch (error) {
      console.error('批量獲取追蹤狀態錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取追蹤列表
   * @param {string|number} userAccountOrId - 用戶帳號或ID
   * @returns {Promise} 追蹤列表
   */
  async getFollowingList(userAccountOrId) {
    try {
      const response = await authAxios.get(`/accounts/following/?user=${userAccountOrId}`);

      const result = response.data;
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '獲取追蹤列表失敗');
      }
    } catch (error) {
      console.error('獲取追蹤列表錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 獲取粉絲列表
   * @param {string|number} userAccountOrId - 用戶帳號或ID
   * @returns {Promise} 粉絲列表
   */
  async getFollowersList(userAccountOrId) {
    try {
      const response = await authAxios.get(`/accounts/followers/?user=${userAccountOrId}`);

      const result = response.data;
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '獲取粉絲列表失敗');
      }
    } catch (error) {
      console.error('獲取粉絲列表錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 移除粉絲
   * @param {string} userAccount - 要移除的粉絲用戶帳號
   * @returns {Promise} 操作結果
   */
  async removeFollower(userAccount) {
    try {
      const response = await authAxios.delete(`/accounts/followers/remove/${userAccount}/`);

      const result = response.data;
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '移除粉絲失敗');
      }
    } catch (error) {
      console.error('移除粉絲錯誤:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || '移除粉絲失敗'
      };
    }
  }
}

// 創建單例實例
const socialService = new SocialService();

// 導出常用方法
export const searchUsers = socialService.searchUsers.bind(socialService);
export const getSearchSuggestions = socialService.getSearchSuggestions.bind(socialService);
export const followUser = socialService.followUser.bind(socialService);
export const getUserFollowStatus = socialService.getUserFollowStatus.bind(socialService);
export const getUserFollowStatusBatch = socialService.getUserFollowStatusBatch.bind(socialService);
export const getFollowingList = socialService.getFollowingList.bind(socialService);
export const getFollowersList = socialService.getFollowersList.bind(socialService);
export const removeFollower = socialService.removeFollower.bind(socialService);

export default socialService; 