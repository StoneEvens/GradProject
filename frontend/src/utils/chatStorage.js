// 聊天記錄本地儲存管理工具

const STORAGE_KEY = 'chat_conversations';
const MAX_CONVERSATIONS = 5;

// 生成對話標題（基於第一個用戶訊息）
const generateConversationTitle = (messages) => {
  const firstUserMessage = messages.find(msg => msg.isUser);
  if (firstUserMessage) {
    const title = firstUserMessage.text.substring(0, 20);
    return title.length < firstUserMessage.text.length ? title + '...' : title;
  }
  return '新對話';
};

// 儲存對話記錄
export const saveConversation = (messages) => {
  if (!messages || messages.length === 0) return;

  try {
    const conversations = loadConversations();
    const newConversation = {
      id: Date.now(),
      title: generateConversationTitle(messages),
      messages: messages,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // 添加新對話到開頭
    conversations.unshift(newConversation);

    // 保持最多 5 筆記錄
    if (conversations.length > MAX_CONVERSATIONS) {
      conversations.splice(MAX_CONVERSATIONS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return newConversation.id;
  } catch (error) {
    console.error('儲存對話記錄失敗:', error);
    return null;
  }
};

// 更新現有對話記錄
export const updateConversation = (conversationId, messages) => {
  if (!conversationId || !messages || messages.length === 0) return;

  try {
    const conversations = loadConversations();
    const index = conversations.findIndex(conv => conv.id === conversationId);

    if (index !== -1) {
      conversations[index] = {
        ...conversations[index],
        title: generateConversationTitle(messages),
        messages: messages,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  } catch (error) {
    console.error('更新對話記錄失敗:', error);
  }
};

// 載入所有對話記錄
export const loadConversations = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('載入對話記錄失敗:', error);
    return [];
  }
};

// 載入特定對話記錄
export const loadConversation = (conversationId) => {
  try {
    const conversations = loadConversations();
    return conversations.find(conv => conv.id === conversationId) || null;
  } catch (error) {
    console.error('載入特定對話記錄失敗:', error);
    return null;
  }
};

// 刪除對話記錄
export const deleteConversation = (conversationId) => {
  try {
    const conversations = loadConversations();
    const filteredConversations = conversations.filter(conv => conv.id !== conversationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredConversations));
    return true;
  } catch (error) {
    console.error('刪除對話記錄失敗:', error);
    return false;
  }
};

// 清除所有對話記錄
export const clearAllConversations = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('清除所有對話記錄失敗:', error);
    return false;
  }
};

// 格式化時間顯示
export const formatConversationTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now - date;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (diffInDays === 1) {
    return '昨天';
  } else if (diffInDays < 7) {
    return `${diffInDays}天前`;
  } else {
    return date.toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric'
    });
  }
};