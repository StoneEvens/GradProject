import React from 'react';
import styles from '../styles/ChatSidebar.module.css';
import aiChatService from '../services/aiChatService';

// 格式化對話時間
const formatConversationTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '剛剛';
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const ChatSidebar = ({ isOpen, onClose, currentConversationId, onConversationSelect, onNewConversation }) => {
  const [conversations, setConversations] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // 從後端載入對話列表
  React.useEffect(() => {
    if (isOpen) {
      loadConversationsFromAPI();
    }
  }, [isOpen]);

  const loadConversationsFromAPI = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiChatService.getConversations({ archived: false });

      // 處理多種 API 響應格式：
      // 1. 自定義 APIResponse: { success: true, data: [...] }
      // 2. DRF 直接陣列: [{...}, {...}]
      // 3. DRF 分頁格式: { results: [{...}], count: 10 }
      let conversationList = [];

      if (response && response.success && response.data) {
        // 自定義 APIResponse 格式
        if (Array.isArray(response.data)) {
          conversationList = response.data;
        } else if (Array.isArray(response.data.results)) {
          conversationList = response.data.results;
        } else {
          console.error('未預期的 API 響應格式:', response);
          throw new Error('API 返回格式錯誤');
        }
      } else if (Array.isArray(response)) {
        // DRF 直接陣列
        conversationList = response;
      } else if (response && Array.isArray(response.results)) {
        // DRF 分頁格式
        conversationList = response.results;
      } else if (response && response.data && Array.isArray(response.data)) {
        // 其他包裹格式
        conversationList = response.data;
      } else {
        console.error('未預期的 API 響應格式:', response);
        throw new Error('API 返回格式錯誤');
      }

      // 將後端格式轉換為前端格式
      const formattedConversations = conversationList.map(conv => ({
        id: conv.id,
        title: conv.title || '新對話',
        lastUpdated: conv.updated_at || conv.last_message_at || conv.created_at,
        messages: [], // 稍後載入完整訊息時會填充
        messageCount: conv.message_count || 0,
        isPinned: conv.is_pinned || false,
        isArchived: conv.is_archived || false,
        lastMessagePreview: conv.last_message_preview || null
      }));

      // 按照更新時間排序（最新的在前）
      formattedConversations.sort((a, b) =>
        new Date(b.lastUpdated) - new Date(a.lastUpdated)
      );

      // 限制最多顯示 5 條歷史記錄
      const limitedConversations = formattedConversations.slice(0, 5);

      setConversations(limitedConversations);
    } catch (error) {
      console.error('載入對話列表失敗:', error);
      console.error('錯誤詳情:', error.response || error);
      setError('載入對話失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversation) => {
    onConversationSelect(conversation);
    onClose();
  };

  const handleDeleteConversation = async (conversationId, event) => {
    event.stopPropagation();
    try {
      await aiChatService.deleteConversation(conversationId);
      // 從列表中移除已刪除的對話
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (error) {
      console.error('刪除對話失敗:', error);
      setError('刪除對話失敗，請稍後再試');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('確定要刪除所有對話記錄嗎？此操作無法撤銷。')) {
      return;
    }

    try {
      // 批量刪除所有對話
      const deletePromises = conversations.map(conv =>
        aiChatService.deleteConversation(conv.id)
      );
      await Promise.all(deletePromises);
      setConversations([]);
    } catch (error) {
      console.error('清除所有對話失敗:', error);
      setError('清除對話失敗，請稍後再試');
    }
  };

  const handleNewConversation = () => {
    onNewConversation();
    onClose();
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>聊天記錄</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.actions}>
        <button className={styles.newChatButton} onClick={handleNewConversation}>
          + 新對話
        </button>
      </div>

      <div className={styles.conversationList}>
        {loading ? (
          <div className={styles.loadingState}>
            <p>載入中...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button onClick={loadConversationsFromAPI} className={styles.retryButton}>
              重試
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className={styles.emptyState}>
            <p>還沒有聊天記錄</p>
          </div>
        ) : (
          conversations.map(conversation => (
            <div
              key={conversation.id}
              className={`${styles.conversationItem} ${
                conversation.id === currentConversationId ? styles.active : ''
              }`}
              onClick={() => handleConversationClick(conversation)}
            >
              <div className={styles.conversationContent}>
                <div className={styles.conversationTitle}>
                  {conversation.title}
                  {conversation.messageCount > 0 && (
                    <span className={styles.messageCount}> ({conversation.messageCount})</span>
                  )}
                </div>
                <div className={styles.conversationTime}>
                  {formatConversationTime(conversation.lastUpdated)}
                </div>
              </div>
              <button
                className={styles.deleteButton}
                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                title="刪除對話"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {conversations.length > 0 && (
        <div className={styles.footer}>
          <button className={styles.clearAllButton} onClick={handleClearAll}>
            清除所有記錄
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;