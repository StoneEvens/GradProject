import React, { useState, useRef } from 'react';
import axios from '../utils/axios';
import '../styles/PostComments.css';
import { checkUserAccount } from '../services/userService';

const PostComments = ({user, postID, previewComments, handleClose}) => {
    //React自動幫忙生成的function
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [clickedCommentID, setClickedCommentID] = useState(null);
    const [isCommenting, setIsCommenting] = useState(false);
    const [replyingCommentID, setReplyingCommentID] = useState(null);
    const [replies, setReplies] = useState({});
    const [editingCommentID, setEditingCommentID] = useState(null);
    const [editText, setEditText] = useState('');
    const [replyText, setReplyText] = useState('');

    const handleCommentChange = (event) => {
        setCommentText(event.target.value);
    };

    const handleReplyChange = (event) => {
        setReplyText(event.target.value);
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

    const submitReply = async () => {
        if (replyText.trim()) {
            const newReply = await createReply(postID, user, replyText, replyingCommentID);
            if (newReply) {
                setComments((prevComments) =>
                    prevComments.map((comment) =>
                        comment.id === replyingCommentID
                            ? { ...comment, replies: [...(comment.replies || []), newReply] }
                            : comment
                    )
                );
                // Also update the replies state
                setReplies(prev => ({
                    ...prev,
                    [replyingCommentID]: [...(prev[replyingCommentID] || []), newReply]
                }));
                setReplyText('');
                setReplyingCommentID(null);
                setIsCommenting(false);
            }
        }
    };

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

    const fetchReplies = async (commentID) => {
      if (!commentID) return [];

      try {
        const response = await axios.get(`/comments/comments/${commentID}/replies/`, {
          headers: {
            'Accept': 'application/json',
          },
        });
        return response.data.results || [];
      } catch (error) {
        console.error('Error fetching replies:', error);
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

    const createReply = async (postID, user, commentText, parentCommentID) => {
        try {
            const response = await axios.post(`/comments/comments/${parentCommentID}/replies/`, {
                user,
                postID,
                content: commentText,
                comment_id: parentCommentID,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error creating reply:', error);
            return null;
        }
    };

    const updateComment = async (commentID, updatedContent) => {
      try {
      const response = await axios.put(`/comments/comments/${commentID}/`, {
        content: updatedContent,
      }, {
        headers: {
        'Content-Type': 'application/json',
        },
      });

      // Update the comment in the state
      if (postID) {
        setComments((prevComments) =>
          prevComments.map((comment) =>
          comment.id === commentID ? { ...comment, content: updatedContent } : comment
          )
        );
      }

      // Update the comment in the previewComments if available
      if (previewComments) {
        previewComments.forEach((comment) => {
          if (comment.id === commentID) {
            comment.content = updatedContent;
          }
        });
      }

      // Leave edit mode
      setEditingCommentID(null);
      setEditText('');

      return response.data;
      } catch (error) {
      console.error('Error updating comment:', error);
      return null;
      }
    };

    const deleteComment = async (commentID) => {
      try {
        await axios.delete(`/comments/comments/${commentID}/`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        setEditingCommentID(null);
        setEditText('');

        if (postID) {
          setComments((prevComments) =>
          prevComments.map((comment) =>
          comment.id === commentID ? { ...comment, content: "[此評論已刪除]" } : comment
          )
        );
        }

        if (previewComments) {
          previewComments.forEach((comment) => {
            if (comment.id === commentID) {
              comment.content = "[此評論已刪除]";
            }
          });
        }


      } catch (error) {
        console.error('Error deleting comment:', error);
      }
    };

    const displayReply = async (commentID) => {
        if (clickedCommentID === commentID) {
            setClickedCommentID(null);
            setReplies([]);
        } else {
            setClickedCommentID(commentID);
            // Fetch replies when showing them
            if (!replies[commentID]) {
                const fetchedReplies = await fetchReplies(commentID);
                setReplies(prev => ({
                    ...prev,
                    [commentID]: fetchedReplies
                }));
            }
        }
    };

    const toggleIsCommenting = async (commentID) => {
        if (isCommenting) {
            setIsCommenting(false);
            setReplyingCommentID(null);
        } else {
            setIsCommenting(true);
            setReplyingCommentID(commentID);
            setClickedCommentID(commentID);
            // Fetch replies when showing them
            if (!replies[commentID]) {
                const fetchedReplies = await fetchReplies(commentID);
                setReplies(prev => ({
                    ...prev,
                    [commentID]: fetchedReplies
                }));
            }
        }
    };

    const startEditing = (comment) => {
        if (editingCommentID === comment.id) {
            // If already editing this comment, stop editing
            setEditingCommentID(null);
            setEditText('');
        } else {
            // Start editing this comment
            setEditingCommentID(comment.id);
            setEditText(comment.content);
            console.log('Editing comment:', comment.id);
        }
    };

    const handleEditChange = (event) => {
        setEditText(event.target.value);
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span className="comment-date">{new Date(comment.post_date).toLocaleDateString()}</span>
                      {comment.content !== "[此評論已刪除]" && (
                        <button className="like-button" onClick={() => comment.isAuthor ? startEditing(comment) : console.log('Like button clicked')}>
                          {comment.isAuthor ? (editingCommentID === comment.id ? 'Cancel' : 'Edit') : 'Like'}
                        </button>
                      )}
                    </div>
                  </div>
                  {editingCommentID === comment.id ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <textarea
                        placeholder='Edit your comment...'
                        className="comment-input"
                        value={editText}
                        onChange={handleEditChange}
                        style={{ flex: 1, minHeight: '80px', resize: 'none' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <button className="submit-comment-button" onClick={() => deleteComment(comment.id)}>Delete</button>
                        <button className="submit-comment-button" onClick={() => updateComment(comment.id, editText)}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-text">{comment.content}</p>
                  )}
                  <div className="comment-actions">
                    <button className='show-replies-button' onClick={() => displayReply(comment.id)}>{clickedCommentID === comment.id ? 'Hide Replies' : 'Show Replies'}</button>
                    <button className="reply-button" onClick={() => toggleIsCommenting(comment.id)}>{replyingCommentID === comment.id ? 'Cancel Reply' : 'Reply'}</button>
                  </div>

                  {replyingCommentID === comment.id && isCommenting ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginTop: '10px' }}>
                      <textarea
                        placeholder='Write your reply...'
                        className="comment-input"
                        value={replyText}
                        onChange={handleReplyChange}
                        style={{ flex: 1, minHeight: '80px', resize: 'none' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <button className="submit-comment-button" onClick={submitReply}>Reply</button>
                      </div>
                    </div>
                  ) : null}

                  {clickedCommentID === comment.id ? <PostComments
                    previewComments={replies[comment.id] || []}
                  /> : null}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="modalFooter">
          <div className="new-comment">
            <textarea
              placeholder='Write a comment...'
              className="comment-input"
              value={commentText}
              onChange={handleCommentChange}
            ></textarea>
            <button className="submit-comment-button" onClick={submitComment}>
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="comments-container">
      {!previewComments || previewComments.length === 0 ? (
      <p>No comments available.</p>
      ) : (
      previewComments.map((comment) => (
        <div key={comment.id} className="comment-block">
        <div className="comment-header">
          <strong>{comment.user.username}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="comment-date">{new Date(comment.post_date).toLocaleDateString()}</span>
            {comment.content !== "[此評論已刪除]" && (
              <button className="like-button" onClick={() => comment.isAuthor ? startEditing(comment) : console.log('Like button clicked')}>
                {comment.isAuthor ? (editingCommentID === comment.id ? 'Cancel' : 'Edit') : 'Like'}
              </button>
            )}
          </div>
        </div>
        {editingCommentID === comment.id ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              placeholder='Edit your comment...'
              className="comment-input"
              value={editText}
              onChange={handleEditChange}
              style={{ flex: 1, minHeight: '80px', resize: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button className="submit-comment-button" onClick={() => deleteComment(comment.id)}>Delete</button>
              <button className="submit-comment-button" onClick={() => updateComment(comment.id, editText)}>Save</button>
            </div>
          </div>
        ) : (
          <p className="comment-text">{comment.content}</p>
        )}
        </div>
      ))
      )}
    </div>
  );
};

export default PostComments;