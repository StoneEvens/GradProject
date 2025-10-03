import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/RecommendedArticlesPreview.module.css';
import aiChatService from '../services/aiChatService';

const RecommendedArticlesPreview = ({ articleIds = [], onArticleClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('main');
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 獲取推薦文章詳情
  useEffect(() => {
    const fetchArticleDetails = async () => {
      if (!articleIds || articleIds.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // 從後端 API 獲取疾病檔案詳情
        const articleDetails = await aiChatService.getDiseaseArchiveDetails(articleIds);
        setArticles(articleDetails);
      } catch (error) {
        console.error('獲取推薦文章詳情失敗:', error);
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticleDetails();
  }, [articleIds]);

  // 處理文章點擊 - 跳轉到疾病檔案詳情頁面
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // 通知全局啟動浮動模式
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));

      // 跳轉到疾病檔案詳情頁面（公開瀏覽模式）
      navigate(`/disease-archive/${article.id}/public`);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
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
            key={article.id}
            className={styles.articleItem}
            onClick={() => handleArticleClick(article)}
          >
            <div className={styles.articleContent}>
              <div className={styles.articleTitle}>
                {article.archive_title || '疾病案例分享'}
              </div>
              <div className={styles.articleAuthor}>
                由 {article.author?.fullname || article.author?.username || '匿名'} 分享
              </div>
              <div className={styles.articleDate}>{formatDate(article.created_at)}</div>
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