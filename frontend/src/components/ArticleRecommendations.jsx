import React, { useRef, useEffect, useState } from 'react';
import styles from '../styles/ArticleRecommendations.module.css';
import ArticleRecommendationsService from '../services/articleRecommendationsService.js';

const ArticleRecommendations = () => {
  // 文章列表的引用
  const articleListRef = useRef(null);
  
  // 推薦文章數據
  const [recommendedArticles, setRecommendedArticles] = useState([]);
  // Fetch articles when component mounts
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const articles = await ArticleRecommendationsService.getArticleRecommendations();
        console.log('Retrieved articles:', articles);
        setRecommendedArticles(articles);
      } catch (error) {
        console.error('Error fetching articles:', error);
      }
    };

    fetchArticles();
  }, []);
  
  // 滑動文章列表的函數
  const handleScroll = (direction) => {
    if (articleListRef.current) {
      const scrollAmount = 100; // 每次滑動的距離
      const currentScroll = articleListRef.current.scrollTop;
      
      if (direction === 'up') {
        articleListRef.current.scrollTo({
          top: Math.max(0, currentScroll - scrollAmount),
          behavior: 'smooth'
        });
      } else {
        articleListRef.current.scrollTo({
          top: currentScroll + scrollAmount,
          behavior: 'smooth'
        });
      }
    }
  };

  // 點擊文章處理函數
  const handleArticleClick = (article) => {
    console.log('查看文章:', article.title);
    // 這裡可以導航到文章詳情頁面
    // navigate(`/articles/${article.id}`);
  };

  // 加入滑鼠滾輪事件
  useEffect(() => {
    const handleWheel = (e) => {
      if (articleListRef.current && articleListRef.current.contains(e.target)) {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 'down' : 'up';
        handleScroll(direction);
      }
    };

    const listElement = articleListRef.current;
    if (listElement) {
      listElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (listElement) {
        listElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>好文推薦</div>
      
      
      <div className={styles.articleList} ref={articleListRef}>
        {recommendedArticles.map((article) => (
          <div 
            key={article.id} 
            className={styles.articleItem}
            onClick={() => handleArticleClick(article)}
          >
            <div className={styles.title}>{article.title}</div>
            <div className={styles.tags}>
              {article.tags.map((tag, index) => (
                <span key={index} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArticleRecommendations; 