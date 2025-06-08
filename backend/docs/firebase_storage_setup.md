# Firebase Storage 設定指南

## 概述

本專案已將圖片儲存從本地檔案系統遷移至 Firebase Storage，提供更好的擴展性和可靠性。

## 設定步驟

### 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Storage 服務

### 2. 設定 Storage 規則

在 Firebase Console 的 Storage 規則中設定：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 允許讀取所有圖片
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // 只允許已驗證用戶上傳
    match /avatars/{userId}/{fileName} {
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /pets/{userId}/{petId}/{photoType}/{fileName} {
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /feeds/{fileName} {
      allow write: if request.auth != null;
    }
  }
}
```

### 3. 下載服務帳戶金鑰

1. 在 Firebase Console 中前往「專案設定」→「服務帳戶」
2. 點擊「產生新的私密金鑰」
3. 下載 JSON 檔案並重新命名為 `firebase-credentials.json`
4. 將檔案放置在 `backend/config/` 目錄下

### 4. 安裝 Firebase Admin SDK

```bash
pip install firebase-admin
```

### 5. 更新 Django 設定

在 `backend/gradProject/settings.py` 中取消註解並設定：

```python
# Firebase Storage 配置
FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, 'config', 'firebase-credentials.json')
FIREBASE_STORAGE_BUCKET = 'your-project-id.appspot.com'  # 替換為您的專案 ID
```

### 6. 更新 Firebase 服務

在 `backend/utils/firebase_service.py` 中取消註解 Firebase 相關程式碼：

```python
def __init__(self):
    """初始化 Firebase Storage 服務"""
    import firebase_admin
    from firebase_admin import credentials, storage
    
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {
            'storageBucket': settings.FIREBASE_STORAGE_BUCKET
        })
    
    self.bucket = storage.bucket()
```

### 7. 執行資料庫遷移

```bash
python manage.py migrate
```

## 檔案結構

Firebase Storage 中的檔案將按以下結構組織：

```
your-bucket/
├── avatars/
│   └── user_{user_id}/
│       └── {unique_filename}.{ext}
├── pets/
│   └── user_{user_id}/
│       └── pet_{pet_id}/
│           ├── headshot/
│           │   └── {unique_filename}.{ext}
│           └── general/
│               └── {unique_filename}.{ext}
└── feeds/
    └── {unique_filename}.{ext}
```

## API 端點

### 圖片列表
- **GET** `/api/v1/media/images/`
- 查詢參數：
  - `content_type_id`: 內容類型 ID
  - `object_id`: 對象 ID

### 圖片上傳
- **POST** `/api/v1/media/upload/` - 通用圖片上傳
- **POST** `/api/v1/media/avatar/` - 用戶頭像上傳
- **POST** `/api/v1/media/pets/{pet_id}/photos/` - 寵物照片上傳

### 圖片刪除
- **DELETE** `/api/v1/media/images/{image_id}/`

## 注意事項

1. **安全性**：確保 `firebase-credentials.json` 不被提交到版本控制系統
2. **權限**：Storage 規則已設定為只允許檔案擁有者修改檔案
3. **檔案大小**：目前限制為 5MB，可在 `FirebaseStorageService` 中調整
4. **支援格式**：jpg, jpeg, png, gif, webp

## 故障排除

### 常見錯誤

1. **權限錯誤**：檢查 Firebase 規則和服務帳戶權限
2. **檔案大小錯誤**：確認檔案未超過 5MB 限制
3. **格式錯誤**：確認檔案格式在支援列表中

### 日誌檢查

查看 Django 日誌檔案：
```bash
tail -f backend/logs/django.log
```

## 開發模式

在開發階段，Firebase 服務會返回模擬 URL。要啟用實際的 Firebase Storage，請：

1. 完成上述所有設定步驟
2. 在 `firebase_service.py` 中取消註解實際的 Firebase 程式碼
3. 註解掉模擬程式碼

## 生產環境部署

1. 確保 Firebase 專案已設定為生產模式
2. 更新 Storage 規則以符合生產環境需求
3. 設定適當的 CORS 規則
4. 考慮設定 CDN 以提升效能 