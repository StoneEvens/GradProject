import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/RecommendedArticlesPreview.module.css';
import aiChatService from '../services/aiChatService';

const RecommendedArticlesPreview = ({ 
  articleIds = [],  // 舊格式支援
  socialPosts = {},  // 新格式: 字典 {id: post_details}
  forumPosts = {},  // 新格式: 字典 {id: post_details}
  onArticleClick 
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('main');
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 獲取推薦文章詳情
  useEffect(() => {
    const fetchArticleDetails = async () => {
      setIsLoading(true);

      try {
        let articleDetails = [];

        // 新格式: 直接使用傳入的字典
        if (Object.keys(socialPosts).length > 0 || Object.keys(forumPosts).length > 0) {
          // 合併社交貼文和論壇貼文
          const allPosts = [];
          
          // 添加社交貼文 (標記類型)
          Object.values(socialPosts).forEach(post => {
            allPosts.push({
              ...post,
              type: 'social'
            });
          });
          
          // 添加論壇貼文 (標記類型)
          Object.values(forumPosts).forEach(post => {
            allPosts.push({
              ...post,
              type: 'forum'
            });
          });
          
          articleDetails = allPosts;
        }
        // 舊格式: 使用 article IDs 從後端獲取
        else if (articleIds && articleIds.length > 0) {
          // 從後端 API 獲取疾病檔案詳情
          articleDetails = await aiChatService.getDiseaseArchiveDetails(articleIds);
          // 標記為論壇類型
          articleDetails = articleDetails.map(article => ({
            ...article,
            type: 'forum'
          }));
        }

        setArticles(articleDetails);
      } catch (error) {
        console.error('獲取推薦文章詳情失敗:', error);
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticleDetails();
  }, [articleIds, socialPosts, forumPosts]);

  // 處理文章點擊 - 根據類型跳轉
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // 通知全局啟動浮動模式
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));

      if (article.type === 'social') {
        // 跳轉到社交貼文詳情頁面
        navigate(`/social/post/${article.id}`);
      } else {
        // 跳轉到疾病檔案詳情頁面（公開瀏覽模式）
        navigate(`/disease-archive/${article.id}/public`);
      }
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
  };

  // 獲取文章標題
  const getArticleTitle = (article) => {
    if (article.type === 'forum') {
      return article.archive_title || '疾病案例分享';
    } else {
      // 社交貼文: 使用內容前30字作為標題
      // Handle both old format (content string) and new agent format (content.content_text)
      const content = article.content?.content_text || article.content || '';
      return content.length > 30 ? content.substring(0, 30) + '...' : content || '社交貼文';
    }
  };

  // 獲取作者名稱
  const getAuthorName = (article) => {
    // Handle both old format (author.fullname) and new agent format (user_info.user_fullname)
    return article.user_info?.user_fullname || 
           article.user_info?.username ||
           article.author?.fullname || 
           article.author?.username || 
           '匿名';
  };

  // 獲取日期
  const getArticleDate = (article) => {
    // Handle both old format (created_at) and new agent format (post_date for forum)
    return article.created_at || article.post_date || new Date().toISOString();
  };

  // 獲取位置
  const getLocation = (article) => {
    // Handle both old format (location string) and new agent format (content.location)
    return article.content?.location || article.location;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{t('chatWindow.recommendedArticles.title')}</span>
        </div>
        <div className={styles.loading}>
          <p>{t('chatWindow.recommendedArticles.loading')}</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>💡 相關案例分享</span>
      </div>
      <div className={styles.articleList}>
        {articles.map(article => (
          <div
            key={`${article.type}-${article.id}`}
            className={styles.articleItem}
            onClick={() => handleArticleClick(article)}
          >
            <div className={styles.articleContent}>
              <div className={styles.articleTitle}>
                {getArticleTitle(article)}
              </div>
              <div className={styles.articleAuthor}>
                由 {getAuthorName(article)} 分享
                {article.type === 'social' && getLocation(article) && (
                  <span> · 📍 {getLocation(article)}</span>
                )}
                {article.type === 'forum' && article.health_status && (
                  <span> · {article.health_status}</span>
                )}
              </div>
              <div className={styles.articleDate}>{formatDate(getArticleDate(article))}</div>
            </div>

            <div className={styles.articleArrow}>
              ❯
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedArticlesPreview;