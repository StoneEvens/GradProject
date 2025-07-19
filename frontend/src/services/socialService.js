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

  /**
   * 檢查圖片標註權限
   * @param {string} userAccount - 要標註的使用者帳號
   * @returns {Promise} 標註權限檢查結果
   */
  async checkAnnotationPermission(userAccount) {
    try {
      const response = await authAxios.get(`/social/annotation/check-permission/${userAccount}/`);

      const result = response.data;
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '檢查標註權限失敗');
      }
    } catch (error) {
      console.error('檢查標註權限錯誤:', error);
      
      // 處理不同的 HTTP 狀態碼
      if (error.response) {
        const { status, data } = error.response;
        return {
          success: false,
          error: data.message || error.message,
          data: data.data || {
            can_annotate: false,
            reason: data.message || '檢查權限時發生錯誤',
            user_info: null
          },
          status: status
        };
      }
      
      return {
        success: false,
        error: error.message || '檢查標註權限失敗',
        data: {
          can_annotate: false,
          reason: '網路錯誤或伺服器無回應',
          user_info: null
        }
      };
    }
  }

  /**
   * 發布新貼文
   * @param {Object} postData - 貼文資料
   * @param {string} postData.content - 貼文內容
   * @param {string} postData.location - 位置資訊
   * @param {string} postData.hashtags - 標籤（逗號分隔）
   * @param {Array} postData.images - 圖片檔案陣列（File 物件）
   * @param {Array} postData.annotations - 標註資料陣列
   * @returns {Promise} 發布結果
   */
  async createPost(postData) {
    try {
      const formData = new FormData();
      
      // 添加基本貼文資料
      formData.append('content', postData.content || '');
      formData.append('location', postData.location || '');
      formData.append('hashtags', postData.hashtags || '');
      
      // 添加圖片檔案（已經在前端預處理過）
      if (postData.images && postData.images.length > 0) {
        postData.images.forEach((imageFile, index) => {
          if (imageFile instanceof File) {
            formData.append('images', imageFile);
          } else {
            console.warn(`圖片 ${index} 不是有效的 File 物件:`, imageFile);
          }
        });
      }
      
      // 添加標註資料
      if (postData.annotations && postData.annotations.length > 0) {
        formData.append('annotations', JSON.stringify(postData.annotations));
      }

      console.log('發送貼文資料:', {
        content: postData.content,
        location: postData.location,
        hashtags: postData.hashtags,
        imageCount: postData.images?.length || 0,
        annotationCount: postData.annotations?.length || 0
      });

      // 打印 FormData 內容用於調試
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(`FormData[${pair[0]}]:`, `File: ${pair[1].name}, size: ${pair[1].size}, type: ${pair[1].type}`);
        } else {
          console.log(`FormData[${pair[0]}]:`, pair[1]);
        }
      }

      const response = await authAxios.post('/social/posts/create/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60秒超時，因為圖片上傳可能需要較長時間
      });

      const result = response.data;
      
      if (result.success || response.status === 201) {
        return {
          success: true,
          data: result.data,
          message: result.message || '貼文發布成功'
        };
      } else {
        throw new Error(result.message || '貼文發布失敗');
      }
    } catch (error) {
      console.error('發布貼文錯誤:', error);
      
      if (error.response) {
        const { status, data } = error.response;
        
        // 特殊處理某些錯誤狀態碼
        let errorMessage = data?.message || error.message;
        if (status === 413) {
          errorMessage = '檔案大小超過限制，請選擇較小的圖片';
        } else if (status === 400) {
          errorMessage = data?.message || '請求資料格式錯誤';
        } else if (status === 500) {
          errorMessage = '伺服器錯誤，請稍後再試';
        }
        
        return {
          success: false,
          error: errorMessage,
          data: data?.data || null,
          status: status
        };
      }
      
      // 處理網路錯誤
      if (error.code === 'NETWORK_ERROR') {
        return {
          success: false,
          error: '網路連線錯誤，請檢查網路連線',
          data: null
        };
      }
      
      return {
        success: false,
        error: error.message || '發布貼文失敗，請稍後再試',
        data: null
      };
    }
  }

  /**
   * 獲取貼文列表
   * @param {Object} params - 查詢參數
   * @param {number} params.offset - 偏移量
   * @param {number} params.limit - 限制數量
   * @returns {Promise} 貼文列表
   */
  async getPosts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        offset: params.offset || 0,
        limit: params.limit || 10,
        ...params
      });

      const response = await authAxios.get(`/social/posts/?${queryParams}`);
      const result = response.data;
      
      console.log('獲取貼文 API 回應:', result);
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '獲取貼文失敗');
      }
    } catch (error) {
      console.error('獲取貼文錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: { posts: [], has_more: false }
      };
    }
  }

  /**
   * 獲取特定用戶的貼文列表
   * @param {number} userId - 用戶ID
   * @param {Object} params - 查詢參數
   * @param {number} params.offset - 偏移量
   * @param {number} params.limit - 限制數量
   * @returns {Promise} 用戶貼文列表
   */
  async getUserPosts(userId, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        offset: params.offset || 0,
        limit: params.limit || 10,
        ...params
      });

      const response = await authAxios.get(`/social/users/${userId}/posts/?${queryParams}`);
      const result = response.data;
      
      console.log('獲取用戶貼文 API 回應:', result);
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: result.message
        };
      } else {
        throw new Error(result.message || '獲取用戶貼文失敗');
      }
    } catch (error) {
      console.error('獲取用戶貼文錯誤:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 對貼文進行互動（按讚/取消按讚）
   * @param {number} postId - 貼文ID
   * @param {boolean} isLiked - 目前是否已按讚
   * @returns {Promise} 操作結果
   */
  async togglePostLike(postId, isLiked) {
    try {
      const response = await authAxios.post(`/interactions/posts/${postId}/interaction/`, {
        relation: 'liked'  // 發送 'liked' 來切換按讚狀態
      });

      const result = response.data;
      return {
        success: true,
        data: result.data,
        message: result.detail || '操作成功'
      };
    } catch (error) {
      console.error('貼文互動錯誤:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || '操作失敗'
      };
    }
  }

  /**
   * 切換貼文收藏狀態
   * @param {number} postId - 貼文ID
   * @param {boolean} isSaved - 目前是否已收藏
   * @returns {Promise} 操作結果
   */
  async togglePostSave(postId, isSaved) {
    try {
      const response = await authAxios.post(`/interactions/posts/${postId}/interaction/`, {
        relation: 'saved'  // 發送 'saved' 來切換收藏狀態
      });

      const result = response.data;
      return {
        success: true,
        data: result.data,
        message: result.detail || '操作成功'
      };
    } catch (error) {
      console.error('貼文收藏錯誤:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || '操作失敗'
      };
    }
  }

  /**
   * 獲取用戶按讚的貼文列表
   * @param {Object} params - 查詢參數
   * @param {string} params.sort - 排序方式
   * @param {number} params.page - 頁數
   * @param {number} params.limit - 每頁數量
   * @returns {Promise} 按讚貼文列表
   */
  async getUserLikedPosts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        sort: params.sort || 'post_date_desc',
        page: params.page || 1,
        limit: params.limit || 10,
        ...params
      });

      const response = await authAxios.get(`/interactions/user/liked-posts/?${queryParams}`);
      const result = response.data;
      
      console.log('獲取按讚貼文 API 回應:', result);
      
      // 處理分頁回應
      if (result.results) {
        return {
          success: true,
          data: {
            posts: result.results,
            count: result.count,
            next: result.next,
            previous: result.previous,
            has_more: !!result.next
          },
          message: '獲取按讚貼文成功'
        };
      } else {
        return {
          success: true,
          data: result.data || result,
          message: result.message || '獲取按讚貼文成功'
        };
      }
    } catch (error) {
      console.error('獲取按讚貼文錯誤:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || '獲取按讚貼文失敗',
        data: { posts: [], has_more: false }
      };
    }
  }

  /**
   * 獲取用戶收藏的貼文列表
   * @param {Object} params - 查詢參數
   * @param {string} params.sort - 排序方式
   * @param {number} params.page - 頁數
   * @param {number} params.limit - 每頁數量
   * @returns {Promise} 收藏貼文列表
   */
  async getUserSavedPosts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        sort: params.sort || 'post_date_desc',
        page: params.page || 1,
        limit: params.limit || 10,
        ...params
      });

      const response = await authAxios.get(`/interactions/user/saved-posts/?${queryParams}`);
      const result = response.data;
      
      console.log('獲取收藏貼文 API 回應:', result);
      
      // 處理分頁回應
      if (result.results) {
        return {
          success: true,
          data: {
            posts: result.results,
            count: result.count,
            next: result.next,
            previous: result.previous,
            has_more: !!result.next
          },
          message: '獲取收藏貼文成功'
        };
      } else {
        return {
          success: true,
          data: result.data || result,
          message: result.message || '獲取收藏貼文成功'
        };
      }
    } catch (error) {
      console.error('獲取收藏貼文錯誤:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || '獲取收藏貼文失敗',
        data: { posts: [], has_more: false }
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
export const checkAnnotationPermission = socialService.checkAnnotationPermission.bind(socialService);
export const createPost = socialService.createPost.bind(socialService);
export const getPosts = socialService.getPosts.bind(socialService);
export const getUserPosts = socialService.getUserPosts.bind(socialService);
export const togglePostLike = socialService.togglePostLike.bind(socialService);
export const togglePostSave = socialService.togglePostSave.bind(socialService);
export const getUserLikedPosts = socialService.getUserLikedPosts.bind(socialService);
export const getUserSavedPosts = socialService.getUserSavedPosts.bind(socialService);

export default socialService; 