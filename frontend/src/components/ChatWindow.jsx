import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ChatWindow.module.css';
import aiChatService from '../services/aiChatService';

const ChatWindow = ({ isOpen, onClose, user }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi！我是 PETer 專員 Peter，很高興為您服務！有什麼問題都可以問我喔～",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userAvatarError, setUserAvatarError] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 自動滾動到最新訊息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 當用戶改變時重置頭像錯誤狀態
  useEffect(() => {
    setUserAvatarError(false);
  }, [user?.headshot_url]);

  // 當聊天框開啟時禁用背景滾動
  useEffect(() => {
    if (isOpen) {
      // 保存原始的 overflow 樣式
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // 清理函數：恢復原始樣式
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 處理輸入變化
  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  // 處理按鍵事件
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // 發送訊息
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    const userInput = inputText; // 保存輸入內容

    // 添加用戶訊息
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // 使用 AI 聊天服務處理訊息
      const aiResult = await aiChatService.processMessage(userInput);

      // 模擬真實的回應時間
      const delay = 800 + Math.random() * 1500; // 0.8-2.3秒

      setTimeout(() => {
        const aiMessage = {
          id: Date.now() + 1,
          text: aiResult.response,
          isUser: false,
          timestamp: new Date(),
          confidence: aiResult.confidence,
          source: aiResult.source
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }, delay);

    } catch (error) {
      console.error('Error processing message:', error);

      setTimeout(() => {
        const errorMessage = {
          id: Date.now() + 1,
          text: "抱歉，我暫時無法回應您的問題。請稍後再試。",
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
      }, 1000);
    }
  };


  // 格式化時間
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.chatOverlay} onClick={onClose}>
      <div className={styles.chatContainer} onClick={(e) => e.stopPropagation()}>
        {/* 聊天標題列 */}
        <div className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <img
              src="/assets/icon/PeterAiChatIcon.png"
              alt="Peter AI"
              className={styles.aiAvatar}
            />
            <div className={styles.headerText}>
              <h3>PETer 專員 Peter</h3>
              <span className={styles.status}>線上</span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* 訊息區域 */}
        <div className={styles.messagesContainer}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.messageWrapper} ${message.isUser ? styles.userMessage : styles.aiMessage}`}
            >
              {!message.isUser && (
                <img
                  src="/assets/icon/PeterAiChatIcon.png"
                  alt="Peter AI"
                  className={styles.messageAvatar}
                />
              )}
              <div className={styles.messageContent}>
                <div className={styles.messageBubble}>
                  {message.text}
                </div>
                <div className={styles.messageTime}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
              {message.isUser && (
                <img
                  src={userAvatarError || !user?.headshot_url ? "/assets/icon/DefaultAvatar.jpg" : user.headshot_url}
                  alt={user?.username || "User"}
                  className={styles.messageAvatar}
                  onError={() => setUserAvatarError(true)}
                  onLoad={() => {
                    if (user?.headshot_url && !userAvatarError) {
                      setUserAvatarError(false);
                    }
                  }}
                />
              )}
            </div>
          ))}

          {/* 打字指示器 */}
          {isTyping && (
            <div className={`${styles.messageWrapper} ${styles.aiMessage}`}>
              <img
                src="/assets/icon/PeterAiChatIcon.png"
                alt="Peter AI"
                className={styles.messageAvatar}
              />
              <div className={styles.messageContent}>
                <div className={`${styles.messageBubble} ${styles.typingIndicator}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 輸入區域 */}
        <div className={styles.inputSection}>
          <div className={styles.inputContainer}>
            <div className={styles.inputUserAvatar}>
              <img
                src={userAvatarError || !user?.headshot_url ? "/assets/icon/DefaultAvatar.jpg" : user.headshot_url}
                alt={user?.username || "User"}
                onError={() => setUserAvatarError(true)}
                onLoad={() => {
                  if (user?.headshot_url && !userAvatarError) {
                    setUserAvatarError(false);
                  }
                }}
              />
            </div>
            <textarea
              ref={textareaRef}
              placeholder="輸入您的問題..."
              className={styles.inputTextarea}
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              rows={1}
            />
            <div className={styles.inputActions}>
              <button
                className={styles.sendBtn}
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                title="送出訊息"
              >
                <img src="/assets/icon/CommentSendIcon.png" alt="送出訊息" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;