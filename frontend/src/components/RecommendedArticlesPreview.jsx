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

  // Debug: log counts to verify presence of social vs forum posts
  useEffect(() => {
    try {
      const socialCount = socialPosts ? Object.keys(socialPosts).length : 0;
      const forumCount = forumPosts ? Object.keys(forumPosts).length : 0;
      console.log('[RecommendedArticlesPreview] counts:', { socialCount, forumCount });
    } catch (e) {
      // no-op
    }
  }, [socialPosts, forumPosts]);

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
        // 直接導向社群頁面，並注入代理返回的貼文資料（仿後端取回的結構）
        const normalized = normalizeAgentSocialPost(article);
        navigate('/social', {
          state: {
            injectedPost: normalized,
            source: 'agent',
            focus: true
          }
        });
      } else {
        // 跳轉到疾病檔案詳情頁面（公開瀏覽模式）
        navigate(`/disease-archive/${article.id}/public`);
      }
    }
  };

  // 將代理返回的社群貼文規格化為前端 Post 組件可直接渲染的結構
  const normalizeAgentSocialPost = (post) => {
    // 圖片處理：兼容 images、image_urls、imageUrls
    const rawImages = post.images || post.image_urls || post.imageUrls || [];
    const images = Array.isArray(rawImages)
      ? rawImages.map((img) => {
          if (typeof img === 'string') return { url: img };
          if (img && typeof img === 'object') {
            return {
              url: img.url || img.firebase_url || img.dataUrl,
              firebase_url: img.firebase_url,
              dataUrl: img.dataUrl
            };
          }
          return null;
        }).filter(Boolean)
      : [];

    // 使用者資訊
    const user = post.user_info || {
      user_account: post.user_account || post.username || '',
      username: post.username || post.user_account || '',
      user_fullname: post.user_fullname || post.author?.fullname || '',
      headshot_url: post.headshot_url || post.avatar_url || ''
    };

    // Hashtags 標準化為物件陣列或字串陣列皆可被 Post 支援
    const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];

    // 標註
    const annotations = Array.isArray(post.annotations) ? post.annotations : [];

    // 互動統計
    const interaction_stats = {
      likes: post.interaction_stats?.likes ?? post.like_count ?? 0,
      comments: post.interaction_stats?.comments ?? post.comment_count ?? 0
    };

    const user_interaction = {
      is_liked: post.user_interaction?.is_liked ?? post.is_liked ?? false,
      is_saved: post.user_interaction?.is_saved ?? post.is_saved ?? false
    };

    return {
      id: post.id,
      created_at: post.created_at || post.post_date || new Date().toISOString(),
      images,
      content: {
        content_text: post.content_text || post.content?.content_text || post.content || '',
        location: post.content?.location || post.location || ''
      },
      hashtags,
      annotations,
      user_info: user,
      interaction_stats,
      user_interaction,
      // 標記為由代理注入，便於頁面做特殊處理（例如滾動或高亮）
      __injected: true
    };
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
      // Handle both old format (content string) and new agent format (content_text at top-level or content.content_text)
      const content = article.content_text || article.content?.content_text || article.content || '';
      return content.length > 30 ? content.substring(0, 30) + '...' : content || '社交貼文';
    }
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