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
  const restoredRef = useRef(false);

  // 簡易本地快取鍵
  const LAST_CONV_ID_KEY = 'aiChat.lastConversationId';
  const LAST_MESSAGES_KEY = 'aiChat.lastMessages';

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
    // 若已有快取或已還原，不顯示歡迎訊息
    const hasCache = !!localStorage.getItem(LAST_CONV_ID_KEY) || !!localStorage.getItem(LAST_MESSAGES_KEY);
    if (ready && messages.length === 0 && !hasCache) {
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

      // Normalize post recommendation arrays (ensure id + post_id present, drop malformed)
      const normalizePostList = (lst, typeHint) => {
        if (!Array.isArray(lst)) return [];
        return lst
          .filter(p => p && (p.post_id !== undefined || p.id !== undefined))
          .map(p => {
            const post_id = p.post_id !== undefined ? p.post_id : p.id;
            const id = p.id !== undefined ? p.id : post_id;
            return { ...p, post_id, id, type: p.type || typeHint || p.category || 'forum' };
          });
      };

      const normSocial = normalizePostList(aiResult.recommendedSocialPosts, 'social');
      const normForum = normalizePostList(aiResult.recommendedForumPosts, 'forum');

      const aiMessage = {
        id: Date.now() + 1,
        text: aiResult.response,
        isUser: false,
        timestamp: new Date(),
        // 加入教學相關資訊（新：使用單一 tutorial 欄位）
        tutorial: aiResult.tutorial || null,
        // 推薦用戶標準化為陣列
    recommendedUsers: Array.isArray(aiResult.recommendedUsers)
      ? aiResult.recommendedUsers.map(_u => {
          const u = { ..._u };
          const id = u.id !== undefined ? u.id : (u.user_id !== undefined ? u.user_id : undefined);
          const user_id = u.user_id !== undefined ? u.user_id : (u.id !== undefined ? u.id : id);
          const user_account = u.user_account ?? u.account ?? (typeof u.display_name === 'string' ? u.display_name : u.username);
          const user_fullname = u.user_fullname ?? u.display_name ?? u.fullname ?? u.name;
          return { ...u, id, user_id, user_account, user_fullname };
        }).filter(u => u.id !== undefined)
      : Object.entries(aiResult.recommendedUsers || {}).map(([uid, _u]) => {
          const u = { ...(_u || {}) };
          const id = u.id !== undefined ? u.id : uid;
          const user_id = u.user_id !== undefined ? u.user_id : id;
          const user_account = u.user_account ?? u.account ?? (typeof u.display_name === 'string' ? u.display_name : u.username);
          const user_fullname = u.user_fullname ?? u.display_name ?? u.fullname ?? u.name;
          return { ...u, id, user_id, user_account, user_fullname };
        }),
    // Post recommendations (array form, each element now guaranteed to have id & post_id)
    recommendedSocialPosts: normSocial,
    recommendedForumPosts: normForum,
        // 加入營養計算機相關資訊
        hasCalculator: aiResult.hasCalculator || false,
        // 加入操作功能相關資訊 (operations array)
        operations: aiResult.operations || [],
        operationType: aiResult.operationType || null,
        // 加入待確認操作（頁面跳轉等）
        pendingOperation: aiResult.pendingOperation || null
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      // 更新當前對話 ID（後端會返回）
      if (aiResult.conversationId) {
        setCurrentConversationId(aiResult.conversationId);
        try { localStorage.setItem(LAST_CONV_ID_KEY, String(aiResult.conversationId)); } catch (e) {}
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

  // 將後端會話詳情格式化為前端訊息結構
  const formatMessagesFromConversationDetail = async (conversationDetail) => {
    if (!conversationDetail.messages || !Array.isArray(conversationDetail.messages)) {
      return [];
    }

    const sortedMessages = [...conversationDetail.messages].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    const formattedMessages = await Promise.all(sortedMessages
      .filter(msg => msg.role !== 'system')
      .map(async (msg) => {
        let additionalData = msg.additional_data;
        if (typeof additionalData === 'string') {
          try { additionalData = JSON.parse(additionalData); } catch { additionalData = {}; }
        }

        let messageData = msg.message_data;
        if (typeof messageData === 'string') {
          try { messageData = JSON.parse(messageData); } catch { messageData = null; }
        }

        // 推薦用戶標準化為陣列
        const normalizeUsersList = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) {
            return val.map(_u => {
              const u = { ..._u };
              const id = u.id !== undefined ? u.id : (u.user_id !== undefined ? u.user_id : undefined);
              const user_id = u.user_id !== undefined ? u.user_id : (u.id !== undefined ? u.id : id);
              const user_account = u.user_account ?? u.account ?? (typeof u.display_name === 'string' ? u.display_name : u.username);
              const user_fullname = u.user_fullname ?? u.display_name ?? u.fullname ?? u.name;
              return { ...u, id, user_id, user_account, user_fullname };
            }).filter(u => u.id !== undefined);
          }
          if (typeof val === 'object') {
            return Object.entries(val).map(([uid, _u]) => {
              const u = { ...(_u || {}) };
              const id = u.id !== undefined ? u.id : uid;
              const user_id = u.user_id !== undefined ? u.user_id : id;
              const user_account = u.user_account ?? u.account ?? (typeof u.display_name === 'string' ? u.display_name : u.username);
              const user_fullname = u.user_fullname ?? u.display_name ?? u.fullname ?? u.name;
              return { ...u, id, user_id, user_account, user_fullname };
            });
          }
          return [];
        };
        let recommendedUsers = [];
        if (messageData?.recommendedUsers) {
          recommendedUsers = normalizeUsersList(messageData.recommendedUsers);
        } else if (additionalData?.recommendedUsers) {
          recommendedUsers = normalizeUsersList(additionalData.recommendedUsers);
        } else if (additionalData?.recommended_users) {
          recommendedUsers = normalizeUsersList(additionalData.recommended_users);
        } else if (additionalData?.recommendedUserDetails && Array.isArray(additionalData.recommendedUserDetails)) {
          recommendedUsers = normalizeUsersList(additionalData.recommendedUserDetails);
        } else if (additionalData?.recommended_user_details && Array.isArray(additionalData.recommended_user_details)) {
          recommendedUsers = normalizeUsersList(additionalData.recommended_user_details);
        } else if (msg.has_recommended_users) {
          const userIds = additionalData?.recommended_user_ids || [];
          if (userIds.length > 0) {
            const fetched = await fetchUserDetailsByIds(userIds);
            recommendedUsers = normalizeUsersList(fetched);
          }
        }

        // 推薦文章
        // 推薦文章（支援新陣列格式與舊字典格式）
        const normalizePostList = (lst, typeHint) => {
          if (!Array.isArray(lst)) return [];
          return lst
            .filter(p => p && (p.post_id !== undefined || p.id !== undefined))
            .map(p => {
              const post_id = p.post_id !== undefined ? p.post_id : p.id;
              const id = p.id !== undefined ? p.id : post_id;
              return { ...p, post_id, id, type: p.type || typeHint || 'forum' };
            });
        };
        const convertLegacyDictToArray = (obj, typeHint) => {
          if (!obj || typeof obj !== 'object') return [];
          if (Array.isArray(obj)) return normalizePostList(obj, typeHint);
          const arr = Object.entries(obj).map(([pid, data]) => ({
            post_id: pid,
            id: data?.id !== undefined ? data.id : pid,
            title: data?.title || '',
            post_details: data?.post_details || data?.details || '',
            created_at: data?.created_at || null,
            type: typeHint || data?.type
          }));
            return normalizePostList(arr, typeHint);
        };
        let recommendedSocialPosts = convertLegacyDictToArray(
          messageData?.recommendedSocialPosts ||
          additionalData?.recommendedSocialPosts ||
          additionalData?.recommended_social_posts ||
          [],
          'social'
        );
        let recommendedForumPosts = convertLegacyDictToArray(
          messageData?.recommendedForumPosts ||
          additionalData?.recommendedForumPosts ||
          additionalData?.recommended_forum_posts ||
          [],
          'forum'
        );

        return {
          id: msg.id || Date.now() + Math.random(),
          text: messageData?.response || msg.content,
          isUser: msg.role === 'user',
          timestamp: new Date(msg.created_at),
          tutorial: messageData?.tutorial ?? msg.tutorial_type ?? null,
          recommendedUsers,
          recommendedSocialPosts,
          recommendedForumPosts,
          hasCalculator: (messageData?.hasCalculator ?? msg.has_calculator) || false,
          operations: messageData?.operations || additionalData?.operations || [],
          operationType: messageData?.operationType ?? msg.operation_type ?? null,
          operationParams: additionalData?.operationParams || additionalData?.operation_params || {}
        };
      }));

    return formattedMessages;
  };

  // 開啟聊天視窗時嘗試還原最近一次會話
  useEffect(() => {
    if (!isOpen || restoredRef.current) return;

    const restore = async () => {
      try {
        const lastId = localStorage.getItem(LAST_CONV_ID_KEY);
        const cachedMessagesRaw = localStorage.getItem(LAST_MESSAGES_KEY);

        if (cachedMessagesRaw && messages.length === 0) {
          try {
            const cached = JSON.parse(cachedMessagesRaw);
            if (Array.isArray(cached) && cached.length > 0) {
              setMessages(cached.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
            }
          } catch {}
        }

        if (lastId) {
          try {
            const conversationDetail = await aiChatService.loadConversation(lastId);
            const formatted = await formatMessagesFromConversationDetail(conversationDetail);
            setMessages(formatted);
            setCurrentConversationId(Number(lastId));
          } catch (loadErr) {
            // 快取對話已不存在：建立新對話
            try {
              const newConv = await aiChatService.createConversation({ title: '新對話', welcome_message: t('chatWindow.welcomeMessage') });
              setCurrentConversationId(newConv.id);
              try { localStorage.setItem(LAST_CONV_ID_KEY, String(newConv.id)); } catch {}

              // 若無快取訊息，顯示歡迎訊息
              if (!localStorage.getItem(LAST_MESSAGES_KEY)) {
                setMessages([
                  {
                    id: 1,
                    text: t('chatWindow.welcomeMessage'),
                    isUser: false,
                    timestamp: new Date()
                  }
                ]);
              }
            } catch (createErr) {
              // 無法建立新對話時，保持現狀
              console.warn('建立新對話失敗:', createErr);
            }
          }
        } else {
          // 無快取對話：建立新對話
          try {
            const newConv = await aiChatService.createConversation({ title: '新對話', welcome_message: t('chatWindow.welcomeMessage') });
            setCurrentConversationId(newConv.id);
            try { localStorage.setItem(LAST_CONV_ID_KEY, String(newConv.id)); } catch {}
            // 不覆蓋已存在的訊息（例如已預先顯示的歡迎訊息或本地快取）
          } catch (createErr) {
            console.warn('建立新對話失敗（無快取情況）:', createErr);
          }
        }
      } catch (e) {
        // 無法還原時保持當前狀態
      } finally {
        restoredRef.current = true;
      }
    };

    restore();
    // 僅在首次打開時運行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 將當前訊息快取到本地（限制條數以避免過大）
  useEffect(() => {
    try {
      const max = 30;
      const trimmed = messages.slice(-max).map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
      localStorage.setItem(LAST_MESSAGES_KEY, JSON.stringify(trimmed));
    } catch {}
  }, [messages]);

  // 處理開始教學按鈕點擊 - 觸發教學模式事件
  const handleStartTutorial = (tutorialId) => {
    console.log('開始教學模式:', tutorialId);

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
            // 保持事件欄位名稱為 tutorialType 以相容其他組件
            tutorialType: tutorialId,
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

  // 在點擊推薦項目後，最小化（但不隱藏）AI HUD 並執行導航
  const minimizeHudThen = (navigateFn) => {
    try {
      // 開啟浮動模式並允許 GlobalFloatingAI 自動關閉展開視窗
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));
    } catch (e) {}
    // 停止可能的錄音
    stopVoiceRecording();
    // 立即收起聊天視窗（保持浮動頭像可見）
    if (floatingMode && onToggleFloating) {
      onToggleFloating();
    } else if (onClose) {
      onClose();
    }
    // 執行實際導航
    if (typeof navigateFn === 'function') {
      // 略微延遲，讓HUD狀態更新更順滑
      setTimeout(() => navigateFn(), 50);
    }
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

  // 處理待確認操作（頁面跳轉）
  const handleConfirmPendingOperation = (pendingOperation) => {
    console.log('用戶確認操作:', pendingOperation);

    if (!pendingOperation || pendingOperation.type !== 'navigate') {
      console.warn('不支援的操作類型:', pendingOperation?.type);
      return;
    }

    const { params } = pendingOperation;
    const targetPath = params.path;

    // 顯示確認訊息
    const confirmMessage = {
      id: Date.now(),
      text: `正在前往 ${pendingOperation.preview?.destination || targetPath}...`,
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMessage]);

    // 延遲後執行跳轉
    setTimeout(() => {
      try {
        // 通知全局啟動浮動模式
        window.dispatchEvent(new CustomEvent('forceFloatingMode'));

        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 執行導航
        navigate(targetPath);
      } catch (error) {
        console.error('頁面跳轉時發生錯誤:', error);
      }
    }, 800);
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
      const formattedMessages = await formatMessagesFromConversationDetail(conversationDetail);
      setMessages(formattedMessages);
      setCurrentConversationId(conversation.id);
      try { localStorage.setItem(LAST_CONV_ID_KEY, String(conversation.id)); } catch (e) {}
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

  const handleNewConversation = async () => {
    // 重置 AI Chat Service 的會話狀態
    aiChatService.startNewConversation();

    // 預設顯示歡迎訊息
    setMessages([
      {
        id: 1,
        text: t('chatWindow.welcomeMessage'),
        isUser: false,
        timestamp: new Date()
      }
    ]);

    // 立刻在後端建立新對話，避免「新對話」在列表中消失
    try {
      const newConv = await aiChatService.createConversation({ title: '新對話', welcome_message: t('chatWindow.welcomeMessage') });
      setCurrentConversationId(newConv.id);
      try { localStorage.setItem(LAST_CONV_ID_KEY, String(newConv.id)); } catch (e) {}
    } catch (err) {
      console.warn('建立新對話失敗（按下新對話）:', err);
      // 失敗時，至少清掉舊的快取，讓下次開啟時會自動建立
      setCurrentConversationId(null);
      try { localStorage.removeItem(LAST_CONV_ID_KEY); } catch (e) {}
    }
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
                  {message.tutorial && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleStartTutorial(message.tutorial)}
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
                  {message.operations && message.operations.length > 0 && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleOperationClick(message.operationType)}
                    >
                      {t(`chatWindow.operation.buttons.${message.operationType}`)}
                    </button>
                  )}
                  {/* 如果有待確認操作，顯示確認按鈕 */}
                  {message.pendingOperation && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleConfirmPendingOperation(message.pendingOperation)}
                    >
                      {message.pendingOperation.preview?.destination
                        ? `確認前往${message.pendingOperation.preview.destination}`
                        : '確認操作'}
                    </button>
                  )}
                  {/* 如果有推薦用戶，顯示推薦用戶預覽 */}
                  {Array.isArray(message.recommendedUsers) && message.recommendedUsers.length > 0 && (
                    <RecommendedUsersPreview
                      users={message.recommendedUsers}
                      onUserClick={(user) => {
                        console.log('點擊推薦用戶:', user);
                        const targetId = user.user_id ?? user.id;
                        if (targetId !== undefined && targetId !== null) {
                          minimizeHudThen(() => navigate(`/user/${targetId}`));
                        } else {
                          const dest = user.user_account || String(user.id);
                          minimizeHudThen(() => navigate(`/user/${dest}`));
                        }
                      }}
                    />
                  )}
                  {/* 如果有推薦文章，顯示推薦文章預覽 */}
                  {(Array.isArray(message.recommendedSocialPosts) && message.recommendedSocialPosts.length > 0 ||
                    Array.isArray(message.recommendedForumPosts) && message.recommendedForumPosts.length > 0) && (
                    <RecommendedArticlesPreview
                      socialPosts={message.recommendedSocialPosts}
                      forumPosts={message.recommendedForumPosts}
                      onArticleClick={(article) => {
                        if (article?.type === 'social') {
                          minimizeHudThen(() => navigate('/social', {
                            state: { injectedPost: article, source: 'agent', focus: true }
                          }));
                        } else {
                          const targetId = article.post_id || article.id;
                          minimizeHudThen(() => navigate(`/disease-archive/${targetId}/public`));
                        }
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