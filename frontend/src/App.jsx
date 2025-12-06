import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import './i18n/i18n';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPageV2';
import UserProfilePage from './pages/UserProfilePage';
import OtherUserProfilePage from './pages/OtherUserProfilePage';
import UserFollowConditionPage from './pages/UserFollowConditionPage';
import UserPostsPage from './pages/UserPostsPage';
import SocialPage from './pages/SocialPage';
import SettingsPage from './pages/SettingsPage';
import NotificationPage from './pages/NotificationPage';
import PetPage from './pages/PetPage';
import AddPetPage from './pages/AddPetPage';
import EditPetPage from './pages/EditPetPage';
import CreatePostPage from './pages/CreatePostPage';
import CreateAbnormalPostPage from './pages/CreateAbnormalPostPage';
import EditAbnormalPostPage from './pages/EditAbnormalPostPage';
import PostPreviewPage from './pages/PostPreviewPage';
import EditPostPage from './pages/EditPostPage';
import PostDetailPage from './pages/PostDetailPage';
import SearchPostsPage from './pages/SearchPostsPage';
import LikedPostsPage from './pages/LikedPostsPage';
import LikedPostsListPage from './pages/LikedPostsListPage';
import SavedPostsPage from './pages/SavedPostsPage';
import SavedPostsListPage from './pages/SavedPostsListPage';
import LikedArchivesPage from './pages/LikedArchivesPage';
import SavedArchivesPage from './pages/SavedArchivesPage';
import PetRelatedPostsPage from './pages/PetRelatedPostsPage';
import PetRelatedPostsListPage from './pages/PetRelatedPostsListPage';
import PetAbnormalPostsPage from './pages/PetAbnormalPostsPage';
import AbnormalPostDetailPage from './pages/AbnormalPostDetailPage';
import CalculatorPage from './pages/CalculatorPageV2';
import FeedPage from './pages/FeedPage';
import FeedDetailPage from './pages/FeedDetailPage';
import MarkedFeedsPage from './pages/MarkedFeedsPage';
import AllFeedsPage from './pages/AllFeedsPage';
import FeedSearchResultPage from './pages/FeedSearchResultPage';
import { isAuthenticated, refreshAccessToken } from './services/authService';
import HealthReportsPage from './pages/HealthReportsPage';
import HealthReportUploadPage from './pages/HealthReportUploadPage';
import HealthReportDetailPage from './pages/HealthReportDetailPage';
import HealthReportEditPage from './pages/HealthReportEditPage';
import PetDiseaseArchivePage from './pages/PetDiseaseArchivePage';
import CreateDiseaseArchivePage from './pages/CreateDiseaseArchivePage';
import DiseaseArchiveEditContentPage from './pages/DiseaseArchiveEditContentPage';
import DiseaseArchivePreviewPage from './pages/DiseaseArchivePreviewPage';
import DiseaseArchiveDetailPage from './pages/DiseaseArchiveDetailPage';
import InteractiveCityPage from './pages/InteractiveCityPage';
import CheckpointDetailPage from './pages/CheckpointDetailPage';
import { UserProvider } from './context/UserContext';
import { TutorialProvider, useTutorial } from './context/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';
import FloatingAIAvatar from './components/FloatingAIAvatar';
import ChatWindow from './components/ChatWindow';
import { realtimeVoiceService } from './services/realtimeVoiceService_agents';

