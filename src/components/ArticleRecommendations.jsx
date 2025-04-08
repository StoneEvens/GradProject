// 📁 src/components/ArticleRecommendations.jsx
import React from 'react'
import './ArticleRecommendations.css'

const articles = [
  {
    title: '法鬥的漫長減肥之路',
    tags: ['#法國鬥牛犬', '#過重']
  },
  {
    title: '吉娃娃終於把舌頭收起來',
    tags: ['#吉娃娃', '#神經失調']
  },
  {
    title: '黃金獵犬的髖關節治好了',
    tags: ['#黃金獵犬', '#髖關節']
  },
  {
    title: '柴犬的糖尿病獲得有效控制',
    tags: ['#柴犬', '#糖尿病', '#嘔吐']
  },
]

function ArticleRecommendations() {
  return (
    <div className="article-container">
      <h3 className="section-title">好文推薦</h3>
      <div className="article-grid">
        {articles.map((article, index) => (
          <button key={index} className="article-card">
            <div className="article-title">{article.title}</div>
            <div className="article-tags">{article.tags.join(' ')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ArticleRecommendations
