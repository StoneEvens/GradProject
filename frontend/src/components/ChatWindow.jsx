import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ChatWindow.module.css';
// 為 Demo 使用專門的 Demo Service
// 正式環境可切換回 aiChatService
import aiChatService from '../services/aiDemoService';
// import aiChatService from '../services/aiChatService';
import aiOperationService from '../services/aiOperationService';
import aiTutorialService from '../services/aiTutorialService';
// 新的 AI Agent 架構（可選升級）
// import aiAgentService from '../services/aiAgentService';
import RecommendedUsersPreview from './RecommendedUsersPreview';
import RecommendedArticlesPreview from './RecommendedArticlesPreview';
import ChatSidebar from './ChatSidebar';
import FloatingAIAvatar from './FloatingAIAvatar';
import { saveConversation, updateConversation, loadConversation } from '../utils/chatStorage';

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
        console.error('語音識別錯誤:', event.error);
        if (event.error === 'not-allowed') {
          alert('請允許使用麥克風權限');
        } else if (event.error === 'no-speech') {
          console.log('未偵測到語音');
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
      console.log('瀏覽器不支援語音識別');
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
      alert('您的瀏覽器不支援語音輸入');
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
        console.error('啟動語音識別失敗:', error);
        alert('無法啟動語音識別，請檢查麥克風權限');
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
      // 當前使用 Demo Service
      const aiResult = await aiChatService.processMessage(userInput);

      // 未來升級到新架構時，只需要替換上面一行為：
      // const aiResult = await aiAgentService.processMessage(userInput, {
      //   user: user,
      //   petId: user?.pets?.[0]?.id || 1
      // });

      // 模擬真實的回應時間
      const delay = 800 + Math.random() * 1500; // 0.8-2.3秒

      setTimeout(() => {
        const aiMessage = {
          id: Date.now() + 1,
          text: aiResult.response,
          isUser: false,
          timestamp: new Date(),
          confidence: aiResult.confidence,
          source: aiResult.source,
          // 加入教學相關資訊
          hasTutorial: aiResult.hasTutorial || false,
          tutorialType: aiResult.tutorialType || null,
          // 加入推薦用戶相關資訊
          hasRecommendedUsers: aiResult.hasRecommendedUsers || false,
          // 加入推薦文章相關資訊
          hasRecommendedArticles: aiResult.hasRecommendedArticles || false,
          // 加入營養計算機相關資訊
          hasCalculator: aiResult.hasCalculator || false,
          // 加入操作功能相關資訊
          hasOperation: aiResult.hasOperation || false,
          operationType: aiResult.operationType || null
        };

        const finalMessages = [...newMessages, aiMessage];
        setMessages(finalMessages);
        setIsTyping(false);

        // 保存或更新對話記錄
        if (currentConversationId) {
          updateConversation(currentConversationId, finalMessages);
        } else {
          const conversationId = saveConversation(finalMessages);
          setCurrentConversationId(conversationId);
        }
      }, delay);

    } catch (error) {
      console.error('Error processing message:', error);

      setTimeout(() => {
        const errorMessage = {
          id: Date.now() + 1,
          text: t('chatWindow.errorMessage'),
          isUser: false,
          timestamp: new Date()
        };

        const finalMessages = [...newMessages, errorMessage];
        setMessages(finalMessages);
        setIsTyping(false);

        // 保存或更新對話記錄
        if (currentConversationId) {
          updateConversation(currentConversationId, finalMessages);
        } else {
          const conversationId = saveConversation(finalMessages);
          setCurrentConversationId(conversationId);
        }
      }, 1000);
    }
  };

  // 處理開始教學按鈕點擊
  const handleStartTutorial = async (tutorialType) => {
    console.log('開始教學模式:', tutorialType);

    // 獲取教學標題
    const tutorialTitle = aiTutorialService.getTutorialTitle(tutorialType);

    // 顯示準備訊息
    const tutorialStartMessage = {
      id: Date.now(),
      text: `正在啟動${tutorialTitle}...請稍候`,
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, tutorialStartMessage]);

    // 延遲一下讓用戶看到訊息，然後關閉聊天室並啟動教學
    setTimeout(async () => {
      try {
        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 自動關閉漂浮頭像（如果存在）
        window.dispatchEvent(new CustomEvent('dismissFloatingAvatar'));

        // 使用教學服務啟動教學
        const result = await aiTutorialService.startTutorial(tutorialType, {
          source: 'ai_chat',
          user: user
        });

        if (!result.success) {
          console.error('啟動教學失敗:', result.error);
          // 這裡可以顯示錯誤訊息或使用備用方案
        }
      } catch (error) {
        console.error('啟動教學過程中發生錯誤:', error);
      }
    }, 1000);
  };

  // 處理營養計算機按鈕點擊
  const handleCalculatorClick = () => {
    console.log('導向營養計算機');

    // 顯示準備訊息
    const calculatorMessage = {
      id: Date.now(),
      text: '正在導向營養計算機...請稍候',
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

  // 處理操作按鈕點擊
  const handleOperationClick = async (operationType, params = {}) => {
    console.log('執行操作:', operationType, params);

    // 獲取操作描述
    const operationDesc = aiOperationService.getOperationDescription(operationType);

    // 顯示準備訊息
    const operationMessage = {
      id: Date.now(),
      text: `正在執行${operationDesc}...請稍候`,
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, operationMessage]);

    // 延遲一下讓用戶看到訊息，然後關閉聊天室並執行操作
    setTimeout(async () => {
      try {
        // 通知全局啟動浮動模式（針對任何 ChatWindow 導航）
        window.dispatchEvent(new CustomEvent('forceFloatingMode'));

        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 使用操作服務執行操作
        const result = await aiOperationService.executeOperation(operationType, params, navigate);

        if (!result.success) {
          console.error('操作執行失敗:', result.error);
          // 這裡可以添加錯誤處理，比如顯示錯誤訊息
        }
      } catch (error) {
        console.error('操作執行過程中發生錯誤:', error);
      }
    }, 1000);
  };

  // 處理側邊欄
  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleConversationSelect = (conversation) => {
    setMessages(conversation.messages);
    setCurrentConversationId(conversation.id);
  };

  const handleNewConversation = () => {
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
                      {aiTutorialService.getTutorialButtonText(message.tutorialType)}
                    </button>
                  )}
                  {/* 如果有營養計算機，顯示營養計算機按鈕 */}
                  {message.hasCalculator && (
                    <button
                      className={styles.tutorialButton}
                      onClick={handleCalculatorClick}
                    >
                      出發計算
                    </button>
                  )}
                  {/* 如果有操作功能，顯示操作按鈕 */}
                  {message.hasOperation && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleOperationClick(message.operationType)}
                    >
                      {aiOperationService.getOperationButtonText(message.operationType)}
                    </button>
                  )}
                  {/* 如果有推薦用戶，顯示推薦用戶預覽 */}
                  {message.hasRecommendedUsers && (
                    <RecommendedUsersPreview
                      onUserClick={(user) => {
                        console.log('點擊推薦用戶:', user);
                      }}
                    />
                  )}
                  {/* 如果有推薦文章，顯示推薦文章預覽 */}
                  {message.hasRecommendedArticles && (
                    <RecommendedArticlesPreview
                      onArticleClick={(article) => {
                        console.log('點擊推薦文章:', article);
                      }}
                    />
                  )}
                  <div className={styles.messageTime}>
                    {formatTime(message.timestamp)}
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
                title={isListening ? '停止語音輸入' : '開始語音輸入（支援中英文）'}
              >
                <img src="/assets/icon/microphone.png" alt={isListening ? '停止語音輸入' : '開始語音輸入'} />
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