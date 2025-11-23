import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ChatWindow.module.css';
import aiChatService from '../services/aiChatService';
import { realtimeVoiceService } from '../services/realtimeVoiceService_agents';
import RecommendedUsersPreview from './RecommendedUsersPreview';
import RecommendedArticlesPreview from './RecommendedArticlesPreview';
import ChatSidebar from './ChatSidebar';
import FloatingAIAvatar from './FloatingAIAvatar';
import ConfirmNotification from './ConfirmNotification';

const ChatWindow = ({
  isOpen,
  onClose,
  user,
  floatingMode = false,
  onToggleFloating,
  onDismissFloating
}) => {
  const { t, ready, i18n } = useTranslation('main');
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userAvatarError, setUserAvatarError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  // 語音識別相關 state (original speech-to-text)
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  // 即時語音通話相關 state (Realtime API)
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // 圖片上傳相關 state
  const [selectedImages, setSelectedImages] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isWaitingForFeedImageReplacement, setIsWaitingForFeedImageReplacement] = useState(false);

  // 確認對話框相關 state
  const [showImageConfirm, setShowImageConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'close' 或 { type: 'switch', conversation: {...} }

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // 注意：歡迎訊息現在由 isOpen 的 useEffect 處理

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

  // 監聽 OCR 完成事件
  useEffect(() => {
    const handleOcrCompleted = async (event) => {
      const { ocrData, rawText, imageCount = 0 } = event.detail;

      console.log('[ChatWindow] 收到 OCR 完成事件:', ocrData);

      // 將 OCR 結果回傳給 Agent
      const ocrMessage = "[系統] OCR 分析完成，請協助確認辨識結果";
      const ocrContext = {
        ocrCompleted: true,
        hasImages: imageCount > 0,
        imageCount: imageCount,
        ocrData: ocrData
      };

      // 自動發送給 Agent
      await handleSendMessage(ocrMessage, ocrContext);
    };

    const handleHealthReportOcrCompleted = async (event) => {
      const { ocrData, petId, imageCount = 0 } = event.detail;

      console.log('[ChatWindow] 收到健康報告 OCR 完成事件:', ocrData);

      // 將 OCR 結果回傳給 Agent
      const ocrMessage = "[系統] 健康報告 OCR 分析完成，請協助確認辨識結果";
      const ocrContext = {
        healthReportOcrCompleted: true,
        hasImages: imageCount > 0,
        imageCount: imageCount,
        healthReportOcrData: ocrData,
        petId: petId
      };

      // 自動發送給 Agent
      await handleSendMessage(ocrMessage, ocrContext);
    };

    window.addEventListener('ocrCompleted', handleOcrCompleted);
    window.addEventListener('healthReportOcrCompleted', handleHealthReportOcrCompleted);

    return () => {
      window.removeEventListener('ocrCompleted', handleOcrCompleted);
      window.removeEventListener('healthReportOcrCompleted', handleHealthReportOcrCompleted);
    };
  }, []);

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

  // ============= 即時語音通話功能 (Realtime API) =============
  
  // 開始語音通話
  const startVoiceCall = async () => {
    if (isVoiceCallActive) {
      // 如果已經在通話中，結束通話
      endVoiceCall();
      return;
    }

    setIsVoiceConnecting(true);
    setVoiceError(null);

    try {
      console.log('[ChatWindow] Starting voice call...');

      // 創建 realtime session
      console.log('[ChatWindow] Step 1: Creating session...');
      const sessionConfig = await realtimeVoiceService.createSession({
        conversationId: currentConversationId,
        voice: 'alloy', // 可以改為其他聲音: echo, fable, onyx, nova, shimmer
        language: i18n.language || 'zh-TW', // Use i18n.language directly
      });
      console.log('[ChatWindow] Using language:', i18n.language);

      console.log('[ChatWindow] Step 2: Session created:', sessionConfig.session_id);

      // 連接到 OpenAI Realtime API
      console.log('[ChatWindow] Step 3: Connecting to OpenAI...');
      await realtimeVoiceService.connect();
      console.log('[ChatWindow] Step 4: Connected successfully');

      // 設置事件監聽器
      realtimeVoiceService.on('conversation.updated', (event) => {
        console.log('Conversation updated:', event);
      });

      realtimeVoiceService.on('response.audio.delta', (event) => {
        // 音頻會自動播放
        console.log('Receiving audio response...');
      });

      // Note: conversation items are handled automatically by the SDK
      // We don't need to manually process them here
      
      realtimeVoiceService.on('error', (event) => {
        console.error('Realtime error:', event);
        setVoiceError('語音通話發生錯誤');
        endVoiceCall();
      });

      // 開始錄音
      console.log('[ChatWindow] Step 5: Starting audio recording...');
      await realtimeVoiceService.startRecording();
      console.log('[ChatWindow] Step 6: Recording started');

      setIsVoiceCallActive(true);
      setIsVoiceConnecting(false);
      console.log('[ChatWindow] ✅ Voice call active!');

    } catch (error) {
      console.error('[ChatWindow] ❌ Failed to start voice call:', error);
      console.error('[ChatWindow] Error details:', {
        message: error.message,
        stack: error.stack,
        error: error
      });

      // 顯示具體錯誤訊息
      const errorMsg = error.message || '無法啟動語音通話';
      setVoiceError(errorMsg);

      // 添加錯誤訊息到聊天
      const errorMessage = {
        id: Date.now(),
        text: `語音通話錯誤: ${errorMsg}`,
        isUser: false,
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);

      setIsVoiceConnecting(false);
      setIsVoiceCallActive(false);
    }
  };

  // 結束語音通話
  const endVoiceCall = () => {
    console.log('Ending voice call...');
    realtimeVoiceService.stopRecording();
    realtimeVoiceService.disconnect();
    setIsVoiceCallActive(false);
    setIsVoiceConnecting(false);
    setVoiceError(null);
  };

  // 清理函數：當組件卸載時結束通話
  useEffect(() => {
    return () => {
      if (isVoiceCallActive) {
        endVoiceCall();
      }
    };
  }, [isVoiceCallActive]);

  // ============= 即時語音通話功能結束 =============

  // 處理按鍵事件
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // 圖片處理函數
  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      // 檢查是否超過9張圖片限制
      const currentImageCount = selectedImages.length;
      const availableSlots = 9 - currentImageCount;

      if (availableSlots <= 0) {
        alert('最多只能上傳 9 張圖片');
        event.target.value = '';
        return;
      }

      // 限制新選擇的圖片數量
      const limitedImageFiles = imageFiles.slice(0, availableSlots);

      if (imageFiles.length > availableSlots) {
        alert(`最多只能再選擇 ${availableSlots} 張圖片`);
      }

      // 建立預覽 URL
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
        setSelectedImages(prev => {
          const newImages = [...prev, ...imagePreviews];
          // 使用 window 物件儲存（避免 localStorage 容量限制）
          window.__selectedFeedImages = newImages;
          console.log('[ChatWindow] 圖片已選擇並保存到 window.__selectedFeedImages:', newImages.length, '張');
          return newImages;
        });

        // 如果正在等待替換飼料圖片，自動發送訊息給 AI 重新進行 OCR
        if (isWaitingForFeedImageReplacement) {
          console.log('[ChatWindow] 檢測到用戶選擇新的飼料圖片，自動通知 AI 重新進行 OCR');
          setIsWaitingForFeedImageReplacement(false);

          // 自動發送訊息給 AI，告訴它重新進行 OCR 分析
          setTimeout(() => {
            const autoMessage = '[系統] 用戶已選擇新的圖片，請重新進行 OCR 分析';
            handleSendMessage(autoMessage);
          }, 500);
        }
      });
    }

    // 清空 input 的值
    event.target.value = '';
  };

  const removeImage = (imageId) => {
    setSelectedImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      // 更新 window 物件
      window.__selectedFeedImages = newImages;
      return newImages;
    });
  };

  const clearAllImages = () => {
    setSelectedImages([]);
    // 清除 window 物件和 localStorage
    delete window.__selectedFeedImages;
    localStorage.removeItem('feedOcrData');
    localStorage.removeItem('feedImageTypeMap');
  };

  // 發送訊息
  const handleSendMessage = async (customMessage = null, customContext = null) => {
    // 使用自訂訊息或 inputText
    const messageText = customMessage || inputText;

    // 確保至少有文字或圖片
    if ((typeof messageText !== 'string' || !messageText.trim()) && selectedImages.length === 0) return;

    // 如果正在錄音，先停止錄音
    stopVoiceRecording();

    // 保存當前的圖片數據，用於後續上傳
    const currentImages = selectedImages.length > 0 ? [...selectedImages] : [];

    console.log('[ChatWindow] handleSendMessage - currentImages:', currentImages.length, '張');
    console.log('[ChatWindow] handleSendMessage - window.__selectedFeedImages:', window.__selectedFeedImages?.length || 0, '張');

    // 確保 text 永遠是字符串
    const messageDisplayText = messageText?.trim()
      ? messageText
      : (currentImages.length > 0 ? `[${currentImages.length} 張圖片]` : '');

    const userMessage = {
      id: Date.now(),
      text: messageDisplayText,
      isUser: true,
      timestamp: new Date(),
      images: currentImages.length > 0 ? currentImages : undefined
    };

    // 確保傳到後端的只是純文字，沒有任何對象引用
    const userInput = String(messageText || '').trim();

    // 添加用戶訊息
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // 清空輸入框和圖片預覽
    if (!customMessage) {
      setInputText('');
    }
    // 立即清空圖片預覽區域（圖片已保存在 currentImages、userMessage 和 window.__selectedFeedImages 中）
    setSelectedImages([]);
    console.log('[ChatWindow] handleSendMessage - 已清空 selectedImages，但 window.__selectedFeedImages 保留');

    setIsTyping(true);

    try {
      // 合併預設 context 和自訂 context
      // 只傳遞可序列化的基本數據類型到後端，避免循環引用錯誤
      const defaultContext = {
        userId: Number(user?.id) || null,
        petId: Number(user?.pets?.[0]?.id) || null,
        hasImages: Boolean(currentImages.length > 0),
        imageCount: Number(currentImages.length) || 0
      };

      // 合併並清理 customContext，確保只包含可序列化的數據
      let finalContext = defaultContext;
      if (customContext) {
        try {
          // 深拷貝並清理循環引用（這會移除不可序列化的數據）
          const cleanCustomContext = JSON.parse(JSON.stringify(customContext));
          finalContext = { ...defaultContext, ...cleanCustomContext };
        } catch (e) {
          console.warn('[ChatWindow] customContext 包含不可序列化的數據，使用默認 context:', e);
          finalContext = defaultContext;
        }
      }

      // 使用正式後端 AI Chat Service
      const aiResult = await aiChatService.processMessage(userInput, finalContext);

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

      // 檢測是否需要展示確認圖片
      const needsConfirmationWithImages = aiResult.response?.includes('[[NEEDS_CONFIRMATION_WITH_IMAGES]]');
      const needsConfirmationHeadshot = aiResult.response?.includes('[[NEEDS_CONFIRMATION_HEADSHOT]]');

      const aiMessage = {
        id: Date.now() + 1,
        text: aiResult.response, // 保留原始文字（包含指令標記），前端可用於判斷
        isUser: false,
        timestamp: new Date(),
        // 加入確認相關資訊
        needsConfirmation: needsConfirmationWithImages || needsConfirmationHeadshot,
        confirmationImages: (needsConfirmationWithImages || needsConfirmationHeadshot) ? [...currentImages] : undefined,
        isHeadshotConfirmation: needsConfirmationHeadshot,
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
        operations: aiResult.operations || []
      };

      const finalMessages = [...newMessages, aiMessage];

      // NOTE: Navigation operations are no longer auto-executed.
      // They will be shown as buttons for user to click manually.

      setMessages(finalMessages);
      setIsTyping(false);

      // 更新當前對話 ID（後端會返回）
      if (aiResult.conversationId) {
        setCurrentConversationId(aiResult.conversationId);
        try { localStorage.setItem(LAST_CONV_ID_KEY, String(aiResult.conversationId)); } catch (e) {}
      }

      // 檢測 remove_image operation 並移除特定圖片
      if (aiResult.operations && Array.isArray(aiResult.operations)) {
        const removeImageOp = aiResult.operations.find(
          op => op.operation_type === 'remove_image'
        );

        if (removeImageOp) {
          try {
            const opData = typeof removeImageOp.operation_data === 'string'
              ? JSON.parse(removeImageOp.operation_data)
              : removeImageOp.operation_data;

            const imageIndex = opData.index - 1; // 轉換為 0-based 索引

            console.log(`[ChatWindow] 檢測到 remove_image operation，移除第 ${opData.index} 張圖片（索引 ${imageIndex}）`);

            setSelectedImages(prev => {
              const newImages = [...prev];
              if (imageIndex >= 0 && imageIndex < newImages.length) {
                newImages.splice(imageIndex, 1);
                // 同步更新 window 物件
                window.__selectedFeedImages = newImages;
                console.log(`[ChatWindow] 已移除圖片，剩餘 ${newImages.length} 張`);
                return newImages;
              }
              return prev;
            });

            // 如果移除的是飼料圖片，清除 OCR 相關快取
            if (imageIndex === 0 || imageIndex === 1) {
              localStorage.removeItem('feedOcrData');
              localStorage.removeItem('feedImageTypeMap');
              console.log('[ChatWindow] 已清除 OCR 快取');
            }

          } catch (error) {
            console.error('[ChatWindow] 解析 remove_image operation 失敗:', error);
          }
        }

        // 檢測 replace_image operation 並移除特定圖片（等待用戶選擇新圖片）
        const replaceImageOp = aiResult.operations.find(
          op => op.operation_type === 'replace_image'
        );

        if (replaceImageOp) {
          try {
            const opData = typeof replaceImageOp.operation_data === 'string'
              ? JSON.parse(replaceImageOp.operation_data)
              : replaceImageOp.operation_data;

            const imageIndex = opData.index - 1; // 轉換為 0-based 索引

            console.log(`[ChatWindow] 檢測到 replace_image operation，移除第 ${opData.index} 張圖片（索引 ${imageIndex}）並等待用戶選擇新圖片`);

            setSelectedImages(prev => {
              const newImages = [...prev];
              if (imageIndex >= 0 && imageIndex < newImages.length) {
                newImages.splice(imageIndex, 1);
                // 同步更新 window 物件
                window.__selectedFeedImages = newImages;
                console.log(`[ChatWindow] 已移除圖片，剩餘 ${newImages.length} 張，等待用戶選擇新圖片`);
                return newImages;
              }
              return prev;
            });

            // 如果替換的是飼料圖片，清除 OCR 相關快取並設置等待狀態
            if (imageIndex === 0 || imageIndex === 1) {
              localStorage.removeItem('feedOcrData');
              localStorage.removeItem('feedImageTypeMap');
              setIsWaitingForFeedImageReplacement(true);
              console.log('[ChatWindow] 已清除 OCR 快取，等待用戶選擇新的飼料圖片並重新進行 OCR');
            }

          } catch (error) {
            console.error('[ChatWindow] 解析 replace_image operation 失敗:', error);
          }
        }
      }

      // 檢測 post_created operation 並自動上傳圖片
      if (aiResult.operations && Array.isArray(aiResult.operations)) {
        const postCreatedOp = aiResult.operations.find(
          op => op.operation_type === 'post_created'
        );

        if (postCreatedOp) {
          // 優先使用 currentImages（當前訊息的圖片），如果為空則使用 window.__selectedFeedImages
          console.log('[ChatWindow] 檢測到 post_created operation');
          console.log('[ChatWindow] currentImages.length:', currentImages.length);
          console.log('[ChatWindow] window.__selectedFeedImages?.length:', window.__selectedFeedImages?.length || 0);

          const imagesToUpload = currentImages.length > 0
            ? currentImages
            : (window.__selectedFeedImages || []);

          console.log('[ChatWindow] imagesToUpload.length:', imagesToUpload.length);

          if (imagesToUpload.length > 0) {
            // 驗證圖片對象是否包含 file 屬性
            const validImages = imagesToUpload.filter(img => img && img.file);
            console.log('[ChatWindow] 有效圖片數量（包含 file 對象）:', validImages.length);

            if (validImages.length === 0) {
              console.error('[ChatWindow] 圖片對象缺少 file 屬性！');
              const errorMessage = {
                id: Date.now() + 2,
                text: `圖片上傳失敗：圖片數據無效。請重新選擇圖片。`,
                isUser: false,
                timestamp: new Date(),
                error: true,
                operations: []
              };
              setMessages(prev => [...prev, errorMessage]);
            } else {
              // 有有效圖片，執行上傳
              console.log('[ChatWindow] 檢測到 post_created operation，開始上傳圖片');
              console.log(`[ChatWindow] 使用${currentImages.length > 0 ? 'currentImages' : 'window.__selectedFeedImages'}，共 ${validImages.length} 張圖片`);

              try {
                const opData = typeof postCreatedOp.operation_data === 'string'
                  ? JSON.parse(postCreatedOp.operation_data)
                  : postCreatedOp.operation_data;

                const postId = opData.post_id;

                if (postId) {
                  setIsUploadingImages(true);

                  // 上傳圖片（使用驗證後的圖片）
                  const uploadResult = await aiChatService.uploadPostImages(
                    postId,
                    validImages
                  );

                  console.log('[ChatWindow] 圖片上傳成功:', uploadResult);

                  // 清空已上傳的圖片
                  clearAllImages();
                  setIsUploadingImages(false);

                  // 添加系統訊息通知用戶
                  const uploadSuccessMessage = {
                    id: Date.now() + 2,
                    text: `已成功上傳 ${uploadResult.data.uploaded_count} 張圖片到您的貼文！`,
                    isUser: false,
                    timestamp: new Date(),
                    operations: []
                  };

                  setMessages(prev => [...prev, uploadSuccessMessage]);

                } else {
                  console.error('[ChatWindow] post_created operation 中缺少 post_id');
                }

              } catch (uploadError) {
                console.error('[ChatWindow] 圖片上傳失敗:', uploadError);
                setIsUploadingImages(false);

                // 添加錯誤訊息
                const uploadErrorMessage = {
                  id: Date.now() + 2,
                  text: `圖片上傳失敗：${uploadError.message || '未知錯誤'}。您可以稍後在貼文頁面手動上傳。`,
                  isUser: false,
                  timestamp: new Date(),
                  error: true,
                  operations: []
                };

                setMessages(prev => [...prev, uploadErrorMessage]);
              }
            }
          } else {
            // 沒有圖片，但 AI 以為有圖片
            console.warn('[ChatWindow] 檢測到 post_created operation，但用戶沒有選擇圖片');

            const noImageWarning = {
              id: Date.now() + 2,
              text: `貼文已創建，但您沒有選擇任何圖片。如需添加圖片，請稍後在貼文頁面手動上傳。`,
              isUser: false,
              timestamp: new Date(),
              operations: []
            };

            setMessages(prev => [...prev, noImageWarning]);
          }
        }

        // 檢測 abnormal_post_created operation 並自動上傳圖片
        const abnormalPostCreatedOp = aiResult.operations.find(
          op => op.operation_type === 'abnormal_post_created'
        );

        if (abnormalPostCreatedOp) {
          // 優先使用 currentImages（當前訊息的圖片），如果為空則使用 window.__selectedFeedImages
          const imagesToUpload = currentImages.length > 0
            ? currentImages
            : (window.__selectedFeedImages || []);

          if (imagesToUpload.length > 0) {
            // 有圖片，執行上傳
            console.log('[ChatWindow] 檢測到 abnormal_post_created operation，開始上傳圖片');
            console.log(`[ChatWindow] 使用${currentImages.length > 0 ? 'currentImages' : 'window.__selectedFeedImages'}，共 ${imagesToUpload.length} 張圖片`);

            try {
              const opData = typeof abnormalPostCreatedOp.operation_data === 'string'
                ? JSON.parse(abnormalPostCreatedOp.operation_data)
                : abnormalPostCreatedOp.operation_data;

              const abnormalPostId = opData.abnormal_post_id;

              if (abnormalPostId) {
                setIsUploadingImages(true);

                // 上傳圖片
                const uploadResult = await aiChatService.uploadAbnormalPostImages(
                  abnormalPostId,
                  imagesToUpload
                );

                console.log('[ChatWindow] 異常記錄圖片上傳成功:', uploadResult);

                // 清空已上傳的圖片
                clearAllImages();
                setIsUploadingImages(false);

                // 添加系統訊息通知用戶
                const uploadSuccessMessage = {
                  id: Date.now() + 3,
                  text: `已成功上傳 ${uploadResult.data.uploaded_count} 張圖片到您的異常記錄！`,
                  isUser: false,
                  timestamp: new Date(),
                  operations: []
                };

                setMessages(prev => [...prev, uploadSuccessMessage]);

              } else {
                console.error('[ChatWindow] abnormal_post_created operation 中缺少 abnormal_post_id');
              }

            } catch (uploadError) {
              console.error('[ChatWindow] 異常記錄圖片上傳失敗:', uploadError);
              setIsUploadingImages(false);

              // 添加錯誤訊息
              const uploadErrorMessage = {
                id: Date.now() + 3,
                text: `圖片上傳失敗：${uploadError.message || '未知錯誤'}。您可以稍後在異常記錄頁面手動上傳。`,
                isUser: false,
                timestamp: new Date(),
                error: true,
                operations: []
              };

              setMessages(prev => [...prev, uploadErrorMessage]);
            }
          } else {
            // 沒有圖片，但 AI 以為有圖片
            console.warn('[ChatWindow] 檢測到 abnormal_post_created operation，但用戶沒有選擇圖片');

            const noImageWarning = {
              id: Date.now() + 3,
              text: `異常記錄已創建，但您沒有選擇任何圖片。如需添加圖片，請稍後在異常記錄頁面手動上傳。`,
              isUser: false,
              timestamp: new Date(),
              operations: []
            };

            setMessages(prev => [...prev, noImageWarning]);
          }
        }

        // 檢測 update_user_headshot operation 並自動上傳頭像
        const updateHeadshotOp = aiResult.operations.find(
          op => op.operation_type === 'update_user_headshot'
        );

        if (updateHeadshotOp) {
          if (currentImages.length === 1) {
            // 有圖片且只有一張，執行上傳
            console.log('[ChatWindow] 檢測到 update_user_headshot operation，開始上傳頭像');

            try {
              setIsUploadingImages(true);

              // 上傳頭像（只傳第一張圖片）
              const uploadResult = await aiChatService.uploadUserHeadshot(currentImages[0]);

              console.log('[ChatWindow] 頭像上傳成功:', uploadResult);

              // 清空已上傳的圖片
              clearAllImages();
              setIsUploadingImages(false);

              // 添加系統訊息通知用戶
              const uploadSuccessMessage = {
                id: Date.now() + 3,
                text: `頭像更新成功！您的新頭像已經生效了。`,
                isUser: false,
                timestamp: new Date(),
                operations: []
              };

              setMessages(prev => [...prev, uploadSuccessMessage]);

            } catch (uploadError) {
              console.error('[ChatWindow] 頭像上傳失敗:', uploadError);
              setIsUploadingImages(false);

              // 添加錯誤訊息
              const uploadErrorMessage = {
                id: Date.now() + 3,
                text: `頭像上傳失敗：${uploadError.message || '未知錯誤'}。請稍後再試或在個人資料頁面手動上傳。`,
                isUser: false,
                timestamp: new Date(),
                error: true,
                operations: []
              };

              setMessages(prev => [...prev, uploadErrorMessage]);
            }
          } else if (currentImages.length === 0) {
            // 沒有圖片
            console.warn('[ChatWindow] 檢測到 update_user_headshot operation，但用戶沒有選擇圖片');

            const noImageWarning = {
              id: Date.now() + 3,
              text: `請先點擊聊天框左下角的相片按鈕選擇您想要設定為頭像的照片。`,
              isUser: false,
              timestamp: new Date(),
              operations: []
            };

            setMessages(prev => [...prev, noImageWarning]);
          } else {
            // 圖片超過一張
            console.warn('[ChatWindow] 檢測到 update_user_headshot operation，但用戶選擇了多張圖片');

            const multipleImageWarning = {
              id: Date.now() + 3,
              text: `頭像只能設定一張照片。請點擊照片預覽區的 ✕ 按鈕移除多餘的照片，只保留一張您想要設定為頭像的照片。`,
              isUser: false,
              timestamp: new Date(),
              operations: []
            };

            setMessages(prev => [...prev, multipleImageWarning]);
          }
        }

        // 檢測 ocr_feed_analysis operation 並執行 OCR 分析
        const ocrOp = aiResult.operations.find(
          op => op.operation_type === 'ocr_feed_analysis'
        );

        if (ocrOp && currentImages.length >= 2) {
          console.log('[ChatWindow] 檢測到 ocr_feed_analysis operation，開始執行 OCR 分析');

          try {
            // 調用 aiChatService 執行 OCR 分析
            const ocrResult = await aiChatService.analyzeFeedWithOCR(currentImages);

            console.log('[ChatWindow] OCR 分析完成:', ocrResult);

            // 觸發 ocrCompleted 事件，供 useEffect 監聽並回傳給 Agent
            window.dispatchEvent(new CustomEvent('ocrCompleted', {
              detail: {
                ocrData: ocrResult.ocrData,
                rawText: ocrResult.rawText,
                nutritionImageIndex: ocrResult.nutritionImageIndex,
                frontImageIndex: ocrResult.frontImageIndex,
                imageTypeMap: ocrResult.imageTypeMap,
                imageCount: currentImages.length
              }
            }));

          } catch (ocrError) {
            console.error('[ChatWindow] OCR 分析失敗:', ocrError);

            // 添加錯誤訊息
            const ocrErrorMessage = {
              id: Date.now() + 5,
              text: `OCR 分析失敗：${ocrError.message || '未知錯誤'}`,
              isUser: false,
              timestamp: new Date(),
              error: true,
              operations: []
            };

            setMessages(prev => [...prev, ocrErrorMessage]);
          }
        }

        // 檢測 ocr_health_report_analysis operation 並執行健康報告 OCR 分析
        const healthOcrOp = aiResult.operations.find(
          op => op.operation_type === 'ocr_health_report_analysis'
        );

        if (healthOcrOp && currentImages.length >= 1) {
          console.log('[ChatWindow] 檢測到 ocr_health_report_analysis operation，開始執行健康報告 OCR 分析');

          try {
            // 從 operation_data 中獲取 pet_id
            const opData = typeof healthOcrOp.operation_data === 'string'
              ? JSON.parse(healthOcrOp.operation_data)
              : healthOcrOp.operation_data;

            const petId = opData.pet_id;

            if (!petId) {
              throw new Error('缺少寵物 ID，無法進行 OCR 分析');
            }

            console.log(`[ChatWindow] 使用寵物 ID ${petId} 進行健康報告 OCR 分析`);

            // 調用 aiChatService 執行健康報告 OCR 分析（只需要第一張圖片）
            const ocrResult = await aiChatService.analyzeHealthReportWithOCR(currentImages[0], petId);

            console.log('[ChatWindow] 健康報告 OCR 分析完成:', ocrResult);

            // 觸發 healthReportOcrCompleted 事件，供 useEffect 監聽並回傳給 Agent
            window.dispatchEvent(new CustomEvent('healthReportOcrCompleted', {
              detail: {
                ocrData: ocrResult.ocrData,
                petId: petId,
                imageCount: currentImages.length
              }
            }));

          } catch (ocrError) {
            console.error('[ChatWindow] 健康報告 OCR 分析失敗:', ocrError);

            // 添加錯誤訊息
            const ocrErrorMessage = {
              id: Date.now() + 5,
              text: `健康報告 OCR 分析失敗：${ocrError.message || '未知錯誤'}`,
              isUser: false,
              timestamp: new Date(),
              error: true,
              operations: []
            };

            setMessages(prev => [...prev, ocrErrorMessage]);
          }
        }

        // 檢測 feed_created operation 並自動上傳圖片（類似 post_created）
        const feedCreatedOp = aiResult.operations.find(
          op => op.operation_type === 'feed_created'
        );

        if (feedCreatedOp) {
          if (currentImages.length > 0) {
            // 有圖片，執行上傳或匹配邏輯
            try {
              const opData = typeof feedCreatedOp.operation_data === 'string'
                ? JSON.parse(feedCreatedOp.operation_data)
                : feedCreatedOp.operation_data;

              const feedId = opData.feed_id || opData.feedId;
              const isExisting = opData.is_existing || false;

              if (feedId) {
                // ✅ 檢查是否為智能匹配到的已存在飼料
                if (isExisting) {
                  console.log('[ChatWindow] 智能匹配到已存在的飼料，清除圖片快取');

                  // 清除圖片快取（不上傳）
                  clearAllImages();

                  // 添加系統訊息通知用戶
                  const matchedMessage = {
                    id: Date.now() + 5,
                    text: `已智能匹配到資料庫中現有的飼料，無需重複上傳圖片。`,
                    isUser: false,
                    timestamp: new Date(),
                    operations: []
                  };

                  setMessages(prev => [...prev, matchedMessage]);

                } else {
                  // 新建立的飼料，上傳圖片
                  console.log('[ChatWindow] 檢測到 feed_created operation，開始上傳圖片');

                  setIsUploadingImages(true);

                  // 上傳圖片
                  const uploadResult = await aiChatService.uploadFeedImages(feedId, currentImages);

                  console.log('[ChatWindow] 飼料圖片上傳成功:', uploadResult);

                  // 清空已上傳的圖片
                  clearAllImages();
                  setIsUploadingImages(false);

                  // 添加系統訊息通知用戶
                  const uploadSuccessMessage = {
                    id: Date.now() + 5,
                    text: `已成功上傳 ${uploadResult.data.uploaded_count} 張圖片到您的飼料！`,
                    isUser: false,
                    timestamp: new Date(),
                    operations: []
                  };

                  setMessages(prev => [...prev, uploadSuccessMessage]);
                }

              } else {
                console.error('[ChatWindow] feed_created operation 中缺少 feed_id');
              }

            } catch (uploadError) {
              console.error('[ChatWindow] 飼料圖片上傳失敗:', uploadError);
              setIsUploadingImages(false);

              // 添加錯誤訊息
              const uploadErrorMessage = {
                id: Date.now() + 5,
                text: `圖片上傳失敗：${uploadError.message || '未知錯誤'}。`,
                isUser: false,
                timestamp: new Date(),
                error: true,
                operations: []
              };

              setMessages(prev => [...prev, uploadErrorMessage]);
            }
          } else {
            // 沒有圖片，但 AI 以為有圖片
            console.warn('[ChatWindow] 檢測到 feed_created operation，但用戶沒有選擇圖片');

            const noImageWarning = {
              id: Date.now() + 5,
              text: `飼料記錄已創建，但您沒有選擇任何圖片。如需添加飼料圖片，請稍後手動上傳。`,
              isUser: false,
              timestamp: new Date(),
              operations: []
            };

            setMessages(prev => [...prev, noImageWarning]);
          }
        }
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

  // 清理訊息中的指令標記
  const cleanMessageText = (text) => {
    if (!text || typeof text !== 'string') return text;

    // 移除所有指令標記
    return text
      .replace(/\[\[NEEDS_CONFIRMATION_WITH_IMAGES\]\]/g, '')
      .replace(/\[\[NEEDS_CONFIRMATION_HEADSHOT\]\]/g, '')
      .replace(/\[\[NEEDS_CONFIRMATION\]\]/g, '')
      .trim();
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
          text: messageData?.response || msg.content, // 保留原始文字（包含指令標記）
          isUser: msg.role === 'user',
          timestamp: new Date(msg.created_at),
          tutorial: messageData?.tutorial ?? msg.tutorial_type ?? null,
          recommendedUsers,
          recommendedSocialPosts,
          recommendedForumPosts,
          hasCalculator: (messageData?.hasCalculator ?? msg.has_calculator) || false,
          operations: messageData?.operations || additionalData?.operations || [],
          operationParams: additionalData?.operationParams || additionalData?.operation_params || {}
        };
      }));

    return formattedMessages;
  };

  // 開啟聊天視窗時恢復最後的對話或顯示歡迎訊息
  useEffect(() => {
    if (!isOpen) return;

    // 只在訊息為空時處理（避免重複載入）
    if (messages.length === 0 && ready) {
      // 嘗試從 localStorage 恢復最後的對話
      try {
        const lastConvId = localStorage.getItem(LAST_CONV_ID_KEY);

        if (lastConvId) {
          console.log('[ChatWindow] 恢復最後的對話:', lastConvId);

          // 載入對話
          aiChatService.loadConversation(lastConvId)
            .then(conversationDetail => {
              // 格式化訊息
              return formatMessagesFromConversationDetail(conversationDetail);
            })
            .then(formattedMessages => {
              if (formattedMessages && formattedMessages.length > 0) {
                setMessages(formattedMessages);
                setCurrentConversationId(lastConvId);
                console.log('[ChatWindow] 成功恢復對話，訊息數:', formattedMessages.length);
              } else {
                // 如果沒有訊息，顯示歡迎訊息
                showWelcomeMessage();
              }
            })
            .catch(error => {
              console.warn('[ChatWindow] 載入對話失敗，顯示歡迎訊息:', error);
              // 載入失敗時顯示歡迎訊息
              showWelcomeMessage();
            });
        } else {
          // 沒有保存的對話 ID，顯示歡迎訊息
          showWelcomeMessage();
        }
      } catch (e) {
        console.warn('[ChatWindow] 處理對話恢復時出錯:', e);
        showWelcomeMessage();
      }
    }

    // 顯示歡迎訊息的輔助函數
    function showWelcomeMessage() {
      console.log('[ChatWindow] 顯示歡迎訊息');
      setCurrentConversationId(null);
      aiChatService.startNewConversation();
      setMessages([
        {
          id: 1,
          text: t('chatWindow.welcomeMessage'),
          isUser: false,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, ready, t]);

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

  // 處理導航按鈕點擊
  const handleNavigationClick = (operation) => {
    console.log('執行導航操作:', operation);

    try {
      const opData = typeof operation.operation_data === 'string'
        ? JSON.parse(operation.operation_data)
        : operation.operation_data;

      if (!opData.path) {
        console.error('導航操作缺少路徑:', operation);
        return;
      }

      // 延遲一下讓用戶看到訊息，然後關閉聊天室並導航
      setTimeout(() => {
        // 啟動浮動模式
        window.dispatchEvent(new CustomEvent('forceFloatingMode'));

        // 停止語音錄音並關閉聊天室
        stopVoiceRecording();
        onClose();

        // 執行導航
        navigate(opData.path);
      }, 300);
    } catch (error) {
      console.error('解析導航操作失敗:', error, operation);
    }
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
    // 檢查是否有選擇的圖片
    if (selectedImages.length > 0) {
      // 有圖片時顯示確認對話框
      setPendingAction({ type: 'switch', conversation });
      setShowImageConfirm(true);
      return;
    }

    // 沒有圖片時直接執行切換
    executeSwitchConversation(conversation);
  };

  // 實際執行切換對話操作
  const executeSwitchConversation = async (conversation) => {
    // 清除選擇的圖片
    if (selectedImages.length > 0) {
      setSelectedImages([]);
    }

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
    // 檢查是否有選擇的圖片
    if (selectedImages.length > 0) {
      // 有圖片時顯示確認對話框
      setPendingAction({ type: 'new' });
      setShowImageConfirm(true);
      return;
    }

    // 沒有圖片時直接執行新對話
    executeNewConversation();
  };

  // 實際執行新對話操作
  const executeNewConversation = () => {
    // 清除選擇的圖片
    if (selectedImages.length > 0) {
      setSelectedImages([]);
    }

    // Reset AI Chat Service session state (in-memory only, no DB call yet)
    aiChatService.startNewConversation();

    // Show welcome message locally
    setMessages([
      {
        id: 1,
        text: t('chatWindow.welcomeMessage'),
        isUser: false,
        timestamp: new Date()
      }
    ]);

    // Clear conversation ID - new conversation will be created in DB when user sends first message
    setCurrentConversationId(null);
    try { localStorage.removeItem(LAST_CONV_ID_KEY); } catch (e) {}

    console.log('[ChatWindow] Started new conversation (no DB creation yet)');
  };

  // 處理確認離開（清除圖片）
  const handleConfirmLeave = () => {
    setShowImageConfirm(false);

    // 根據待執行的操作類型執行相應的動作
    if (pendingAction === 'close') {
      executeClose();
    } else if (pendingAction?.type === 'switch') {
      executeSwitchConversation(pendingAction.conversation);
    } else if (pendingAction?.type === 'new') {
      executeNewConversation();
    }

    // 清除待執行操作
    setPendingAction(null);
  };

  // 處理取消離開（保留圖片）
  const handleCancelLeave = () => {
    setShowImageConfirm(false);
    setPendingAction(null);
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
    // 檢查是否有選擇的圖片
    if (selectedImages.length > 0) {
      // 有圖片時顯示確認對話框
      setPendingAction('close');
      setShowImageConfirm(true);
      return;
    }

    // 沒有圖片時直接執行關閉
    executeClose();
  };

  // 實際執行關閉操作
  const executeClose = () => {
    // 如果正在錄音，先停止錄音
    stopVoiceRecording();

    // 關閉側邊欄（如果開啟）
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }

    // 清除選擇的圖片
    if (selectedImages.length > 0) {
      setSelectedImages([]);
    }

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
            <span className={styles.status}>
              {isVoiceCallActive ? '通話中...' :
               isVoiceConnecting ? '連線中...' :
               voiceError ? voiceError :
               t('chatWindow.status')}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {/* 語音通話按鈕 */}
          <button
            className={`${styles.voiceCallButton} ${isVoiceCallActive ? styles.active : ''} ${isVoiceConnecting ? styles.connecting : ''}`}
            onClick={startVoiceCall}
            disabled={isVoiceConnecting}
            title={isVoiceCallActive ? '結束通話' : '開始語音通話'}
          >
            {isVoiceConnecting ? (
              <img src="/assets/icon/spinner-of-dots.png" alt="連接中" />
            ) : isVoiceCallActive ? (
              <img src="/assets/icon/telephone.png" alt="通話中" />
            ) : (
              <img src="/assets/icon/telephone.png" alt="開始語音通話" />
            )}
          </button>
          <button className={styles.closeButton} onClick={handleChatClose}>
            ×
          </button>
        </div>
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
                    {String(cleanMessageText(message.text) || '').split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < String(cleanMessageText(message.text) || '').split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  {/* 如果有確認圖片，顯示圖片預覽（帶編號） */}
                  {message.confirmationImages && message.confirmationImages.length > 0 && (
                    <div className={styles.messageImagesGrid}>
                      {message.confirmationImages.map((image, idx) => (
                        <div key={image.id || idx} className={styles.messageImageItem}>
                          <div className={styles.imageNumberLabel}>第 {idx + 1} 張</div>
                          <img
                            src={image.preview}
                            alt={`確認圖片 ${idx + 1}`}
                            className={styles.messageImage}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 如果有教學模式，顯示開始教學按鈕 */}
                  {message.tutorial && (
                    <button
                      className={styles.tutorialButton}
                      onClick={() => handleStartTutorial(message.tutorial)}
                    >
                      {t(`chatWindow.tutorial.titles.${message.tutorial}`) 
                        ? t('chatWindow.tutorial.startButtonWithTitle', { 
                            tutorialTitle: t(`chatWindow.tutorial.titles.${message.tutorial}`)
                          })
                        : t('chatWindow.tutorial.startButton')}
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
                  {message.operations && message.operations.length > 0 && (() => {
                    // 找出導航操作
                    const navigateOp = message.operations.find(op =>
                      op.operation_type === 'navigate' || op.operation_type === 'navigation'
                    );
                    // 找出其他操作（排除 navigate 和背景自動執行的操作）
                    const backgroundOps = [
                      'ocr_feed_analysis', 
                      'ocr_health_report_analysis', 
                      'abnormal_post_created', 
                      'update_user_headshot',
                      'post_created',
                      'feed_created'
                    ]; // 背景自動執行，不顯示按鈕
                    const otherOps = message.operations.filter(op =>
                      op.operation_type !== 'navigate' &&
                      op.operation_type !== 'navigation' &&
                      !backgroundOps.includes(op.operation_type)
                    );

                    return (
                      <>
                        {/* 顯示導航按鈕 */}
                        {navigateOp && (() => {
                          try {
                            const opData = typeof navigateOp.operation_data === 'string'
                              ? JSON.parse(navigateOp.operation_data)
                              : navigateOp.operation_data;
                            
                            return (
                              <button
                                className={styles.tutorialButton}
                                onClick={() => handleNavigationClick(navigateOp)}
                              >
                                {opData.destination 
                                  ? `前往${opData.destination}` 
                                  : t('chatWindow.operation.buttons.navigate', '前往頁面')}
                              </button>
                            );
                          } catch (e) {
                            console.error('解析導航操作失敗:', e);
                            return null;
                          }
                        })()}
                      </>
                    );
                  })()}
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
                    {String(cleanMessageText(message.text) || '').split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < String(cleanMessageText(message.text) || '').split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* 🎨 顯示用戶選擇的圖片（類似留言區的圖片網格） */}
                  {message.images && message.images.length > 0 && (
                    <div className={styles.messageImagesGrid}>
                      {message.images.map((image, idx) => (
                        <div key={image.id || idx} className={styles.messageImageItem}>
                          <img
                            src={image.preview}
                            alt={`選擇的圖片 ${idx + 1}`}
                            className={styles.messageImage}
                          />
                        </div>
                      ))}
                    </div>
                  )}

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
        {/* 圖片預覽區域 */}
        {selectedImages.length > 0 && (
          <div className={styles.imagePreviewContainer}>
            {selectedImages.map((image) => (
              <div key={image.id} className={styles.imagePreviewItem}>
                <img src={image.preview} alt="預覽圖片" className={styles.previewImage} />
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

        {/* 圖片上傳進度提示 */}
        {isUploadingImages && (
          <div className={styles.uploadingIndicator}>
            <span>正在上傳圖片...</span>
          </div>
        )}

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
            <button
              className={styles.photoBtn}
              onClick={handleImageSelect}
              title="新增圖片"
            >
              <img src="/assets/icon/CommentPhotoIcon.png" alt="新增圖片" />
            </button>
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage();
              }}
              disabled={!inputText.trim() && selectedImages.length === 0}
              title={t('chatWindow.sendButton')}
            >
              <img src="/assets/icon/CommentSendIcon.png" alt={t('chatWindow.sendButton')} />
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

      {/* 側邊欄 */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
      />

      {/* 圖片清除確認對話框 */}
      {showImageConfirm && (
        <ConfirmNotification
          message={`您有 ${selectedImages.length} 張已選擇的圖片。如果離開此對話，下次將需要重新選擇圖片。確定要繼續嗎？`}
          onConfirm={handleConfirmLeave}
          onCancel={handleCancelLeave}
        />
      )}
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