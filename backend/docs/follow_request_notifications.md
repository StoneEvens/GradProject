# 追蹤請求通知系統

## 概述

此系統實現了追蹤請求的通知機制，當使用者向私人帳戶發送追蹤請求時，會自動為被請求者建立通知，並在請求被取消時自動刪除相關通知。

## 功能特點

### 1. 自動通知建立
- 當使用者向私人帳戶發送追蹤請求時，系統會自動建立一個 `follow_request` 類型的通知
- 通知內容為：`{發送者帳號} 希望追蹤您`
- 通知會關聯到發送請求的使用者和相關的追蹤關係

### 2. 自動通知清理
- 當發送者在請求被接受前取消追蹤時，相關的通知會自動被刪除
- 確保不會有過期或無效的通知殘留

### 3. 請求回應處理
- 被請求者可以接受或拒絕追蹤請求
- 接受：確認追蹤關係並刪除通知
- 拒絕：刪除追蹤關係和通知

## 資料庫變更

### Notification 模型新增欄位
- `follow_request_from`: 發送追蹤請求的使用者（ForeignKey）
- `related_follow`: 相關的追蹤關係（ForeignKey to UserFollow）
- 新增通知類型：`follow_request`

## API 端點

### 通知管理 API

#### 獲取通知列表
```
GET /accounts/notifications/
```
回傳當前使用者的所有通知，包含未讀數量統計。

#### 標記單個通知為已讀
```
PATCH /accounts/notifications/{notification_id}/read/
```

#### 標記所有通知為已讀
```
PATCH /accounts/notifications/read-all/
```

#### 回應追蹤請求
```
POST /accounts/notifications/{notification_id}/follow-request/
```
請求體：
```json
{
  "action": "accept" // 或 "reject"
}
```

### 修改的追蹤 API

#### 發送/取消追蹤請求
- `POST /accounts/follow/{user_id}/`
- `POST /accounts/follow/{user_account}/`

這些 API 已被修改以支援通知的自動建立和刪除。

## 前端整合建議

### 1. 通知顯示
- 在頁面頂部導航欄顯示未讀通知數量
- 建立通知頁面列出所有通知
- 區分不同類型的通知並提供適當的操作按鈕

### 2. 追蹤請求處理
- 在通知頁面對追蹤請求通知提供「接受」和「拒絕」按鈕
- 處理完畢後更新通知列表和追蹤狀態

### 3. 即時更新
- 考慮使用 WebSocket 或定期輪詢來即時更新通知
- 當有新的追蹤請求時即時顯示

## 使用流程

### 發送追蹤請求
1. 使用者 A 向私人帳戶使用者 B 發送追蹤請求
2. 系統建立 UserFollow 關係（confirm_or_not=False）
3. 系統為使用者 B 建立追蹤請求通知
4. 使用者 B 可在通知頁面看到請求

### 取消追蹤請求
1. 使用者 A 在請求被接受前取消追蹤
2. 系統刪除相關通知
3. 系統刪除 UserFollow 關係

### 回應追蹤請求
1. 使用者 B 在通知頁面看到追蹤請求
2. 選擇接受或拒絕
3. 接受：確認追蹤關係，刪除通知
4. 拒絕：刪除追蹤關係和通知

## 注意事項

### 1. 資料庫遷移
執行以下指令來應用資料庫變更：
```bash
python manage.py makemigrations accounts
python manage.py migrate
```

### 2. 公開帳戶處理
- 對公開帳戶的追蹤請求不會建立通知
- 追蹤關係會直接被確認（confirm_or_not=True）

### 3. 效能考量
- 通知查詢已優化，使用 `select_related` 預載入相關資料
- 考慮對大量通知進行分頁處理

## 擴展可能性

### 1. 其他通知類型
可擴展支援更多通知類型：
- 貼文被按讚
- 新增評論
- 系統公告等

### 2. 通知偏好設定
允許使用者設定哪些類型的通知要接收

### 3. 推送通知
整合行動裝置推送通知服務 