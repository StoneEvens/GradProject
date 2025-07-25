import React, { useState, useRef } from 'react';
import axios from '../utils/axios';
import '../styles/PostComments.css';
import { checkUserAccount } from '../services/userService';

const PostComments = ({user, isOpen, postID, previewComments, handleClose}) => {
    //自己定義要幹嘛的function

    const fetchComments = async (postID) => {
        try {
            const response = await axios.get(`/comments/post/${postID}/comments`, {
                headers: {
                    'Accept': 'application/json',
                },
            });
            return response.data.results || [];
        } catch (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
    };

    const createComment = async (postID, user, commentText) => {
        try {
            const response = await axios.post(`/comments/post/${postID}/comments/`, {
                user,
                postID,
                content: commentText,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error creating comment:', error);
            return null;
        }
    };

    //React自動幫忙生成的function
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');

    const handleCommentChange = (event) => {
        setCommentText(event.target.value);
    };

    const submitComment = async () => {
        if (commentText.trim()) {
        const newComment = await createComment(postID, user, commentText);
        if (newComment) {
            setComments((prevComments) => [...prevComments, newComment]);
            setCommentText('');
        }
        }
    };

    

    //使用React生成的function要在這邊使用
    //每當postID更新時就會重新載入評論
    React.useEffect(() => {
        const loadComments = async () => {
            if (postID) {
                const fetchedComments = await fetchComments(postID);
                setComments(fetchedComments);
            } else if (previewComments) {
                setComments(previewComments);
            }
        };

        loadComments();
    }, [postID]);

    if (!isOpen) {
        return null;
    }

    return postID ? (
      <div className="modalOverlay" onClick={() => handleClose()}>
        <div className="modalContainer" onClick={(e) => e.stopPropagation()}>
          <div className="modalHeader">
            <h2>Comments for Post {postID}</h2>
            <button className="closeButton" onClick={() => handleClose()}>×</button>
          </div>
          <div className="modalBody">
            <div className={`comments-container ${comments.length === 0 ? 'empty' : ''}`}>
              {comments.length === 0 ? (
                <div className='comment-block'>
                  <p>No comments available.</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div className="comment-block">
                    <div className="comment-header">
                      <strong>{comment.user.username}</strong>
                      <span className="comment-date">{new Date(comment.post_date).toLocaleDateString()}</span>
                    </div>
                    <p className="comment-text">{comment.content}</p>
                    <div className="comment-actions">
                      <button className='show-replies-button'>Show Replies</button>
                      <button className="reply-button">Reply</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="modalFooter">
            <div className="new-comment">
              <textarea
                placeholder="Write a comment..."
                className="comment-input"
                value={commentText}
                onChange={handleCommentChange}
              ></textarea>
              <button className="submit-comment-button" onClick={submitComment}>
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="comments-container">
        <h2>Comments</h2>
        {comments.length === 0 ? (
          <p>No comments available.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-block">
              <div className="comment-header">
                <strong>{comment.user.username}</strong>
                <span className="comment-date">{new Date(comment.post_date).toLocaleDateString()}</span>
              </div>
              <p className="comment-text">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    );
};

export default PostComments;