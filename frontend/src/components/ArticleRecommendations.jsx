import React, { useRef, useEffect } from 'react';
import styles from '../styles/ArticleRecommendations.module.css';

const ArticleRecommendations = () => {
  // 文章列表的引用
  const articleListRef = useRef(null);
  
  // 模擬的推薦文章數據
  const recommendedArticles = [
    { id: 1, title: '法鬥的溫柔減肥之路', tags: ['法國鬥牛犬', '過重'] },
    { id: 2, title: '吉娃娃終於把舌頭收起來', tags: ['吉娃娃', '調皮失調'] },
    { id: 3, title: '黃金獵犬的髖關節治好了', tags: ['黃金獵犬', '髖關節'] },
    { id: 4, title: '柴犬糖尿病獲得有效控制', tags: ['柴犬', '糖尿病', '嗜吐'] },
    { id: 5, title: '邊境牧羊犬的耐心訓練指南', tags: ['邊牧', '訓練', '技巧'] },
    { id: 6, title: '哈士奇變乖了！主人分享秘訣', tags: ['哈士奇', '行為矯正'] },
    { id: 7, title: '馬爾濟斯的毛髮護理全攻略', tags: ['馬爾濟斯', '毛髮護理'] },
    { id: 8, title: '臘腸狗的背部保健方法', tags: ['臘腸狗', '脊椎健康'] },
    { id: 9, title: '鬆獅犬的日常飲食建議', tags: ['鬆獅犬', '營養', '飲食'] },
    { id: 10, title: '貓狗和平相處的小技巧', tags: ['貓咪', '犬隻', '相處'] },
  ];

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