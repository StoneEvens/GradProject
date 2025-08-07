import React, { useState, useRef } from 'react';
import axios from '../utils/axios';
import styles from '../styles/PostComments.module.css';
import { useNavigate } from 'react-router-dom';
import { checkUserAccount } from '../services/userService';
import Comment from './Comment';
import ConfirmNotification from './ConfirmNotification';
// Use public assets directly in src attributes
const EditIcon = '/assets/icon/PetpageEditButton.png';
const HeartIcon = '/assets/icon/PostHeart.png';
const HeartFilledIcon = '/assets/icon/PostLiked.png';

//使用方法
//留言系統用於顯示貼文的留言區
//使用PostComments時，請使用<PostComments postID={貼文ID} user={當前使用者} handleClose={關閉函數} />
//提供postID就會自動抓取貼文留言

const PostComments = ({user, postID, handleClose, onCommentCountChange}) => {
    const navigate = useNavigate();
    //React自動幫忙生成的function
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [clickedCommentID, setClickedCommentID] = useState(null);
    const [isCommenting, setIsCommenting] = useState(false);
    const [replyingCommentID, setReplyingCommentID] = useState(null);
    const [replies, setReplies] = useState({});
    const [editingCommentID, setEditingCommentID] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const [editText, setEditText] = useState('');
    const [repliesLoaded, setRepliesLoaded] = useState(false);
    const [replyText, setReplyText] = useState('');
    const fileInputRef = useRef(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, commentId: null });

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
        
        // 檢查是否超過三張圖片限制
        const currentImageCount = selectedImages.length;
        const availableSlots = 3 - currentImageCount;
        
        if (availableSlots <= 0) {
          alert('最多只能選擇 3 張圖片');
          // 清空 input 的值，以便下次選擇
          event.target.value = '';
          return;
        }
        
        // 限制新選擇的圖片數量
        const limitedImageFiles = imageFiles.slice(0, availableSlots);
        
        if (imageFiles.length > availableSlots) {
          alert(`只能再選擇 ${availableSlots} 張圖片，已自動選取前 ${availableSlots} 張`);
        }
        
        // Create preview URLs for the selected images
        const imagePreviewPromises = limitedImageFiles.map(file => {
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
      
      // 清空 input 的值，以便下次選擇相同檔案
      event.target.value = '';
    };

    const removeImage = (imageId) => {
      setSelectedImages(prev => prev.filter(img => img.id !== imageId));
    };

    const handleUserClick = (userInfo) => {
      navigate(`/user/${userInfo.user_account}`);
    };

    const submitComment = async () => {
        // 允許只有圖片沒有文字的留言，或只有文字沒有圖片的留言
        if (commentText.trim() || selectedImages.length > 0) {
        const newComment = await createComment(postID, user, commentText, selectedImages);
        if (newComment) {
            setComments((prevComments) => [...prevComments, newComment]);
            setCommentText('');
            setSelectedImages([]); // 清空選中的圖片
            // 通知父元件留言數增加
            if (onCommentCountChange) {
                onCommentCountChange(1);
            }
        }
        }
    };

    const submitReply = async () => {
        // 允許只有圖片沒有文字的回覆，或只有文字沒有圖片的回覆
        if (commentText.trim() || selectedImages.length > 0) {
            const newReply = await createReply(postID, user, commentText, replyingCommentID, selectedImages);
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
                setCommentText('');
                setSelectedImages([]); // 清空選中的圖片
                setReplyingCommentID(null);
                setIsCommenting(false);
                // 通知父元件留言數增加
                if (onCommentCountChange) {
                    onCommentCountChange(1);
                }
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

    const createComment = async (postID, user, commentText, images = []) => {
        try {
            const formData = new FormData();
            formData.append('content', commentText || '');
            
            // 添加圖片到 FormData
            images.forEach((imageObj) => {
                formData.append('images', imageObj.file);
            });

            const response = await axios.post(`/comments/post/${postID}/comments/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error creating comment:', error);
            return null;
        }
    };

    const createReply = async (postID, user, commentText, parentCommentID, images = []) => {
        try {
            const formData = new FormData();
            formData.append('content', commentText || '');
            
            // 添加圖片到 FormData
            images.forEach((imageObj) => {
                formData.append('images', imageObj.file);
            });

            const response = await axios.post(`/comments/comments/${parentCommentID}/replies/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
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


      // Leave edit mode
      setEditingCommentID(null);
      setEditText('');

      return response.data;
      } catch (error) {
      console.error('Error updating comment:', error);
      return null;
      }
    };

    const handleDeleteClick = (commentID) => {
      setDeleteConfirm({ show: true, commentId: commentID });
    };

    const deleteComment = async () => {
      const commentID = deleteConfirm.commentId;
      if (!commentID) return;
      
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
          comment.id === commentID ? { 
            ...comment, 
            content: "[此評論已刪除]",
            images: [] // 清空圖片數據
          } : comment
          )
        );
        
        // 同時更新 replies 狀態中的對應回覆
        setReplies(prevReplies => {
          const newReplies = { ...prevReplies };
          Object.keys(newReplies).forEach(parentID => {
            newReplies[parentID] = newReplies[parentID].map(reply => {
              if (reply.id === commentID) {
                return { 
                  ...reply, 
                  content: "[此評論已刪除]",
                  images: [] // 清空圖片數據
                };
              }
              return reply;
            });
          });
          return newReplies;
        });
        }

        setDeleteConfirm({ show: false, commentId: null });
      } catch (error) {
        console.error('Error deleting comment:', error);
        setDeleteConfirm({ show: false, commentId: null });
        
        // 顯示錯誤訊息給使用者
        alert('刪除留言時發生錯誤，請稍後再試');
      }
    };

    const likeComment = async (commentID) => {
        try {
          // 先保存原始狀態以便回滾
          let originalComment;
          
          // 立即更新 UI - 包含isLiked狀態和likes數量
            setComments(prevComments => 
              prevComments.map(comment => {
                if (comment.id === commentID) {
                  originalComment = { ...comment };
                  return { 
                    ...comment, 
                    isLiked: !comment.isLiked,
                    likes: comment.isLiked ? (comment.likes || 0) - 1 : (comment.likes || 0) + 1
                  };
                }
                return comment;
              })
            );

          // 同時更新回覆中的評論
          setReplies(prevReplies => {
            const newReplies = { ...prevReplies };
            Object.keys(newReplies).forEach(parentID => {
              newReplies[parentID] = newReplies[parentID].map(reply => {
                if (reply.id === commentID) {
                  return { 
                    ...reply, 
                    isLiked: !reply.isLiked,
                    likes: reply.isLiked ? (reply.likes || 0) - 1 : (reply.likes || 0) + 1
                  };
                }
                return reply;
              });
            });
            return newReplies;
          });

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
                ? { ...comment, isLiked: !comment.isLiked, likes: comment.isLiked ? (comment.likes || 0) + 1 : (comment.likes || 0) - 1 }
                : comment
            )
          );


          // 恢復回覆中的評論狀態
          setReplies(prevReplies => {
            const newReplies = { ...prevReplies };
            Object.keys(newReplies).forEach(parentID => {
              newReplies[parentID] = newReplies[parentID].map(reply => {
                if (reply.id === commentID) {
                  return { 
                    ...reply, 
                    isLiked: !reply.isLiked,
                    likes: reply.isLiked ? (reply.likes || 0) + 1 : (reply.likes || 0) - 1
                  };
                }
                return reply;
              });
            });
            return newReplies;
          });
          
          console.error('貼文互動錯誤:', error);
          return {
            success: false,
            error: error.response?.data?.detail || error.message || '操作失敗'
          };
        }
    };

    const displayReply = async (commentID) => {
        if (clickedCommentID === commentID) {
            // 隱藏回覆，但不清空 replies 數據
            setClickedCommentID(null);
        } else {
            // 展開回覆
            setClickedCommentID(commentID);
            // 如果還沒有載入過回覆，則載入
            if (!replies[commentID] || replies[commentID].length === 0) {
                const fetchedReplies = await fetchReplies(commentID);
                setReplies(prev => ({
                    ...prev,
                    [commentID]: fetchedReplies || []
                }));
            }
        }
    };

    const toggleIsCommenting = async (commentID) => {
        if (replyingCommentID === commentID) {
            // 如果正在回覆這個留言，則取消回覆
            setIsCommenting(false);
            setReplyingCommentID(null);
            setCommentText('');
        } else {
            // 開始回覆這個留言，但不自動展開既有回覆
            setIsCommenting(true);
            setReplyingCommentID(commentID);
            setCommentText('');
            // 不自動設置 clickedCommentID，避免展開回覆
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
                
                // 為每個留言檢查是否有回覆
                const repliesMap = {};
                for (const comment of fetchedComments) {
                    try {
                        const commentReplies = await fetchReplies(comment.id);
                        repliesMap[comment.id] = commentReplies || [];
                    } catch (error) {
                        console.error(`獲取留言 ${comment.id} 回覆失敗:`, error);
                        repliesMap[comment.id] = [];
                    }
                }
                setReplies(repliesMap);
                setRepliesLoaded(true);
            }
        };

        loadComments();
    }, [postID]);

    if (!postID) {
        return null;
    }

    return (
    <div className={styles.modalOverlay} onClick={() => handleClose()}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <h2>留言區</h2>
          </div>
          <button className={styles.closeButton} onClick={() => handleClose()}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={`${styles.commentsContainer} ${comments.length === 0 ? styles.empty : ''}`}>
            {comments.length === 0 ? (
              <div className={styles.commentBlock}>
                <p>目前沒有任何留言</p>
              </div>
            ) : (
              comments.map((comment) => (
                <React.Fragment key={comment.id}>
                  <Comment
                    comment={comment}
                    type="normal"
                    onLike={likeComment}
                    onReply={toggleIsCommenting}
                    onShowReplies={displayReply}
                    onDelete={handleDeleteClick}
                    onReport={(commentId) => {
                      console.log('檢舉留言:', commentId);
                      alert('檢舉功能尚未實作');
                    }}
                    currentUser={user}
                    showingReplies={clickedCommentID === comment.id}
                    isReplying={replyingCommentID === comment.id}
                    hasReplies={repliesLoaded && Array.isArray(replies[comment.id]) && replies[comment.id].length > 0}
                  />
                  
                  {clickedCommentID === comment.id && replies[comment.id] && (
                    <div className={styles.repliesContainer}>
                      {replies[comment.id].map((reply) => (
                        <Comment
                          key={reply.id}
                          comment={reply}
                          type="reply"
                          onLike={likeComment}
                          onDelete={handleDeleteClick}
                          onReport={(commentId) => {
                            console.log('檢舉留言:', commentId);
                            alert('檢舉功能尚未實作');
                          }}
                          currentUser={user}
                        />
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
        <div className={styles.commentInputSection}>
          {replyingCommentID && (
            <div className={styles.replyingIndicator}>
              <span className={styles.replyingText}>
                正在回覆 {comments.find(c => c.id === replyingCommentID)?.user?.username || '用戶'}
              </span>
              <button 
                className={styles.cancelReplyBtn}
                onClick={() => {
                  setReplyingCommentID(null);
                  setIsCommenting(false);
                  setCommentText('');
                }}
              >
                ×
              </button>
            </div>
          )}
          
          {/* 圖片預覽區域 */}
          {selectedImages.length > 0 && (
            <div className={styles.imagePreviewContainer}>
              {selectedImages.map((image) => (
                <div key={image.id} className={styles.imagePreviewItem}>
                  <img src={image.preview} alt="預覽" className={styles.previewImage} />
                  <button 
                    className={styles.removeImageBtn}
                    onClick={() => removeImage(image.id)}
                    title="移除圖片"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className={styles.inputContainer}>
            <div className={styles.inputUserAvatar}>
              <img 
                src={user?.headshot_url || "/assets/icon/DefaultUser.png"} 
                alt={user?.username || "User"}
                onError={(e) => {
                  if (e.target.src !== "/assets/icon/DefaultUser.png") {
                    e.target.src = "/assets/icon/DefaultUser.png";
                  }
                }}
              />
            </div>
            <textarea
              placeholder={replyingCommentID ? '撰寫回覆...' : '撰寫留言...'}
              className={styles.inputTextarea}
              value={commentText}
              onChange={handleCommentChange}
            />
            <div className={styles.inputActions}>
              <button 
                className={`${styles.photoBtn} ${selectedImages.length >= 3 ? styles.disabled : ''}`}
                onClick={selectedImages.length >= 3 ? undefined : handleImageSelect}
                disabled={selectedImages.length >= 3}
                title={selectedImages.length >= 3 ? "已達圖片上限 (3張)" : `新增圖片 (${selectedImages.length}/3)`}
              >
                <img src="/assets/icon/CommentPhotoIcon.png" alt="新增圖片" />
              </button>
              <button 
                className={styles.sendBtn} 
                onClick={replyingCommentID ? submitReply : submitComment}
                title={replyingCommentID ? "送出回覆" : "送出留言"}
              >
                <img src="/assets/icon/CommentSendIcon.png" alt={replyingCommentID ? "送出回覆" : "送出留言"} />
              </button>
            </div>
          </div>
          
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      </div>
      {deleteConfirm.show && (
        <ConfirmNotification
          message="確定要刪除這則留言嗎？"
          onConfirm={deleteComment}
          onCancel={() => setDeleteConfirm({ show: false, commentId: null })}
        />
      )}
    </div>
    );
};

export default PostComments;