// 全局浮動AI頭像管理器
const GlobalFloatingAI = ({ user }) => {
  const [floatingMode, setFloatingMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isForceMode, setIsForceMode] = useState(false); // 強制模式標記
  // 初始化時檢查語音服務是否已連接
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(() => realtimeVoiceService.isConnected());
  const location = useLocation();
  const navigate = useNavigate();

  // 監聽全局AI聊天啟動事件
  useEffect(() => {
    const handleStartFloatingChat = (event) => {
      console.log('啟動全局浮動聊天');
      setFloatingMode(true);
      setIsChatOpen(true);
    };

    const handleCloseFloatingChat = (event) => {
      console.log('關閉全局浮動聊天');
      setFloatingMode(false);
      setIsChatOpen(false);
    };

    const handleForceFloatingMode = (event) => {
      console.log('強制啟動浮動模式（ChatWindow 導航觸發）');
      setFloatingMode(true);
      setIsForceMode(true);
      // 設置一個定時器，在導航完成後清除強制模式標記
      setTimeout(() => {
        console.log('清除強制模式標記');
        setIsForceMode(false);
      }, 2000); // 2秒後清除強制模式
    };

    // 語音導航專用事件：保持浮動模式並標記語音狀態
    const handleVoiceNavigate = (event) => {
      console.log('語音導航觸發，啟動浮動模式並保持語音狀態');
      const { isVoiceActive } = event.detail || {};
      setFloatingMode(true);
      setIsForceMode(true);
      if (isVoiceActive) {
        setIsVoiceCallActive(true);
      }
      // 關閉聊天視窗但保持浮動頭像可見（與文字代理相同邏輯）
      setIsChatOpen(false);
      // 設置一個定時器，在導航完成後清除強制模式標記
      setTimeout(() => {
        console.log('清除強制模式標記');
        setIsForceMode(false);
      }, 2000);
    };

    const handleDismissFloatingAvatar = (event) => {
      console.log('自動關閉漂浮頭像（教學模式觸發）');
      setFloatingMode(false);
      setIsChatOpen(false);
      setIsForceMode(false);
    };

    window.addEventListener('startFloatingChat', handleStartFloatingChat);
    window.addEventListener('closeFloatingChat', handleCloseFloatingChat);
    window.addEventListener('forceFloatingMode', handleForceFloatingMode);
    window.addEventListener('voiceNavigate', handleVoiceNavigate);
    window.addEventListener('dismissFloatingAvatar', handleDismissFloatingAvatar);

    return () => {
      window.removeEventListener('startFloatingChat', handleStartFloatingChat);
      window.removeEventListener('closeFloatingChat', handleCloseFloatingChat);
      window.removeEventListener('forceFloatingMode', handleForceFloatingMode);
      window.removeEventListener('voiceNavigate', handleVoiceNavigate);
      window.removeEventListener('dismissFloatingAvatar', handleDismissFloatingAvatar);
    };
  }, []);

  // 當位置改變時，檢查是否應該啟用浮動模式
  useEffect(() => {
    // 只有當浮動模式已啟動時才處理路徑變化
    if (floatingMode) {
      // 檢查是否在有AINavigator的主頁面
      const isOnMainPages =
        location.pathname === '/' ||
        location.pathname === '/main';

      // 直接從服務檢查語音連接狀態，避免狀態同步延遲問題
      const isVoiceActive = isVoiceCallActive || realtimeVoiceService.isConnected();

      console.log('全局AI頭像 - 當前路徑:', location.pathname);
      console.log('全局AI頭像 - 是否在主頁面:', isOnMainPages);
      console.log('全局AI頭像 - 當前狀態:', { floatingMode, isChatOpen, isForceMode, isVoiceCallActive, isVoiceActive });

      if (!isOnMainPages) {
        console.log('在非主頁面，確保顯示浮動頭像');
        // 在非主頁面，如果聊天是開啟的，關閉它顯示浮動頭像
        // 但如果語音通話進行中，保持聊天開啟
        if (isChatOpen && !isVoiceActive) {
          console.log('關閉展開的聊天，顯示浮動頭像');
          setIsChatOpen(false);
        } else if (isChatOpen && isVoiceActive) {
          console.log('語音通話進行中，保持聊天視窗開啟');
        }
      } else if (!isForceMode) {
        // 只有在非強制模式下才關閉浮動模式
        console.log('回到主頁面且非強制模式，關閉浮動模式');
        setFloatingMode(false);
        setIsChatOpen(false);
      } else {
        console.log('回到主頁面但處於強制模式，保持浮動模式');
      }
    }
  }, [location.pathname, floatingMode, isForceMode, isVoiceCallActive]);

  // 單獨處理聊天開啟狀態變化，避免衝突
  useEffect(() => {
    // 當聊天開啟時，如果在非主頁面且不是浮動模式，啟動浮動模式
    if (isChatOpen && !floatingMode) {
      const isOnMainPages =
        location.pathname === '/' ||
        location.pathname === '/main';

      if (!isOnMainPages) {
        console.log('聊天開啟且不在主頁面，啟動浮動模式');
        setFloatingMode(true);
      }
    }
  }, [isChatOpen, floatingMode, location.pathname]);

  const handleToggleFloating = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleDismissFloating = () => {
    setFloatingMode(false);
    setIsChatOpen(false);
  };

  const handleChatClose = () => {
    // 關閉聊天視窗
    setIsChatOpen(false);
    // 浮動模式狀態由路徑變化自動管理，這裡不做變更
  };

  // 處理語音通話狀態變化 (從 ChatWindow 回傳)
  const handleVoiceStateChange = (isActive) => {
    console.log('GlobalFloatingAI - 語音通話狀態變化:', isActive);
    setIsVoiceCallActive(isActive);
  };

  // 只在浮動模式下渲染
  if (!floatingMode) return null;

  return (
    <>
      {/* 浮動 AI 頭像 - 最高 z-index */}
      {/* 當語音通話進行中，即使聊天視窗開啟也顯示浮動頭像作為指示器 */}
      <FloatingAIAvatar
        isVisible={!isChatOpen || isVoiceCallActive}
        onAvatarClick={handleToggleFloating}
        onDismiss={handleDismissFloating}
        isVoiceActive={isVoiceCallActive}
      />

      {/* 展開的聊天視窗 */}
      {isChatOpen && (
        <ChatWindow
          isOpen={isChatOpen}
          onClose={handleChatClose}
          user={user}
          floatingMode={true}
          onToggleFloating={handleToggleFloating}
          onDismissFloating={handleDismissFloating}
          onVoiceStateChange={handleVoiceStateChange}
        />
      )}
    </>
  );
};

