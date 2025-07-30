import React, { useState, useRef } from 'react';
import axios from '../utils/axios';
import '../styles/PostComments.css';
import { useNavigate } from 'react-router-dom';
import { checkUserAccount } from '../services/userService';
import EditIcon from '../../public/assets/icon/PetpageEditButton.png';
import HeartIcon from '../../public/assets/icon/PostHeart.png';
import HeartFilledIcon from '../../public/assets/icon/PostLiked.png';

//使用方法
//留言系統我整個是做在一起的，包含貼文留言預覽的兩個留言、留言區的留言、回覆
//
//當使用PostComments作為貼文留言預覽時，請使用<PostComments previewComments={[來自後端或自行建立的comments陣列]} (去掉大括號)/>
//
//當使用PostComments作為貼文留言區時，請使用<PostComments postID={貼文ID} (去掉大括號)/>
//
//若要更改PostComments的Comments內容時，請使用setComments([新的comments陣列])
//若要更改PostComments的PreviewComments內容時，請使用setLocalPreviewComments([新的comments陣列])
//第一層就是留言區，有回覆按鈕可以回覆的就是第一層，提供postID就會自動抓取貼文留言
//第二層和貼文留言預覽是同一個系統，需要提供完整的留言/回覆陣列，被動顯示，不會自動抓取
//不論是日常發文或是論壇發文又或是留言全部都是Interactables，所以以上三種的ID不會撞到，只要在以上類別的前端底下照上述給入PostID即可

