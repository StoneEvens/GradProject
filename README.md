# GradProject
政大資管111第7組畢專

## 📁 專案前端資料夾結構說明
1. 所有頁面皆以資料夾區分，每個頁面建立一個獨立資料夾（例如：`src/LoginPage/`和`src/RegisterPage/`）。
2. 通用元件如 `Header` 和 `BottomNavigationBar` 統一放置於 `src/components/` 資料夾中，便於跨頁面重用與維護。
3. 所有按鈕圖片統一儲存於 `src/assets/icon/`，使用相對路徑引入，例如：
   import calculatorIcon from '../assets/icon/BottomButton_Calculator.png'
4. 全域配置與進入點檔案統一放在 src/ 根目錄中，包含：
    App.jsx       // 設定路由、頁面主結構
    App.css       // 全域 App 外觀樣式
    index.css     // 全域重置與排版設定
    main.jsx      // React 進入點
