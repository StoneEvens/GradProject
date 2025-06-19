import authAxios from '../utils/axios';

class NotificationService {
  /**
   * 獲取當前使用者的所有通知
   * @returns {Promise} 通知列表
   */
  async getNotifications() {
    try {
      const response = await authAxios.get('/accounts/notifications/');
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      console.error('獲取通知失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 標記指定通知為已讀
   * @param {number} notificationId - 通知ID
   * @returns {Promise} 操作結果
   */
  async markNotificationAsRead(notificationId) {
    try {
      const response = await authAxios.patch(`/accounts/notifications/${notificationId}/read/`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('標記通知失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 標記所有通知為已讀
   * @returns {Promise} 操作結果
   */
  async markAllNotificationsAsRead() {
    try {
      const response = await authAxios.patch('/accounts/notifications/read-all/');
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error) {
      console.error('標記所有通知失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 回應追蹤請求
   * @param {number} notificationId - 通知ID
   * @param {string} action - 'accept' 或 'reject'
   * @returns {Promise} 操作結果
   */
  async respondToFollowRequest(notificationId, action) {
    try {
      const response = await authAxios.post(`/accounts/notifications/${notificationId}/follow-request/`, {
        action: action
      });
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('回應追蹤請求失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 創建服務實例
const notificationService = new NotificationService();

// 導出個別方法
export const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  respondToFollowRequest
} = notificationService;

// 也導出整個服務
export default notificationService; 