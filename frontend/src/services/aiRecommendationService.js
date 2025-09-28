// AI 推薦服務 - 處理用戶推薦、文章推薦等功能
// 這個服務負責為 AI 提供各種推薦內容

class AIRecommendationService {
  constructor() {
    // 推薦類型定義
    this.RECOMMENDATION_TYPES = {
      USERS: 'users',
      ARTICLES: 'articles',
      POSTS: 'posts',
      PRODUCTS: 'products'
    };
  }

  /**
   * 獲取推薦用戶
   * @param {Object} criteria - 推薦條件
   * @returns {Promise<Array>} 推薦用戶列表
   */
  async getRecommendedUsers(criteria = {}) {
    try {
      // Demo 模式：返回寫死的推薦用戶
      const mockUsers = await this.getMockRecommendedUsers(criteria);

      // 未來正式版本可以在這裡調用真實的推薦 API
      // const realUsers = await this.fetchRecommendedUsersFromAPI(criteria);

      return {
        success: true,
        users: mockUsers,
        criteria,
        source: 'demo'
      };
    } catch (error) {
      console.error('獲取推薦用戶失敗:', error);
      return {
        success: false,
        users: [],
        error: error.message
      };
    }
  }

  /**
   * 獲取推薦文章
   * @param {Object} criteria - 推薦條件
   * @returns {Promise<Array>} 推薦文章列表
   */
  async getRecommendedArticles(criteria = {}) {
    try {
      // Demo 模式：返回寫死的推薦文章
      const mockArticles = await this.getMockRecommendedArticles(criteria);

      // 未來正式版本可以在這裡調用真實的推薦 API
      // const realArticles = await this.fetchRecommendedArticlesFromAPI(criteria);

      return {
        success: true,
        articles: mockArticles,
        criteria,
        source: 'demo'
      };
    } catch (error) {
      console.error('獲取推薦文章失敗:', error);
      return {
        success: false,
        articles: [],
        error: error.message
      };
    }
  }


  /**
   * Demo 模式：獲取模擬推薦用戶
   */
  async getMockRecommendedUsers(criteria) {
    // 模擬 API 延遲
    await this.simulateDelay(300, 800);

    const users = [
      {
        id: 1,
        user_account: 'petlover',
        user_fullname: '小明',
        headshot_url: '/assets/icon/DefaultAvatar.jpg',
        account_privacy: 'public',
        follower_count: 156,
        pet_count: 2,
        recent_activity: '2天前',
        match_reason: '同樣養布偶貓'
      },
      {
        id: 2,
        user_account: 'catowner_jenny',
        user_fullname: 'Jenny',
        headshot_url: '/assets/icon/DefaultAvatar.jpg',
        account_privacy: 'public',
        follower_count: 89,
        pet_count: 1,
        recent_activity: '1天前',
        match_reason: '布偶貓愛好者'
      },
      {
        id: 3,
        user_account: 'ragdoll_mom',
        user_fullname: '布偶媽咪',
        headshot_url: '/assets/icon/DefaultAvatar.jpg',
        account_privacy: 'public',
        follower_count: 234,
        pet_count: 3,
        recent_activity: '3小時前',
        match_reason: '專業布偶貓飼主'
      }
    ];

    // 根據條件篩選用戶（Demo 中返回所有用戶）
    return users;
  }

  /**
   * Demo 模式：獲取模擬推薦文章
   */
  async getMockRecommendedArticles(criteria) {
    // 模擬 API 延遲
    await this.simulateDelay(400, 900);

    const articles = [
      {
        id: 1,
        title: '我家小吉咳不停',
        author: 'leotest',
        created_at: '2025-09-15',
        category: '健康諮詢',
        view_count: 45,
        reply_count: 8,
        match_reason: '相關症狀：咳嗽'
      },
      {
        id: 2,
        title: '吉娃娃康復歷程',
        author: 'StevenStone',
        created_at: '2025-01-10',
        category: '疾病討論',
        view_count: 123,
        reply_count: 15,
        match_reason: '相關品種：吉娃娃'
      },
      {
        id: 3,
        title: '吉娃娃胃炎的三個月治療心得',
        author: 'Ivylee',
        created_at: '2024-12-08',
        category: '經驗分享',
        view_count: 78,
        reply_count: 12,
        match_reason: '相關症狀：消化問題'
      }
    ];

    // 根據條件篩選文章（Demo 中返回所有文章）
    return articles;
  }


  /**
   * 處理用戶點擊推薦用戶
   * @param {Object} user - 用戶資訊
   * @param {Function} navigate - 導航函數
   */
  handleUserClick(user, navigate) {
    console.log('點擊推薦用戶:', user);

    // 可以導航到用戶檔案頁面
    if (navigate) {
      navigate(`/profile/${user.user_account}`);
    }
  }

  /**
   * 處理用戶點擊推薦文章
   * @param {Object} article - 文章資訊
   * @param {Function} navigate - 導航函數
   */
  handleArticleClick(article, navigate) {
    console.log('點擊推薦文章:', article);

    // 可以導航到文章詳細頁面
    if (navigate) {
      navigate(`/forum/article/${article.id}`);
    }
  }

  /**
   * 模擬 API 延遲
   */
  simulateDelay(min = 300, max = 1000) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 未來可以實作的真實 API 調用方法
   */

  // async fetchRecommendedUsersFromAPI(criteria) {
  //   const response = await fetch('/api/ai/recommendations/users', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(criteria)
  //   });
  //   return response.json();
  // }

  // async fetchRecommendedArticlesFromAPI(criteria) {
  //   const response = await fetch('/api/ai/recommendations/articles', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(criteria)
  //   });
  //   return response.json();
  // }

  // async fetchFeedingRecommendationFromAPI(petInfo) {
  //   const response = await fetch('/api/ai/feeding/recommendation', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(petInfo)
  //   });
  //   return response.json();
  // }
}

// 導出單例
export default new AIRecommendationService();