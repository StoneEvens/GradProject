import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ChatWindow.module.css';
import aiChatService from '../services/aiChatService';
import RecommendedUsersPreview from './RecommendedUsersPreview';
import RecommendedArticlesPreview from './RecommendedArticlesPreview';
import ChatSidebar from './ChatSidebar';
import FloatingAIAvatar from './FloatingAIAvatar';

const ChatWindow = ({
  isOpen,
  onClose,
  user,
  floatingMode = false,
  onToggleFloating,
  onDismissFloating
}) => {
  const { t, ready } = useTranslation('main');
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userAvatarError, setUserAvatarError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  // 語音識別相關 state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // 初始化語音識別
  useEffect(() => {
    // 檢查瀏覽器是否支援語音識別
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();

      // 設定語音識別參數
      recognition.continuous = true; // 持續監聽
      recognition.interimResults = true; // 顯示即時辨識結果

      // 設定多語言識別（讓瀏覽器自動處理）
      // 使用 maxAlternatives 來獲得多個可能的識別結果
      recognition.maxAlternatives = 3;

      // 預設使用混合語言模式（中英文混合）
      recognition.lang = 'zh-TW'; // 主要語言是中文，但可以識別英文

      // 處理識別結果
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // 設定即時辨識文字
        setInterimTranscript(interimTranscript);

        // 如果有最終結果，添加到輸入框
        if (finalTranscript) {
          setInputText(prev => {
            // 如果前面有文字，加個空格分隔
            return prev ? prev + ' ' + finalTranscript : finalTranscript;
          });
          setInterimTranscript('');
        }
      };

      // 處理錯誤
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          // 使用 t 函數時需要在組件內部處理
          console.error('Microphone permission denied');
        } else if (event.error === 'no-speech') {
          console.log('No speech detected');
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      // 識別結束時的處理
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } else {
      console.log('Browser does not support speech recognition');
    }

    // 清理函數
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 監聽視窗關閉或組件卸載
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 視窗關閉時停止錄音
      stopVoiceRecording();
    };

    // 當視窗關閉時停止錄音
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 清理函數
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 組件卸載時停止錄音
      stopVoiceRecording();
    };
  }, [isListening]);

  // 自動滾動到最新訊息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 當翻譯準備好時初始化歡迎訊息
  useEffect(() => {
    if (ready && messages.length === 0) {
      setMessages([
        {
          id: 1,
          text: t('chatWindow.welcomeMessage'),
          isUser: false,
          timestamp: new Date()
        }
      ]);
    }
  }, [ready, t, messages.length]);

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

  // 停止語音錄音的通用函數
  const stopVoiceRecording = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    }
  };

  // 切換語音輸入
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert(t('chatWindow.voiceInput.notSupported'));
      return;
    }

    if (isListening) {
      // 停止語音識別
      stopVoiceRecording();
    } else {
      // 開始語音識別
      try {
        // 使用中文為主的混合識別模式
        // 現代瀏覽器的語音識別 API 可以自動處理中英文混合
        recognitionRef.current.lang = 'zh-TW';

        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        alert(t('chatWindow.voiceInput.startFailed'));
      }
    }
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

    // 如果正在錄音，先停止錄音
    stopVoiceRecording();

    const userMessage = {
      id: Date.now(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    const userInput = inputText; // 保存輸入內容

    // 添加用戶訊息
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);

    try {
      // 使用正式後端 AI Chat Service
      const aiResult = await aiChatService.processMessage(userInput, {
        user: user,
        petId: user?.pets?.[0]?.id || null
      });

      console.log('AI 回應結果:', aiResult); // Debug 用

      const aiMessage = {
        id: Date.now() + 1,
        text: aiResult.response,
        isUser: false,
        timestamp: new Date(),
        confidence: aiResult.confidence,
        source: aiResult.source,
        intent: aiResult.intent, // 顯示意圖
        // 加入教學相關資訊
        hasTutorial: aiResult.hasTutorial || false,
        tutorialType: aiResult.tutorialType || null,
        // 加入推薦用戶相關資訊
        hasRecommendedUsers: aiResult.hasRecommendedUsers || false,
        recommendedUserDetails: aiResult.recommendedUserDetails || [],  // 加入用戶詳細資料
        // 加入推薦文章相關資訊
        hasRecommendedArticles: aiResult.hasRecommendedArticles || false,
        recommendedArticleIds: aiResult.recommendedArticleIds || [],  // 加入推薦文章 ID
        // 加入營養計算機相關資訊
        hasCalculator: aiResult.hasCalculator || false,
        // 加入操作功能相關資訊
        hasOperation: aiResult.hasOperation || false,
        operationType: aiResult.operationType || null
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      // 更新當前對話 ID（後端會返回）
      if (aiResult.conversationId) {
        setCurrentConversationId(aiResult.conversationId);
      }

    } catch (error) {
      console.error('Error processing message:', error);

      const errorMessage = {
        id: Date.now() + 1,
        text: error.response?.data?.response || t('chatWindow.errorMessage') || '抱歉，處理您的請求時發生錯誤。',
        isUser: false,
        timestamp: new Date(),
        error: true
      };

      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      setIsTyping(false);
    }
  };

  // 處理開始教學按鈕點擊 - 觸發教學模式事件
  const handleStartTutorial = (tutorialType) => {
    console.log('開始教學模式:', tutorialType);

    // 延遲一下讓用戶看到訊息，然後關閉聊天室並啟動教學
    setTimeout(() => {
      try {
        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 自動關閉漂浮頭像（如果存在）
        window.dispatchEvent(new CustomEvent('dismissFloatingAvatar'));

        // 觸發教學模式事件，由 App.jsx 或相應組件處理
        window.dispatchEvent(new CustomEvent('startTutorial', {
          detail: {
            tutorialType,
            source: 'ai_chat',
            user: user
          }
        }));
      } catch (error) {
        console.error('啟動教學過程中發生錯誤:', error);
      }
    }, 500);
  };

  // 處理營養計算機按鈕點擊
  const handleCalculatorClick = () => {
    console.log('導向營養計算機');

    // 顯示準備訊息
    const calculatorMessage = {
      id: Date.now(),
      text: t('chatWindow.calculator.redirecting'),
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, calculatorMessage]);

    // 延遲一下讓用戶看到訊息，然後關閉聊天室並導航
    setTimeout(() => {
      // 通知全局啟動浮動模式（針對任何 ChatWindow 導航）
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));

      // 停止語音錄音並關閉聊天室
      stopVoiceRecording();
      onClose();

      // 導向營養計算機頁面
      navigate('/calculator');
    }, 1000);
  };

  // 處理操作按鈕點擊 - 根據後端回傳的操作類型執行導航
  const handleOperationClick = async (operationType, params = {}) => {
    console.log('執行操作:', operationType, params);

    // 延遲一下讓用戶看到訊息，然後關閉聊天室並執行操作
    setTimeout(() => {
      try {
        // 通知全局啟動浮動模式（針對任何 ChatWindow 導航）
        window.dispatchEvent(new CustomEvent('forceFloatingMode'));

        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 根據操作類型執行相應的導航
        switch (operationType) {
          case 'navigate_health_records':
            navigate('/health', { state: params });
            break;
          case 'navigate_feeding_schedule':
            navigate('/schedule', { state: params });
            break;
          case 'navigate_nearby_hospitals':
            navigate('/interactive-city', { state: params });
            break;
          case 'navigate_pet_profile':
            if (params.petId) {
              navigate(`/pets/${params.petId}`, { state: params });
            }
            break;
          case 'navigate_social':
            navigate('/social', { state: params });
            break;
          default:
            console.warn('未知的操作類型:', operationType);
        }
      } catch (error) {
        console.error('操作執行過程中發生錯誤:', error);
      }
    }, 500);
  };

  // 處理側邊欄
  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  // 根據用戶 ID 獲取用戶詳情（用於舊對話）
  const fetchUserDetailsByIds = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];

    try {
      // 使用現有的 getUserFollowStatusBatch API 獲取用戶資訊
      const { getUserFollowStatusBatch } = await import('../services/socialService');
      const userDetails = await getUserFollowStatusBatch(userIds);

      // 將 status 格式轉換為用戶詳情格式
      return userIds.map(userId => {
        const status = userDetails[userId];
        return status ? {
          id: userId,
          user_account: status.user_account || '',
          user_fullname: status.user_fullname || '',
          headshot_url: status.headshot_url || null,
          user_intro: status.user_intro || null,
          account_privacy: status.account_privacy || 'public'
        } : null;
      }).filter(user => user !== null);
    } catch (error) {
      console.error('獲取用戶詳情失敗:', error);
      return [];
    }
  };

  const handleConversationSelect = async (conversation) => {
    try {
      // 從後端載入完整的對話詳情
      const conversationDetail = await aiChatService.loadConversation(conversation.id);

      // 檢查是否有 messages
      if (!conversationDetail.messages || !Array.isArray(conversationDetail.messages)) {
        console.error('對話詳情中沒有訊息陣列:', conversationDetail);
        throw new Error('對話詳情格式錯誤');
      }

      // 將後端的 messages 轉換為前端格式
      // 按照創建時間排序（確保舊的在前，新的在後）
      const sortedMessages = [...conversationDetail.messages].sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );

      const formattedMessages = await Promise.all(sortedMessages
        .filter(msg => msg.role !== 'system') // 過濾掉系統訊息
        .map(async (msg) => {
          // 處理 additional_data 可能是字串或物件的情況
          let additionalData = msg.additional_data;
          if (typeof additionalData === 'string') {
            try {
              additionalData = JSON.parse(additionalData);
            } catch (e) {
              additionalData = {};
            }
          }

          // 處理 entities 可能是字串或物件的情況
          let entities = msg.entities;
          if (typeof entities === 'string') {
            try {
              entities = JSON.parse(entities);
            } catch (e) {
              entities = {};
            }
          }

          // 獲取推薦用戶詳情
          let recommendedUserDetails = additionalData?.recommendedUserDetails ||
                                      additionalData?.recommended_user_details ||
                                      [];

          // 如果沒有用戶詳情但有用戶 ID，嘗試獲取
          if (recommendedUserDetails.length === 0 && msg.has_recommended_users) {
            const userIds = additionalData?.recommended_user_ids || [];
            if (userIds.length > 0) {
              recommendedUserDetails = await fetchUserDetailsByIds(userIds);
            }
          }

          return {
            id: msg.id || Date.now() + Math.random(),
            text: msg.content,
            isUser: msg.role === 'user',
            timestamp: new Date(msg.created_at),
            confidence: msg.confidence,
            intent: msg.intent,
            source: msg.source,
            // AI 訊息的額外資訊
            hasTutorial: msg.has_tutorial || false,
            tutorialType: msg.tutorial_type || null,
            hasRecommendedUsers: msg.has_recommended_users || false,
            recommendedUserDetails: recommendedUserDetails,
            hasRecommendedArticles: msg.has_recommended_articles || false,
            // 推薦文章 ID 可能在 additional_data 中
            recommendedArticleIds: additionalData?.recommendedArticleIds ||
                                  additionalData?.recommended_article_ids ||
                                  [],
            hasCalculator: msg.has_calculator || false,
            hasOperation: msg.has_operation || false,
            operationType: msg.operation_type || null,
            // 操作參數
            operationParams: additionalData?.operationParams ||
                           additionalData?.operation_params ||
                           {}
          };
        }));

      setMessages(formattedMessages);
      setCurrentConversationId(conversation.id);
    } catch (error) {
      console.error('載入對話失敗:', error);
      console.error('錯誤詳情:', error.response || error);

      // 如果載入失敗，使用 fallback 方式
      if (conversation.messages && conversation.messages.length > 0) {
        setMessages(conversation.messages);
        setCurrentConversationId(conversation.id);
      } else {
        // 顯示錯誤訊息給用戶
        alert('載入對話失敗，請稍後再試');
      }
    }
  };

  const handleNewConversation = () => {
    // 重置 AI Chat Service 的會話狀態
    aiChatService.startNewConversation();

    // 重置前端狀態
    setMessages([
      {
        id: 1,
        text: t('chatWindow.welcomeMessage'),
        isUser: false,
        timestamp: new Date()
      }
    ]);
    setCurrentConversationId(null);
  };

  // 處理浮動頭像點擊
  const handleFloatingAvatarClick = () => {
    if (onToggleFloating) {
      onToggleFloating();
    }
  };

  // 處理浮動頭像遣散
  const handleFloatingAvatarDismiss = () => {
    if (onDismissFloating) {
      onDismissFloating();
    }
  };

  // 處理聊天視窗關閉（支援浮動模式）
  const handleChatClose = () => {
    // 如果正在錄音，先停止錄音
    stopVoiceRecording();

    if (floatingMode && onToggleFloating) {
      // 浮動模式下收合為頭像
      onToggleFloating();
    } else {
      // 一般模式下完全關閉
      onClose();
    }
  };

  // 格式化時間
  const formatTime = (timestamp) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 渲染聊天內容（提取為函數以便重用）
  const renderChatContent = () => (
    <>
      {/* 聊天標題列 */}
      <div className={styles.chatHeader}>
        <button className={styles.menuButton} onClick={handleToggleSidebar}>
          <div className={styles.menuIcon}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <div className={styles.headerInfo}>
          <img
            src="/assets/icon/PeterAiChatIcon.png"
            alt="Peter AI"
            className={styles.aiAvatar}
          />
          <div className={styles.headerText}>
            <h3>{t('chatWindow.title')}</h3>
            <span className={styles.status}>{t('chatWindow.status')}</span>
          </div>
        </div>
        <button className={styles.closeButton} onClick={handleChatClose}>
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
            {/* AI 訊息：頭像在左，訊息在右 */}
            {!message.isUser && (
              <>
                <img
                  src="/assets/icon/PeterAiChatIcon.png"
                  alt="Peter AI"
                  className={styles.messageAvatar}
                />
                <div className={styles.messageContent}>
                  <div className={styles.messageBubble}>
                    {message.text.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < message.text.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  {/* 如果有教學模式，顯示開始教學按鈕 */}
                  {message.hasTutorial && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleStartTutorial(message.tutorialType)}
                    >
                      {t('chatWindow.tutorial.startButton')}
                    </button>
                  )}
                  {/* 如果有營養計算機，顯示營養計算機按鈕 */}
                  {message.hasCalculator && (
                    <button
                      className={styles.tutorialButton}
                      onClick={handleCalculatorClick}
                    >
                      {t('chatWindow.calculator.buttonText')}
                    </button>
                  )}
                  {/* 如果有操作功能，顯示操作按鈕 */}
                  {message.hasOperation && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleOperationClick(message.operationType)}
                    >
                      {t(`chatWindow.operation.buttons.${message.operationType}`)}
                    </button>
                  )}
                  {/* 如果有推薦用戶，顯示推薦用戶預覽 */}
                  {message.hasRecommendedUsers && message.recommendedUserDetails && (
                    <RecommendedUsersPreview
                      users={message.recommendedUserDetails}
                      onUserClick={(user) => {
                        console.log('點擊推薦用戶:', user);
                        // 導航到用戶個人頁面
                        navigate(`/user/${user.user_account}`);
                      }}
                    />
                  )}
                  {/* 如果有推薦文章，顯示推薦文章預覽 */}
                  {message.hasRecommendedArticles && message.recommendedArticleIds && (
                    <RecommendedArticlesPreview
                      articleIds={message.recommendedArticleIds}
                    />
                  )}
                  <div className={styles.messageTime}>
                    {formatTime(message.timestamp)}
                    {/* 顯示意圖資訊（測試用） */}
                    {message.intent && (
                      <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.85em' }}>
                        | 意圖: <strong>{message.intent}</strong>
                      </span>
                    )}
                    {message.confidence !== undefined && (
                      <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.85em' }}>
                        | 信心度: {(message.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 使用者訊息：訊息在左，頭像在右 */}
            {message.isUser && (
              <>
                <div className={styles.messageContent}>
                  <div className={styles.messageBubble}>
                    {message.text.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < message.text.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className={styles.messageTime}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
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
              </>
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
          <div className={styles.textareaWrapper}>
            <textarea
              ref={textareaRef}
              placeholder={interimTranscript || t('chatWindow.inputPlaceholder')}
              className={`${styles.inputTextarea} ${isListening ? styles.listening : ''}`}
              value={inputText + (interimTranscript ? ' ' + interimTranscript : '')}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              rows={1}
            />
          </div>
          <div className={styles.inputActions}>
            {speechSupported && (
              <button
                className={`${styles.voiceBtn} ${isListening ? styles.active : ''}`}
                onClick={toggleVoiceInput}
                title={isListening ? t('chatWindow.voiceInput.stopTooltip') : t('chatWindow.voiceInput.startTooltip')}
              >
                <img src="/assets/icon/microphone.png" alt={isListening ? t('chatWindow.voiceInput.stopTooltip') : t('chatWindow.voiceInput.startTooltip')} />
              </button>
            )}
            <button
              className={styles.sendBtn}
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              title={t('chatWindow.sendButton')}
            >
              <img src="/assets/icon/CommentSendIcon.png" alt={t('chatWindow.sendButton')} />
            </button>
          </div>
        </div>
      </div>

      {/* 側邊欄 */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
      />
    </>
  );

  // 浮動模式顯示邏輯
  if (floatingMode) {
    return (
      <>
        {/* 浮動 AI 頭像 */}
        <FloatingAIAvatar
          isVisible={!isOpen}
          onAvatarClick={handleFloatingAvatarClick}
          onDismiss={handleFloatingAvatarDismiss}
        />

        {/* 展開的聊天視窗 */}
        {isOpen && (
          <div className={styles.chatOverlay} onClick={handleChatClose}>
            <div className={styles.chatContainer} onClick={(e) => e.stopPropagation()}>
              {renderChatContent()}
            </div>
          </div>
        )}
      </>
    );
  }

  // 一般模式
  if (!isOpen) return null;

  return (
    <div className={styles.chatOverlay} onClick={onClose}>
      <div className={styles.chatContainer} onClick={(e) => e.stopPropagation()}>
        {renderChatContent()}
      </div>
    </div>
  );
};

export default ChatWindow;