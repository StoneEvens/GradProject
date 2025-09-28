import React from 'react';
import styles from '../styles/ChatSidebar.module.css';
import { loadConversations, deleteConversation, clearAllConversations, formatConversationTime } from '../utils/chatStorage';

const ChatSidebar = ({ isOpen, onClose, currentConversationId, onConversationSelect, onNewConversation }) => {
  const [conversations, setConversations] = React.useState([]);

  React.useEffect(() => {
    if (isOpen) {
      const loadedConversations = loadConversations();
      setConversations(loadedConversations);
    }
  }, [isOpen]);

  const handleConversationClick = (conversation) => {
    onConversationSelect(conversation);
    onClose();
  };

  const handleDeleteConversation = (conversationId, event) => {
    event.stopPropagation();
    const success = deleteConversation(conversationId);
    if (success) {
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    }
  };

  const handleClearAll = () => {
    const success = clearAllConversations();
    if (success) {
      setConversations([]);
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
        {conversations.length === 0 ? (
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