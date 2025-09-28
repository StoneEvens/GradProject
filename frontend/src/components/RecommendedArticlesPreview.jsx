import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/RecommendedArticlesPreview.module.css';
import aiRecommendationService from '../services/aiRecommendationService';

const RecommendedArticlesPreview = ({ onArticleClick }) => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 獲取推薦文章
  useEffect(() => {
    const fetchRecommendedArticles = async () => {
      setIsLoading(true);

      try {
        // 使用推薦服務獲取文章
        const result = await aiRecommendationService.getRecommendedArticles({
          context: 'health_consultation',
          symptoms: ['咳嗽', '嘔吐'],
          pet_breed: '吉娃娃'
        });

        if (result.success) {
          setArticles(result.articles);
        } else {
          console.error('獲取推薦文章失敗:', result.error);
          setArticles([]);
        }
      } catch (error) {
        console.error('獲取推薦文章過程中發生錯誤:', error);
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendedArticles();
  }, []);

  // 處理文章點擊
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // 使用推薦服務處理文章點擊
      aiRecommendationService.handleArticleClick(article, navigate);
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
          <span className={styles.title}>相關文章推薦</span>
        </div>
        <div className={styles.loading}>
          <p>載入中...</p>
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
        <span className={styles.title}>相關文章推薦</span>
      </div>
      <div className={styles.articleList}>
        {articles.map(article => (
          <div
            key={article.id}
            className={styles.articleItem}
            onClick={() => handleArticleClick(article)}
          >
            <div className={styles.articleContent}>
              <div className={styles.articleTitle}>{article.title}</div>
              <div className={styles.articleAuthor}>{article.author}</div>
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