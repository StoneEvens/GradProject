import React from 'react';
import './CommunityPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';

export default function CommunityPost() {
  // 假資料，可日後用 props 或 API 替換
  const post = {
    title: '我的貓咪最近不太吃飯，該怎麼辦？',
    author: '小明',
    date: '2024-05-06',
    content: '最近家裡的貓咪突然變得不太愛吃飯，精神也有點差，請問有沒有人遇過類似的情況？有什麼建議嗎？',
    comments: [
      { id: 1, author: '貓奴A', content: '建議先帶去給獸醫檢查喔！' },
      { id: 2, author: '獸醫師B', content: '有可能是腸胃不適，觀察幾天還是沒改善就要就醫。' }
    ]
  };

  return (
    <div className="community-post-page-container">
      <Header />
      <div className="community-post-container">
        <h2 className="post-title">{post.title}</h2>
        <div className="post-meta">
          <span className="post-author">{post.author}</span>
          <span className="post-date">{post.date}</span>
        </div>
        <div className="post-content">{post.content}</div>
        <div className="post-comments-section">
          <h3 className="comments-title">留言</h3>
          {post.comments.map(comment => (
            <div className="comment" key={comment.id}>
              <span className="comment-author">{comment.author}：</span>
              <span className="comment-content">{comment.content}</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNavigationBar />
    </div>
  );
}