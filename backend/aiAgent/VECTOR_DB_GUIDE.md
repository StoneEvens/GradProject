# 向量資料庫完整指南

## 📊 資料庫總覽

系統現在支援 **6 種向量資料庫**：

| 資料庫 | 檔案前綴 | 用途 | 狀態 |
|--------|---------|------|------|
| **社交貼文** | `social_post` | 推薦相關貼文 | ✅ 已存在 |
| **論壇貼文** | `forum_post` | 推薦相關文章 | ✅ 已存在 |
| **使用者** | `user` | 推薦相似用戶 | 🆕 新增 |
| **寵物** | `pet` | 推薦相似寵物 | 🆕 新增 |
| **飼料** | `feed` | 飼料諮詢推薦 | 🆕 新增 |
| **系統操作** | `system_operation` | 系統操作諮詢 | 🆕 新增 |

## 🏗️ 架構設計

### 基礎類別層次

```
BaseVectorDBManager (抽象基礎類別)
├── 共用功能
│   ├── 載入/儲存 .npy 檔案
│   ├── 向量搜尋 (FAISS)
│   ├── 添加/刪除項目
│   └── 統計資訊
├── UserVectorDB (使用者資料庫)
├── PetVectorDB (寵物資料庫)
├── FeedVectorDB (飼料資料庫)
└── SystemOperationVectorDB (系統操作資料庫)
```

### VectorService 整合

```python
VectorService
├── user_db → UserVectorDB
├── pet_db → PetVectorDB
├── feed_db → FeedVectorDB
├── system_operation_db → SystemOperationVectorDB
└── recommendation_service → 現有 BERT + FAISS 服務
```

## 🚀 快速開始

### 1. 初始化所有向量資料庫

```bash
cd /mnt/c/Users/leo/PetApp/GradProject/backend

# 初始化所有資料庫
python manage.py init_vector_dbs

# 只初始化特定資料庫
python manage.py init_vector_dbs --db user
python manage.py init_vector_dbs --db pet
python manage.py init_vector_dbs --db feed
python manage.py init_vector_dbs --db system

# 強制重建現有資料庫
python manage.py init_vector_dbs --rebuild
```

### 2. 檢查資料庫狀態

初始化完成後，會產生以下檔案：

```
backend/
├── social_post_embs.npy      ✅ (已存在)
├── social_post_ids.npy       ✅ (已存在)
├── forum_post_embs.npy       ✅ (已存在)
├── forum_post_ids.npy        ✅ (已存在)
├── user_embs.npy             🆕 (新建)
├── user_ids.npy              🆕 (新建)
├── user_metadata.npy         🆕 (新建)
├── pet_embs.npy              🆕 (新建)
├── pet_ids.npy               🆕 (新建)
├── pet_metadata.npy          🆕 (新建)
├── feed_embs.npy             🆕 (新建)
├── feed_ids.npy              🆕 (新建)
├── feed_metadata.npy         🆕 (新建)
├── system_operation_embs.npy 🆕 (新建)
├── system_operation_ids.npy  🆕 (新建)
└── system_operation_metadata.npy 🆕 (新建)
```

## 📝 各資料庫詳細說明

### 1. 使用者向量資料庫 (UserVectorDB)

**用途**: 根據使用者資訊推薦相似用戶

**嵌入內容**:
- 使用者名稱 + 全名
- 自我介紹 (bio)
- 寵物資訊（名稱、類型、品種）

**範例查詢**:
```
"推薦養布偶貓的用戶"
"有沒有同樣養吉娃娃的朋友"
```

**metadata 包含**:
```python
{
    'username': 'user_account',
    'fullname': 'user_fullname',
    'privacy': 'public'
}
```

**資料來源**: `social.models.CustomUser` (僅公開帳號)

---

### 2. 寵物向量資料庫 (PetVectorDB)

**用途**: 推薦相似寵物、寵物搜尋

**嵌入內容**:
- 名稱 + 類型 + 品種
- 年齡 + 性別
- 特徵描述
- 健康狀況

**範例查詢**:
```
"有沒有類似的貓咪"
"推薦同品種的寵物"
```

**metadata 包含**:
```python
{
    'name': 'pet_name',
    'type': 'cat/dog',
    'owner': 'owner_username'
}
```

**資料來源**: `pets.models.Pet`

---

### 3. 飼料向量資料庫 (FeedVectorDB)

**用途**: 飼料諮詢、品牌比較、營養建議

**嵌入內容**:
- 品牌 + 產品名稱
- 適用對象（貓/狗、年齡階段）
- 適用狀況（肝臟疾病、減重等）
- 主要成分
- 產品特色

**範例查詢**:
```
"推薦老貓肝臟保健的飼料"
"Toma-Pro 和耐吉斯哪個比較好"
"適合減重的飼料"
```

**內建飼料資料**:
1. Toma-Pro 優格高齡貓 化毛高纖配方
2. 耐吉斯 成貓高蛋白配方
3. Royal Canin 幼貓成長配方
4. Hill's 處方糧 減重配方
5. Orijen 六種鮮魚配方
6. Purina Pro Plan 腸胃保健配方

**metadata 包含完整飼料資訊**:
```python
{
    'brand': 'Toma-Pro',
    'product_name': '...',
    'pet_type': '貓',
    'life_stage': '高齡',
    'suitable_for': [...],
    'protein': 32,
    'fat': 12,
    ...
}
```

**資料來源**: 預定義飼料資料（未來可從資料表載入）

---