// 教學模式管理組件 - 必須在 TutorialProvider 內部使用
const TutorialManager = () => {
  const { tutorialMode, startTutorial, endTutorial } = useTutorial();

  useEffect(() => {
    // 監聽教學啟動事件
    const handleStartTutorial = (event) => {
      const { tutorialType } = event.detail;
      console.log('TutorialManager 收到教學啟動事件:', tutorialType);
      startTutorial(tutorialType);
    };
    window.addEventListener('startTutorial', handleStartTutorial);

    return () => {
      window.removeEventListener('startTutorial', handleStartTutorial);
    };
  }, [startTutorial]);

  // 處理教學完成
  const handleTutorialComplete = () => {
    console.log('教學完成');
    endTutorial();
  };

  // 處理教學跳過
  const handleTutorialSkip = () => {
    console.log('教學跳過');
    endTutorial();
  };

  if (!tutorialMode.isActive) return null;

  return (
    <TutorialOverlay
      tutorialType={tutorialMode.tutorialType}
      onComplete={handleTutorialComplete}
      onSkip={handleTutorialSkip}
    />
  );
};

const App = () => {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // 檢查認證狀態並嘗試刷新 Token
    const checkAuth = async () => {
      try {
        // 如果有 token 但即將過期，先嘗試刷新
        const token = localStorage.getItem('accessToken');
        if (token) {
          // 解碼 token 查看過期時間
          try {
            const payload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            const currentTime = Math.floor(Date.now() / 1000);
            // 如果 token 將在 5 分鐘內過期，主動刷新
            if ((decodedPayload.exp - currentTime) < 300) {
              await refreshAccessToken();
            }
          } catch (error) {
            console.error('解析 token 失敗:', error);
          }
        }
        
        // 檢查認證狀態
        const authStatus = isAuthenticated();
        setIsUserAuthenticated(authStatus);
      } catch (error) {
        console.error('認證檢查失敗:', error);
        setIsUserAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    // 初始檢查
    checkAuth();

    // 添加自定義事件監聽器
    window.addEventListener('auth-change', checkAuth);
    
    // 監聽登出事件
    const handleLogout = () => {
      // 清除 AI 會話本地快取，避免跨帳號殘留
      try {
        localStorage.removeItem('aiChat.lastConversationId');
        localStorage.removeItem('aiChat.lastMessages');
      } catch (e) {
        // no-op
      }
      setIsUserAuthenticated(false);
    };
    window.addEventListener('auth-logout', handleLogout);

    // 定期檢查 token 是否有效（每分鐘）
    const intervalId = setInterval(checkAuth, 60000);

    return () => {
      window.removeEventListener('auth-change', checkAuth);
      window.removeEventListener('auth-logout', handleLogout);
      clearInterval(intervalId);
    };
  }, []);

  // 認證檢查中顯示載入畫面
  if (isAuthLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#FFF2D9',
        fontSize: '1.2rem',
        color: '#333'
      }}>
        載入中...
      </div>
    );
  }

  return (
    <UserProvider>
      <TutorialProvider>
      <BrowserRouter>
          <Routes>
        {/* 根路徑：已登入導向MainPage，未登入導向HomePage */}
        <Route 
          path="/" 
          element={isUserAuthenticated ? <MainPage /> : <HomePage />} 
        />
        {/* 登入頁面：已登入導向MainPage */}
        <Route 
          path="/login" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <LoginPage />} 
        />
        {/* 註冊頁面：已登入導向MainPage */}
        <Route 
          path="/register" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <RegisterPage />} 
        />
        {/* 主頁面：未登入導向HomePage */}
        <Route 
          path="/main" 
          element={isUserAuthenticated ? <MainPage /> : <Navigate to="/" />} 
        />
        {/* 用戶個人頁：未登入導向HomePage */}
        <Route 
          path="/user-profile" 
          element={isUserAuthenticated ? <UserProfilePage /> : <Navigate to="/" />} 
        />
        {/* 其他用戶個人頁：未登入導向HomePage */}
        <Route 
          path="/user/:userAccount" 
          element={isUserAuthenticated ? <OtherUserProfilePage /> : <Navigate to="/" />} 
        />
        {/* 用戶追蹤狀況頁面：未登入導向HomePage */}
        <Route 
          path="/user/:userAccount/follow/:type" 
          element={isUserAuthenticated ? <UserFollowConditionPage /> : <Navigate to="/" />} 
        />
        {/* 用戶貼文列表頁面：未登入導向HomePage */}
        <Route 
          path="/user-posts" 
          element={isUserAuthenticated ? <UserPostsPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/user/:userAccount/posts" 
          element={isUserAuthenticated ? <UserPostsPage /> : <Navigate to="/" />} 
        />
        {/* 社群頁面：未登入導向HomePage */}
        <Route 
          path="/social" 
          element={isUserAuthenticated ? <SocialPage /> : <Navigate to="/" />} 
        />
        {/* 社群搜尋結果頁面：未登入導向HomePage */}
        <Route 
          path="/social/search" 
          element={isUserAuthenticated ? <SocialPage /> : <Navigate to="/" />} 
        />
        {/* 搜尋貼文頁面：未登入導向HomePage */}
        <Route 
          path="/search-posts" 
          element={isUserAuthenticated ? <SearchPostsPage /> : <Navigate to="/" />} 
        />
        {/* 設定頁面：未登入導向HomePage */}
        <Route 
          path="/settings" 
          element={isUserAuthenticated ? <SettingsPage /> : <Navigate to="/" />} 
        />
        {/* 按讚貼文頁面：未登入導向HomePage */}
        <Route 
          path="/liked-posts" 
          element={isUserAuthenticated ? <LikedPostsPage /> : <Navigate to="/" />} 
        />
        {/* 按讚貼文列表頁面：未登入導向HomePage */}
        <Route 
          path="/liked-posts-list" 
          element={isUserAuthenticated ? <LikedPostsListPage /> : <Navigate to="/" />} 
        />
        {/* 收藏貼文頁面：未登入導向HomePage */}
        <Route 
          path="/saved-posts" 
          element={isUserAuthenticated ? <SavedPostsPage /> : <Navigate to="/" />} 
        />
        {/* 收藏貼文列表頁面：未登入導向HomePage */}
        <Route 
          path="/saved-posts-list" 
          element={isUserAuthenticated ? <SavedPostsListPage /> : <Navigate to="/" />} 
        />
        {/* 按讚的論壇文章頁面：未登入導向HomePage */}
        <Route 
          path="/liked-archives" 
          element={isUserAuthenticated ? <LikedArchivesPage /> : <Navigate to="/" />} 
        />
        {/* 收藏的論壇文章頁面：未登入導向HomePage */}
        <Route 
          path="/saved-archives" 
          element={isUserAuthenticated ? <SavedArchivesPage /> : <Navigate to="/" />} 
        />
        {/* 寵物相關貼文頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/posts" 
          element={isUserAuthenticated ? <PetRelatedPostsPage /> : <Navigate to="/" />} 
        />
        {/* 寵物相關貼文列表頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/posts-list" 
          element={isUserAuthenticated ? <PetRelatedPostsListPage /> : <Navigate to="/" />} 
        />
        {/* 通知頁面：未登入導向HomePage */}
        <Route 
          path="/notifications" 
          element={isUserAuthenticated ? <NotificationPage /> : <Navigate to="/" />} 
        />
        {/* 寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet" 
          element={isUserAuthenticated ? <PetPage /> : <Navigate to="/" />} 
        />
        {/* 新增寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet/add" 
          element={isUserAuthenticated ? <AddPetPage /> : <Navigate to="/" />} 
        />
        {/* 編輯寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/edit" 
          element={isUserAuthenticated ? <EditPetPage /> : <Navigate to="/" />} 
        />
        {/* 寵物疾病檔案頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/disease-archive" 
          element={isUserAuthenticated ? <PetDiseaseArchivePage /> : <Navigate to="/" />} 
        />
        {/* 建立疾病檔案頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/disease-archive/create" 
          element={isUserAuthenticated ? <CreateDiseaseArchivePage /> : <Navigate to="/" />} 
        />
        {/* 疾病檔案編輯頁面（第二步驟）：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/disease-archive/edit-content" 
          element={isUserAuthenticated ? <DiseaseArchiveEditContentPage /> : <Navigate to="/" />} 
        />
        {/* 疾病檔案預覽頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/disease-archive/preview" 
          element={isUserAuthenticated ? <DiseaseArchivePreviewPage /> : <Navigate to="/" />} 
        />
        {/* 疾病檔案詳細頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/disease-archive/:archiveId" 
          element={isUserAuthenticated ? <DiseaseArchiveDetailPage /> : <Navigate to="/" />} 
        />
        {/* 公開疾病檔案詳細頁面：未登入導向HomePage */}
        <Route 
          path="/disease-archive/:archiveId/public" 
          element={isUserAuthenticated ? <DiseaseArchiveDetailPage /> : <Navigate to="/" />} 
        />
        {/* 寵物異常貼文列表頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/abnormal-posts" 
          element={isUserAuthenticated ? <PetAbnormalPostsPage /> : <Navigate to="/" />} 
        />
        {/* 異常貼文詳細頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/abnormal-post/:postId" 
          element={isUserAuthenticated ? <AbnormalPostDetailPage /> : <Navigate to="/" />} 
        />
        {/* 公開異常貼文詳細頁面：未登入導向HomePage */}
        <Route 
          path="/abnormal-post/:postId/public" 
          element={isUserAuthenticated ? <AbnormalPostDetailPage /> : <Navigate to="/" />} 
        />
        {/* 編輯異常記錄頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/abnormal-post/:postId/edit" 
          element={isUserAuthenticated ? <EditAbnormalPostPage /> : <Navigate to="/" />} 
        />
        {/* 創建貼文頁面：未登入導向HomePage */}
        <Route 
          path="/create-post" 
          element={isUserAuthenticated ? <CreatePostPage /> : <Navigate to="/" />} 
        />
        {/* 創建異常記錄頁面：未登入導向HomePage */}
        <Route 
          path="/create-abnormal-post" 
          element={isUserAuthenticated ? <CreateAbnormalPostPage /> : <Navigate to="/" />} 
        />
        {/* 貼文預覽頁面：未登入導向HomePage */}
        <Route 
          path="/create-post-preview" 
          element={isUserAuthenticated ? <PostPreviewPage /> : <Navigate to="/" />} 
        />
        {/* 編輯貼文頁面：未登入導向HomePage */}
        <Route
          path="/post/:postId/edit"
          element={isUserAuthenticated ? <EditPostPage /> : <Navigate to="/" />}
        />
        {/* 貼文詳情頁面：未登入導向HomePage */}
        <Route
          path="/post/:postId"
          element={isUserAuthenticated ? <PostDetailPage /> : <Navigate to="/" />}
        />
        {/* 未定義路徑：根據登入狀態重定向 */}
        <Route 
          path="*" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <Navigate to="/" />} 
        />
        {/* 計算機頁面：未登入導向HomePage */}
        <Route 
          path="/calculator" 
          element={isUserAuthenticated ? <CalculatorPage /> : <Navigate to="/" />}
        />
        {/* 飼料頁面：未登入導向HomePage */}
        <Route 
          path="/feeds" 
          element={isUserAuthenticated ? <FeedPage /> : <Navigate to="/" />} 
        />
        {/* 飼料詳情頁面：未登入導向HomePage */}
        <Route 
          path="/feeds/:id" 
          element={isUserAuthenticated ? <FeedDetailPage /> : <Navigate to="/" />} 
        />
        {/* 我的精選飼料頁面：未登入導向HomePage */}
        <Route 
          path="/feeds/my-marked" 
          element={isUserAuthenticated ? <MarkedFeedsPage /> : <Navigate to="/" />} 
        />
        {/* 所有飼料頁面：未登入導向HomePage */}
        <Route 
          path="/feeds/all" 
          element={isUserAuthenticated ? <AllFeedsPage /> : <Navigate to="/" />} 
        />
        {/* 飼料搜尋結果頁面：未登入導向HomePage */}
        <Route 
          path="/feeds/search" 
          element={isUserAuthenticated ? <FeedSearchResultPage /> : <Navigate to="/" />} 
        />
        {/* 健康報告列表頁面 */}
        <Route
          path="/pet/:petId/health-reports"
          element={isUserAuthenticated ? <HealthReportsPage /> : <Navigate to="/" />}
        />
        {/* 健康報告上傳頁面 */}
        <Route
          path="/pet/:petId/health-report/upload"
          element={isUserAuthenticated ? <HealthReportUploadPage /> : <Navigate to="/" />}
        />
        {/* 健康報告編輯頁面 */}
        <Route
          path="/pet/:petId/health-report/:id/edit"
          element={isUserAuthenticated ? <HealthReportEditPage /> : <Navigate to="/" />}
        />
        {/* 健康報告詳情頁面 */}
        <Route
          path="/pet/:petId/health-report/:id"
          element={isUserAuthenticated ? <HealthReportDetailPage /> : <Navigate to="/" />}
        />
        {/* 互動城市頁面 */}
        <Route 
          path="/interactive-city" 
          element={isUserAuthenticated ? <InteractiveCityPage /> : <Navigate to="/" />} 
        />
        {/* 站點詳情頁面 */}
        <Route
          path="/checkpoint/:id"
          element={isUserAuthenticated ? <CheckpointDetailPage /> : <Navigate to="/" />}
        />
      </Routes>

      {/* 教學模式管理組件 - 使用 TutorialContext */}
      <TutorialManager />

      {/* 全局浮動 AI 頭像 - 最高層級 */}
      {isUserAuthenticated && <GlobalFloatingAI user={currentUser} />}
    </BrowserRouter>
      </TutorialProvider>
    </UserProvider>
  );
};

export default App; 