const PostComments = ({user, postID, previewComments, handleClose}) => {
    const navigate = useNavigate();
    //React自動幫忙生成的function
    const [comments, setComments] = useState([]);
    const [localPreviewComments, setLocalPreviewComments] = useState(previewComments || []);
    const [commentText, setCommentText] = useState('');
    const [clickedCommentID, setClickedCommentID] = useState(null);
    const [isCommenting, setIsCommenting] = useState(false);
    const [replyingCommentID, setReplyingCommentID] = useState(null);
    const [replies, setReplies] = useState({});
    const [editingCommentID, setEditingCommentID] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const [editText, setEditText] = useState('');
    const [replyText, setReplyText] = useState('');
    const fileInputRef = useRef(null);

    const handleCommentChange = (event) => {
        setCommentText(event.target.value);
    };

    const handleReplyChange = (event) => {
        setReplyText(event.target.value);
    };

    const handleImageSelect = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        // Create preview URLs for the selected images
        const imagePreviewPromises = imageFiles.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
              file,
              preview: e.target.result,
              id: Date.now() + Math.random()
            });
            reader.readAsDataURL(file);
          });
        });
        
        Promise.all(imagePreviewPromises).then(imagePreviews => {
          setSelectedImages(prev => [...prev, ...imagePreviews]);
        });
      }
    };

    const removeImage = (imageId) => {
      setSelectedImages(prev => prev.filter(img => img.id !== imageId));
    };

    const handleUserClick = (userInfo) => {
      navigate(`/user/${userInfo.user_account}`);
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

    const likeComment = async (commentID) => {
        try {
          // 立即更新 UI
          if (postID) {
            setComments(prevComments => 
              prevComments.map(comment => 
                comment.id === commentID 
                  ? { ...comment, isLiked: !comment.isLiked }
                  : comment
              )
            );
          }

          if (previewComments) {
            // 使用 setLocalPreviewComments 來更新狀態
            setLocalPreviewComments(prevComments => 
              prevComments.map(comment => 
                comment.id === commentID 
                  ? { ...comment, isLiked: !comment.isLiked }
                  : comment
              )
            );
          }

          const response = await axios.post(`/interactions/comments/${commentID}/interaction/`, {
            relation: 'liked'  // 發送 'liked' 來切換按讚狀態
          });
    
          const result = response.data;

          return {
            success: true,
            data: result.data,
            message: result.detail || '操作成功'
          };
        } catch (error) {
          // 發生錯誤時恢復原始狀態
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === commentID 
                ? { ...comment, isLiked: !comment.isLiked }
                : comment
            )
          );
          
          console.error('貼文互動錯誤:', error);
          return {
            success: false,
            error: error.response?.data?.detail || error.message || '操作失敗'
          };
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
                setLocalPreviewComments(previewComments);
            }
        };

        loadComments();
    }, [postID, previewComments]);

    return postID ? (
    <div className="modalOverlay" onClick={() => handleClose()}>
      <div className="modalContainer" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2>留言區</h2>
          <button className="closeButton" onClick={() => handleClose()}>×</button>
        </div>
        <div className="modalBody">
          <div className={`comments-container ${comments.length === 0 ? 'empty' : ''}`}>
            {comments.length === 0 ? (
              <div className='comment-block'>
                <p>目前沒有任何留言</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div className="comment-block">
                  <div className="comment-header">
                    <strong onClick={() => handleUserClick(comment.user)}>{comment.user.username}</strong>
                    <div className="comment-header-info">
                      <span className="comment-date">{new Date(comment.created_at).toLocaleDateString()}</span>
                      {comment.content !== "[此評論已刪除]" && (
                        <button 
                          className="like-button" 
                          onClick={() => comment.isAuthor ? startEditing(comment) : likeComment(comment.id)}
                          title={comment.isAuthor ? (editingCommentID === comment.id ? '取消' : '編輯') : (comment.isLiked ? '取消點讚' : '點讚')}
                        >
                          <div className="icon-container">
                            {comment.isAuthor ? (
                              editingCommentID === comment.id ? (
                                <span className="close-icon">×</span>
                              ) : (
                                <img src={EditIcon} alt="編輯" className="action-icon" />
                              )
                            ) : (
                              <img 
                                src={comment.isLiked ? HeartFilledIcon : HeartIcon} 
                                alt={comment.isLiked ? '取消點讚' : '點讚'} 
                                className="action-icon" 
                              />
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                  {editingCommentID === comment.id ? (
                    <div className="edit-container">
                      <textarea
                        placeholder='編輯留言...'
                        className="comment-input edit-textarea"
                        value={editText}
                        onChange={handleEditChange}
                      />
                      <div className="button-group">
                        <button className="submit-comment-button" onClick={() => deleteComment(comment.id)}>刪除</button>
                        <button className="submit-comment-button" onClick={() => updateComment(comment.id, editText)}>儲存</button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-text">{comment.content}</p>
                  )}
                  <div className="comment-actions">
                    <button className='show-replies-button' onClick={() => displayReply(comment.id)}>{clickedCommentID === comment.id ? '隱藏回覆' : '顯示回覆'}</button>
                    <button className="reply-button" onClick={() => toggleIsCommenting(comment.id)}>{replyingCommentID === comment.id ? '取消回覆' : '回覆'}</button>
                  </div>

                  {replyingCommentID === comment.id && isCommenting ? (
                    <div className="reply-container">
                      <textarea
                        placeholder='撰寫回復...'
                        className="comment-input reply-textarea"
                        value={replyText}
                        onChange={handleReplyChange}
                      />
                      <div className="button-group">
                        <button className="submit-comment-button" onClick={() => console.log('新增圖片')}>新增圖片</button>
                        <button className="submit-comment-button" onClick={submitReply}>回覆</button>
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
              placeholder='撰寫留言...'
              className="comment-input"
              value={commentText}
              onChange={handleCommentChange}
            ></textarea>
            <div className="button-group">
              <button className="submit-comment-button" onClick={() => console.log('新增圖片')}>新增圖片</button>
              <button className="submit-comment-button" onClick={submitComment}>送出留言</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="comments-container">
      {!localPreviewComments || localPreviewComments.length === 0 ? (
      <p>目前沒有任何內容</p>
      ) : (
      localPreviewComments.map((comment) => (
        <div key={comment.id} className="comment-block">
        <div className="comment-header">
          <strong onClick={() => handleUserClick(comment.user)}>{comment.user.username}</strong>
          <div className="comment-header-info">
            <span className="comment-date">{new Date(comment.created_at).toLocaleDateString()}</span>
            {comment.content !== "[此評論已刪除]" && (
              <button 
                className="like-button" 
                onClick={() => comment.isAuthor ? startEditing(comment) : likeComment(comment.id)}
                title={comment.isAuthor ? (editingCommentID === comment.id ? '取消' : '編輯') : (comment.isLiked ? '取消點讚' : '點讚')}
              >
                <div className="icon-container">
                  {comment.isAuthor ? (
                    editingCommentID === comment.id ? (
                      <span className="close-icon">×</span>
                    ) : (
                      <img src={EditIcon} alt="編輯" className="action-icon" />
                    )
                  ) : (
                    <img 
                      src={comment.isLiked ? HeartFilledIcon : HeartIcon} 
                      alt={comment.isLiked ? '取消點讚' : '點讚'} 
                      className="action-icon" 
                    />
                  )}
                </div>
              </button>
            )}
          </div>
        </div>
        {editingCommentID === comment.id ? (
          <div className="edit-container">
            <textarea
              placeholder='編輯留言...'
              className="comment-input edit-textarea"
              value={editText}
              onChange={handleEditChange}
            />
            <div className="button-group">
              <button className="submit-comment-button" onClick={() => deleteComment(comment.id)}>刪除</button>
              <button className="submit-comment-button" onClick={() => updateComment(comment.id, editText)}>儲存</button>
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