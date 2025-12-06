import React, { useState, useEffect, useMemo } from 'react';
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

  // Stabilize dependencies by stringifying objects to prevent infinite loops
  const socialPostsStr = useMemo(() => JSON.stringify(socialPosts || {}), [socialPosts]);
  const forumPostsStr = useMemo(() => JSON.stringify(forumPosts || {}), [forumPosts]);
  const articleIdsStr = useMemo(() => JSON.stringify(articleIds || []), [articleIds]);

  // 獲取推薦文章詳情
  useEffect(() => {
    const fetchArticleDetails = async () => {
      setIsLoading(true);

      try {
        let articleDetails = [];
        
        // Parse back the stabilized strings
        const socialPostsObj = JSON.parse(socialPostsStr);
        const forumPostsObj = JSON.parse(forumPostsStr);
        const articleIdsArr = JSON.parse(articleIdsStr);

        // 新格式: 直接使用傳入的字典
        if (Object.keys(socialPostsObj).length > 0 || Object.keys(forumPostsObj).length > 0) {
          // 合併社交貼文和論壇貼文
          const allPosts = [];
          
          // 添加社交貼文 (標記類型)
          Object.values(socialPostsObj).forEach(post => {
            const id = post.id ?? post.post_id ?? post.postId;
            allPosts.push({
              ...post,
              id,
              type: 'social'
            });
          });
          
          // 添加論壇貼文 (標記類型)
          Object.values(forumPostsObj).forEach(post => {
            const id = post.id ?? post.post_id ?? post.postId;
            allPosts.push({
              ...post,
              id,
              type: 'forum'
            });
          });
          
          articleDetails = allPosts;
        }
        // 舊格式: 使用 article IDs 從後端獲取
        else if (articleIdsArr && articleIdsArr.length > 0) {
          // 從後端 API 獲取疾病檔案詳情
          articleDetails = await aiChatService.getDiseaseArchiveDetails(articleIdsArr);
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
  }, [socialPostsStr, forumPostsStr, articleIdsStr]);

  // 處理文章點擊 - 根據類型跳轉
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // 通知全局啟動浮動模式
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));

      if (article.type === 'social') {
        // 導向社群貼文詳情頁面
        const targetId = article.id ?? article.post_id ?? article.postId;
        navigate(`/post/${targetId}`);
      } else {
        // 跳轉到疾病檔案詳情頁面（公開瀏覽模式）
        const targetId = article.id ?? article.post_id ?? article.postId;
        navigate(`/disease-archive/${targetId}/public`);
      }
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
  };

  // 使用回應中的 title，並加上貼文類型前綴（社交貼文／論壇貼文）；若缺失則不顯示
  const getArticleTitle = (article) => {
    if (!article || typeof article.title !== 'string' || !article.title.trim()) return '';
    const typeLabel = article.type === 'forum' ? '論壇貼文' : '社交貼文';
    return `${typeLabel}：${article.title}`;
  };

  // 獲取作者名稱
  const getAuthorName = (article) => {
    // Handle old format (author/user_info) and new agent format (user_fullname/user)
    return article.user_info?.user_fullname ||
           article.user_info?.username ||
           article.user_fullname ||
           article.user ||
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
              {getArticleTitle(article) && (
                <div className={styles.articleTitle}>
                  {getArticleTitle(article)}
                </div>
              )}
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