### 4. 系統操作資訊向量資料庫 (SystemOperationVectorDB)

**用途**:
- 系統操作代理（查找記錄、設置提醒）
- 功能諮詢（如何使用某功能）
- 教學引導

**嵌入內容**:
- 操作名稱 + 描述
- 關鍵字
- 使用情境範例

**範例查詢**:
```
"幫我找異常記錄"
"如何標註寵物"
"設定餵食提醒"
```

**內建操作資料**:
1. 查找異常記錄 (findAbnormalPosts)
2. 查找健康記錄 (findHealthRecords)
3. 設置餵食提醒 (setFeedingReminder)
4. 搜尋附近醫院 (searchNearbyHospitals)
5. 發布貼文教學 (createPost)
6. 標註寵物教學 (tagPet)
7. 設置提醒教學 (setReminder)
8. 健康記錄管理教學 (healthRecord)
9. 使用營養計算機 (useCalculator)

**metadata 包含完整操作資訊**:
```python
{
    'operation_type': 'findAbnormalPosts',
    'required_params': ['petId'],
    'api_endpoint': '/api/v1/pets/abnormal-records/',
    'tutorial_type': None  # 或教學類型
}
```

## 🔄 使用方式

### 在 VectorService 中使用

```python
from aiAgent.services.vector_service import VectorService

vector_service = VectorService()

# 1. 搜尋相似用戶
user_results = vector_service.user_db.search(
    query_embedding,
    top_k=5,
    min_similarity=0.3
)

# 2. 搜尋飼料
feed_results = vector_service.feed_db.search(
    query_embedding,
    top_k=5,
    min_similarity=0.3
)

# 3. 搜尋系統操作
operation_results = vector_service.system_operation_db.search(
    query_embedding,
    top_k=3,
    min_similarity=0.5
)
```

### 動態添加/刪除項目

```python
# 添加新使用者
vector_service.user_db.add_item(
    item_id=123,
    text="新使用者的資訊...",
    metadata={'username': 'newuser', ...}
)

# 刪除使用者
vector_service.user_db.delete_item(item_id=123)

# 添加新寵物
vector_service.pet_db.add_item(
    item_id=456,
    text="新寵物的資訊...",
    metadata={'name': 'Fluffy', ...}
)
```

## 📊 向量檢索流程

```
使用者輸入: "推薦老貓肝臟保健的飼料"
        ↓
IntentService 識別意圖: feeding
        ↓
VectorService._handle_feeding_intent()
        ↓
生成查詢向量 (BERT embedding)
        ↓
feed_db.search(query_embedding, top_k=5)
        ↓
FAISS 相似度搜尋
        ↓
返回: [
    {
        'id': 1,
        'similarity': 0.87,
        'metadata': {
            'brand': 'Toma-Pro',
            'suitable_for': ['肝臟疾病', ...],
            ...
        }
    },
    ...
]
        ↓
OpenAI 生成友善回應
```

## 🛠️ 維護與更新

### 更新使用者資料庫

當有新使用者註冊或資訊變更時：

```bash
# 重建使用者資料庫
python manage.py init_vector_dbs --db user --rebuild
```

### 更新寵物資料庫

當有新寵物添加或資訊變更時：

```bash
# 重建寵物資料庫
python manage.py init_vector_dbs --db pet --rebuild
```

### 更新飼料資料

修改 `vector_db_implementations.py` 中的 `FeedVectorDB.get_feed_database()`，然後：

```bash
python manage.py init_vector_dbs --db feed --rebuild
```

### 更新系統操作資料

修改 `vector_db_implementations.py` 中的 `SystemOperationVectorDB.get_operations_database()`，然後：

```bash
python manage.py init_vector_dbs --db system --rebuild
```

## 🔍 監控與統計

### 獲取資料庫統計

```python
stats = vector_service.user_db.get_stats()
# 返回:
{
    'name': 'user',
    'total_items': 150,
    'embedding_dim': 768,
    'has_metadata': True,
    'file_exists': True
}
```

### 檢查所有資料庫狀態

```bash
curl http://localhost:8000/api/v1/ai/health/
```

## 🎯 最佳實踐

### 1. 定期更新
- 每週重建使用者和寵物資料庫
- 有新飼料資料時立即更新
- 系統操作資料視功能更新而更新

### 2. 相似度閾值設定
- 使用者/寵物推薦: `min_similarity=0.3`
- 飼料推薦: `min_similarity=0.3`
- 系統操作: `min_similarity=0.5` (要求更精確匹配)

### 3. 資料品質
- 確保文本資訊完整（避免空字串）
- metadata 包含足夠的過濾資訊
- 定期清理無效或過時資料

## 🚨 故障排除

### 資料庫未載入

**問題**: 找不到向量資料庫檔案

**解決**:
```bash
python manage.py init_vector_dbs --db all
```

### 搜尋結果為空

**問題**: 資料庫為空或查詢向量生成失敗

**檢查**:
1. 確認 .npy 檔案存在且非空
2. 檢查 BERT 模型是否正常載入
3. 降低 min_similarity 閾值

### 記憶體不足

**問題**: 向量資料庫太大

**解決**:
- 使用延遲載入（已實作）
- 定期清理舊資料
- 考慮使用 FAISS 的壓縮索引

## 📚 相關文件

- [AI Agent 完整架構](/AI_AGENT_ARCHITECTURE.md)
- [快速啟動指南](/backend/aiAgent/QUICKSTART.md)
- [完整文檔](/backend/aiAgent/README.md)